/**
 * Full-Text Search API for Players
 * 
 * Query params: 
 * - q (query): Search by name, city, state
 * - sport: Required sport filter
 * - city: Filter by city
 * - state: Filter by state
 * - minPoints: Minimum visible points filter
 * - maxPoints: Maximum visible points filter
 * - limit: Results per page (default 20, max 100)
 * - offset: Pagination offset (default 0)
 * 
 * Features:
 * - Case-insensitive full-text search on name, city, state
 * - Points range filtering
 * - Relevance scoring based on match quality
 * - Tier calculation from ELO
 * - Proper pagination with total count
 * - Rate limiting: 20/min unauthenticated, 60/min authenticated
 * - Abuse detection and automatic blocking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheGetOrSet, buildCacheKey, CACHE_TTL } from '@/lib/cache';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withSearchProtection } from '@/lib/search-protection';

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  city: string | null;
  state: string | null;
  visiblePoints: number;
  hiddenElo: number;
  tier: string;
  matchesPlayed: number;
  wins: number;
  avatar: string | null;
  relevanceScore: number;
}

/**
 * Calculate tier from ELO rating
 */
function calculateTier(elo: number): string {
  if (elo >= 1900) return 'diamond';
  if (elo >= 1700) return 'platinum';
  if (elo >= 1500) return 'gold';
  if (elo >= 1300) return 'silver';
  if (elo >= 1000) return 'bronze';
  return 'unranked';
}

/**
 * Calculate relevance score for search results
 * Higher score = better match
 */
function calculateRelevanceScore(
  player: { firstName: string; lastName: string; city: string | null; state: string | null },
  query: string
): number {
  if (!query) return 0;
  
  const lowerQuery = query.toLowerCase();
  const searchTerms = lowerQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  
  const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
  const firstName = player.firstName.toLowerCase();
  const lastName = player.lastName.toLowerCase();
  const city = (player.city || '').toLowerCase();
  const state = (player.state || '').toLowerCase();
  
  for (const term of searchTerms) {
    // Exact name match (highest priority)
    if (fullName === term) {
      score += 100;
    }
    // Full name starts with query
    else if (fullName.startsWith(term)) {
      score += 80;
    }
    // First name exact match
    else if (firstName === term) {
      score += 70;
    }
    // Last name exact match
    else if (lastName === term) {
      score += 60;
    }
    // Name contains query
    else if (fullName.includes(term)) {
      score += 50;
    }
    // First name starts with query
    else if (firstName.startsWith(term)) {
      score += 40;
    }
    // Last name starts with query
    else if (lastName.startsWith(term)) {
      score += 35;
    }
    // City match
    else if (city.includes(term)) {
      score += 20;
    }
    // State match
    else if (state.includes(term)) {
      score += 15;
    }
  }
  
  return score;
}

/**
 * Internal search handler (protected by middleware)
 */
async function searchPlayersHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const query = searchParams.get('q') || '';
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const minPoints = searchParams.get('minPoints');
  const maxPoints = searchParams.get('maxPoints');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  // Sport is required
  if (!sport) {
    return NextResponse.json({ 
      success: false,
      error: 'Sport parameter is required' 
    }, { status: 400 });
  }

  // Validate sport value
  const validSports = ['CORNHOLE', 'DARTS'];
  const sportUpper = sport.toUpperCase();
  if (!validSports.includes(sportUpper)) {
    return NextResponse.json({ 
      success: false,
      error: 'Invalid sport. Must be CORNHOLE or DARTS' 
    }, { status: 400 });
  }

  // Build cache key
  const cacheKey = buildCacheKey(
    'search', 
    'players', 
    sportUpper, 
    query, 
    city || 'all', 
    state || 'all',
    minPoints || 'min',
    maxPoints || 'max',
    limit, 
    offset
  );

  const results = await cacheGetOrSet<PlayerSearchResult[]>(
    cacheKey,
    async () => {
      // Build WHERE conditions
      const conditions: Record<string, unknown>[] = [
        { sport: sportUpper },
        { isActive: true },
      ];

      // Full-text search on name, city, state
      // Note: SQLite is case-insensitive by default for contains
      if (query) {
        const searchTerms = query.split(/\s+/).filter(Boolean);
        conditions.push({
          OR: searchTerms.flatMap(term => [
            { firstName: { contains: term } },
            { lastName: { contains: term } },
            { city: { contains: term } },
            { state: { contains: term } },
          ]),
        });
      }

      // Location filters
      if (city) {
        conditions.push({ city: { contains: city } });
      }
      if (state) {
        conditions.push({ state: { contains: state } });
      }

      // Points range filters
      if (minPoints) {
        const min = parseInt(minPoints);
        if (!isNaN(min)) {
          conditions.push({ visiblePoints: { gte: min } });
        }
      }
      if (maxPoints) {
        const max = parseInt(maxPoints);
        if (!isNaN(max)) {
          conditions.push({ visiblePoints: { lte: max } });
        }
      }

      // Execute query with profile info
      const players = await db.user.findMany({
        where: { AND: conditions },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          visiblePoints: true,
          hiddenElo: true,
          photoUrl: true,
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
            },
          },
        },
        orderBy: [
          { visiblePoints: 'desc' },
          { hiddenElo: 'desc' },
        ],
        take: limit,
        skip: offset,
      });

      // Transform and calculate relevance scores
      return players.map(player => {
        const relevanceScore = calculateRelevanceScore(player, query);
        
        return {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          fullName: `${player.firstName} ${player.lastName}`,
          city: player.city,
          state: player.state,
          visiblePoints: player.visiblePoints,
          hiddenElo: Math.round(player.hiddenElo),
          tier: calculateTier(player.hiddenElo),
          matchesPlayed: player.rating?.matchesPlayed || 0,
          wins: player.rating?.wins || 0,
          avatar: player.photoUrl,
          relevanceScore,
        };
      }).sort((a, b) => {
        // Sort by relevance first if query exists, then by points
        if (query) {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }
        return b.visiblePoints - a.visiblePoints;
      });
    },
    CACHE_TTL.LEADERBOARD
  );

  // Get total count for pagination
  const countConditions: Record<string, unknown>[] = [
    { sport: sportUpper },
    { isActive: true },
  ];

  if (query) {
    const searchTerms = query.split(/\s+/).filter(Boolean);
    countConditions.push({
      OR: searchTerms.flatMap(term => [
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
      ]),
    });
  }

  if (city) {
    countConditions.push({ city: { contains: city } });
  }
  if (state) {
    countConditions.push({ state: { contains: state } });
  }

  if (minPoints) {
    const min = parseInt(minPoints);
    if (!isNaN(min)) {
      countConditions.push({ visiblePoints: { gte: min } });
    }
  }
  if (maxPoints) {
    const max = parseInt(maxPoints);
    if (!isNaN(max)) {
      countConditions.push({ visiblePoints: { lte: max } });
    }
  }

  const totalCount = await db.user.count({
    where: { AND: countConditions },
  });

  const response = NextResponse.json({
    success: true,
    data: {
      results,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      filters: {
        query: query || null,
        sport: sportUpper,
        city: city || null,
        state: state || null,
        minPoints: minPoints ? parseInt(minPoints) : null,
        maxPoints: maxPoints ? parseInt(maxPoints) : null,
      },
    },
  });

  addVersionHeaders(response);
  return response;
}

// Export protected GET handler
export const GET = withSearchProtection(searchPlayersHandler, 'players');
