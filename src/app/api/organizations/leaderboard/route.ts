import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const scope = searchParams.get('scope'); // city, district, state, national
    const location = searchParams.get('location');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      sport,
    };

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
      where.name = { contains: search };
    }

    // Get organizations with their stats
    const organizations = await db.organization.findMany({
      where,
      include: {
        roster: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                visiblePoints: true,
                hiddenElo: true,
              }
            }
          }
        },
        hostedIntraOrgs: {
          select: { id: true, status: true }
        },
        subscription: {
          select: { status: true }
        },
        _count: {
          select: { roster: { where: { isActive: true } } }
        }
      },
    });

    // Calculate org metrics and rank
    const orgLeaderboard = organizations
      .map((org) => {
        const members = org.roster.filter(r => r.isActive);
        const totalPoints = members.reduce((sum, m) => sum + m.user.visiblePoints, 0);
        const avgPoints = members.length > 0 ? Math.round(totalPoints / members.length) : 0;
        const avgElo = members.length > 0 
          ? members.reduce((sum, m) => sum + m.user.hiddenElo, 0) / members.length 
          : 0;
        const tournamentsHosted = org.hostedIntraOrgs.length;
        const completedTournaments = org.hostedIntraOrgs.filter(t => t.status === 'COMPLETED').length;

        return {
          id: org.id,
          name: org.name,
          type: org.type,
          city: org.city,
          district: org.district,
          state: org.state,
          planTier: org.planTier,
          isSubscribed: org.subscription?.status === 'ACTIVE',
          stats: {
            totalMembers: members.length,
            totalPoints,
            avgPoints,
            avgElo: Math.round(avgElo),
            tournamentsHosted,
            completedTournaments,
          },
        };
      })
      .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints)
      .slice(0, limit)
      .map((org, index) => ({
        ...org,
        rank: index + 1,
      }));

    // Get stats
    const totalOrgs = await db.organization.count({
      where: { sport },
    });

    const subscribedOrgs = await db.organization.count({
      where: {
        sport,
        subscription: { status: 'ACTIVE' }
      },
    });

    return NextResponse.json({
      leaderboard: orgLeaderboard,
      stats: {
        totalOrganizations: totalOrgs,
        subscribedOrganizations: subscribedOrgs,
        topOrg: orgLeaderboard[0]?.name || null,
      },
    });
  } catch (error) {
    console.error('Error fetching organizations leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
