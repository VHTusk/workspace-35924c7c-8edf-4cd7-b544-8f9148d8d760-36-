/**
 * V1 Players Profile API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/players/:id?sport=CORNHOLE
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getCDNUrl } from '@/lib/cdn-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Valid sport parameter required',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    // Get player basic info
    const player = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        state: true,
        district: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!player) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'Player not found',
        undefined,
        404
      );
    }

    // Get sport stats
    const sportStats = await db.sportStats.findUnique({
      where: {
        userId_sport: { userId: id, sport: sport as SportType },
      },
    });

    // Get follower/following counts
    const [followersCount, followingCount] = await Promise.all([
      db.userFollow.count({
        where: { followingId: id, sport: sport as SportType },
      }),
      db.userFollow.count({
        where: { followerId: id, sport: sport as SportType },
      }),
    ]);

    // Calculate rank
    const allStats = await db.sportStats.findMany({
      where: { sport: sport as SportType },
      orderBy: { visiblePoints: 'desc' },
      select: { userId: true },
    });
    const rank = allStats.findIndex((s) => s.userId === id) + 1 || null;

    return apiSuccess({
      player: {
        id: player.id,
        name: `${player.firstName} ${player.lastName}`,
        city: player.city,
        state: player.state,
        district: player.district,
        avatar: getCDNUrl(player.avatar),
        memberSince: player.createdAt.toISOString(),
      },
      stats: {
        points: sportStats?.visiblePoints || 0,
        elo: sportStats?.hiddenElo || 1000,
        wins: sportStats?.wins || 0,
        losses: sportStats?.losses || 0,
        winStreak: sportStats?.winStreak || 0,
        tier: sportStats?.tier || 'UNRANKED',
        rank,
      },
      social: {
        followers: followersCount,
        following: followingCount,
      },
    });
  } catch (error) {
    console.error('[V1 Players] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch player profile',
      undefined,
      500
    );
  }
}
