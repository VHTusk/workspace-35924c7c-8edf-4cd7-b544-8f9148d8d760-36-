import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, RegistrationStatus, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

// Get tournament registrations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RegistrationStatus | null;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: { id: true, name: true, sport: true, maxPlayers: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = { tournamentId: id };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search } } },
        { user: { lastName: { contains: search } } },
        { user: { email: { contains: search } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [registrations, total] = await Promise.all([
      db.tournamentRegistration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              hiddenElo: true,
              city: true,
              state: true,
              rating: {
                select: {
                  matchesPlayed: true,
                  wins: true,
                  losses: true,
                },
              },
            },
          },
        },
        orderBy: { registeredAt: 'asc' },
        skip,
        take: limit,
      }),
      db.tournamentRegistration.count({ where }),
    ]);

    // Get waitlist count
    const waitlistCount = await db.tournamentWaitlist.count({
      where: { tournamentId: id, status: 'WAITING' },
    });

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        maxPlayers: tournament.maxPlayers,
      },
      registrations: registrations.map((r, index) => ({
        id: r.id,
        status: r.status,
        registeredAt: r.registeredAt,
        amount: r.amount,
        paymentId: r.paymentId,
        seedNumber: index + 1,
        user: {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          email: r.user.email,
          phone: r.user.phone,
          elo: Math.round(r.user.hiddenElo),
          city: r.user.city,
          state: r.user.state,
          matchesPlayed: r.user.rating?.matchesPlayed || 0,
          wins: r.user.rating?.wins || 0,
          losses: r.user.rating?.losses || 0,
        },
      })),
      counts: {
        total,
        confirmed: registrations.filter((r) => r.status === RegistrationStatus.CONFIRMED).length,
        pending: registrations.filter((r) => r.status === RegistrationStatus.PENDING).length,
        waitlist: waitlistCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update registration status (approve/reject/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { registrationId, status, reason } = body;

    if (!registrationId || !status) {
      return NextResponse.json(
        { error: 'Registration ID and status are required' },
        { status: 400 }
      );
    }

    const registration = await db.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: { tournament: true },
    });

    if (!registration || registration.tournamentId !== id) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const updated = await db.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        status: status as RegistrationStatus,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      registration: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Update registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
