import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiResponse } from '@/lib/api-response';
import { authorizeOrgRoute } from '@/lib/session-helpers';
import { EmployeeInvitationStatus, TournamentType, TournamentStatus, SportType } from '@prisma/client';

// GET /api/orgs/[id]/employer-sports/stats - Get employer sports dashboard stats

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authorize: verify authenticated org matches route param
    const auth = await authorizeOrgRoute(request, id);
    if (!auth.success) return auth.error;

    const sport = request.nextUrl.searchParams.get('sport');

    const sportFilter = sport ? { sport: sport as SportType } : {};

    // Get total employees
    const totalEmployees = await db.employee.count({
      where: {
        orgId: id,
        isActive: true,
        ...sportFilter,
      },
    });

    // Get verified employees
    const verifiedEmployees = await db.employee.count({
      where: {
        orgId: id,
        isActive: true,
        isVerified: true,
        ...sportFilter,
      },
    });

    // Get active tournaments (INTRA_ORG)
    const activeTournaments = await db.tournament.count({
      where: {
        orgId: id,
        type: TournamentType.INTRA_ORG,
        status: {
          in: [
            TournamentStatus.REGISTRATION_OPEN,
            TournamentStatus.REGISTRATION_CLOSED,
            TournamentStatus.BRACKET_GENERATED,
            TournamentStatus.IN_PROGRESS,
          ],
        },
        ...sportFilter,
      },
    });

    // Get total internal tournaments
    const totalTournaments = await db.tournament.count({
      where: {
        orgId: id,
        type: TournamentType.INTRA_ORG,
        ...sportFilter,
      },
    });

    // Get pending invitations
    const pendingInvitations = await db.employeeInvitation.count({
      where: {
        orgId: id,
        status: EmployeeInvitationStatus.PENDING,
        ...sportFilter,
      },
    });

    // Get total participants across all tournaments
    const participations = await db.employeeTournamentParticipation.count({
      where: {
        employee: {
          orgId: id,
        },
        ...sportFilter,
      },
    });

    // Get upcoming tournaments
    const upcomingTournaments = await db.tournament.findMany({
      where: {
        orgId: id,
        type: TournamentType.INTRA_ORG,
        status: TournamentStatus.REGISTRATION_OPEN,
        startDate: {
          gte: new Date(),
        },
        ...sportFilter,
      },
      take: 5,
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: {
            employeeInvitations: true,
          },
        },
      },
    });

    // Get department breakdown
    const departmentBreakdown = await db.employee.groupBy({
      by: ['department'],
      where: {
        orgId: id,
        isActive: true,
        department: { not: null },
        ...sportFilter,
      },
      _count: {
        id: true,
      },
    });

    return apiResponse({
      stats: {
        totalEmployees,
        verifiedEmployees,
        verificationRate: totalEmployees > 0 
          ? Math.round((verifiedEmployees / totalEmployees) * 100) 
          : 0,
        activeTournaments,
        totalTournaments,
        pendingInvitations,
        totalParticipants: participations,
      },
      upcomingTournaments: upcomingTournaments.map((t) => ({
        id: t.id,
        name: t.name,
        sport: t.sport,
        startDate: t.startDate,
        location: t.location,
        invitationCount: t._count.employeeInvitations,
      })),
      departmentBreakdown: departmentBreakdown.map((d) => ({
        department: d.department,
        count: d._count.id,
      })),
    });
  } catch (error) {
    console.error('Error fetching employer sports stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
