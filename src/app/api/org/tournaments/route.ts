import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - Get tournaments for org (INTER_ORG and INTRA_ORG only)
// Query params:
// - type: INTRA_ORG | INTER_ORG - filter by tournament type
export async function GET(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.org.id;
    const sport = session.org.sport;
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as 'INTRA_ORG' | 'INTER_ORG' | null;

    // Build the where clause based on type filter
    let whereClause: any = {
      sport,
      status: { not: 'DRAFT' },
    };

    if (typeFilter === 'INTRA_ORG') {
      // Only INTRA_ORG tournaments hosted by this org
      whereClause.type = 'INTRA_ORG';
      whereClause.hostOrgId = orgId;
    } else if (typeFilter === 'INTER_ORG') {
      // Only INTER_ORG tournaments
      whereClause.type = 'INTER_ORG';
    } else {
      // Default: Get tournaments where:
      // 1. Type is INTER_ORG (org can participate)
      // 2. Type is INTRA_ORG and hosted by this org
      whereClause.OR = [
        { type: 'INTER_ORG' },
        { type: 'INTRA_ORG', hostOrgId: orgId },
      ];
    }

    const tournaments = await db.tournament.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Check if org is already registered for each tournament
    const tournamentWithRegistration = await Promise.all(
      tournaments.map(async (t) => {
        const registration = await db.orgTournamentRegistration.findUnique({
          where: {
            orgId_tournamentId: { orgId, tournamentId: t.id },
          },
        });

        return {
          id: t.id,
          name: t.name,
          type: t.type,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          registrationDeadline: t.registrationDeadline,
          city: t.city,
          state: t.state,
          scope: t.scope,
          maxParticipants: t.maxParticipants,
          currentParticipants: t._count.registrations,
          prizePool: t.prizePool,
          isRegistered: !!registration,
          registrationStatus: registration?.status || null,
        };
      })
    );

    return NextResponse.json({
      tournaments: tournamentWithRegistration,
    });
  } catch (error) {
    console.error('Get org tournaments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
