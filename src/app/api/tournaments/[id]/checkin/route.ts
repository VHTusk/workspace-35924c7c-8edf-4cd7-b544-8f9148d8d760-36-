import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get check-in status for tournament
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        checkins: true,
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const registrationMap = new Map(
      tournament.registrations.map((registration) => [
        registration.userId,
        `${registration.user.firstName} ${registration.user.lastName}`,
      ]),
    );
    const checkedInIds = new Set(tournament.checkins.map(c => c.userId));
    const notCheckedIn = tournament.registrations.filter(r => !checkedInIds.has(r.userId));

    const userCheckin = userId ? tournament.checkins.find(c => c.userId === userId) : null;

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        startDate: tournament.startDate
      },
      stats: {
        total: tournament.registrations.length,
        checkedIn: tournament.checkins.length,
        notCheckedIn: notCheckedIn.length
      },
      checkedInPlayers: tournament.checkins.map(c => ({
        id: c.id,
        userId: c.userId,
        name: registrationMap.get(c.userId) ?? 'Unknown Player',
        checkedInAt: c.checkedInAt,
        method: c.method
      })),
      notCheckedInPlayers: notCheckedIn.map(r => ({
        userId: r.userId,
        name: `${r.user.firstName} ${r.user.lastName}`
      })),
      userCheckin: userCheckin ? {
        checkedIn: true,
        checkedInAt: userCheckin.checkedInAt
      } : { checkedIn: false }
    });
  } catch (error) {
    console.error('Error fetching check-in status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Check-in to tournament
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, method = 'SELF' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check tournament exists and is in correct status
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { userId, status: 'CONFIRMED' }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if registration exists
    if (tournament.registrations.length === 0) {
      return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 400 });
    }

    // Check if already checked in
    const existingCheckin = await db.tournamentCheckin.findFirst({
      where: {
        tournamentId: id,
        userId,
      }
    });

    if (existingCheckin) {
      return NextResponse.json({ error: 'Already checked in', checkin: existingCheckin }, { status: 400 });
    }

    // Create check-in
    const checkin = await db.tournamentCheckin.create({
      data: {
        tournamentId: id,
        userId,
        method
      }
    });

    return NextResponse.json({ success: true, checkin });
  } catch (error) {
    console.error('Error checking in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Cancel check-in
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await db.tournamentCheckin.deleteMany({
      where: {
        tournamentId: id,
        userId,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling check-in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
