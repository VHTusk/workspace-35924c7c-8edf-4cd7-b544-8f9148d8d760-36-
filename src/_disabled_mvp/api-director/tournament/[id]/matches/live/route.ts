import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, BracketMatchStatus } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get live matches for a tournament
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDirector(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Check if user is a tournament director or admin
    const allowedRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        staff: { where: { userId: user.id } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // If not admin, check if user is assigned to this tournament
    const isAdmin = [Role.ADMIN, Role.SUB_ADMIN].includes(user.role as Role);
    if (!isAdmin && tournament.staff.length === 0) {
      return NextResponse.json({ error: 'Not assigned to this tournament' }, { status: 403 });
    }

    // Get live matches for this tournament
    const liveBracketMatches = await db.bracketMatch.findMany({
      where: {
        bracket: { tournamentId: id },
        status: BracketMatchStatus.LIVE,
      },
      include: {
        match: {
          include: {
            playerA: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
            playerB: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
          },
        },
      },
      orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
    });

    // Get pending matches that could start soon
    const pendingMatches = await db.bracketMatch.findMany({
      where: {
        bracket: { tournamentId: id },
        status: BracketMatchStatus.PENDING,
      },
      include: {
        match: {
          include: {
            playerA: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
            playerB: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
          },
        },
      },
      orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
      take: 10,
    });

    // Format live matches
    const liveMatches = liveBracketMatches.map(bm => ({
      id: bm.id,
      matchId: bm.match?.id || null,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      playerA: bm.match?.playerA ? {
        id: bm.match.playerA.id,
        firstName: bm.match.playerA.firstName,
        lastName: bm.match.playerA.lastName,
      } : null,
      playerB: bm.match?.playerB ? {
        id: bm.match.playerB.id,
        firstName: bm.match.playerB.firstName,
        lastName: bm.match.playerB.lastName,
      } : null,
      scoreA: bm.match?.scoreA || null,
      scoreB: bm.match?.scoreB || null,
      court: bm.courtAssignment,
      round: bm.roundNumber,
      matchNumber: bm.matchNumber,
      status: bm.status,
      scheduledAt: bm.scheduledAt,
    }));

    // Format pending matches
    const upcomingMatches = pendingMatches.map(bm => ({
      id: bm.id,
      matchId: bm.match?.id || null,
      playerA: bm.match?.playerA ? {
        id: bm.match.playerA.id,
        firstName: bm.match.playerA.firstName,
        lastName: bm.match.playerA.lastName,
      } : null,
      playerB: bm.match?.playerB ? {
        id: bm.match.playerB.id,
        firstName: bm.match.playerB.firstName,
        lastName: bm.match.playerB.lastName,
      } : null,
      court: bm.courtAssignment,
      round: bm.roundNumber,
      matchNumber: bm.matchNumber,
      status: bm.status,
      scheduledAt: bm.scheduledAt,
    }));

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
      liveMatches,
      upcomingMatches,
      stats: {
        live: liveMatches.length,
        pending: pendingMatches.length,
      },
    });
  } catch (error) {
    console.error('Get live matches error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update match status (start, complete)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDirector(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    const allowedRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { bracketMatchId, action, scoreA, scoreB, winnerId } = body;

    if (!bracketMatchId || !action) {
      return NextResponse.json({ error: 'Bracket match ID and action required' }, { status: 400 });
    }

    const bracketMatch = await db.bracketMatch.findFirst({
      where: {
        id: bracketMatchId,
        bracket: { tournamentId: id },
      },
      include: { match: true },
    });

    if (!bracketMatch) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (action === 'start') {
      // Start the match
      const updated = await db.bracketMatch.update({
        where: { id: bracketMatchId },
        data: { status: BracketMatchStatus.LIVE },
      });

      return NextResponse.json({ success: true, bracketMatch: updated });
    }

    if (action === 'complete') {
      if (scoreA === undefined || scoreB === undefined || !winnerId) {
        return NextResponse.json({ error: 'Scores and winner ID required' }, { status: 400 });
      }

      // Update bracket match
      const updatedBracketMatch = await db.bracketMatch.update({
        where: { id: bracketMatchId },
        data: {
          status: BracketMatchStatus.COMPLETED,
          winnerId,
        },
      });

      // Update match if exists
      if (bracketMatch.match) {
        await db.match.update({
          where: { id: bracketMatch.match.id },
          data: {
            scoreA,
            scoreB,
            winnerId,
          },
        });
      }

      return NextResponse.json({ success: true, bracketMatch: updatedBracketMatch });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update match error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
