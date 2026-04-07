import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, OrgType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const scope = searchParams.get('scope'); // city, district, state, national
    const state = searchParams.get('state');
    const district = searchParams.get('district');
    const city = searchParams.get('city');
    const orgType = searchParams.get('orgType'); // CLUB, SCHOOL, CORPORATE, ACADEMY
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      sport,
    };

    // Apply location filters based on scope
    if (scope === 'city' && city) {
      where.city = city;
    } else if (scope === 'district' && district) {
      where.district = district;
    } else if (scope === 'state' && state) {
      where.state = state;
    }

    // Apply org type filter
    if (orgType && orgType !== 'ALL' && Object.values(OrgType).includes(orgType as OrgType)) {
      where.type = orgType;
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get all organizations for this sport
    const organizations = await db.organization.findMany({
      where,
      include: {
        roster: {
          where: { isActive: true },
          include: {
            user: {
              include: {
                rating: true,
              },
            },
          },
        },
        tournamentRegs: {
          where: { status: 'CONFIRMED' },
        },
        hostedIntraOrgs: true,
      },
    });

    // Calculate organization scores
    let orgScores = organizations.map((org) => {
      // Calculate total points from roster players
      const totalPoints = org.roster.reduce((sum, entry) => sum + (entry.user.visiblePoints || 0), 0);

      // Calculate average Elo
      const avgElo = org.roster.length > 0
        ? org.roster.reduce((sum, entry) => sum + entry.user.hiddenElo, 0) / org.roster.length
        : 0;

      // Count matches played by roster players
      const totalMatches = org.roster.reduce((sum, entry) => sum + (entry.user.rating?.matchesPlayed || 0), 0);
      const totalWins = org.roster.reduce((sum, entry) => sum + (entry.user.rating?.wins || 0), 0);

      // Get top tier among roster players
      const tiers = org.roster.map(entry => {
        const elo = entry.user.hiddenElo;
        const matches = entry.user.rating?.matchesPlayed || 0;
        if (matches >= 10 && elo >= 2000) return 'DIAMOND';
        if (matches >= 10 && elo >= 1800) return 'PLATINUM';
        if (matches >= 10 && elo >= 1600) return 'GOLD';
        if (matches >= 10 && elo >= 1400) return 'SILVER';
        if (matches >= 10) return 'BRONZE';
        return 'UNRANKED';
      });
      const topTier = tiers.length > 0 ? tiers.sort()[0] : 'UNRANKED';

      return {
        id: org.id,
        uniqueId: org.id,
        name: org.name,
        type: org.type,
        city: org.city,
        district: org.district,
        state: org.state,
        playerCount: org.roster.length,
        totalPoints,
        avgElo: Math.round(avgElo),
        totalMatches,
        totalWins,
        winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        tournamentsWon: org.tournamentRegs.length,
        tournamentsHosted: org.hostedIntraOrgs.length,
        topTier,
      };
    });

    // Sort by total points (descending)
    orgScores.sort((a, b) => b.totalPoints - a.totalPoints);

    // Add rank
    let leaderboard = orgScores.map((org, index) => ({
      rank: index + 1,
      ...org,
      change: 0,
    }));

    // Get unique locations for filters
    const [cities, states, districts] = await Promise.all([
      db.organization.findMany({
        where: { sport, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
      }),
      db.organization.findMany({
        where: { sport, state: { not: null } },
        select: { state: true },
        distinct: ['state'],
      }),
      db.organization.findMany({
        where: { sport, district: { not: null } },
        select: { district: true },
        distinct: ['district'],
      }),
    ]);

    // Apply pagination
    const paginatedLeaderboard = leaderboard.slice(offset, offset + limit);

    return NextResponse.json({
      leaderboard: paginatedLeaderboard,
      total: leaderboard.length,
      stats: {
        totalOrganizations: organizations.length,
        activeThisMonth: organizations.length,
        topOrg: leaderboard[0]?.name || null,
      },
      filters: {
        cities: cities.map((c) => c.city).filter(Boolean),
        states: states.map((s) => s.state).filter(Boolean),
        districts: districts.map((d) => d.district).filter(Boolean),
        orgTypes: ['CLUB', 'SCHOOL', 'CORPORATE', 'ACADEMY'],
      },
    });
  } catch (error) {
    console.error('Error fetching org leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
