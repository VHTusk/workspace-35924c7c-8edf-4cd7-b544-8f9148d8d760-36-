import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrgSession } from '@/lib/auth/org-session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const schedule = await db.scheduleSlot.findMany({
      where: { tournamentId: id },
      orderBy: { startTime: 'asc' },
      include: {
        match: {
          include: {
            player1: { select: { id: true, firstName: true, lastName: true } },
            player2: { select: { id: true, firstName: true, lastName: true } },
          }
        }
      }
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        bracket: {
          include: {
            matches: {
              where: { status: 'PENDING' },
              include: {
                match: true,
              }
            }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Verify ownership
    if (tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { courts, startTime, matchDuration, breakTime } = body;

    if (!courts || courts.length === 0) {
      return NextResponse.json({ error: 'No courts specified' }, { status: 400 });
    }

    if (!tournament.bracket) {
      return NextResponse.json({ error: 'No bracket generated' }, { status: 400 });
    }

    // Clear existing schedule
    await db.scheduleSlot.deleteMany({
      where: { tournamentId: id }
    });

    // Generate schedule
    const slots: Array<{
      courtName: string;
      startTime: Date;
      endTime: Date;
      matchId: string;
    }> = [];

    let currentTime = new Date(startTime);
    let courtIndex = 0;
    const matchDurationMs = (matchDuration || 20) * 60 * 1000;
    const breakTimeMs = (breakTime || 5) * 60 * 1000;

    // Sort matches by round and match number
    const matches = tournament.bracket.matches.sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
      return a.matchNumber - b.matchNumber;
    });

    for (const bracketMatch of matches) {
      if (bracketMatch.status !== 'PENDING') continue;

      const court = courts[courtIndex % courts.length];
      const slotEndTime = new Date(currentTime.getTime() + matchDurationMs);

      slots.push({
        courtName: court,
        startTime: new Date(currentTime),
        endTime: slotEndTime,
        matchId: bracketMatch.matchId,
      });

      // Update bracket match with court and time
      await db.bracketMatch.update({
        where: { id: bracketMatch.id },
        data: {
          courtAssignment: court,
          scheduledAt: new Date(currentTime),
        }
      });

      // Move to next slot
      currentTime = new Date(slotEndTime.getTime() + breakTimeMs);
      courtIndex++;
    }

    // Create schedule slots
    const createdSlots = await db.scheduleSlot.createMany({
      data: slots.map(s => ({
        tournamentId: id,
        courtName: s.courtName,
        startTime: s.startTime,
        endTime: s.endTime,
        matchId: s.matchId,
      }))
    });

    return NextResponse.json({
      success: true,
      slotsCreated: createdSlots.count,
      schedule: slots,
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
