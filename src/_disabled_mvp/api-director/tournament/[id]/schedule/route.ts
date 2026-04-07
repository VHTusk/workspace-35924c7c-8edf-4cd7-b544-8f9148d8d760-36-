import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, BracketMatchStatus } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get schedule for a tournament
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

    const allowedRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get tournament with bracket matches
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        bracket: {
          include: {
            matches: {
              include: {
                match: {
                  include: {
                    playerA: { select: { id: true, firstName: true, lastName: true } },
                    playerB: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
              orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
            },
          },
        },
        scheduleSlots: {
          include: {
            match: {
              include: {
                playerA: { select: { id: true, firstName: true, lastName: true } },
                playerB: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get unique courts
    const courts = new Set<string>();
    tournament.scheduleSlots.forEach(s => courts.add(s.courtName));
    tournament.bracket?.matches.forEach(m => {
      if (m.courtAssignment) courts.add(m.courtAssignment);
    });

    // Build schedule slots with match info
    const scheduleSlots = tournament.scheduleSlots.map(slot => ({
      id: slot.id,
      courtName: slot.courtName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      matchId: slot.matchId,
      match: slot.match ? {
        id: slot.match.id,
        playerA: `${slot.match.playerA.firstName} ${slot.match.playerA.lastName}`,
        playerB: slot.match.playerB
          ? `${slot.match.playerB.firstName} ${slot.match.playerB.lastName}`
          : null,
        scoreA: slot.match.scoreA,
        scoreB: slot.match.scoreB,
      } : null,
    }));

    // Build bracket matches that can be scheduled
    const bracketMatches = (tournament.bracket?.matches || []).map(bm => ({
      id: bm.id,
      matchId: bm.matchId,
      roundNumber: bm.roundNumber,
      matchNumber: bm.matchNumber,
      status: bm.status,
      courtAssignment: bm.courtAssignment,
      scheduledAt: bm.scheduledAt,
      playerA: bm.match?.playerA
        ? `${bm.match.playerA.firstName} ${bm.match.playerA.lastName}`
        : null,
      playerB: bm.match?.playerB
        ? `${bm.match.playerB.firstName} ${bm.match.playerB.lastName}`
        : null,
    }));

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
      },
      courts: Array.from(courts),
      scheduleSlots,
      bracketMatches,
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Generate schedule
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
    const { courts, startTime, matchDuration = 45, breakDuration = 15 } = body;

    if (!courts || courts.length === 0) {
      return NextResponse.json({ error: 'No courts specified' }, { status: 400 });
    }

    // Get tournament with bracket matches
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        bracket: {
          include: {
            matches: {
              where: { status: BracketMatchStatus.PENDING },
              include: {
                match: {
                  include: {
                    playerA: { select: { firstName: true, lastName: true } },
                    playerB: { select: { firstName: true, lastName: true } },
                  },
                },
              },
              orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.bracket) {
      return NextResponse.json({ error: 'No bracket generated' }, { status: 400 });
    }

    // Clear existing schedule slots
    await db.scheduleSlot.deleteMany({
      where: { tournamentId: id },
    });

    // Generate schedule
    const slots: Array<{
      courtName: string;
      startTime: Date;
      endTime: Date;
      matchId: string | null;
      bracketMatchId: string;
    }> = [];

    let currentTime = new Date(startTime);
    let courtIndex = 0;
    const matchDurationMs = matchDuration * 60 * 1000;
    const breakDurationMs = breakDuration * 60 * 1000;

    for (const bracketMatch of tournament.bracket.matches) {
      const court = courts[courtIndex % courts.length];
      const slotEndTime = new Date(currentTime.getTime() + matchDurationMs);

      slots.push({
        courtName: court,
        startTime: new Date(currentTime),
        endTime: slotEndTime,
        matchId: bracketMatch.matchId,
        bracketMatchId: bracketMatch.id,
      });

      // Update bracket match with court and time
      await db.bracketMatch.update({
        where: { id: bracketMatch.id },
        data: {
          courtAssignment: court,
          scheduledAt: new Date(currentTime),
        },
      });

      // Move to next slot
      currentTime = new Date(slotEndTime.getTime() + breakDurationMs);
      courtIndex++;
    }

    // Create schedule slots
    await db.scheduleSlot.createMany({
      data: slots.map(s => ({
        tournamentId: id,
        courtName: s.courtName,
        startTime: s.startTime,
        endTime: s.endTime,
        matchId: s.matchId,
      })),
    });

    return NextResponse.json({
      success: true,
      slotsCreated: slots.length,
      schedule: slots,
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update a single slot
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
    const { slotId, courtName, startTime, endTime } = body;

    if (!slotId) {
      return NextResponse.json({ error: 'Slot ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (courtName !== undefined) updateData.courtName = courtName;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);

    const slot = await db.scheduleSlot.update({
      where: { id: slotId },
      data: updateData,
    });

    return NextResponse.json({ success: true, slot });
  } catch (error) {
    console.error('Update slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete a slot
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return NextResponse.json({ error: 'Slot ID required' }, { status: 400 });
    }

    await db.scheduleSlot.delete({
      where: { id: slotId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
