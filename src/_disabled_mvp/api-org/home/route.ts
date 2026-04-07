/**
 * Organization Home API
 * Returns dashboard data for organization home pages
 * Works for CORPORATE, SCHOOL, COLLEGE, and other org types
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

    // Get organization data
    const org = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        _count: {
          select: {
            affiliatedPlayers: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get org type specific data
    let homeData: any = {
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        email: org.email,
        phone: org.phone,
        city: org.city,
        state: org.state,
        planTier: org.planTier,
        logoUrl: org.logoUrl,
        isSubscribed: org.subscription?.isActive || false,
      },
      sport,
    };

    // Get announcements
    const announcements = await db.announcement.findMany({
      where: {
        OR: [
          { orgId },
          { orgId: null }, // Global announcements
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    homeData.announcements = announcements.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type || 'info',
      createdAt: a.createdAt.toISOString(),
    }));

    if (org.type === 'CORPORATE') {
      homeData = await getCorporateHomeData(orgId, sport, homeData);
    } else if (org.type === 'SCHOOL') {
      homeData = await getSchoolHomeData(orgId, sport, homeData);
    } else if (org.type === 'COLLEGE') {
      homeData = await getCollegeHomeData(orgId, sport, homeData);
    } else {
      homeData = await getGeneralHomeData(orgId, sport, homeData);
    }

    return NextResponse.json({
      success: true,
      data: homeData,
    });
  } catch (error) {
    console.error('Error fetching org home data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch home data' },
      { status: 500 }
    );
  }
}

async function getCorporateHomeData(orgId: string, sport: string, baseData: any) {
  // Get employees
  const employees = await db.employee.findMany({
    where: { orgId, status: 'ACTIVE' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          visiblePoints: true,
          verified: true,
        },
      },
      department: {
        select: { name: true },
      },
    },
  });

  // Get departments count
  const departments = await db.collegeDepartment.count({
    where: { orgId },
  });

  // Get rep squads
  const repSquads = await db.repSquad.findMany({
    where: { orgId, status: 'ACTIVE' },
  });

  // Get upcoming tournaments
  const upcomingTournaments = await db.tournament.findMany({
    where: {
      sport: sport as any,
      status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      OR: [
        { type: 'INTER_ORG' },
        { orgId },
      ],
    },
    orderBy: { startDate: 'asc' },
    take: 5,
    include: {
      _count: {
        select: { registrations: true },
      },
    },
  });

  // Get recent wins (employees who won matches)
  const recentWins = await db.match.count({
    where: {
      OR: [
        { playerA: { employee: { orgId } }, winnerA: true },
        { playerB: { employee: { orgId } }, winnerB: true },
      ],
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  // Top performers
  const topPerformers = employees
    .sort((a, b) => (b.user.visiblePoints || 0) - (a.user.visiblePoints || 0))
    .slice(0, 5)
    .map(e => ({
      name: `${e.user.firstName} ${e.user.lastName}`,
      type: 'employee' as const,
      achievement: e.department?.name || 'Employee',
      points: e.user.visiblePoints,
    }));

  // Calculate participation rate
  const totalRegistrations = await db.tournamentRegistration.count({
    where: {
      user: { employee: { orgId } },
    },
  });

  const participationRate = employees.length > 0
    ? Math.round((totalRegistrations / employees.length) * 100)
    : 0;

  return {
    ...baseData,
    quickStats: {
      totalEmployees: employees.length,
      verifiedEmployees: employees.filter(e => e.user.verified).length,
      totalDepartments: departments,
      activeTeams: repSquads.length,
      upcomingTournaments: upcomingTournaments.length,
      recentWins,
      participationRate,
    },
    upcomingEvents: upcomingTournaments.map(t => ({
      id: t.id,
      name: t.name,
      type: t.orgId === orgId ? 'internal' : 'external',
      date: t.startDate.toISOString(),
      participants: t._count.registrations,
    })),
    topPerformers,
    recentActivity: [],
  };
}

async function getSchoolHomeData(orgId: string, sport: string, baseData: any) {
  // Get students
  const students = await db.student.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          visiblePoints: true,
        },
      },
      class: { select: { name: true } },
      house: { select: { name: true } },
    },
  });

  // Get classes and houses count
  const classes = await db.schoolClass.count({ where: { orgId } });
  const houses = await db.schoolHouse.count({ where: { orgId } });
  const teams = await db.schoolTeam.count({ where: { orgId } });

  // Get upcoming tournaments
  const upcomingTournaments = await db.tournament.findMany({
    where: {
      sport: sport as any,
      status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
    },
    orderBy: { startDate: 'asc' },
    take: 5,
    include: {
      _count: { select: { registrations: true } },
    },
  });

  // Top performers
  const topPerformers = students
    .sort((a, b) => (b.user.visiblePoints || 0) - (a.user.visiblePoints || 0))
    .slice(0, 5)
    .map(s => ({
      name: `${s.user.firstName} ${s.user.lastName}`,
      type: 'student' as const,
      achievement: `${s.class?.name || ''} ${s.house ? `• ${s.house.name}` : ''}`.trim(),
      points: s.user.visiblePoints,
    }));

  // Get recent activity
  const recentActivity = await db.activityFeed.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    ...baseData,
    quickStats: {
      totalStudents: students.length,
      totalClasses: classes,
      totalHouses: houses,
      schoolTeams: teams,
      upcomingTournaments: upcomingTournaments.length,
      participationRate: 0,
    },
    upcomingEvents: upcomingTournaments.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type === 'INTRA_ORG' ? 'internal' : 'external',
      date: t.startDate.toISOString(),
      participants: t._count.registrations,
    })),
    topPerformers,
    recentActivity: recentActivity.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      timestamp: a.createdAt.toISOString(),
    })),
  };
}

async function getCollegeHomeData(orgId: string, sport: string, baseData: any) {
  // Get students
  const students = await db.student.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          visiblePoints: true,
        },
      },
      department: { select: { name: true } },
      batch: { select: { name: true, year: true } },
    },
  });

  // Get departments and batches count
  const departments = await db.collegeDepartment.count({ where: { orgId } });
  const batches = await db.collegeBatch.count({ where: { orgId } });
  const teams = await db.collegeTeam.count({ where: { orgId } });

  // Get upcoming tournaments
  const upcomingTournaments = await db.tournament.findMany({
    where: {
      sport: sport as any,
      status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
    },
    orderBy: { startDate: 'asc' },
    take: 5,
    include: {
      _count: { select: { registrations: true } },
    },
  });

  // Top performers
  const topPerformers = students
    .sort((a, b) => (b.user.visiblePoints || 0) - (a.user.visiblePoints || 0))
    .slice(0, 5)
    .map(s => ({
      name: `${s.user.firstName} ${s.user.lastName}`,
      type: 'student' as const,
      achievement: `${s.department?.name || ''} ${s.batch?.name ? `• ${s.batch.name}` : ''}`.trim(),
      points: s.user.visiblePoints,
    }));

  // Get recent activity
  const recentActivity = await db.activityFeed.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    ...baseData,
    quickStats: {
      totalStudents: students.length,
      totalDepartments: departments,
      totalBatches: batches,
      collegeTeams: teams,
      upcomingTournaments: upcomingTournaments.length,
      participationRate: 0,
    },
    upcomingEvents: upcomingTournaments.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type === 'INTRA_ORG' ? 'internal' : 'external',
      date: t.startDate.toISOString(),
      participants: t._count.registrations,
    })),
    topPerformers,
    recentActivity: recentActivity.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      timestamp: a.createdAt.toISOString(),
    })),
  };
}

async function getGeneralHomeData(orgId: string, sport: string, baseData: any) {
  // For clubs, academies, etc.
  const rosterPlayers = await db.orgRosterPlayer.count({ where: { orgId } });

  // Get upcoming tournaments
  const upcomingTournaments = await db.tournament.findMany({
    where: {
      sport: sport as any,
      status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
    },
    orderBy: { startDate: 'asc' },
    take: 5,
  });

  return {
    ...baseData,
    quickStats: {
      totalMembers: rosterPlayers,
      upcomingTournaments: upcomingTournaments.length,
    },
    upcomingEvents: upcomingTournaments.map(t => ({
      id: t.id,
      name: t.name,
      type: 'external',
      date: t.startDate.toISOString(),
    })),
    topPerformers: [],
    recentActivity: [],
  };
}
