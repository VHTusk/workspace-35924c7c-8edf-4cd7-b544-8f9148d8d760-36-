/**
 * Corporate Leaderboard API
 * Returns leaderboard of employees within a corporate organization
 * Also includes inter-corporate rankings
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate org session
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.orgId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const orgId = session.orgId;
    const sport = session.sport;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'intra'; // 'intra' or 'inter'
    const departmentFilter = searchParams.get('department');

    // Verify this is a corporate
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'CORPORATE') {
      return NextResponse.json({ error: 'Not a corporate organization' }, { status: 400 });
    }

    if (type === 'intra') {
      return getIntraCorporateLeaderboard(orgId, sport, departmentFilter);
    } else {
      return getInterCorporateLeaderboard(orgId, sport);
    }
  } catch (error) {
    console.error('Error fetching corporate leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

async function getIntraCorporateLeaderboard(orgId: string, sport: string, departmentFilter?: string | null) {
  // Get all employees in this corporate
  const employees = await db.employee.findMany({
    where: {
      orgId,
      sport: sport as any,
      isActive: true,
      ...(departmentFilter && {
        department: { equals: departmentFilter, mode: 'insensitive' as const },
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          visiblePoints: true,
          hiddenElo: true,
          city: true,
          verified: true,
        },
      },
    },
  });

  // Get match stats for each employee
  const employeeStats = await Promise.all(
    employees.map(async (employee) => {
      if (!employee.userId || !employee.user) {
        return {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          city: employee.user?.city || '',
          department: employee.department || 'N/A',
          points: 0,
          elo: 0,
          matches: 0,
          wins: 0,
          tournaments: 0,
          isVerified: false,
        };
      }

      const matches = await db.match.count({
        where: {
          OR: [
            { playerAId: employee.userId },
            { playerBId: employee.userId },
          ],
        },
      });

      const wins = await db.match.count({
        where: {
          OR: [
            { playerAId: employee.userId, winnerId: employee.userId },
            { playerBId: employee.userId, winnerId: employee.userId },
          ],
        },
      });

      const tournaments = await db.tournamentRegistration.count({
        where: { userId: employee.userId },
      });

      return {
        id: employee.userId,
        name: `${employee.user.firstName} ${employee.user.lastName}`,
        city: employee.user.city || '',
        department: employee.department || 'N/A',
        points: employee.user.visiblePoints,
        elo: employee.user.hiddenElo,
        matches,
        wins,
        tournaments,
        isVerified: employee.user.verified,
      };
    })
  );

  // Sort by points descending
  const leaderboard = employeeStats
    .sort((a, b) => b.points - a.points)
    .map((emp, index) => ({
      rank: index + 1,
      ...emp,
    }));

  // Get departments for filter
  const departments = Array.from(
    new Set(
      employees
        .map((employee) => employee.department?.trim())
        .filter((department): department is string => Boolean(department)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    success: true,
    data: {
      leaderboard,
      filters: {
        departments,
      },
      stats: {
        totalEmployees: leaderboard.length,
        topEmployee: leaderboard[0]?.name || null,
        avgPoints: leaderboard.length > 0
          ? Math.round(leaderboard.reduce((sum, e) => sum + e.points, 0) / leaderboard.length)
          : 0,
      },
    },
  });
}

async function getInterCorporateLeaderboard(orgId: string, sport: string) {
  // Get all corporate organizations with their stats
  const corporates = await db.organization.findMany({
    where: {
      type: 'CORPORATE',
      sport: sport as any,
    },
    include: {
      _count: {
        select: {
          affiliatedPlayers: true,
        },
      },
    },
  });

  // Calculate stats for each corporate
  const corporateStats = await Promise.all(
    corporates.map(async (corp) => {
      // Get employees for this corporate
      const employees = await db.employee.findMany({
        where: { orgId: corp.id, sport: sport as any, isActive: true },
        select: { userId: true },
      });

      const userIds = employees
        .map((employee) => employee.userId)
        .filter((userId): userId is string => Boolean(userId));

      // Calculate total points
      const totalPoints = await db.user.aggregate({
        where: { id: { in: userIds } },
        _sum: { visiblePoints: true },
      });

      // Calculate average ELO
      const avgElo = await db.user.aggregate({
        where: { id: { in: userIds } },
        _avg: { hiddenElo: true },
      });

      // Get tournaments hosted
      const tournamentsHosted = await db.tournament.count({
        where: { orgId: corp.id, type: 'INTER_ORG' },
      });

      // Get completed tournaments
      const completedTournaments = await db.tournament.count({
        where: { orgId: corp.id, type: 'INTER_ORG', status: 'COMPLETED' },
      });

      return {
        id: corp.id,
        name: corp.name,
        city: corp.city,
        state: corp.state,
        planTier: corp.planTier,
        isSubscribed: corp.planTier !== 'BASIC',
        stats: {
          totalMembers: employees.length,
          totalPoints: totalPoints._sum.visiblePoints || 0,
          avgPoints: employees.length > 0
            ? Math.round((totalPoints._sum.visiblePoints || 0) / employees.length)
            : 0,
          avgElo: Math.round(avgElo._avg.hiddenElo || 0),
          tournamentsHosted,
          completedTournaments,
        },
      };
    })
  );

  // Sort by total points
  const leaderboard = corporateStats
    .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints)
    .map((corp, index) => ({
      rank: index + 1,
      ...corp,
      isCurrentOrg: corp.id === orgId,
    }));

  return NextResponse.json({
    success: true,
    data: {
      leaderboard,
      currentOrgId: orgId,
      stats: {
        totalCorporates: leaderboard.length,
        subscribedCorporates: leaderboard.filter(c => c.isSubscribed).length,
        topCorporate: leaderboard[0]?.name || null,
        yourRank: leaderboard.find(c => c.id === orgId)?.rank || null,
      },
    },
  });
}
