import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to calculate tier based on points
function calculateTier(points: number): string {
  if (points >= 5000) return 'DIAMOND';
  if (points >= 2500) return 'PLATINUM';
  if (points >= 1000) return 'GOLD';
  if (points >= 500) return 'SILVER';
  return 'BRONZE';
}

// Helper to calculate Elo-based win probability
function calculateWinProbability(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const player1Id = searchParams.get('player1');
    const player2Id = searchParams.get('player2');
    const sport = searchParams.get('sport') || 'CORNHOLE';

    if (!player1Id || !player2Id) {
      return NextResponse.json({ error: 'Both player1 and player2 IDs required' }, { status: 400 });
    }

    // Get player info with stats
    const [player1, player2] = await Promise.all([
      db.user.findUnique({
        where: { id: player1Id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hiddenElo: true,
          visiblePoints: true,
          city: true,
          state: true,
          sport: true,
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
            }
          }
        }
      }),
      db.user.findUnique({
        where: { id: player2Id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hiddenElo: true,
          visiblePoints: true,
          city: true,
          state: true,
          sport: true,
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
            }
          }
        }
      })
    ]);

    if (!player1 || !player2) {
      return NextResponse.json({ error: 'Player(s) not found' }, { status: 404 });
    }

    // Get all matches between these players
    const matchesAsA = await db.match.findMany({
      where: {
        playerAId: player1Id,
        playerBId: player2Id,
        outcome: 'PLAYED'
      },
      include: {
        tournament: { select: { id: true, name: true, scope: true } }
      },
      orderBy: { playedAt: 'desc' }
    });

    const matchesAsB = await db.match.findMany({
      where: {
        playerAId: player2Id,
        playerBId: player1Id,
        outcome: 'PLAYED'
      },
      include: {
        tournament: { select: { id: true, name: true, scope: true } }
      },
      orderBy: { playedAt: 'desc' }
    });

    // Process matches
    let player1Wins = 0;
    let player2Wins = 0;
    let totalScore1 = 0;
    let totalScore2 = 0;
    let matchCount = 0;

    const allMatches = [
      ...matchesAsA.map(m => ({
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentName: m.tournament?.name,
        tournamentScope: m.tournament?.scope,
        player1Score: m.scoreA,
        player2Score: m.scoreB,
        winnerId: m.winnerId,
        playedAt: m.playedAt,
        isPlayer1: true
      })),
      ...matchesAsB.map(m => ({
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentName: m.tournament?.name,
        tournamentScope: m.tournament?.scope,
        player1Score: m.scoreB,
        player2Score: m.scoreA,
        winnerId: m.winnerId,
        playedAt: m.playedAt,
        isPlayer1: false
      }))
    ].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    allMatches.forEach(m => {
      if (m.winnerId === player1Id) player1Wins++;
      else if (m.winnerId === player2Id) player2Wins++;

      if (m.player1Score !== null && m.player1Score !== undefined &&
          m.player2Score !== null && m.player2Score !== undefined) {
        totalScore1 += m.player1Score;
        totalScore2 += m.player2Score;
        matchCount++;
      }
    });

    // Get tournament meetings
    const tournamentMeetingsMap = new Map<string, { tournamentId: string; tournamentName: string; count: number }>();
    allMatches.forEach(m => {
      if (m.tournamentId && m.tournamentName) {
        const existing = tournamentMeetingsMap.get(m.tournamentId);
        if (existing) {
          existing.count++;
        } else {
          tournamentMeetingsMap.set(m.tournamentId, {
            tournamentId: m.tournamentId,
            tournamentName: m.tournamentName,
            count: 1
          });
        }
      }
    });

    // Calculate projected winner based on Elo
    const winProbability = calculateWinProbability(player1.hiddenElo, player2.hiddenElo);

    // Build response
    const response = {
      playerA: {
        id: player1.id,
        name: `${player1.firstName} ${player1.lastName}`,
        elo: player1.hiddenElo,
        points: player1.visiblePoints,
        city: player1.city,
        state: player1.state,
        tier: calculateTier(player1.visiblePoints),
        matchesPlayed: player1.rating?.matchesPlayed || 0,
        wins: player1.rating?.wins || 0,
        losses: player1.rating?.losses || 0,
      },
      playerB: {
        id: player2.id,
        name: `${player2.firstName} ${player2.lastName}`,
        elo: player2.hiddenElo,
        points: player2.visiblePoints,
        city: player2.city,
        state: player2.state,
        tier: calculateTier(player2.visiblePoints),
        matchesPlayed: player2.rating?.matchesPlayed || 0,
        wins: player2.rating?.wins || 0,
        losses: player2.rating?.losses || 0,
      },
      record: {
        playerAWins: player1Wins,
        playerBWins: player2Wins,
        totalMatches: allMatches.length
      },
      averageScores: {
        playerAAvg: matchCount > 0 ? totalScore1 / matchCount : 0,
        playerBAvg: matchCount > 0 ? totalScore2 / matchCount : 0
      },
      last5Matches: allMatches.slice(0, 5),
      tournamentMeetings: Array.from(tournamentMeetingsMap.values()),
      projectedWinner: {
        playerId: winProbability > 0.5 ? player1Id : player2Id,
        probability: winProbability > 0.5 ? winProbability : 1 - winProbability
      },
      sport: player1.sport,
      shareUrl: `/h2h?player1=${player1Id}&player2=${player2Id}&sport=${sport}`
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching H2H:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
