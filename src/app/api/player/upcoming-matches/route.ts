import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { SportType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;
    const userId = user.id;

    // Get sport from query parameter
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get("sport");
    const sport = sportParam?.toUpperCase() as SportType | null;

    // Find upcoming matches from bracket matches where the player is involved
    // and the match status is PENDING (not yet played)
    const upcomingBracketMatches = await db.bracketMatch.findMany({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
        status: "PENDING",
        bracket: {
          tournament: {
            status: { in: ["IN_PROGRESS", "BRACKET_GENERATED"] },
            // Filter by sport if provided
            ...(sport ? { sport } : {}),
          },
        },
      },
      include: {
        bracket: {
          include: {
            tournament: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: [
        { roundNumber: "asc" },
        { matchNumber: "asc" },
      ],
      take: 10,
    });

    // Get player info separately
    const playerIds = new Set<string>();
    upcomingBracketMatches.forEach((bm) => {
      if (bm.playerAId) playerIds.add(bm.playerAId);
      if (bm.playerBId) playerIds.add(bm.playerBId);
    });

    const players = await db.user.findMany({
      where: { id: { in: Array.from(playerIds) } },
      select: { id: true, firstName: true, lastName: true },
    });

    const playerMap = new Map(players.map(p => [p.id, p]));

    // Format matches for response
    const upcomingMatches = upcomingBracketMatches.map((bm) => {
      const isPlayerA = bm.playerAId === userId;
      const opponentId = isPlayerA ? bm.playerBId : bm.playerAId;
      const opponent = opponentId ? playerMap.get(opponentId) : null;

      // Calculate round name
      const totalRounds = bm.bracket.totalRounds;
      const roundName = getRoundName(bm.roundNumber, totalRounds);

      return {
        id: bm.id,
        opponent: opponent
          ? `${opponent.firstName} ${opponent.lastName}`
          : "TBD",
        opponentId: opponentId || null,
        tournament: bm.bracket.tournament.name,
        tournamentId: bm.bracket.tournament.id,
        round: roundName,
        roundNumber: bm.roundNumber,
        matchNumber: bm.matchNumber,
        time: bm.scheduledAt?.toISOString() || null,
        court: bm.courtAssignment || null,
        bracketSide: bm.bracketSide || null,
      };
    });

    return NextResponse.json({
      matches: upcomingMatches,
      count: upcomingMatches.length,
    });
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming matches" },
      { status: 500 }
    );
  }
}

// Helper function to get round name
function getRoundName(roundNumber: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundNumber + 1;

  if (roundsFromEnd === 1) return "Final";
  if (roundsFromEnd === 2) return "Semi Final";
  if (roundsFromEnd === 3) return "Quarter Final";
  if (roundsFromEnd === 4) return "Round of 16";

  return `Round ${roundNumber}`;
}
