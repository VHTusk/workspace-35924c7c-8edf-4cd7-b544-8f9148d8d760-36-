/**
 * Public Tournaments API with Caching
 * GET /api/public/tournaments - Get public tournaments list
 * 
 * Cache Configuration:
 * - TTL: 30 seconds
 * - Stale-while-revalidate: 15 seconds
 * - Invalidate on: Tournament status change
 * 
 * Cache Headers:
 * - X-Cache: HIT/MISS/STALE
 * - X-Cache-TTL: remaining seconds
 * - Cache-Control: public, max-age=30
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, SportType } from '@prisma/client';
import {
  cacheResponse,
  generateCacheKeyFromParts,
  addCacheHeaders,
  API_CACHE_PREFIXES,
  ENDPOINT_CACHE_CONFIGS,
} from '@/lib/api-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const status = searchParams.get('status') || 'REGISTRATION_OPEN,IN_PROGRESS';
    const scope = searchParams.get('scope');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Generate cache key based on all query parameters
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.TOURNAMENT_LIST,
      sport || 'all',
      `status:${status}`,
      scope || 'all',
      city || 'all',
      state || 'all',
      search || '',
      `page:${page}`,
      `limit:${limit}`
    );

    // Get cache config
    const cacheConfig = ENDPOINT_CACHE_CONFIGS.tournamentList;

    // Execute with caching
    const result = await cacheResponse(
      request,
      cacheKey,
      cacheConfig,
      async () => {
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Record<string, unknown> = {
          isPublic: true,
        };

        // Sport filter
        if (sport && ['CORNHOLE', 'DARTS'].includes(sport.toUpperCase())) {
          where.sport = sport.toUpperCase() as SportType;
        }

        // Status filter (can be comma-separated)
        if (status) {
          const statuses = status.split(',').filter(s => 
            ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(s)
          );
          if (statuses.length > 0) {
            where.status = { in: statuses as TournamentStatus[] };
          }
        } else {
          // Default: show tournaments that are open for registration or in progress
          where.status = { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] as TournamentStatus[] };
        }

        // Scope filter
        if (scope && ['CITY', 'DISTRICT', 'STATE', 'NATIONAL'].includes(scope.toUpperCase())) {
          where.scope = scope.toUpperCase();
        }

        // City filter (SQLite is case-insensitive by default for contains)
        if (city) {
          where.city = { contains: city };
        }

        // State filter
        if (state) {
          where.state = state;
        }

        // Search filter (SQLite is case-insensitive by default for contains)
        if (search) {
          where.OR = [
            { name: { contains: search } },
            { location: { contains: search } },
          ];
        }

        // Get tournaments with registration counts
        const tournaments = await db.tournament.findMany({
          where,
          include: {
            hostOrg: {
              select: { id: true, name: true, logoUrl: true },
            },
            _count: {
              select: { registrations: true },
            },
          },
          orderBy: [
            { startDate: 'asc' },
          ],
          skip,
          take: limit,
        });

        // Get total count
        const total = await db.tournament.count({ where });

        // Transform for public view
        const publicTournaments = tournaments.map(t => ({
          id: t.id,
          name: t.name,
          sport: t.sport,
          type: t.type,
          scope: t.scope,
          location: t.location,
          city: t.city,
          state: t.state,
          startDate: t.startDate,
          endDate: t.endDate,
          regDeadline: t.regDeadline,
          prizePool: t.prizePool,
          entryFee: t.entryFee,
          maxPlayers: t.maxPlayers,
          currentRegistrations: t._count.registrations,
          status: t.status,
          bracketFormat: t.bracketFormat,
          hostOrg: t.hostOrg,
          earlyBirdFee: t.earlyBirdFee,
          earlyBirdDeadline: t.earlyBirdDeadline,
        }));

        return {
          tournaments: publicTournaments,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }
    );

    // Build response with cache headers
    const response = NextResponse.json(result.data);
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
    
  } catch (error) {
    console.error('Error fetching public tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}
