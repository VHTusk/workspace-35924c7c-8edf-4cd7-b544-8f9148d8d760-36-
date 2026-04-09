import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import { ContractStatus } from "@prisma/client";

// GET - Get all contracts for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get("session_token")?.value || ""
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where clause
    const where: Record<string, unknown> = { organizationId: orgId };
    if (status && ["PENDING", "ACTIVE", "EXPIRED", "TERMINATED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    // Get contracts
    const contracts = await db.playerContract.findMany({
      where,
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get stats
    const now = new Date();
    const stats = {
      pending: await db.playerContract.count({
        where: { organizationId: orgId, status: "PENDING" },
      }),
      active: await db.playerContract.count({
        where: {
          organizationId: orgId,
          status: "ACTIVE",
          endDate: { gte: now },
        },
      }),
      expired: await db.playerContract.count({
        where: { organizationId: orgId, status: "EXPIRED" },
      }),
      terminated: await db.playerContract.count({
        where: { organizationId: orgId, status: "TERMINATED" },
      }),
    };

    return NextResponse.json({
      contracts: contracts.map((c) => ({
        id: c.id,
        player: {
          id: c.player.id,
          firstName: c.player.firstName,
          lastName: c.player.lastName,
          name: `${c.player.firstName} ${c.player.lastName}`,
          email: c.player.email,
          phone: c.player.phone,
          elo: c.player.hiddenElo,
          points: c.player.visiblePoints,
          playerOrgType: c.player.playerOrgType,
          verificationStatus: c.player.verificationStatus,
          city: c.player.city,
          state: c.player.state,
        },
        contractTitle: c.contractTitle,
        contractType: c.contractType,
        contractTerms: c.contractTerms,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        contractDocumentUrl: c.contractDocumentUrl,
        verifiedAt: c.verifiedAt,
        rejectionReason: c.rejectionReason,
        createdAt: c.createdAt,
        // Calculate days remaining for active contracts
        daysRemaining:
          c.status === "ACTIVE"
            ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : null,
      })),
      stats,
    });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new contract
export async function POST(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get("session_token")?.value || ""
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org.id;
    const body = await request.json();
    const {
      playerId,
      contractTitle,
      contractType,
      contractTerms,
      startDate,
      endDate,
      contractDocumentUrl,
    } = body;

    // Validate required fields
    if (!playerId || !contractTitle || !contractType || !contractTerms || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: playerId, contractTitle, contractType, contractTerms, startDate, endDate" },
        { status: 400 }
      );
    }

    // Check if player exists
    const player = await db.user.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Check if player is already verified for this org
    if (player.affiliatedOrgId !== orgId) {
      return NextResponse.json(
        { error: "Player must be verified for this organization before creating a contract" },
        { status: 400 }
      );
    }

    // Check for existing active/pending contract
    const existingContract = await db.playerContract.findFirst({
      where: {
        playerId,
        organizationId: orgId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
    });

    if (existingContract) {
      return NextResponse.json(
        { error: "Player already has an active or pending contract with this organization" },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    // Create contract
    const contract = await db.playerContract.create({
      data: {
        playerId,
        organizationId: orgId,
        contractTitle,
        contractType,
        contractTerms,
        startDate: start,
        endDate: end,
        contractDocumentUrl,
        status: ContractStatus.PENDING,
        createdById: session.userId || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contract created and submitted for admin verification",
      contract: {
        id: contract.id,
        status: contract.status,
        createdAt: contract.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
