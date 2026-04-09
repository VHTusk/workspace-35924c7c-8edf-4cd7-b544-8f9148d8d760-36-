import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

function isOrgSubscribed(status?: { status: string; endDate: Date } | null) {
  if (!status) {
    return false;
  }

  return status.status === 'ACTIVE' && status.endDate >= new Date();
}

export async function GET(request: NextRequest) {
  try {
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

    const org = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        _count: {
          select: {
            affiliatedPlayers: true,
            employees: true,
            students: true,
            schoolClasses: true,
            schoolHouses: true,
            schoolTeams: true,
            collegeDepartments: true,
            collegeBatches: true,
            collegeTeams: true,
            repSquads: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const baseData = {
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
        isSubscribed: isOrgSubscribed(org.subscription),
      },
      sport,
      announcements: [],
    };

    const upcomingTournaments = await db.tournament.findMany({
      where: {
        sport,
        status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
        OR:
          org.type === 'CORPORATE'
            ? [{ type: 'INTER_ORG' }, { orgId }]
            : undefined,
      },
      orderBy: { startDate: 'asc' },
      take: 5,
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (org.type === 'CORPORATE') {
      const employees = await db.employee.findMany({
        where: { orgId, sport, isActive: true },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              visiblePoints: true,
              verified: true,
            },
          },
        },
      });

      const topPerformers = employees
        .filter((employee) => employee.user)
        .sort((a, b) => (b.user?.visiblePoints || 0) - (a.user?.visiblePoints || 0))
        .slice(0, 5)
        .map((employee) => ({
          name: `${employee.user!.firstName} ${employee.user!.lastName}`,
          type: 'employee' as const,
          achievement: employee.department || 'Employee',
          points: employee.user!.visiblePoints,
        }));

      return NextResponse.json({
        success: true,
        data: {
          ...baseData,
          quickStats: {
            totalEmployees: employees.length,
            verifiedEmployees: employees.filter((employee) => employee.user?.verified).length,
            totalDepartments: new Set(
              employees
                .map((employee) => employee.department?.trim())
                .filter((department): department is string => Boolean(department)),
            ).size,
            activeTeams: org._count.repSquads,
            upcomingTournaments: upcomingTournaments.length,
          },
          upcomingEvents: upcomingTournaments.map((tournament) => ({
            id: tournament.id,
            name: tournament.name,
            type: tournament.orgId === orgId ? 'internal' : 'external',
            date: tournament.startDate.toISOString(),
            participants: tournament._count.registrations,
          })),
          topPerformers,
          recentActivity: [],
        },
      });
    }

    if (org.type === 'SCHOOL') {
      const students = await db.student.findMany({
        where: { orgId, sport, studentType: 'SCHOOL_STUDENT', status: 'ACTIVE' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              visiblePoints: true,
            },
          },
          schoolClass: { select: { name: true } },
          schoolHouse: { select: { name: true } },
        },
      });

      const topPerformers = students
        .filter((student) => student.user)
        .sort((a, b) => (b.user?.visiblePoints || 0) - (a.user?.visiblePoints || 0))
        .slice(0, 5)
        .map((student) => ({
          name: `${student.user!.firstName} ${student.user!.lastName}`,
          type: 'student' as const,
          achievement: `${student.schoolClass?.name || ''}${student.schoolHouse?.name ? ` • ${student.schoolHouse.name}` : ''}`.trim(),
          points: student.user!.visiblePoints,
        }));

      return NextResponse.json({
        success: true,
        data: {
          ...baseData,
          quickStats: {
            totalStudents: students.length,
            totalClasses: org._count.schoolClasses,
            totalHouses: org._count.schoolHouses,
            schoolTeams: org._count.schoolTeams,
            upcomingTournaments: upcomingTournaments.length,
          },
          upcomingEvents: upcomingTournaments.map((tournament) => ({
            id: tournament.id,
            name: tournament.name,
            type: tournament.type === 'INTRA_ORG' ? 'internal' : 'external',
            date: tournament.startDate.toISOString(),
            participants: tournament._count.registrations,
          })),
          topPerformers,
          recentActivity: [],
        },
      });
    }

    if (org.type === 'COLLEGE') {
      const students = await db.student.findMany({
        where: { orgId, sport, studentType: 'COLLEGE_STUDENT', status: 'ACTIVE' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              visiblePoints: true,
            },
          },
          department: { select: { name: true } },
          batch: { select: { name: true, startYear: true, endYear: true } },
        },
      });

      const topPerformers = students
        .filter((student) => student.user)
        .sort((a, b) => (b.user?.visiblePoints || 0) - (a.user?.visiblePoints || 0))
        .slice(0, 5)
        .map((student) => ({
          name: `${student.user!.firstName} ${student.user!.lastName}`,
          type: 'student' as const,
          achievement:
            student.department?.name ||
            student.batch?.name ||
            [student.batch?.startYear, student.batch?.endYear].filter(Boolean).join('-') ||
            'Student',
          points: student.user!.visiblePoints,
        }));

      return NextResponse.json({
        success: true,
        data: {
          ...baseData,
          quickStats: {
            totalStudents: students.length,
            totalDepartments: org._count.collegeDepartments,
            totalBatches: org._count.collegeBatches,
            collegeTeams: org._count.collegeTeams,
            upcomingTournaments: upcomingTournaments.length,
          },
          upcomingEvents: upcomingTournaments.map((tournament) => ({
            id: tournament.id,
            name: tournament.name,
            type: tournament.type === 'INTRA_ORG' ? 'internal' : 'external',
            date: tournament.startDate.toISOString(),
            participants: tournament._count.registrations,
          })),
          topPerformers,
          recentActivity: [],
        },
      });
    }

    const rosterPlayers = await db.orgRosterPlayer.count({ where: { orgId } });

    return NextResponse.json({
      success: true,
      data: {
        ...baseData,
        quickStats: {
          totalMembers: rosterPlayers,
          upcomingTournaments: upcomingTournaments.length,
        },
        upcomingEvents: upcomingTournaments.map((tournament) => ({
          id: tournament.id,
          name: tournament.name,
          type: 'external',
          date: tournament.startDate.toISOString(),
          participants: tournament._count.registrations,
        })),
        topPerformers: [],
        recentActivity: [],
      },
    });
  } catch (error) {
    console.error('Error fetching org home data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch home data' },
      { status: 500 }
    );
  }
}
