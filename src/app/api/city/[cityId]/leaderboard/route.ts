/**
 * City Leaderboard API with Caching
 * GET /api/city/[cityId]/leaderboard - Get city leaderboard (Module 2)
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
import { getCityLeaderboard } from '@/lib/city-utils';
import { SportType } from '@prisma/client';
import {
  cacheResponse,
  generateCacheKeyFromParts,
  addCacheHeaders,
  API_CACHE_PREFIXES,
  ENDPOINT_CACHE_CONFIGS,
} from '@/lib/api-cache';

// GET /api/city/[cityId]/leaderboard
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const period = searchParams.get('period') || 'ALL_TIME';

    // Generate cache key
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.CITY_LEADERBOARD,
      cityId,
      `period:${period}`,
      `limit:${limit}`,
      `offset:${offset}`
    );

    // Get cache config
    const cacheConfig = ENDPOINT_CACHE_CONFIGS.cityLeaderboard;

    // Execute with caching
    const result = await cacheResponse(
      request,
      cacheKey,
      cacheConfig,
      async () => {
        // Find city
        let city = await db.city.findUnique({
          where: { cityId },
        });

        if (!city) {
          city = await db.city.findUnique({
            where: { id: cityId },
          });
        }

        if (!city) {
          return null;
        }

        // Get leaderboard
        const leaderboard = await getCityLeaderboard(
          city.id,
          city.sport as SportType,
          limit,
          period
        );

        return {
          city: {
            id: city.id,
            cityId: city.cityId,
            cityName: city.cityName,
            state: city.state,
            sport: city.sport,
          },
          leaderboard: leaderboard.slice(offset, offset + limit),
          pagination: {
            total: leaderboard.length,
            limit,
            offset,
          },
          period,
        };
      }
    );

    // Handle null result (city not found)
    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Build response with cache headers
    const response = NextResponse.json({
      success: true,
      data: result.data,
    });
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
    
  } catch (error) {
    console.error('Error fetching city leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch city leaderboard' },
      { status: 500 }
    );
  }
}
