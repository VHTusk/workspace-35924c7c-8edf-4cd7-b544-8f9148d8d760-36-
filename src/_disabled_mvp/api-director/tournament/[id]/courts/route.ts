import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, BracketMatchStatus } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get courts and their assignments for a tournament
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

    // Get all bracket matches with court assignments
    const bracketMatches = await db.bracketMatch.findMany({
      where: {
        bracket: { tournamentId: id },
      },
      include: {
        match: {
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
    });

    // Get schedule slots
    const scheduleSlots = await db.scheduleSlot.findMany({
      where: { tournamentId: id },
      include: {
        match: {
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Extract unique courts from bracket matches and schedule slots
    const courtNamesSet = new Set<string>();
    bracketMatches.forEach(m => {
      if (m.courtAssignment) courtNamesSet.add(m.courtAssignment);
    });
    scheduleSlots.forEach(s => {
      if (s.courtName) courtNamesSet.add(s.courtName);
    });

    // Build courts data with current match info
    const courts: Array<{
      id: string;
      name: string;
      status: 'available' | 'in_use' | 'maintenance';
      currentMatch?: {
        id: string;
        playerA: string;
        playerB: string;
        matchId: string;
        round: number;
        matchNumber: number;
      };
    }> = [];

    // Process courts from matches
    const liveMatches = bracketMatches.filter(m => m.status === BracketMatchStatus.LIVE);
    const courtsInUse = new Map<string, typeof liveMatches[0]>();
    liveMatches.forEach(m => {
      if (m.courtAssignment) {
        courtsInUse.set(m.courtAssignment, m);
      }
    });

    // Create courts array
    const courtNames = Array.from(courtNamesSet);
    if (courtNames.length === 0 && bracketMatches.length > 0) {
      // Generate default courts based on expected matches
      const maxConcurrentMatches = Math.ceil(
        bracketMatches.filter(m => m.status === BracketMatchStatus.PENDING).length / 4
      ) || 4;
      for (let i = 1; i <= maxConcurrentMatches; i++) {
        courtNames.push(`Court ${i}`);
      }
    } else if (courtNames.length === 0) {
      // Default courts
      for (let i = 1; i <= 4; i++) {
        courtNames.push(`Court ${i}`);
      }
    }

    courtNames.forEach((name, index) => {
      const liveMatch = courtsInUse.get(name);
      courts.push({
        id: `court-${index}`,
        name,
        status: liveMatch ? 'in_use' : 'available',
        currentMatch: liveMatch?.match ? {
          id: liveMatch.id,
          playerA: liveMatch.match.playerA
            ? `${liveMatch.match.playerA.firstName} ${liveMatch.match.playerA.lastName}`
            : 'TBD',
          playerB: liveMatch.match.playerB
            ? `${liveMatch.match.playerB.firstName} ${liveMatch.match.playerB.lastName}`
            : 'TBD',
          matchId: liveMatch.match.id,
          round: liveMatch.roundNumber,
          matchNumber: liveMatch.matchNumber,
        } : undefined,
      });
    });

    // Build pending matches needing court assignment
    const unassignedMatches = bracketMatches
      .filter(m => m.status === BracketMatchStatus.PENDING && !m.courtAssignment)
      .map(m => ({
        id: m.id,
        matchId: m.match?.id || null,
        playerA: m.match?.playerA
          ? `${m.match.playerA.firstName} ${m.match.playerA.lastName}`
          : 'TBD',
        playerB: m.match?.playerB
          ? `${m.match.playerB.firstName} ${m.match.playerB.lastName}`
          : 'TBD',
        round: m.roundNumber,
        matchNumber: m.matchNumber,
        courtAssigned: null,
        status: m.status,
      }));

    return NextResponse.json({
      courts,
      matches: unassignedMatches,
      scheduleSlots: scheduleSlots.map(s => ({
        id: s.id,
        courtName: s.courtName,
        startTime: s.startTime,
        endTime: s.endTime,
        matchId: s.matchId,
        match: s.match ? {
          id: s.match.id,
          playerA: `${s.match.playerA.firstName} ${s.match.playerA.lastName}`,
          playerB: s.match.playerB
            ? `${s.match.playerB.firstName} ${s.match.playerB.lastName}`
            : null,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Get courts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update court assignment
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
    const { bracketMatchId, courtName, action } = body;

    if (action === 'assign' && bracketMatchId && courtName) {
      // Update bracket match with court assignment
      const bracketMatch = await db.bracketMatch.update({
        where: { id: bracketMatchId },
        data: { courtAssignment: courtName },
        include: {
          match: true,
        },
      });

      // Also update the match if it exists
      if (bracketMatch.match) {
        await db.match.update({
          where: { id: bracketMatch.match.id },
          data: { courtName },
        });
      }

      return NextResponse.json({ success: true, bracketMatch });
    }

    if (action === 'unassign' && courtName) {
      // Clear court assignment from all matches on this court
      await db.bracketMatch.updateMany({
        where: {
          bracket: { tournamentId: id },
          courtAssignment: courtName,
        },
        data: { courtAssignment: null },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update court error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add a new court
export async function POST(
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
    const { name, type = 'indoor' } = body;

    if (!name) {
      return NextResponse.json({ error: 'Court name required' }, { status: 400 });
    }

    // Create a schedule slot to register the court
    const slot = await db.scheduleSlot.create({
      data: {
        tournamentId: id,
        courtName: name,
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      },
    });

    return NextResponse.json({
      success: true,
      court: {
        id: slot.id,
        name: name,
        type,
        status: 'available',
      },
    });
  } catch (error) {
    console.error('Add court error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
