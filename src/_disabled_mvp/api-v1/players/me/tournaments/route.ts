/**
 * V1 Player Tournaments API
 *
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 *
 * GET /api/v1/players/me/tournaments
 *
 * Requires: Bearer token or session cookie
 * Supports cursor pagination
 *
 * Query params:
 * - cursor: Base64 encoded cursor
 * - limit: Number of results (default 20, max 50)
 * - status: Filter by status (UPCOMING/IN_PROGRESS/COMPLETED)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [...],
 *   "meta": {
 *     "nextCursor": "eyJpZCI6ImNse..."},
 *     "hasMore": true
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { TournamentStatus } from '@prisma/client';
import { getCDNUrl } from '@/lib/cdn-url';
import { encodeCursor, decodeCursor, MAX_LIMIT } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user, session } = auth;
    const sport = session.sport;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const statusFilter = searchParams.get('status') as TournamentStatus | null;

    // Build where clause
    const where: Record<string, unknown> = {
      userId: user.id,
      tournament: { sport },
    };

    if (statusFilter && Object.values(TournamentStatus).includes(statusFilter)) {
      where.tournament = {
        sport,
        status: statusFilter,
      };
    }

    // Decode cursor and add cursor filter
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded && decoded.id) {
        // Use id for cursor (matching original behavior)
        where.id = { lt: decoded.id };
      }
    }

    // Get tournament registrations
    const registrations = await db.tournamentRegistration.findMany({
      where,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            scope: true,
            city: true,
            state: true,
            startDate: true,
            endDate: true,
            status: true,
            bannerImage: true,
            prizePool: true,
            entryFee: true,
            maxPlayers: true,
            _count: {
              select: { registrations: true },
            },
          },
        },
        tournamentResult: {
          select: {
            rank: true,
            prize: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = registrations.length > limit;
    const results = hasMore ? registrations.slice(0, -1) : registrations;

    // Generate next cursor
    let nextCursor: string | null = null;
    if (hasMore && results.length > 0) {
      const lastReg = results[results.length - 1];
      nextCursor = encodeCursor({
        value: lastReg.createdAt.toISOString(),
        id: lastReg.id,
        field: 'createdAt',
      });
    }

    // Format tournaments
    const formattedTournaments = results.map(reg => ({
      id: reg.tournament.id,
      registrationId: reg.id,
      name: reg.tournament.name,
      type: reg.tournament.type,
      scope: reg.tournament.scope,
      location: {
        city: reg.tournament.city,
        state: reg.tournament.state,
      },
      dates: {
        start: reg.tournament.startDate?.toISOString() || null,
        end: reg.tournament.endDate?.toISOString() || null,
      },
      status: reg.tournament.status,
      registrationStatus: reg.status,
      bannerImage: getCDNUrl(reg.tournament.bannerImage),
      prize: {
        pool: reg.tournament.prizePool,
        won: reg.tournamentResult?.prize || null,
      },
      entryFee: reg.tournament.entryFee,
      participants: {
        current: reg.tournament._count.registrations,
        max: reg.tournament.maxPlayers,
      },
      result: reg.tournamentResult ? {
        rank: reg.tournamentResult.rank,
        prize: reg.tournamentResult.prize,
      } : null,
      registeredAt: reg.createdAt.toISOString(),
    }));

    const response = NextResponse.json({
      success: true,
      data: formattedTournaments,
      meta: {
        nextCursor,
        hasMore,
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Player Tournaments] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch tournaments',
      undefined,
      500
    );
  }
}
