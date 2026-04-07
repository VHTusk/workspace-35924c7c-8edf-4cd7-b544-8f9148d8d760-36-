import { NextRequest, NextResponse } from 'next/server';
import { SportType, TournamentStatus, TournamentType } from '@prisma/client';
import { db } from '@/lib/db';

const SUPPORTED_SPORTS = new Set<SportType>(['CORNHOLE', 'DARTS']);
const UPCOMING_STATUSES: TournamentStatus[] = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED'];
const ORG_TOURNAMENT_TYPES: TournamentType[] = ['INTRA_ORG', 'INTER_ORG'];

/**
 * GET /api/public/sport-preview?sport=CORNHOLE
 *
 * Returns lightweight public data for the sport preview experience.
 */
export async function GET(request: NextRequest) {
  try {
    const sportParam = request.nextUrl.searchParams.get('sport')?.toUpperCase() as SportType | undefined;

    if (!sportParam || !SUPPORTED_SPORTS.has(sportParam)) {
      return NextResponse.json({ error: 'Valid sport parameter required' }, { status: 400 });
    }

    const [upcomingTournaments, liveTournaments, totalParticipants, topOrganizations] = await Promise.all([
      db.tournament.findMany({
        where: {
          sport: sportParam,
          status: { in: UPCOMING_STATUSES },
          type: { in: ORG_TOURNAMENT_TYPES },
        },
        take: 5,
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          name: true,
          startDate: true,
          city: true,
          state: true,
          maxPlayers: true,
          prizePool: true,
          _count: {
            select: { registrations: true },
          },
        },
      }),
      db.tournament.count({
        where: {
          sport: sportParam,
          status: 'IN_PROGRESS',
        },
      }),
      db.tournamentRegistration.count({
        where: {
          tournament: {
            sport: sportParam,
          },
        },
      }),
      db.orgStatistics.findMany({
        where: { sport: sportParam },
        orderBy: [{ totalWins: 'desc' }, { tournamentsHosted: 'desc' }],
        take: 5,
        select: {
          orgId: true,
          totalWins: true,
          tournamentsHosted: true,
          org: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      upcomingTournaments: upcomingTournaments.map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        startDate: tournament.startDate.toISOString(),
        city: tournament.city,
        state: tournament.state,
        maxParticipants: tournament.maxPlayers,
        currentParticipants: tournament._count.registrations,
        prizePool: tournament.prizePool,
      })),
      liveTournaments,
      totalParticipants,
      topOrganizations: topOrganizations.map((organization) => ({
        id: organization.orgId,
        name: organization.org.name,
        wins: organization.totalWins,
        tournaments: organization.tournamentsHosted,
      })),
    });
  } catch (error) {
    console.error('Error fetching sport preview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sport preview data' },
      { status: 500 },
    );
  }
}
