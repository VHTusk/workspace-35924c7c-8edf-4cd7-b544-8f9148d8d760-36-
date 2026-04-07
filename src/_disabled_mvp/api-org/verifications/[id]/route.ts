import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";

// POST - Verify or reject a player's ID verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateOrgSession(
      request.cookies.get("session_token")?.value || ""
    );

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, notes } = body;

    if (!action || !["verify", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Use 'verify' or 'reject'" }, { status: 400 });
    }

    // Get the verification request
    const verification = await db.playerIdVerification.findFirst({
      where: { id, organizationId: orgId },
      include: { player: true },
    });

    if (!verification) {
      return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
    }

    if (verification.status !== "PENDING") {
      return NextResponse.json({ error: "This verification request has already been processed" }, { status: 400 });
    }

    if (action === "verify") {
      // Update verification status
      await db.playerIdVerification.update({
        where: { id },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          verifiedBy: session.operatorId || session.org.id,
        },
      });

      // Update player's verification status
      await db.user.update({
        where: { id: verification.playerId },
        data: {
          verificationStatus: "VERIFIED",
          orgVerifiedAt: new Date(),
          orgVerifiedBy: session.operatorId || session.org.id,
          verificationNotes: notes || null,
        },
      });

      // Add to roster if not already there
      const existingRoster = await db.orgRosterPlayer.findFirst({
        where: { userId: verification.playerId, orgId },
      });

      if (!existingRoster) {
        await db.orgRosterPlayer.create({
          data: {
            userId: verification.playerId,
            orgId,
            sport: verification.player.sport,
            isActive: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Player verified successfully",
        verification: {
          id,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });
    } else {
      // Reject verification
      await db.playerIdVerification.update({
        where: { id },
        data: {
          status: "REJECTED",
          verifiedAt: new Date(),
          verifiedBy: session.operatorId || session.org.id,
          rejectionReason: rejectionReason || "Not specified",
        },
      });

      // Update player's verification status
      await db.user.update({
        where: { id: verification.playerId },
        data: {
          verificationStatus: "REJECTED",
          verificationNotes: rejectionReason || notes || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Verification rejected",
        verification: {
          id,
          status: "REJECTED",
          rejectionReason,
        },
      });
    }
  } catch (error) {
    console.error("Error processing verification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Get specific verification details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateOrgSession(
      request.cookies.get("session_token")?.value || ""
    );

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { id } = await params;

    const verification = await db.playerIdVerification.findFirst({
      where: { id, organizationId: orgId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            hiddenElo: true,
            visiblePoints: true,
            playerOrgType: true,
            city: true,
            state: true,
            dob: true,
            gender: true,
          },
        },
      },
    });

    if (!verification) {
      return NextResponse.json({ error: "Verification not found" }, { status: 404 });
    }

    return NextResponse.json({
      verification: {
        id: verification.id,
        player: {
          id: verification.player.id,
          firstName: verification.player.firstName,
          lastName: verification.player.lastName,
          name: `${verification.player.firstName} ${verification.player.lastName}`,
          email: verification.player.email,
          phone: verification.player.phone,
          dob: verification.player.dob,
          gender: verification.player.gender,
          elo: verification.player.hiddenElo,
          points: verification.player.visiblePoints,
          playerOrgType: verification.player.playerOrgType,
          city: verification.player.city,
          state: verification.player.state,
        },
        documentUrl: verification.documentUrl,
        documentType: verification.documentType,
        status: verification.status,
        verifiedAt: verification.verifiedAt,
        verifiedBy: verification.verifiedBy,
        rejectionReason: verification.rejectionReason,
        createdAt: verification.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching verification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
