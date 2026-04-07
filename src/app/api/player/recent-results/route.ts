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

    // Get recent completed matches where the player was involved
    const recentMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
        // Get matches that have been played (have a winner)
        winnerId: { not: null },
        // Filter by sport if provided
        ...(sport ? { sport } : {}),
      },
      include: {
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
        tournament: {
          select: { id: true, name: true },
        },
      },
      orderBy: { playedAt: "desc" },
      take: 10,
    });

    // Format matches for response
    const recentResults = recentMatches.map((match) => {
      const isPlayerA = match.playerAId === userId;
      const opponent = isPlayerA ? match.playerB : match.playerA;
      const won = match.winnerId === userId;
      const myScore = isPlayerA ? match.scoreA : match.scoreB;
      const oppScore = isPlayerA ? match.scoreB : match.scoreA;
      const pointsEarned = isPlayerA ? match.pointsA : match.pointsB;

      return {
        id: match.id,
        opponent: opponent
          ? `${opponent.firstName} ${opponent.lastName}`
          : "Unknown",
        opponentId: opponent?.id || null,
        score: `${myScore || 0}-${oppScore || 0}`,
        myScore: myScore || 0,
        opponentScore: oppScore || 0,
        result: won ? "WIN" : "LOSS",
        tournament: match.tournament?.name || "Friendly Match",
        tournamentId: match.tournamentId,
        points: pointsEarned || 0,
        eloChange: isPlayerA ? match.eloChangeA || 0 : match.eloChangeB || 0,
        playedAt: match.playedAt.toISOString(),
        outcome: match.outcome || "PLAYED",
      };
    });

    return NextResponse.json({
      results: recentResults,
      count: recentResults.length,
    });
  } catch (error) {
    console.error("Error fetching recent results:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent results" },
      { status: 500 }
    );
  }
}
