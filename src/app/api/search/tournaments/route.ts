/**
 * Full-Text Search API for Tournaments
 * 
 * Query params:
 * - q (query): Search by name, location
 * - sport: Required sport filter
 * - status: Filter by status (comma-separated: DRAFT, REGISTRATION_OPEN, etc.)
 * - type: Filter by type (INDIVIDUAL, INTER_ORG, INTRA_ORG)
 * - scope: Filter by scope (CITY, DISTRICT, STATE, NATIONAL)
 * - startDate: Filter tournaments starting on/after this date
 * - endDate: Filter tournaments ending on/before this date
 * - limit: Results per page (default 20, max 100)
 * - offset: Pagination offset (default 0)
 * 
 * Features:
 * - Case-insensitive full-text search on name, location
 * - Multiple status filtering
 * - Date range filtering
 * - Relevance scoring based on match quality
 * - Registration count for each tournament
 * - Proper pagination with total count
 * - Rate limiting: 20/min unauthenticated, 60/min authenticated
 * - Abuse detection and automatic blocking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheGetOrSet, buildCacheKey, CACHE_TTL } from '@/lib/cache';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withSearchProtection } from '@/lib/search-protection';

interface TournamentSearchResult {
  id: string;
  name: string;
  type: string;
  scope: string | null;
  status: string;
  location: string;
  city: string | null;
  state: string | null;
  startDate: Date;
  endDate: Date;
  regDeadline: Date;
  entryFee: number;
  earlyBirdFee: number | null;
  prizePool: number;
  maxPlayers: number;
  registrationsCount: number;
  availableSpots: number;
  isPublic: boolean;
  bracketFormat: string | null;
  relevanceScore: number;
  daysUntilStart: number;
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(
  tournament: { name: string; location: string; city: string | null; state: string | null },
  query: string
): number {
  if (!query) return 0;
  
  const lowerQuery = query.toLowerCase();
  const searchTerms = lowerQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  
  const name = tournament.name.toLowerCase();
  const location = tournament.location.toLowerCase();
  const city = (tournament.city || '').toLowerCase();
  const state = (tournament.state || '').toLowerCase();
  
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
    // Location exact match
    else if (location === term) {
      score += 50;
    }
    // Location contains query
    else if (location.includes(term)) {
      score += 40;
    }
    // City match
    else if (city.includes(term)) {
      score += 30;
    }
    // State match
    else if (state.includes(term)) {
      score += 20;
    }
  }
  
  return score;
}

/**
 * Calculate days until tournament starts
 */
function calculateDaysUntilStart(startDate: Date): number {
  const now = new Date();
  const start = new Date(startDate);
  const diffTime = start.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Internal search handler (protected by middleware)
 */
async function searchTournamentsHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const query = searchParams.get('q') || '';
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const scope = searchParams.get('scope');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
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
    'tournaments', 
    sportUpper, 
    query, 
    status || 'all', 
    type || 'all',
    scope || 'all',
    startDate || 'no-start',
    endDate || 'no-end',
    limit, 
    offset
  );

  const results = await cacheGetOrSet<TournamentSearchResult[]>(
    cacheKey,
    async () => {
      // Build WHERE conditions
      const conditions: Record<string, unknown>[] = [
        { sport: sportUpper },
      ];

      // Full-text search on name, location
      // Note: SQLite is case-insensitive by default for contains
      if (query) {
        const searchTerms = query.split(/\s+/).filter(Boolean);
        conditions.push({
          OR: searchTerms.flatMap(term => [
            { name: { contains: term } },
            { location: { contains: term } },
            { city: { contains: term } },
            { state: { contains: term } },
          ]),
        });
      }

      // Status filter (supports multiple comma-separated values)
      if (status) {
        const statuses = status.split(',').map(s => s.trim().toUpperCase());
        conditions.push({ status: { in: statuses } });
      }

      // Type filter
      if (type) {
        conditions.push({ type: type.toUpperCase() });
      }

      // Scope filter
      if (scope) {
        conditions.push({ scope: scope.toUpperCase() });
      }

      // Date range filters
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          conditions.push({ startDate: { gte: start } });
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          conditions.push({ endDate: { lte: end } });
        }
      }

      // Execute query
      const tournaments = await db.tournament.findMany({
        where: { AND: conditions },
        select: {
          id: true,
          name: true,
          type: true,
          scope: true,
          status: true,
          location: true,
          city: true,
          state: true,
          startDate: true,
          endDate: true,
          regDeadline: true,
          entryFee: true,
          earlyBirdFee: true,
          prizePool: true,
          maxPlayers: true,
          isPublic: true,
          bracketFormat: true,
          _count: {
            select: { registrations: true },
          },
        },
        orderBy: [
          { startDate: 'asc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      });

      // Transform and calculate relevance scores
      return tournaments.map(tournament => {
        const relevanceScore = calculateRelevanceScore(tournament, query);
        const daysUntilStart = calculateDaysUntilStart(tournament.startDate);
        
        return {
          id: tournament.id,
          name: tournament.name,
          type: tournament.type,
          scope: tournament.scope,
          status: tournament.status,
          location: tournament.location,
          city: tournament.city,
          state: tournament.state,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          regDeadline: tournament.regDeadline,
          entryFee: tournament.entryFee,
          earlyBirdFee: tournament.earlyBirdFee,
          prizePool: tournament.prizePool,
          maxPlayers: tournament.maxPlayers,
          registrationsCount: tournament._count.registrations,
          availableSpots: tournament.maxPlayers - tournament._count.registrations,
          isPublic: tournament.isPublic,
          bracketFormat: tournament.bracketFormat,
          relevanceScore,
          daysUntilStart,
        };
      }).sort((a, b) => {
        // Sort by relevance first if query exists, then by start date
        if (query) {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }
        return a.daysUntilStart - b.daysUntilStart;
      });
    },
    CACHE_TTL.ACTIVE_TOURNAMENTS
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
        { location: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
      ]),
    });
  }

  if (status) {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    countConditions.push({ status: { in: statuses } });
  }

  if (type) {
    countConditions.push({ type: type.toUpperCase() });
  }

  if (scope) {
    countConditions.push({ scope: scope.toUpperCase() });
  }

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      countConditions.push({ startDate: { gte: start } });
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      countConditions.push({ endDate: { lte: end } });
    }
  }

  const totalCount = await db.tournament.count({
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
        status: status ? status.split(',').map(s => s.trim().toUpperCase()) : null,
        type: type ? type.toUpperCase() : null,
        scope: scope ? scope.toUpperCase() : null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });

  addVersionHeaders(response);
  return response;
}

// Export protected GET handler
export const GET = withSearchProtection(searchTournamentsHandler, 'tournaments');
