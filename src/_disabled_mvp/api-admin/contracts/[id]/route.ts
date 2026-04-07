import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedDirector } from "@/lib/auth";
import { Role, ContractStatus, PlayerOrgType } from "@prisma/client";

// GET - Get specific contract details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;

    const contract = await db.playerContract.findUnique({
      where: { id },
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
            verificationStatus: true,
            city: true,
            state: true,
            affiliatedOrgId: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({
      contract: {
        id: contract.id,
        player: {
          id: contract.player.id,
          name: `${contract.player.firstName} ${contract.player.lastName}`,
          firstName: contract.player.firstName,
          lastName: contract.player.lastName,
          email: contract.player.email,
          phone: contract.player.phone,
          elo: contract.player.hiddenElo,
          points: contract.player.visiblePoints,
          playerOrgType: contract.player.playerOrgType,
          verificationStatus: contract.player.verificationStatus,
          city: contract.player.city,
          state: contract.player.state,
        },
        organization: {
          id: contract.organization.id,
          name: contract.organization.name,
          type: contract.organization.type,
          city: contract.organization.city,
          state: contract.organization.state,
        },
        contractTitle: contract.contractTitle,
        contractType: contract.contractType,
        contractTerms: contract.contractTerms,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        contractDocumentUrl: contract.contractDocumentUrl,
        verifiedBy: contract.verifiedBy,
        verifiedAt: contract.verifiedAt,
        rejectionReason: contract.rejectionReason,
        createdById: contract.createdById,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Verify or reject a contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!action || !["verify", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Use 'verify' or 'reject'" }, { status: 400 });
    }

    // Get the contract
    const contract = await db.playerContract.findUnique({
      where: { id },
      include: { player: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "PENDING") {
      return NextResponse.json({ error: "This contract has already been processed" }, { status: 400 });
    }

    if (action === "verify") {
      // Update contract status
      await db.playerContract.update({
        where: { id },
        data: {
          status: ContractStatus.ACTIVE,
          verifiedBy: user.id,
          verifiedAt: new Date(),
        },
      });

      // Update player's org type to CONTRACTED
      await db.user.update({
        where: { id: contract.playerId },
        data: {
          playerOrgType: PlayerOrgType.CONTRACTED,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Contract verified successfully. Player is now a contracted player.",
      });
    } else {
      // Reject contract
      await db.playerContract.update({
        where: { id },
        data: {
          status: ContractStatus.REJECTED,
          verifiedBy: user.id,
          verifiedAt: new Date(),
          rejectionReason: rejectionReason || "Not specified",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Contract rejected",
      });
    }
  } catch (error) {
    console.error("Error processing contract:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
