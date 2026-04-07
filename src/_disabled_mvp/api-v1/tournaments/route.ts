/**
 * V1 Tournaments List API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/tournaments?sport=CORNHOLE&status=REGISTRATION_OPEN&page=1&limit=20
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, SportType } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes, apiPaginated } from '@/lib/api-response';
import { getCDNUrl } from '@/lib/cdn-url';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const status = searchParams.get('status') as TournamentStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Valid sport parameter required',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {
      sport: sport as SportType,
      isPublic: true,
    };

    if (status && Object.values(TournamentStatus).includes(status)) {
      where.status = status;
    }

    // Get total count
    const total = await db.tournament.count({ where });

    // Get tournaments
    const tournaments = await db.tournament.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        city: true,
        state: true,
        startDate: true,
        endDate: true,
        regDeadline: true,
        prizePool: true,
        maxPlayers: true,
        entryFee: true,
        status: true,
        bannerImage: true,
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { startDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiPaginated(
      tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        scope: t.scope,
        location: {
          city: t.city,
          state: t.state,
        },
        dates: {
          start: t.startDate?.toISOString() || null,
          end: t.endDate?.toISOString() || null,
          registrationDeadline: t.regDeadline?.toISOString() || null,
        },
        prizePool: t.prizePool,
        maxPlayers: t.maxPlayers,
        entryFee: t.entryFee,
        status: t.status,
        bannerImage: getCDNUrl(t.bannerImage),
        registrations: t._count.registrations,
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      }
    );
  } catch (error) {
    console.error('[V1 Tournaments] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch tournaments',
      undefined,
      500
    );
  }
}
