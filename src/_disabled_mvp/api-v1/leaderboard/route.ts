/**
 * V1 Leaderboard API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/leaderboard?sport=CORNHOLE&page=1&limit=50
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes, apiPaginated } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Valid sport parameter required',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    // Get total count
    const total = await db.sportStats.count({
      where: {
        sport: sport as SportType,
        user: { isActive: true },
      },
    });

    // Get leaderboard
    const leaderboard = await db.sportStats.findMany({
      where: {
        sport: sport as SportType,
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { visiblePoints: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate ranks
    const startRank = (page - 1) * limit;

    return apiPaginated(
      leaderboard.map((entry, index) => ({
        rank: startRank + index + 1,
        player: {
          id: entry.user.id,
          name: `${entry.user.firstName} ${entry.user.lastName}`,
          city: entry.user.city,
          state: entry.user.state,
        },
        stats: {
          points: entry.visiblePoints,
          elo: entry.hiddenElo,
          tier: entry.tier,
          wins: entry.wins,
          losses: entry.losses,
          winRate:
            entry.wins + entry.losses > 0
              ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
              : 0,
          matchesPlayed: entry.matchesPlayed,
        },
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
    console.error('[V1 Leaderboard] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch leaderboard',
      undefined,
      500
    );
  }
}
