import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import { ContractStatus } from "@prisma/client";

// GET - Get specific contract details
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

    const contract = await db.playerContract.findFirst({
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
            verificationStatus: true,
            city: true,
            state: true,
            dob: true,
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
          firstName: contract.player.firstName,
          lastName: contract.player.lastName,
          name: `${contract.player.firstName} ${contract.player.lastName}`,
          email: contract.player.email,
          phone: contract.player.phone,
          dob: contract.player.dob,
          elo: contract.player.hiddenElo,
          points: contract.player.visiblePoints,
          playerOrgType: contract.player.playerOrgType,
          verificationStatus: contract.player.verificationStatus,
          city: contract.player.city,
          state: contract.player.state,
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
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Terminate a contract
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
    const { action, terminationReason } = body;

    if (action !== "terminate") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get the contract
    const contract = await db.playerContract.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only active contracts can be terminated" }, { status: 400 });
    }

    // Terminate contract
    await db.playerContract.update({
      where: { id },
      data: {
        status: ContractStatus.TERMINATED,
        rejectionReason: terminationReason || "Terminated by organization",
      },
    });

    // Update player's org type if they have no other active contracts
    const otherActiveContracts = await db.playerContract.count({
      where: {
        playerId: contract.playerId,
        status: "ACTIVE",
        id: { not: id },
      },
    });

    if (otherActiveContracts === 0 && contract.playerId) {
      // Set player to EMPLOYEE if they're still affiliated with the org
      const player = await db.user.findUnique({
        where: { id: contract.playerId },
      });

      if (player && player.affiliatedOrgId === orgId) {
        await db.user.update({
          where: { id: contract.playerId },
          data: { playerOrgType: "EMPLOYEE" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Contract terminated successfully",
    });
  } catch (error) {
    console.error("Error terminating contract:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
