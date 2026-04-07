import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";

// POST - Submit team selection for an inter-org tournament
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

    // Get team selection
    const teamSelection = await db.interOrgTeamSelection.findUnique({
      where: {
        tournamentId_organizationId: {
          tournamentId,
          organizationId: orgId,
        },
      },
      include: {
        players: true,
      },
    });

    if (!teamSelection) {
      return NextResponse.json(
        { error: "No team selection found. Please select players first." },
        { status: 400 }
      );
    }

    if (teamSelection.players.length === 0) {
      return NextResponse.json(
        { error: "No players selected. Please select at least one player." },
        { status: 400 }
      );
    }

    if (teamSelection.isSubmitted) {
      return NextResponse.json(
        { error: "Team selection has already been submitted." },
        { status: 400 }
      );
    }

    // Submit team selection
    await db.interOrgTeamSelection.update({
      where: { id: teamSelection.id },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });

    // Create tournament registrations for selected players
    // FIXED: Batch operation instead of N+1 loop
    const playerIds = teamSelection.players.map(p => p.playerId);

    // Get existing registrations in a single query
    const existingRegistrations = await db.tournamentRegistration.findMany({
      where: {
        tournamentId,
        userId: { in: playerIds },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existingRegistrations.map(r => r.userId));

    // Filter to only players that need new registrations
    const newPlayerIds = playerIds.filter(id => !existingUserIds.has(id));

    // Batch create registrations for new players
    if (newPlayerIds.length > 0) {
      await db.tournamentRegistration.createMany({
        data: newPlayerIds.map(playerId => ({
          tournamentId,
          userId: playerId,
          status: "CONFIRMED",
          amount: 0, // Inter-org tournaments might have different fee structure
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Team selection submitted successfully",
      teamSelection: {
        id: teamSelection.id,
        playerCount: teamSelection.players.length,
        submittedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error submitting team selection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
