/**
 * Intra-School Leaderboard API
 * Returns leaderboard of students within a school
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
    const sport = session.sport || 'CORNHOLE';
    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get('class');
    const houseFilter = searchParams.get('house');

    // Verify this is a school
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'SCHOOL') {
      return NextResponse.json({ error: 'Not a school organization' }, { status: 400 });
    }

    // Build where clause
    const whereClause: any = {
      orgId,
      sport,
      status: 'ACTIVE',
    };

    if (classFilter) {
      whereClause.schoolClass = { name: classFilter };
    }
    if (houseFilter) {
      whereClause.schoolHouse = { name: houseFilter };
    }

    // Get all students in this school with their stats
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
          },
        },
        schoolClass: {
          select: { id: true, name: true },
        },
        schoolSection: {
          select: { id: true, name: true },
        },
        schoolHouse: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { totalPoints: 'desc' },
    });

    // Build leaderboard
    const leaderboard = students
      .map((student, index) => {
        const matches = student.matchesWon + student.matchesLost;
        return {
          rank: index + 1,
          id: student.id,
          userId: student.userId,
          name: `${student.firstName} ${student.lastName}`,
          className: student.schoolClass?.name || null,
          sectionName: student.schoolSection?.name || null,
          houseName: student.schoolHouse?.name || null,
          houseColor: student.schoolHouse?.color || null,
          points: student.totalPoints,
          matches,
          wins: student.matchesWon,
          tournaments: student.tournamentsPlayed,
          isVerified: student.isVerified,
          winRate: matches > 0 ? Math.round((student.matchesWon / matches) * 100) : 0,
        };
      });

    // Get unique classes and houses for filters
    const classes = await db.schoolClass.findMany({
      where: { orgId, sport, isActive: true },
      select: { id: true, name: true },
      orderBy: { gradeLevel: 'asc' },
    });

    const houses = await db.schoolHouse.findMany({
      where: { orgId, sport, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        filters: {
          classes: classes.map((c) => ({ id: c.id, name: c.name })),
          houses: houses.map((h) => ({ id: h.id, name: h.name, color: h.color })),
        },
        stats: {
          totalStudents: leaderboard.length,
          topStudent: leaderboard[0]?.name || null,
          avgPoints:
            leaderboard.length > 0
              ? Math.round(leaderboard.reduce((sum, s) => sum + s.points, 0) / leaderboard.length)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching intra-school leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
