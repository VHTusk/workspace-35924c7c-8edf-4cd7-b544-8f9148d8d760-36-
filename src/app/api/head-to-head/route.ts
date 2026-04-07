import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerAId = searchParams.get('playerAId');
    const playerBId = searchParams.get('playerBId');

    if (!playerAId || !playerBId) {
      return NextResponse.json({ error: 'Both player IDs required' }, { status: 400 });
    }

    // Get all matches between these players
    const matchesAsA = await db.match.findMany({
      where: {
        playerAId,
        playerBId,
        outcome: 'PLAYED'
      },
      include: {
        tournament: { select: { id: true, name: true, scope: true } }
      },
      orderBy: { playedAt: 'desc' }
    });

    const matchesAsB = await db.match.findMany({
      where: {
        playerAId: playerBId,
        playerBId: playerAId,
        outcome: 'PLAYED'
      },
      include: {
        tournament: { select: { id: true, name: true, scope: true } }
      },
      orderBy: { playedAt: 'desc' }
    });

    // Calculate head-to-head stats
    let playerAWins = 0;
    let playerBWins = 0;
    
    const allMatches = [
      ...matchesAsA.map(m => ({
        ...m,
        isPlayerA: true
      })),
      ...matchesAsB.map(m => ({
        ...m,
        isPlayerA: false,
        // Swap scores for consistent display
        scoreA: m.scoreB,
        scoreB: m.scoreA
      }))
    ].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    allMatches.forEach(m => {
      if (m.isPlayerA) {
        if (m.winnerId === playerAId) playerAWins++;
        else if (m.winnerId === playerBId) playerBWins++;
      } else {
        if (m.winnerId === playerAId) playerAWins++;
        else if (m.winnerId === playerBId) playerBWins++;
      }
    });

    // Get player info
    const [playerA, playerB] = await Promise.all([
      db.user.findUnique({
        where: { id: playerAId },
        select: { id: true, firstName: true, lastName: true, hiddenElo: true, visiblePoints: true }
      }),
      db.user.findUnique({
        where: { id: playerBId },
        select: { id: true, firstName: true, lastName: true, hiddenElo: true, visiblePoints: true }
      })
    ]);

    if (!playerA || !playerB) {
      return NextResponse.json({ error: 'Player(s) not found' }, { status: 404 });
    }

    return NextResponse.json({
      playerA: {
        id: playerA.id,
        name: `${playerA.firstName} ${playerA.lastName}`,
        elo: Math.round(playerA.hiddenElo),
        points: playerA.visiblePoints
      },
      playerB: {
        id: playerB.id,
        name: `${playerB.firstName} ${playerB.lastName}`,
        elo: Math.round(playerB.hiddenElo),
        points: playerB.visiblePoints
      },
      record: {
        playerAWins,
        playerBWins,
        totalMatches: allMatches.length
      },
      matches: allMatches.map(m => ({
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentName: m.tournament?.name,
        tournamentScope: m.tournament?.scope,
        playerAScore: m.scoreA,
        playerBScore: m.scoreB,
        winnerId: m.winnerId,
        playedAt: m.playedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching head-to-head:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
