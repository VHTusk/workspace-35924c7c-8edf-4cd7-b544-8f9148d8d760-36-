import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Check for export mode
    const isExport = searchParams.get("export") === "true";

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Filters
    const result = searchParams.get("result"); // "WIN" or "LOSS"
    const tournament = searchParams.get("tournament");
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    // Build where clause
    const whereClause: Record<string, unknown> = {
      OR: [
        { playerAId: userId },
        { playerBId: userId },
      ],
    };

    // Add filters
    if (result) {
      if (result === "WIN") {
        whereClause.winnerId = userId;
      } else {
        whereClause.NOT = { winnerId: userId };
      }
    }

    if (tournament) {
      whereClause.tournament = {
        name: { contains: tournament }, // SQLite is case-insensitive by default
      };
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      whereClause.playedAt = dateFilter;
    }

    // Get total count
    const totalMatches = await db.match.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalMatches / limit);

    // Export mode - return all matches as CSV
    if (isExport) {
      const allMatches = await db.match.findMany({
        where: whereClause,
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
          tournament: { select: { id: true, name: true } },
        },
        orderBy: { playedAt: "desc" },
      });

      const csvRows = [
        "Date,Tournament,Opponent,Result,Score,Points,ELO Change",
      ];

      for (const match of allMatches) {
        const isPlayerA = match.playerAId === userId;
        const opponent = isPlayerA
          ? match.playerB
          : match.playerA;
        const won = match.winnerId === userId;
        const pointsEarned = isPlayerA ? match.pointsA : match.pointsB;
        const eloChange = isPlayerA ? match.eloChangeA : match.eloChangeB;
        const myScore = isPlayerA ? match.scoreA : match.scoreB;
        const oppScore = isPlayerA ? match.scoreB : match.scoreA;

        csvRows.push(
          [
            new Date(match.playedAt).toLocaleDateString(),
            match.tournament?.name || "Friendly",
            opponent ? `${opponent.firstName} ${opponent.lastName}` : "Unknown",
            won ? "WIN" : "LOSS",
            `${myScore}-${oppScore}`,
            pointsEarned?.toString() || "0",
            eloChange?.toFixed(1) || "0",
          ].join(",")
        );
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="match-history.csv"',
        },
      });
    }

    // Get paginated matches
    const matches = await db.match.findMany({
      where: whereClause,
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: "desc" },
      skip,
      take: limit,
    });

    // Format matches for response
    const formattedMatches = matches.map((match) => {
      const isPlayerA = match.playerAId === userId;
      const opponent = isPlayerA
        ? match.playerB
        : match.playerA;
      const won = match.winnerId === userId;
      const pointsEarned = isPlayerA ? match.pointsA : match.pointsB;
      const eloChange = isPlayerA ? match.eloChangeA : match.eloChangeB;
      const myScore = isPlayerA ? match.scoreA : match.scoreB;
      const oppScore = isPlayerA ? match.scoreB : match.scoreA;

      return {
        id: match.id,
        tournamentId: match.tournamentId,
        tournamentName: match.tournament?.name || "Friendly Match",
        opponent: opponent
          ? {
              id: opponent.id,
              name: `${opponent.firstName} ${opponent.lastName}`,
            }
          : {
              id: "unknown",
              name: "Unknown",
            },
        result: won ? "WIN" as const : "LOSS" as const,
        score: `${myScore || 0}-${oppScore || 0}`,
        pointsEarned: pointsEarned || 0,
        eloChange: Math.round(eloChange || 0),
        date: match.playedAt.toISOString(),
      };
    });

    return NextResponse.json({
      matches: formattedMatches,
      currentPage: page,
      totalPages,
      totalMatches,
    });
  } catch (error) {
    console.error("Error fetching match history:", error);
    return NextResponse.json(
      { error: "Failed to fetch match history" },
      { status: 500 }
    );
  }
}
