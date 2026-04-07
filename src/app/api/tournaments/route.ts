import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, TournamentStatus, TournamentType, TournamentScope, BracketFormat, GenderCategory, ScoringMode } from '@prisma/client';
import { getOrgSession } from '@/lib/auth/org-session';
import { log } from '@/lib/logger';
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
    const sport = searchParams.get('sport') as SportType;
    const status = searchParams.get('status') as TournamentStatus | null;
    const scope = searchParams.get('scope');
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const district = searchParams.get('district');
    const state = searchParams.get('state');
    const gender = searchParams.get('gender');
    const ageCategory = searchParams.get('ageCategory');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // PERFORMANCE: Use caching for public tournament list
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.TOURNAMENT_LIST,
      sport,
      status || 'all',
      scope || 'all',
      city || 'all',
      district || 'all',
      state || 'all',
      gender || 'all',
      ageCategory || 'all',
      search || ''
    );

    const cacheConfig = ENDPOINT_CACHE_CONFIGS.tournamentList;

    const result = await cacheResponse(
      request,
      cacheKey,
      cacheConfig,
      async () => {
        const where: Record<string, unknown> = {
          sport,
          isPublic: true,
        };

        if (status) {
          where.status = status;
        }

        if (scope) {
          where.scope = scope;
        }

        if (city) {
          where.city = city;
        }

        if (district) {
          where.district = district;
        }

        if (state) {
          where.state = state;
        }

        if (gender) {
          where.gender = gender;
        }

        // Age category filter:
        // JUNIOR (U-14): tournaments for players under 14 (ageMax <= 14)
        // SENIOR (14+): tournaments for players 14 and above (ageMin >= 14 or no age restriction)
        if (ageCategory === 'JUNIOR') {
          where.ageMax = { lte: 14 };
        } else if (ageCategory === 'SENIOR') {
          where.OR = [
            { ageMin: { gte: 14 } },
            { AND: [{ ageMin: null }, { ageMax: null }] }
          ];
        }

        if (search) {
          const searchCondition = [
            { name: { contains: search } },
            { location: { contains: search } },
          ];
          // Combine with existing OR condition if ageCategory is SENIOR
          if (where.OR && ageCategory === 'SENIOR') {
            where.AND = [
              { OR: where.OR },
              { OR: searchCondition }
            ];
            delete where.OR;
          } else {
            where.OR = searchCondition;
          }
        }

        const tournaments = await db.tournament.findMany({
          where,
          orderBy: { startDate: 'asc' },
          take: 50,
          include: {
            _count: {
              select: { registrations: true },
            },
          },
        });

        return tournaments.map((t) => ({
          ...t,
          registeredPlayers: t._count.registrations,
        }));
      }
    );

    const response = NextResponse.json({ tournaments: result.data });
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
  } catch (error) {
    log.errorWithStack('Error fetching tournaments', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      sport,
      type,
      scope,
      location,
      startDate,
      endDate,
      regDeadline,
      prizePool,
      maxPlayers,
      entryFee,
      earlyBirdFee,
      earlyBirdDeadline,
      bracketFormat,
      city,
      district,
      state,
      ageMin,
      ageMax,
      gender,
      isPublic,
      scoringMode,
      managerName,
      managerPhone,
      managerWhatsApp,
      contactPersonName,
      contactPersonPhone,
      contactPersonWhatsApp,
      venueGoogleMapsUrl,
    } = body;

    const resolvedManagerName = managerName || session.org?.name;
    const resolvedManagerPhone = managerPhone || session.org?.phone;

    // Validate required fields
    if (!name || !sport || !location || !startDate || !endDate || !regDeadline || !resolvedManagerName || !resolvedManagerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create tournament
    const tournament = await db.tournament.create({
      data: {
        name,
        sport: sport as SportType,
        type: (type || 'INDIVIDUAL') as TournamentType,
        scope: scope as TournamentScope,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        regDeadline: new Date(regDeadline),
        prizePool: prizePool || 0,
        maxPlayers: maxPlayers || 32,
        entryFee: entryFee || 0,
        earlyBirdFee,
        earlyBirdDeadline: earlyBirdDeadline ? new Date(earlyBirdDeadline) : undefined,
        bracketFormat: bracketFormat as BracketFormat,
        city,
        district,
        state,
        managerName: resolvedManagerName,
        managerPhone: resolvedManagerPhone,
        managerWhatsApp: managerWhatsApp || resolvedManagerPhone,
        contactPersonName,
        contactPersonPhone,
        contactPersonWhatsApp,
        venueGoogleMapsUrl,
        orgId: session.orgId,
        ageMin,
        ageMax,
        gender: gender as GenderCategory,
        isPublic: isPublic ?? true,
        status: TournamentStatus.DRAFT,
        scoringMode: (scoringMode || 'STAFF_ONLY') as ScoringMode,
        createdById: session.userId,
      },
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    log.errorWithStack('Error creating tournament', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}
