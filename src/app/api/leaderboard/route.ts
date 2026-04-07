/**
 * Leaderboard API with Caching and Dynamic Filters
 * GET /api/leaderboard - Get leaderboard with caching support
 * 
 * Filters:
 * - gender: MALE, FEMALE, MIXED, or all
 * - ageCategory: JUNIOR (under 18), ADULT (18-35), SENIOR (35-50), VETERAN (50+), or all
 * - scope: district, state, national
 * - location: filter value for scope
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
import { SportType, GenderCategory } from '@prisma/client';
import { getEloTier } from '@/lib/auth';
import { safeParseInt } from '@/lib/validation';
import { log } from '@/lib/logger';
import {
  cacheResponse,
  generateCacheKeyFromParts,
  addCacheHeaders,
  API_CACHE_PREFIXES,
  ENDPOINT_CACHE_CONFIGS,
} from '@/lib/api-cache';

// Age categories with date ranges
type AgeCategory = 'JUNIOR' | 'ADULT' | 'SENIOR' | 'VETERAN';

function getAgeCategoryFromDate(dob: Date): AgeCategory | null {
  const today = new Date();
  const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  
  if (age < 18) return 'JUNIOR';
  if (age < 35) return 'ADULT';
  if (age < 50) return 'SENIOR';
  return 'VETERAN';
}

function getDateRangeForAgeCategory(category: AgeCategory): { minDate: Date; maxDate: Date } {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  switch (category) {
    case 'JUNIOR':
      // Under 18: born after (currentYear - 18)
      return {
        minDate: new Date(currentYear - 17, 0, 1), // Born in or after this year
        maxDate: today, // Can be as young as today
      };
    case 'ADULT':
      // 18-35: born between (currentYear - 35) and (currentYear - 18)
      return {
        minDate: new Date(currentYear - 35, 0, 1),
        maxDate: new Date(currentYear - 18, 11, 31),
      };
    case 'SENIOR':
      // 35-50: born between (currentYear - 50) and (currentYear - 35)
      return {
        minDate: new Date(currentYear - 50, 0, 1),
        maxDate: new Date(currentYear - 35, 11, 31),
      };
    case 'VETERAN':
      // 50+: born before (currentYear - 50)
      return {
        minDate: new Date(1900, 0, 1), // Reasonable minimum
        maxDate: new Date(currentYear - 50, 11, 31),
      };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const scope = searchParams.get('scope'); // district, state, national
    const location = searchParams.get('location');
    const search = searchParams.get('search');
    const limit = safeParseInt(searchParams.get('limit'), 100, 1, 100);
    
    // Dynamic filters
    const gender = searchParams.get('gender') as GenderCategory | null;
    const ageCategory = searchParams.get('ageCategory') as AgeCategory | null;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Generate cache key with all filters
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.LEADERBOARD,
      sport,
      scope || 'national',
      location || 'all',
      gender || 'all',
      ageCategory || 'all',
      search || '',
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
        const where: Record<string, unknown> = {
          sport,
          isActive: true,
          isAnonymized: false,
        };

        // Filter by gender
        if (gender && ['MALE', 'FEMALE', 'MIXED'].includes(gender)) {
          where.gender = gender as GenderCategory;
        }

        // Filter by age category
        if (ageCategory && ['JUNIOR', 'ADULT', 'SENIOR', 'VETERAN'].includes(ageCategory)) {
          const dateRange = getDateRangeForAgeCategory(ageCategory);
          where.dob = {
            gte: dateRange.minDate,
            lte: dateRange.maxDate,
          };
        }

        // Filter by location based on scope
        if (scope && location && ['district', 'state', 'city'].includes(scope.toLowerCase())) {
          where[scope.toLowerCase()] = location;
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
          take: limit,
          include: {
            rating: true,
          },
        });

        const leaderboard = users.map((user, index) => ({
          rank: index + 1,
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          city: user.city,
          state: user.state,
          district: user.district,
          gender: user.gender,
          dob: user.dob,
          ageCategory: user.dob ? getAgeCategoryFromDate(user.dob) : null,
          points: user.visiblePoints,
          tier: getEloTier(user.hiddenElo, user.rating?.matchesPlayed || 0),
          matches: user.rating?.matchesPlayed || 0,
          wins: user.rating?.wins || 0,
          winRate: user.rating?.matchesPlayed 
            ? Math.round((user.rating.wins / user.rating.matchesPlayed) * 100) 
            : 0,
          elo: Math.round(user.hiddenElo),
          change: 0, // Would need historical data for this
        }));

        // Get stats
        const totalPlayers = await db.user.count({
          where: { sport, isActive: true, isAnonymized: false },
        });

        const activeThisMonth = await db.user.count({
          where: {
            sport,
            isActive: true,
            isAnonymized: false,
            updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });

        // Get unique locations for filters
        const [districts, states] = await Promise.all([
          db.user.findMany({
            where: { sport, isActive: true, isAnonymized: false, district: { not: null } },
            select: { district: true },
            distinct: ['district'],
          }),
          db.user.findMany({
            where: { sport, isActive: true, isAnonymized: false, state: { not: null } },
            select: { state: true },
            distinct: ['state'],
          }),
        ]);

        return {
          leaderboard,
          stats: {
            totalPlayers,
            activeThisMonth,
            topPlayer: leaderboard[0]?.name || null,
            topPlayerCity: leaderboard[0]?.city || null,
          },
          filters: {
            districts: districts.map(d => d.district).filter(Boolean) as string[],
            states: states.map(s => s.state).filter(Boolean) as string[],
            genders: ['MALE', 'FEMALE', 'MIXED'] as GenderCategory[],
            ageCategories: ['JUNIOR', 'ADULT', 'SENIOR', 'VETERAN'] as AgeCategory[],
          },
        };
      }
    );

    // Build response with cache headers
    const response = NextResponse.json(result.data);
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
    
  } catch (error) {
    log.errorWithStack('Error fetching leaderboard', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
