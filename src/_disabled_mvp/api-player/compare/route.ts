// VALORHIVE Player Comparison API
// Side-by-side comparison of two players

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// GET /api/player/compare - Compare two players
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const player1Id = searchParams.get('player1');
    const player2Id = searchParams.get('player2');
    const sport = searchParams.get('sport') as SportType;

    if (!player1Id || !player2Id) {
      return NextResponse.json({ error: 'Both player IDs required' }, { status: 400 });
    }

    if (player1Id === player2Id) {
      return NextResponse.json({ error: 'Cannot compare same player' }, { status: 400 });
    }

    // Fetch both players
    const [player1, player2] = await Promise.all([
      db.user.findUnique({
        where: { id: player1Id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          hiddenElo: true,
          visiblePoints: true,
          sport: true,
          createdAt: true,
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
              highestElo: true,
              currentStreak: true,
              bestStreak: true,
              tournamentsPlayed: true,
              tournamentsWon: true,
            },
          },
          achievements: {
            select: { id: true, type: true, title: true },
            take: 5,
          },
        },
      }),
      db.user.findUnique({
        where: { id: player2Id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          hiddenElo: true,
          visiblePoints: true,
          sport: true,
          createdAt: true,
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
              highestElo: true,
              currentStreak: true,
              bestStreak: true,
              tournamentsPlayed: true,
              tournamentsWon: true,
            },
          },
          achievements: {
            select: { id: true, type: true, title: true },
            take: 5,
          },
        },
      }),
    ]);

    if (!player1 || !player2) {
      return NextResponse.json({ error: 'One or both players not found' }, { status: 404 });
    }

    // Filter by sport if provided
    if (sport && (player1.sport !== sport || player2.sport !== sport)) {
      return NextResponse.json({ error: 'Players must be from the same sport' }, { status: 400 });
    }

    // Get head-to-head record
    const headToHeadMatches = await db.match.findMany({
      where: {
        OR: [
          { AND: [{ playerAId: player1Id }, { playerBId: player2Id }] },
          { AND: [{ playerAId: player2Id }, { playerBId: player1Id }] },
        ],
      },
      select: {
        winnerId: true,
        scoreA: true,
        scoreB: true,
        playedAt: true,
        tournamentId: true,
        tournament: {
          select: { name: true, scope: true },
        },
      },
      orderBy: { playedAt: 'desc' },
    });

    // Calculate head-to-head stats
    const h2hStats = {
      totalMatches: headToHeadMatches.length,
      player1Wins: headToHeadMatches.filter(m => m.winnerId === player1Id).length,
      player2Wins: headToHeadMatches.filter(m => m.winnerId === player2Id).length,
      recentMatches: headToHeadMatches.slice(0, 5).map(m => ({
        date: m.playedAt,
        tournament: m.tournament?.name,
        winnerId: m.winnerId,
        player1Score: m.playerAId === player1Id ? m.scoreA : m.scoreB,
        player2Score: m.playerAId === player2Id ? m.scoreA : m.scoreB,
      })),
    };

    // Calculate win rates
    const p1Rating = player1.rating || { matchesPlayed: 0, wins: 0, losses: 0, highestElo: 1500, currentStreak: 0, bestStreak: 0, tournamentsPlayed: 0, tournamentsWon: 0 };
    const p2Rating = player2.rating || { matchesPlayed: 0, wins: 0, losses: 0, highestElo: 1500, currentStreak: 0, bestStreak: 0, tournamentsPlayed: 0, tournamentsWon: 0 };

    const p1WinRate = p1Rating.matchesPlayed > 0 ? Math.round((p1Rating.wins / p1Rating.matchesPlayed) * 100) : 0;
    const p2WinRate = p2Rating.matchesPlayed > 0 ? Math.round((p2Rating.wins / p2Rating.matchesPlayed) * 100) : 0;

    // Determine tier for each player
    const getTier = (elo: number, matches: number): { tier: string; color: string } => {
      if (matches < 30) return { tier: 'Unranked', color: 'gray' };
      if (elo < 1300) return { tier: 'Bronze', color: '#CD7F32' };
      if (elo < 1500) return { tier: 'Silver', color: '#C0C0C0' };
      if (elo < 1700) return { tier: 'Gold', color: '#FFD700' };
      if (elo < 1900) return { tier: 'Platinum', color: '#008080' };
      return { tier: 'Diamond', color: '#4169E1' };
    };

    const p1Tier = getTier(player1.hiddenElo, p1Rating.matchesPlayed);
    const p2Tier = getTier(player2.hiddenElo, p2Rating.matchesPlayed);

    // Compare stats - determine winner for each category
    const comparison = {
      elo: {
        player1: player1.hiddenElo,
        player2: player2.hiddenElo,
        winner: player1.hiddenElo > player2.hiddenElo ? 'player1' : player1.hiddenElo < player2.hiddenElo ? 'player2' : 'tie',
      },
      points: {
        player1: player1.visiblePoints,
        player2: player2.visiblePoints,
        winner: player1.visiblePoints > player2.visiblePoints ? 'player1' : player1.visiblePoints < player2.visiblePoints ? 'player2' : 'tie',
      },
      winRate: {
        player1: p1WinRate,
        player2: p2WinRate,
        winner: p1WinRate > p2WinRate ? 'player1' : p1WinRate < p2WinRate ? 'player2' : 'tie',
      },
      matchesPlayed: {
        player1: p1Rating.matchesPlayed,
        player2: p2Rating.matchesPlayed,
        winner: p1Rating.matchesPlayed > p2Rating.matchesPlayed ? 'player1' : p1Rating.matchesPlayed < p2Rating.matchesPlayed ? 'player2' : 'tie',
      },
      tournamentsWon: {
        player1: p1Rating.tournamentsWon,
        player2: p2Rating.tournamentsWon,
        winner: p1Rating.tournamentsWon > p2Rating.tournamentsWon ? 'player1' : p1Rating.tournamentsWon < p2Rating.tournamentsWon ? 'player2' : 'tie',
      },
      highestElo: {
        player1: p1Rating.highestElo,
        player2: p2Rating.highestElo,
        winner: p1Rating.highestElo > p2Rating.highestElo ? 'player1' : p1Rating.highestElo < p2Rating.highestElo ? 'player2' : 'tie',
      },
      currentStreak: {
        player1: p1Rating.currentStreak,
        player2: p2Rating.currentStreak,
        winner: p1Rating.currentStreak > p2Rating.currentStreak ? 'player1' : p1Rating.currentStreak < p2Rating.currentStreak ? 'player2' : 'tie',
      },
      bestStreak: {
        player1: p1Rating.bestStreak,
        player2: p2Rating.bestStreak,
        winner: p1Rating.bestStreak > p2Rating.bestStreak ? 'player1' : p1Rating.bestStreak < p2Rating.bestStreak ? 'player2' : 'tie',
      },
    };

    // Count wins
    const player1CategoryWins = Object.values(comparison).filter(c => c.winner === 'player1').length;
    const player2CategoryWins = Object.values(comparison).filter(c => c.winner === 'player2').length;

    // Overall winner prediction based on ELO
    const expectedScore1 = 1 / (1 + Math.pow(10, (player2.hiddenElo - player1.hiddenElo) / 400));
    const expectedScore2 = 1 - expectedScore1;

    return NextResponse.json({
      success: true,
      data: {
        player1: {
          id: player1.id,
          name: `${player1.firstName} ${player1.lastName}`,
          location: player1.city && player1.state ? `${player1.city}, ${player1.state}` : null,
          tier: p1Tier,
          joinedAt: player1.createdAt,
          rating: p1Rating,
          achievements: player1.achievements,
        },
        player2: {
          id: player2.id,
          name: `${player2.firstName} ${player2.lastName}`,
          location: player2.city && player2.state ? `${player2.city}, ${player2.state}` : null,
          tier: p2Tier,
          joinedAt: player2.createdAt,
          rating: p2Rating,
          achievements: player2.achievements,
        },
        comparison,
        summary: {
          player1CategoryWins,
          player2CategoryWins,
          ties: Object.values(comparison).length - player1CategoryWins - player2CategoryWins,
        },
        headToHead: h2hStats,
        prediction: {
          player1WinProbability: Math.round(expectedScore1 * 100),
          player2WinProbability: Math.round(expectedScore2 * 100),
        },
        sport: player1.sport,
      },
    });
  } catch (error) {
    console.error('Error comparing players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
