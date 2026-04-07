import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public bracket view - no authentication required
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        sport: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        location: true,
        city: true,
        state: true,
        bracketFormat: true,
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get bracket
    const bracket = await db.bracket.findUnique({
      where: { tournamentId },
      include: {
        matches: {
          include: {
            match: {
              include: {
                playerA: { select: { id: true, firstName: true, lastName: true } },
                playerB: { select: { id: true, firstName: true, lastName: true } },
              }
            }
          },
          orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }]
        }
      }
    });

    if (!bracket) {
      return NextResponse.json({ 
        tournament,
        bracket: null,
        message: 'Bracket not yet generated'
      });
    }

    // Structure bracket data for display
    const rounds: Record<number, Array<{
      id: string;
      roundNumber: number;
      matchNumber: number;
      status: string;
      scheduledAt: string | null;
      courtAssignment: string | null;
      playerA: { id: string; name: string } | null;
      playerB: { id: string; name: string } | null;
      scoreA: number | null;
      scoreB: number | null;
      winnerId: string | null;
    }>> = {};

    for (const bm of bracket.matches) {
      const round = bm.roundNumber;
      if (!rounds[round]) rounds[round] = [];

      const match = bm.match;
      rounds[round].push({
        id: bm.id,
        roundNumber: bm.roundNumber,
        matchNumber: bm.matchNumber,
        status: bm.status,
        scheduledAt: bm.scheduledAt?.toISOString() || null,
        courtAssignment: bm.courtAssignment,
        playerA: match?.playerA ? {
          id: match.playerA.id,
          name: `${match.playerA.firstName} ${match.playerA.lastName}`
        } : null,
        playerB: match?.playerB ? {
          id: match.playerB.id,
          name: `${match.playerB.firstName} ${match.playerB.lastName}`
        } : null,
        scoreA: match?.scoreA || null,
        scoreB: match?.scoreB || null,
        winnerId: match?.winnerId || null,
      });
    }

    // Get live matches (status = LIVE)
    const liveMatches = bracket.matches
      .filter(m => m.status === 'LIVE')
      .map(bm => ({
        id: bm.id,
        roundNumber: bm.roundNumber,
        matchNumber: bm.matchNumber,
        court: bm.courtAssignment,
        playerA: bm.match?.playerA ? `${bm.match.playerA.firstName} ${bm.match.playerA.lastName}` : 'TBD',
        playerB: bm.match?.playerB ? `${bm.match.playerB.firstName} ${bm.match.playerB.lastName}` : 'TBD',
        scoreA: bm.match?.scoreA || 0,
        scoreB: bm.match?.scoreB || 0,
      }));

    return NextResponse.json({
      tournament,
      bracket: {
        id: bracket.id,
        format: tournament.bracketFormat,
        totalRounds: Math.max(...Object.keys(rounds).map(Number), 0),
        rounds,
      },
      liveMatches,
      totalMatches: bracket.matches.length,
      completedMatches: bracket.matches.filter(m => m.status === 'COMPLETED').length,
    });
  } catch (error) {
    console.error('Error fetching public bracket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
