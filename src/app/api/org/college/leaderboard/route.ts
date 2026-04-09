/**
 * College Leaderboard API
 * Returns leaderboard of students within a college
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
    const batchFilter = searchParams.get('batch');

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json({ error: 'Not a college organization' }, { status: 400 });
    }

    if (type === 'intra') {
      return getIntraCollegeLeaderboard(orgId, sport, departmentFilter, batchFilter);
    } else {
      return getInterCollegeLeaderboard(orgId, sport);
    }
  } catch (error) {
    console.error('Error fetching college leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

async function getIntraCollegeLeaderboard(
  orgId: string, 
  sport: string, 
  departmentFilter?: string | null,
  batchFilter?: string | null
) {
  // Get all students in this college
  const students = await db.student.findMany({
    where: {
      orgId,
      ...(departmentFilter && { department: { name: departmentFilter } }),
      ...(batchFilter && { batch: { name: batchFilter } }),
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
        },
      },
      department: {
        select: { name: true },
      },
      batch: {
        select: { name: true, startYear: true, endYear: true },
      },
    },
  });

  // Get match stats for each student
  const studentStats = await Promise.all(
    students.map(async (student) => {
      if (!student.userId || !student.user) {
        const matches = (student.matchesWon || 0) + (student.matchesLost || 0);
        return {
          id: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          department: student.department?.name || 'N/A',
          batch:
            student.batch?.name ||
            [student.batch?.startYear, student.batch?.endYear].filter(Boolean).join('-') ||
            'N/A',
          points: student.totalPoints,
          elo: 0,
          tournamentsPlayed: student.tournamentsPlayed,
          wins: student.matchesWon,
          matches,
          winRate: matches > 0 ? Math.round((student.matchesWon / matches) * 100) : 0,
        };
      }

      const matches = await db.match.count({
        where: {
          OR: [
            { playerAId: student.userId },
            { playerBId: student.userId },
          ],
        },
      });

      const wins = await db.match.count({
        where: {
          OR: [
            { playerAId: student.userId, winnerId: student.userId },
            { playerBId: student.userId, winnerId: student.userId },
          ],
        },
      });

      const tournaments = await db.tournamentRegistration.count({
        where: { userId: student.userId },
      });

      return {
        id: student.userId,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        department: student.department?.name || 'N/A',
        batch:
          student.batch?.name ||
          [student.batch?.startYear, student.batch?.endYear].filter(Boolean).join('-') ||
          'N/A',
        points: student.user.visiblePoints,
        elo: student.user.hiddenElo,
        tournamentsPlayed: tournaments,
        wins,
        matches,
        winRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
      };
    })
  );

  // Sort by points descending
  const leaderboard = studentStats
    .sort((a, b) => b.points - a.points)
    .map((student, index) => ({
      rank: index + 1,
      ...student,
      winRate: `${student.winRate}%`,
    }));

  // Get departments and batches for filters
  const departments = await db.collegeDepartment.findMany({
    where: { orgId },
    select: { name: true },
  });

  const batches = await db.collegeBatch.findMany({
    where: { orgId },
    select: { name: true, startYear: true, endYear: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      leaderboard,
      filters: {
        departments: departments.map(d => d.name),
        batches: batches.map(b => b.name || [b.startYear, b.endYear].filter(Boolean).join('-')),
      },
      stats: {
        totalStudents: leaderboard.length,
        topStudent: leaderboard[0]?.studentName || null,
        avgPoints: leaderboard.length > 0
          ? Math.round(leaderboard.reduce((sum, s) => sum + s.points, 0) / leaderboard.length)
          : 0,
      },
    },
  });
}

async function getInterCollegeLeaderboard(orgId: string, sport: string) {
  // Get all college organizations with their stats
  const colleges = await db.organization.findMany({
    where: {
      type: 'COLLEGE',
      sport: sport as any,
    },
  });

  // Calculate stats for each college
  const collegeStats = await Promise.all(
    colleges.map(async (college) => {
      // Get students for this college
      const students = await db.student.findMany({
        where: { orgId: college.id },
        select: { userId: true },
      });

      const userIds = students
        .map((student) => student.userId)
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
        where: { orgId: college.id, type: 'INTER_ORG' },
      });

      // Get tournament wins (teams that won)
      const tournamentWins = await db.tournamentResult.count({
        where: {
          tournament: { orgId: college.id },
          rank: 1,
        },
      });

      return {
        id: college.id,
        name: college.name,
        city: college.city,
        state: college.state,
        planTier: college.planTier,
        isSubscribed: college.planTier !== 'BASIC',
        stats: {
          totalStudents: students.length,
          totalPoints: totalPoints._sum.visiblePoints || 0,
          avgPoints: students.length > 0
            ? Math.round((totalPoints._sum.visiblePoints || 0) / students.length)
            : 0,
          avgElo: Math.round(avgElo._avg.hiddenElo || 0),
          tournamentsHosted,
          tournamentWins,
        },
      };
    })
  );

  // Sort by total points
  const leaderboard = collegeStats
    .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints)
    .map((college, index) => ({
      rank: index + 1,
      ...college,
      isCurrentOrg: college.id === orgId,
    }));

  return NextResponse.json({
    success: true,
    data: {
      leaderboard,
      currentOrgId: orgId,
      stats: {
        totalColleges: leaderboard.length,
        subscribedColleges: leaderboard.filter(c => c.isSubscribed).length,
        topCollege: leaderboard[0]?.name || null,
        yourRank: leaderboard.find(c => c.id === orgId)?.rank || null,
      },
    },
  });
}
