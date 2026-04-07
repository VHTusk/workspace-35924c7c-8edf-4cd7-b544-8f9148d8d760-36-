import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, RegistrationStatus } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get check-ins for a tournament (director view)
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

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

    // Get all registrations with check-in status
    const registrations = await db.tournamentRegistration.findMany({
      where: {
        tournamentId: id,
        status: RegistrationStatus.CONFIRMED,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            visiblePoints: true,
            hiddenElo: true,
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });

    // Get check-ins for this tournament
    const checkins = await db.tournamentCheckin.findMany({
      where: { tournamentId: id },
    });

    const checkedInUserIds = new Set(checkins.map(c => c.userId));
    const checkinMap = new Map(checkins.map(c => [c.userId, c]));

    // Build players list
    let players = registrations.map(r => {
      const checkin = checkinMap.get(r.userId);
      return {
        id: r.userId,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        phone: r.user.phone,
        visiblePoints: r.user.visiblePoints,
        hiddenElo: r.user.hiddenElo,
        checkedIn: checkedInUserIds.has(r.userId),
        checkedInAt: checkin?.checkedInAt || null,
        method: checkin?.method || null,
        tournaments: [{ id: tournament.id, name: tournament.name }],
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      players = players.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
        p.email.toLowerCase().includes(searchLower) ||
        (p.phone && p.phone.includes(search))
      );
    }

    // Calculate stats
    const totalPlayers = players.length;
    const checkedInCount = players.filter(p => p.checkedIn).length;

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        startDate: tournament.startDate,
      },
      players,
      stats: {
        total: totalPlayers,
        checkedIn: checkedInCount,
        notCheckedIn: totalPlayers - checkedInCount,
      },
    });
  } catch (error) {
    console.error('Get checkins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Check in a player
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
    const { userId, method = 'DIRECTOR' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check if registration exists
    const registration = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: id,
        userId,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Player not registered' }, { status: 400 });
    }

    // Check if already checked in
    const existing = await db.tournamentCheckin.findUnique({
      where: {
        tournamentId_userId: { tournamentId: id, userId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Already checked in', checkin: existing }, { status: 400 });
    }

    // Create check-in
    const checkin = await db.tournamentCheckin.create({
      data: {
        tournamentId: id,
        userId,
        method,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      checkin: {
        id: checkin.id,
        userId: checkin.userId,
        name: `${checkin.user.firstName} ${checkin.user.lastName}`,
        checkedInAt: checkin.checkedInAt,
        method: checkin.method,
      },
    });
  } catch (error) {
    console.error('Check in player error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cancel check-in
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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await db.tournamentCheckin.delete({
      where: {
        tournamentId_userId: { tournamentId: id, userId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel check-in error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
