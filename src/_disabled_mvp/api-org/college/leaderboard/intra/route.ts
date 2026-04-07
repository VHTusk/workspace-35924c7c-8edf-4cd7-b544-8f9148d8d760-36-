/**
 * Intra-College Leaderboard API
 * Returns leaderboard of students within a college for internal tournaments
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
    const departmentFilter = searchParams.get('department');
    const batchFilter = searchParams.get('batch');
    const yearFilter = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json({ error: 'Not a college organization' }, { status: 400 });
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      orgId,
      sport: sport as 'CORNHOLE' | 'DARTS',
      studentType: 'COLLEGE_STUDENT',
      status: 'ACTIVE',
    };

    if (departmentFilter) {
      whereClause.department = { name: departmentFilter };
    }

    if (batchFilter) {
      whereClause.batch = { name: batchFilter };
    }

    if (yearFilter) {
      whereClause.year = parseInt(yearFilter);
    }

    // Get all students in this college
    const students = await db.student.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true,
            hiddenElo: true,
            city: true,
            profileImageUrl: true,
          },
        },
        department: {
          select: { name: true, code: true },
        },
        batch: {
          select: { name: true, startYear: true, endYear: true },
        },
      },
    });

    // Get match stats for each student
    const studentStats = await Promise.all(
      students.map(async (student) => {
        // Get tournament registrations for this student
        const tournamentRegs = await db.tournamentRegistration.findMany({
          where: { userId: student.userId },
          select: { tournamentId: true },
        });

        const tournamentIds = tournamentRegs.map(r => r.tournamentId);

        // Get matches
        const matches = await db.match.count({
          where: {
            tournamentId: { in: tournamentIds },
            OR: [
              { playerAId: student.userId },
              { playerBId: student.userId },
            ],
          },
        });

        const wins = await db.match.count({
          where: {
            tournamentId: { in: tournamentIds },
            OR: [
              { playerAId: student.userId, winnerId: student.userId },
              { playerBId: student.userId, winnerId: student.userId },
            ],
          },
        });

        return {
          id: student.userId || student.id,
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          department: student.department?.name || 'N/A',
          departmentCode: student.department?.code,
          batch: student.batch?.name || 'N/A',
          year: student.year,
          points: student.totalPoints || student.user?.visiblePoints || 0,
          elo: student.user?.hiddenElo || 0,
          tournamentsPlayed: student.tournamentsPlayed || tournamentRegs.length,
          wins: wins,
          matches: matches,
          winRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
          profileImageUrl: student.user?.profileImageUrl,
        };
      })
    );

    // Sort by points descending
    const leaderboard = studentStats
      .sort((a, b) => b.points - a.points)
      .slice(0, limit)
      .map((student, index) => ({
        rank: index + 1,
        ...student,
        winRate: `${student.winRate}%`,
      }));

    // Get departments and batches for filters
    const departments = await db.collegeDepartment.findMany({
      where: { orgId, isActive: true },
      select: { name: true, code: true, _count: { select: { students: true } } },
      orderBy: { name: 'asc' },
    });

    const batches = await db.collegeBatch.findMany({
      where: { orgId, isActive: true },
      select: { name: true, startYear: true, endYear: true },
      orderBy: { startYear: 'desc' },
    });

    // Get years
    const years = await db.student.groupBy({
      by: ['year'],
      where: { orgId, year: { not: null } },
      _count: { id: true },
    });

    // Calculate stats
    const stats = {
      totalStudents: students.length,
      totalPoints: studentStats.reduce((sum, s) => sum + s.points, 0),
      avgPoints: students.length > 0
        ? Math.round(studentStats.reduce((sum, s) => sum + s.points, 0) / students.length)
        : 0,
      topStudent: leaderboard[0]?.studentName || null,
      totalTournaments: studentStats.reduce((sum, s) => sum + s.tournamentsPlayed, 0),
      totalMatches: studentStats.reduce((sum, s) => sum + s.matches, 0),
      totalWins: studentStats.reduce((sum, s) => sum + s.wins, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        filters: {
          departments: departments.map(d => ({ name: d.name, code: d.code, count: d._count.students })),
          batches: batches.map(b => ({ name: b.name, startYear: b.startYear, endYear: b.endYear })),
          years: years.filter(y => y.year !== null).map(y => ({ year: y.year, count: y._count.id })),
        },
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching intra-college leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
