import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, SportType } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';
import { safeParseInt } from '@/lib/validation';

// List all players with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const isActive = searchParams.get('isActive');
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const page = safeParseInt(searchParams.get('page'), 1, 1, 1000);
    const limit = safeParseInt(searchParams.get('limit'), 30, 1, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { role: Role.PLAYER };
    if (sport) where.sport = sport;
    if (isActive !== null) where.isActive = isActive === 'true';
    if (city) where.city = { contains: city };
    if (state) where.state = state;
    
    // Tier filter based on ELO
    if (tier) {
      const tierRanges: Record<string, { min: number; max: number }> = {
        DIAMOND: { min: 1900, max: 3000 },
        PLATINUM: { min: 1700, max: 1899 },
        GOLD: { min: 1500, max: 1699 },
        SILVER: { min: 1300, max: 1499 },
        BRONZE: { min: 0, max: 1299 },
      };
      const range = tierRanges[tier];
      if (range) {
        where.hiddenElo = { gte: range.min, lte: range.max };
      }
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [players, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          rating: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
              tournamentsPlayed: true,
              tournamentsWon: true,
            },
          },
          affiliatedOrg: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Get tier from ELO
    const getTier = (elo: number, matches: number) => {
      if (matches < 30) return 'UNRANKED';
      if (elo >= 1900) return 'DIAMOND';
      if (elo >= 1700) return 'PLATINUM';
      if (elo >= 1500) return 'GOLD';
      if (elo >= 1300) return 'SILVER';
      return 'BRONZE';
    };

    return NextResponse.json({
      players: players.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        sport: p.sport,
        city: p.city,
        state: p.state,
        elo: Math.round(p.hiddenElo),
        points: p.visiblePoints,
        tier: getTier(p.hiddenElo, p.rating?.matchesPlayed || 0),
        isActive: p.isActive,
        verified: p.verified,
        createdAt: p.createdAt,
        rating: p.rating,
        affiliatedOrg: p.affiliatedOrg,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin players list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
