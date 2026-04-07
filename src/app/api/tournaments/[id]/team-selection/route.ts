import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import { PlayerOrgType } from "@prisma/client";

// GET - Get team selection for an inter-org tournament
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

    if (!session.org) {
      return NextResponse.json({ error: "Organization session required" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { id: tournamentId } = await params;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.type !== "INTER_ORG") {
      return NextResponse.json({ error: "This API is only for inter-organization tournaments" }, { status: 400 });
    }

    // Get organization's team selection
    const teamSelection = await db.interOrgTeamSelection.findUnique({
      where: {
        tournamentId_organizationId: {
          tournamentId,
          organizationId: orgId,
        },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                hiddenElo: true,
                visiblePoints: true,
                playerOrgType: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
    });

    // Get eligible roster (verified employees + active contracted players)
    const eligiblePlayers = await db.user.findMany({
      where: {
        affiliatedOrgId: orgId,
        verificationStatus: "VERIFIED",
        OR: [
          // Verified employees
          { playerOrgType: PlayerOrgType.EMPLOYEE },
          // Active contracted players
          {
            playerOrgType: PlayerOrgType.CONTRACTED,
            playerContracts: {
              some: {
                status: "ACTIVE",
                endDate: { gte: new Date() },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        hiddenElo: true,
        visiblePoints: true,
        playerOrgType: true,
        verificationStatus: true,
      },
    });

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        maxPlayersPerOrg: tournament.maxPlayersPerOrg,
      },
      teamSelection: teamSelection
        ? {
            id: teamSelection.id,
            isSubmitted: teamSelection.isSubmitted,
            submittedAt: teamSelection.submittedAt,
            selectedAt: teamSelection.selectedAt,
            players: teamSelection.players.map((p) => ({
              id: p.id,
              playerId: p.playerId,
              playerOrgType: p.playerOrgType,
              isCaptain: p.isCaptain,
              addedAt: p.addedAt,
              player: {
                id: p.player.id,
                name: `${p.player.firstName} ${p.player.lastName}`,
                firstName: p.player.firstName,
                lastName: p.player.lastName,
                email: p.player.email,
                elo: p.player.hiddenElo,
                points: p.player.visiblePoints,
                playerOrgType: p.player.playerOrgType,
              },
            })),
          }
        : null,
      eligiblePlayers: eligiblePlayers.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        elo: p.hiddenElo,
        points: p.visiblePoints,
        playerOrgType: p.playerOrgType,
        verificationStatus: p.verificationStatus,
      })),
    });
  } catch (error) {
    console.error("Error fetching team selection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create or update team selection
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

    if (!session.org) {
      return NextResponse.json({ error: "Organization session required" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { playerIds, captainId } = body;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.type !== "INTER_ORG") {
      return NextResponse.json({ error: "This API is only for inter-organization tournaments" }, { status: 400 });
    }

    // Check if registration is still open
    if (tournament.status !== "REGISTRATION_OPEN") {
      return NextResponse.json({ error: "Tournament registration is not open" }, { status: 400 });
    }

    // Validate max players
    if (tournament.maxPlayersPerOrg && playerIds.length > tournament.maxPlayersPerOrg) {
      return NextResponse.json(
        { error: `Maximum ${tournament.maxPlayersPerOrg} players allowed per organization` },
        { status: 400 }
      );
    }

    // Validate all players are eligible
    const eligiblePlayers = await db.user.findMany({
      where: {
        id: { in: playerIds },
        affiliatedOrgId: orgId,
        verificationStatus: "VERIFIED",
        OR: [
          { playerOrgType: PlayerOrgType.EMPLOYEE },
          {
            playerOrgType: PlayerOrgType.CONTRACTED,
            playerContracts: {
              some: {
                status: "ACTIVE",
                endDate: { gte: new Date() },
              },
            },
          },
        ],
      },
      select: { id: true, playerOrgType: true },
    });

    if (eligiblePlayers.length !== playerIds.length) {
      const foundIds = eligiblePlayers.map((p) => p.id);
      const invalidIds = playerIds.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json(
        { error: `Some players are not eligible: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Create player map for org types
    const playerMap = new Map(eligiblePlayers.map((p) => [p.id, p.playerOrgType]));

    // Upsert team selection
    const existingSelection = await db.interOrgTeamSelection.findUnique({
      where: {
        tournamentId_organizationId: {
          tournamentId,
          organizationId: orgId,
        },
      },
    });

    let teamSelection;

    if (existingSelection) {
      // Delete existing players
      await db.interOrgTeamPlayer.deleteMany({
        where: { teamSelectionId: existingSelection.id },
      });

      // Update selection with new players
      teamSelection = await db.interOrgTeamSelection.update({
        where: { id: existingSelection.id },
        data: {
          selectedBy: orgId,
          selectedAt: new Date(),
          players: {
            create: playerIds.map((playerId: string) => ({
              playerId,
              playerOrgType: playerMap.get(playerId) || PlayerOrgType.EMPLOYEE,
              isCaptain: playerId === captainId,
            })),
          },
        },
        include: {
          players: {
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new selection
      teamSelection = await db.interOrgTeamSelection.create({
        data: {
          tournamentId,
          organizationId: orgId,
          selectedBy: orgId,
          players: {
            create: playerIds.map((playerId: string) => ({
              playerId,
              playerOrgType: playerMap.get(playerId) || PlayerOrgType.EMPLOYEE,
              isCaptain: playerId === captainId,
            })),
          },
        },
        include: {
          players: {
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Team selection saved successfully",
      teamSelection: {
        id: teamSelection.id,
        playerCount: teamSelection.players.length,
        players: teamSelection.players.map((p) => ({
          playerId: p.playerId,
          name: `${p.player.firstName} ${p.player.lastName}`,
          isCaptain: p.isCaptain,
        })),
      },
    });
  } catch (error) {
    console.error("Error saving team selection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove team selection
export async function DELETE(
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

    if (!session.org) {
      return NextResponse.json({ error: "Organization session required" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { id: tournamentId } = await params;

    // Delete team selection
    const deleted = await db.interOrgTeamSelection.deleteMany({
      where: {
        tournamentId,
        organizationId: orgId,
        isSubmitted: false, // Can only delete if not submitted
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Team selection not found or already submitted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Team selection removed successfully",
    });
  } catch (error) {
    console.error("Error removing team selection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
