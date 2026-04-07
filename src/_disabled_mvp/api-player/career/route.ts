import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Get tournament results
    const tournamentResults = await db.tournamentResult.findMany({
      where: { userId: user.id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            scope: true,
            city: true,
            state: true,
            startDate: true,
            status: true,
          }
        }
      },
      orderBy: { awardedAt: 'desc' },
      take: 20,
    });

    // Get recent matches
    const matchesAsA = await db.match.findMany({
      where: {
        playerAId: user.id,
        outcome: 'PLAYED',
      },
      include: {
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
    });

    const matchesAsB = await db.match.findMany({
      where: {
        playerBId: user.id,
        outcome: 'PLAYED',
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
    });

    // Combine and sort matches
    const allMatches = [
      ...matchesAsA.map(m => ({
        id: m.id,
        playedAt: m.playedAt,
        scoreA: m.scoreA || 0,
        scoreB: m.scoreB || 0,
        winnerId: m.winnerId,
        opponent: m.playerB,
        isWinner: m.winnerId === user.id,
        tournament: m.tournament,
        pointsEarned: m.pointsA || 0,
      })),
      ...matchesAsB.map(m => ({
        id: m.id,
        playedAt: m.playedAt,
        scoreA: m.scoreB || 0,
        scoreB: m.scoreA || 0,
        winnerId: m.winnerId,
        opponent: m.playerA,
        isWinner: m.winnerId === user.id,
        tournament: m.tournament,
        pointsEarned: m.pointsB || 0,
      })),
    ].sort((a, b) => new Date(b.playedAt!).getTime() - new Date(a.playedAt!).getTime()).slice(0, 15)

    // Get stats
    const rating = await db.playerRating.findUnique({
      where: { userId: user.id },
    })

    const podiums = tournamentResults.filter(r => r.rank <= 3).length
    const wins = rating?.wins || 0
    const losses = rating?.losses || 0
    const totalTournaments = tournamentResults.length

    return NextResponse.json({
      tournamentResults,
      recentMatches: allMatches,
      stats: {
        totalTournaments,
        wins,
        losses,
        podiums,
        totalPoints: tournamentResults.reduce((sum, r) => sum + r.bonusPoints, 0),
        bestRank: tournamentResults.length > 0 ? Math.min(...tournamentResults.map(r => r.rank)) : null,
      }
    })
  } catch (error) {
    console.error('Error fetching career data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
