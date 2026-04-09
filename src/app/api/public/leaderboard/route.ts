/**
 * Public Leaderboard API with Caching
 * GET /api/public/leaderboard - Public leaderboard with caching (no auth required)
 * 
 * Cache Configuration:
 * - TTL: 60 seconds
 * - Stale-while-revalidate: 30 seconds
 * - Invalidate on: Match score submission
 * 
 * Cache Headers:
 * - X-Cache: HIT/MISS/STALE
 * - X-Cache-TTL: remaining seconds
 * - Cache-Control: public, max-age=60
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getEloTier } from '@/lib/auth';
import { buildLeaderboardEligibleUserWhere } from '@/lib/user-sport';
import {
  cacheResponse,
  generateCacheKeyFromParts,
  addCacheHeaders,
  API_CACHE_PREFIXES,
  ENDPOINT_CACHE_CONFIGS,
} from '@/lib/api-cache';

// Public leaderboard - no authentication required
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const scope = searchParams.get('scope'); // city, district, state, national
    const location = searchParams.get('location');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Generate cache key
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.LEADERBOARD,
      'public',
      sport,
      scope || 'national',
      location || 'all',
      search || '',
      `page:${page}`,
      `limit:${limit}`
    );

    // Get cache config
    const cacheConfig = ENDPOINT_CACHE_CONFIGS.leaderboard;

    // Execute with caching
    const result = await cacheResponse(
      request,
      cacheKey,
      cacheConfig,
      async () => {
        const skip = (page - 1) * limit;

        const where = buildLeaderboardEligibleUserWhere(sport, { requirePublic: true });

        // Filter by location based on scope
        if (scope && scope !== 'national' && location) {
          if (scope.toLowerCase() === 'district') {
            where.district = location;
          } else if (scope.toLowerCase() === 'state') {
            where.state = location;
          } else if (scope.toLowerCase() === 'city') {
            where.city = location;
          }
        }

        if (search) {
          where.OR = [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { city: { contains: search } },
          ];
        }

        const users = await db.user.findMany({
          where,
          orderBy: { visiblePoints: 'desc' },
          skip,
          take: limit,
          include: {
            rating: true,
          },
        });

        // Get total count for pagination
        const totalPlayers = await db.user.count({ where });

        const leaderboard = users.map((user, index) => ({
          rank: skip + index + 1,
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          city: user.city,
          state: user.state,
          points: user.visiblePoints,
          tier: getEloTier(user.hiddenElo, user.rating?.matchesPlayed || 0),
          matches: user.rating?.matchesPlayed || 0,
          wins: user.rating?.wins || 0,
          winRate: user.rating?.matchesPlayed 
            ? Math.round((user.rating.wins / user.rating.matchesPlayed) * 100) 
            : 0,
        }));

        // Get stats for SEO
        const activeThisMonth = await db.user.count({
          where: {
            ...buildLeaderboardEligibleUserWhere(sport, { requirePublic: true }),
            updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });

        // Get top player for meta
        const topPlayer = await db.user.findFirst({
          where: buildLeaderboardEligibleUserWhere(sport, { requirePublic: true }),
          orderBy: { visiblePoints: 'desc' },
          select: { firstName: true, lastName: true, city: true }
        });

        return {
          leaderboard,
          pagination: {
            page,
            limit,
            total: totalPlayers,
            totalPages: Math.ceil(totalPlayers / limit)
          },
          stats: {
            totalPlayers,
            activeThisMonth,
            topPlayer: topPlayer ? `${topPlayer.firstName} ${topPlayer.lastName}` : null,
            topPlayerCity: topPlayer?.city || null
          },
          sport,
          scope: scope || 'national'
        };
      }
    );

    // Build response with cache headers
    const response = NextResponse.json(result.data);
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
    
  } catch (error) {
    console.error('Error fetching public leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
