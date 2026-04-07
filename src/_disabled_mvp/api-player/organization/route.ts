import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// GET - Get player's current organization status
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    // Get organization details if player belongs to one
    let organization = null;
    if (user.affiliatedOrgId) {
      organization = await db.organization.findUnique({
        where: { id: user.affiliatedOrgId },
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          state: true,
        },
      });
    }

    // Get active contract if any
    const activeContract = await db.playerContract.findFirst({
      where: {
        playerId: user.id,
        status: "ACTIVE",
        endDate: { gte: new Date() },
      },
      include: {
        organization: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Get pending verification request if any
    const pendingVerification = await db.playerIdVerification.findFirst({
      where: {
        playerId: user.id,
        status: "PENDING",
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      // Player org type
      playerOrgType: user.playerOrgType,
      verificationStatus: user.verificationStatus,
      
      // Organization details
      organization,
      affiliatedOrgId: user.affiliatedOrgId,
      
      // ID Verification
      idDocumentUrl: user.idDocumentUrl,
      idDocumentType: user.idDocumentType,
      orgVerifiedAt: user.orgVerifiedAt,
      verificationNotes: user.verificationNotes,
      
      // Pending verification request
      pendingVerification,
      
      // Active contract
      activeContract,
    });
  } catch (error) {
    console.error("Error fetching player organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Request to join an organization (with ID upload)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;
    const body = await request.json();
    
    // Accept either fileId (secure) or idDocumentUrl (legacy, will be validated)
    const { organizationId, fileId, idDocumentUrl, idDocumentType, playerOrgType } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Require either fileId or idDocumentUrl
    if (!fileId && !idDocumentUrl) {
      return NextResponse.json({ error: "ID document is required (provide fileId)" }, { status: 400 });
    }

    if (!idDocumentType) {
      return NextResponse.json({ error: "ID document type is required" }, { status: 400 });
    }

    // SECURITY: Validate file ownership if fileId provided
    let verifiedDocumentUrl: string;
    
    if (fileId) {
      // Look up the uploaded file and verify ownership
      const uploadedFile = await db.uploadedFile.findUnique({
        where: { id: fileId },
      });
      
      if (!uploadedFile) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      
      if (uploadedFile.deletedAt) {
        return NextResponse.json({ error: "Document has been deleted" }, { status: 400 });
      }
      
      // Verify ownership - must be owned by the current user
      if (uploadedFile.userId !== user.id) {
        return NextResponse.json({ 
          error: "Access denied - document does not belong to you" 
        }, { status: 403 });
      }
      
      // Verify purpose is appropriate
      if (uploadedFile.purpose !== 'idDocument' && uploadedFile.purpose !== 'general') {
        return NextResponse.json({ 
          error: "Invalid document type for ID verification" 
        }, { status: 400 });
      }
      
      // Use the canonical URL from our upload system
      verifiedDocumentUrl = uploadedFile.url;
      
    } else if (idDocumentUrl) {
      // LEGACY PATH: Validate that URL is from our system
      // Reject external URLs for security
      if (idDocumentUrl.startsWith('http://') || idDocumentUrl.startsWith('https://')) {
        // Check if it's our domain
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        if (!idDocumentUrl.startsWith(appUrl) && !idDocumentUrl.startsWith('/api/upload')) {
          return NextResponse.json({ 
            error: "External URLs are not allowed. Please upload your document through our system." 
          }, { status: 400 });
        }
      }
      
      // Extract file ID from URL if possible
      const fileIdMatch = idDocumentUrl.match(/\/api\/upload\/([a-zA-Z0-9]+)/);
      if (fileIdMatch) {
        const existingFile = await db.uploadedFile.findUnique({
          where: { id: fileIdMatch[1] },
        });
        
        if (existingFile && existingFile.userId !== user.id) {
          return NextResponse.json({ 
            error: "Access denied - document does not belong to you" 
          }, { status: 403 });
        }
      }
      
      verifiedDocumentUrl = idDocumentUrl;
    } else {
      return NextResponse.json({ error: "ID document is required" }, { status: 400 });
    }

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check if player already belongs to an organization
    if (user.affiliatedOrgId && user.affiliatedOrgId !== organizationId) {
      return NextResponse.json(
        { error: "You already belong to another organization. Please leave your current organization first." },
        { status: 400 }
      );
    }

    // Check if there's already a pending verification for this org
    const existingVerification = await db.playerIdVerification.findFirst({
      where: {
        playerId: user.id,
        organizationId,
        status: "PENDING",
      },
    });

    if (existingVerification) {
      return NextResponse.json(
        { error: "You already have a pending verification request for this organization" },
        { status: 400 }
      );
    }

    // Wrap both operations in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create verification request
      const verification = await tx.playerIdVerification.create({
        data: {
          playerId: user.id,
          organizationId,
          documentUrl: verifiedDocumentUrl,
          documentType: idDocumentType,
          status: "PENDING",
        },
      });

      // Update user's verification status and document info
      await tx.user.update({
        where: { id: user.id },
        data: {
          verificationStatus: "PENDING",
          idDocumentUrl: verifiedDocumentUrl,
          idDocumentType,
          affiliatedOrgId: organizationId, // Temporarily associate
          playerOrgType: playerOrgType || "EMPLOYEE",
        },
      });

      return verification;
    });

    return NextResponse.json({
      success: true,
      message: "Verification request submitted successfully",
      verification: {
        id: result.id,
        status: result.status,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting verification request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Leave organization
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    if (!user.affiliatedOrgId) {
      return NextResponse.json({ error: "You are not part of any organization" }, { status: 400 });
    }

    // Check for active contracts
    const activeContracts = await db.playerContract.count({
      where: {
        playerId: user.id,
        status: "ACTIVE",
        endDate: { gte: new Date() },
      },
    });

    if (activeContracts > 0) {
      return NextResponse.json(
        { error: "Cannot leave organization while you have active contracts. Please wait for contracts to expire or contact admin." },
        { status: 400 }
      );
    }

    // Wrap both operations in a transaction
    await db.$transaction(async (tx) => {
      // Remove from organization
      await tx.user.update({
        where: { id: user.id },
        data: {
          affiliatedOrgId: null,
          playerOrgType: "INDEPENDENT",
          verificationStatus: "NONE",
          idDocumentUrl: null,
          idDocumentType: null,
          orgVerifiedAt: null,
          orgVerifiedBy: null,
          verificationNotes: null,
        },
      });

      // Remove from roster
      await tx.orgRosterPlayer.deleteMany({
        where: {
          userId: user.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Successfully left the organization",
    });
  } catch (error) {
    console.error("Error leaving organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
