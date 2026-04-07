import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - Get tournaments the org has joined/registered for
export async function GET(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.org.id;

    // Get all tournament registrations for this org
    const registrations = await db.orgTournamentRegistration.findMany({
      where: { orgId },
      include: {
        tournament: {
          include: {
            _count: {
              select: { registrations: true },
            },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    // Format the response
    const myTournaments = registrations.map((reg) => ({
      id: reg.tournament.id,
      name: reg.tournament.name,
      type: reg.tournament.type,
      status: reg.tournament.status,
      startDate: reg.tournament.startDate,
      endDate: reg.tournament.endDate,
      registrationDeadline: reg.tournament.regDeadline,
      city: reg.tournament.city,
      state: reg.tournament.state,
      scope: reg.tournament.scope,
      maxParticipants: reg.tournament.maxPlayers,
      currentParticipants: reg.tournament._count.registrations,
      prizePool: reg.tournament.prizePool,
      entryFee: reg.tournament.entryFee,
      registeredAt: reg.registeredAt,
      registrationStatus: reg.status,
      registrationId: reg.id,
    }));

    // Also get INTRA_ORG tournaments hosted by this org
    const hostedTournaments = await db.tournament.findMany({
      where: {
        orgId: orgId,
        type: 'INTRA_ORG',
      },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const hostedFormatted = hostedTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationDeadline: t.regDeadline,
      city: t.city,
      state: t.state,
      scope: t.scope,
      maxParticipants: t.maxPlayers,
      currentParticipants: t._count.registrations,
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      registeredAt: t.createdAt,
      registrationStatus: 'HOST',
      registrationId: null,
      isHost: true,
    }));

    // Combine and sort by start date
    const allTournaments = [...myTournaments, ...hostedTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationDeadline: t.regDeadline,
      city: t.city,
      state: t.state,
      scope: t.scope,
      maxParticipants: t.maxPlayers,
      currentParticipants: t._count.registrations,
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      registeredAt: t.createdAt,
      registrationStatus: 'HOST' as const,
      registrationId: null,
      isHost: true,
    }))].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({
      tournaments: allTournaments,
    });
  } catch (error) {
    console.error('Get my tournaments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
