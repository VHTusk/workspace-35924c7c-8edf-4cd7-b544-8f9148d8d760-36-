/**
 * Full-Text Search API for Organizations
 * 
 * Query params:
 * - q (query): Search by name, city, state
 * - sport: Required sport filter
 * - type: Filter by organization type (CLUB, SCHOOL, CORPORATE, ACADEMY)
 * - city: Filter by city
 * - state: Filter by state
 * - limit: Results per page (default 20, max 100)
 * - offset: Pagination offset (default 0)
 * 
 * Features:
 * - Case-insensitive full-text search on name, city, state
 * - Organization type filtering
 * - Relevance scoring based on match quality
 * - Member count and statistics
 * - Proper pagination with total count
 * - Rate limiting: 20/min unauthenticated, 60/min authenticated
 * - Abuse detection and automatic blocking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheGetOrSet, buildCacheKey, CACHE_TTL } from '@/lib/cache';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withSearchProtection } from '@/lib/search-protection';

interface OrganizationSearchResult {
  id: string;
  name: string;
  type: string;
  planTier: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  memberCount: number;
  activeMembers: number;
  tournamentsHosted: number;
  tournamentsWon: number;
  totalWins: number;
  avgMemberElo: number;
  relevanceScore: number;
  isSubscribed: boolean;
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(
  org: { name: string; city: string | null; state: string | null },
  query: string
): number {
  if (!query) return 0;
  
  const lowerQuery = query.toLowerCase();
  const searchTerms = lowerQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  
  const name = org.name.toLowerCase();
  const city = (org.city || '').toLowerCase();
  const state = (org.state || '').toLowerCase();
  
  for (const term of searchTerms) {
    // Exact name match (highest priority)
    if (name === term) {
      score += 100;
    }
    // Name starts with query
    else if (name.startsWith(term)) {
      score += 80;
    }
    // Name contains query
    else if (name.includes(term)) {
      score += 60;
    }
    // City exact match
    else if (city === term) {
      score += 50;
    }
    // City contains query
    else if (city.includes(term)) {
      score += 40;
    }
    // State match
    else if (state.includes(term)) {
      score += 30;
    }
  }
  
  return score;
}

/**
 * Internal search handler (protected by middleware)
 */
async function searchOrgsHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
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
    'orgs', 
    sportUpper, 
    query, 
    type || 'all', 
    city || 'all',
    state || 'all',
    limit, 
    offset
  );

  const results = await cacheGetOrSet<OrganizationSearchResult[]>(
    cacheKey,
    async () => {
      // Build WHERE conditions
      const conditions: Record<string, unknown>[] = [
        { sport: sportUpper },
      ];

      // Full-text search on name, city, state
      // Note: SQLite is case-insensitive by default for contains
      if (query) {
        const searchTerms = query.split(/\s+/).filter(Boolean);
        conditions.push({
          OR: searchTerms.flatMap(term => [
            { name: { contains: term } },
            { city: { contains: term } },
            { state: { contains: term } },
          ]),
        });
      }

      // Type filter
      if (type) {
        conditions.push({ type: type.toUpperCase() });
      }

      // Location filters
      if (city) {
        conditions.push({ city: { contains: city } });
      }
      if (state) {
        conditions.push({ state: { contains: state } });
      }

      // Execute query
      const orgs = await db.organization.findMany({
        where: { AND: conditions },
        select: {
          id: true,
          name: true,
          type: true,
          planTier: true,
          city: true,
          state: true,
          logoUrl: true,
          subscription: {
            select: {
              status: true,
              endDate: true,
            },
          },
          statistics: {
            select: {
              totalMembers: true,
              activeMembers: true,
              tournamentsHosted: true,
              tournamentsWon: true,
              totalWins: true,
              avgMemberElo: true,
            },
          },
          _count: {
            select: { roster: true },
          },
        },
        orderBy: [
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      });

      // Transform and calculate relevance scores
      return orgs.map(org => {
        const relevanceScore = calculateRelevanceScore(org, query);
        const now = new Date();
        const isSubscribed = org.subscription?.status === 'ACTIVE' && 
          (!org.subscription.endDate || new Date(org.subscription.endDate) > now);
        
        return {
          id: org.id,
          name: org.name,
          type: org.type,
          planTier: org.planTier,
          city: org.city,
          state: org.state,
          logoUrl: org.logoUrl,
          memberCount: org._count.roster,
          activeMembers: org.statistics?.activeMembers || 0,
          tournamentsHosted: org.statistics?.tournamentsHosted || 0,
          tournamentsWon: org.statistics?.tournamentsWon || 0,
          totalWins: org.statistics?.totalWins || 0,
          avgMemberElo: Math.round(org.statistics?.avgMemberElo || 0),
          relevanceScore,
          isSubscribed,
        };
      }).sort((a, b) => {
        // Sort by relevance first if query exists, then by member count
        if (query) {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }
        // Sort by member count (popularity)
        return b.memberCount - a.memberCount;
      });
    },
    CACHE_TTL.ORG_STATS
  );

  // Build count conditions
  const countConditions: Record<string, unknown>[] = [
    { sport: sportUpper },
  ];

  if (query) {
    const searchTerms = query.split(/\s+/).filter(Boolean);
    countConditions.push({
      OR: searchTerms.flatMap(term => [
        { name: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
      ]),
    });
  }

  if (type) {
    countConditions.push({ type: type.toUpperCase() });
  }

  if (city) {
    countConditions.push({ city: { contains: city } });
  }
  if (state) {
    countConditions.push({ state: { contains: state } });
  }

  const totalCount = await db.organization.count({
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
        type: type ? type.toUpperCase() : null,
        city: city || null,
        state: state || null,
      },
    },
  });

  addVersionHeaders(response);
  return response;
}

// Export protected GET handler
export const GET = withSearchProtection(searchOrgsHandler, 'orgs');
