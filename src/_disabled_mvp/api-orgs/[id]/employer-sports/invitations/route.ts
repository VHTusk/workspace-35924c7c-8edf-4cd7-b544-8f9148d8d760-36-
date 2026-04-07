import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiResponse } from '@/lib/api-response';
import { authorizeOrgRoute } from '@/lib/session-helpers';
import { EmployeeInvitationStatus } from '@prisma/client';

// GET /api/orgs/[id]/employer-sports/invitations - List employee invitations
// POST /api/orgs/[id]/employer-sports/invitations - Send invitations to employees

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authorize: verify authenticated org matches route param
    const auth = await authorizeOrgRoute(request, id);
    if (!auth.success) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    const where: Record<string, unknown> = {
      orgId: id,
    };

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }
    if (status) {
      where.status = status as EmployeeInvitationStatus;
    }
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const invitations = await db.employeeInvitation.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { invitedAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            startDate: true,
            location: true,
          },
        },
      },
    });

    const total = await db.employeeInvitation.count({ where });

    return apiResponse({
      invitations,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching employee invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authorize: verify authenticated org matches route param
    const auth = await authorizeOrgRoute(request, id);
    if (!auth.success) return auth.error;

    const body = await request.json();

    // Validate required fields
    // SECURITY: invitedBy is derived from authenticated session, NOT from request body
    if (!body.tournamentId) {
      return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }
    if (!body.employeeIds || !Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json({ error: 'employeeIds array is required' }, { status: 400 });
    }

    // SECURITY: Ignore any client-supplied identity fields
    // These fields are derived from the authenticated session only
    const invitedBy = auth.orgId; // Use authenticated org ID as the inviter

    // Get tournament and employees
    const tournament = await db.tournament.findFirst({
      where: {
        id: body.tournamentId,
        orgId: id,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const employees = await db.employee.findMany({
      where: {
        id: { in: body.employeeIds },
        orgId: id,
        isActive: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No valid employees found' }, { status: 400 });
    }

    // Create invitations (with expiry of 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = await db.$transaction(
      employees.map((employee) =>
        db.employeeInvitation.create({
          data: {
            orgId: id,
            tournamentId: body.tournamentId,
            employeeId: employee.id,
            sport: tournament.sport,
            invitedBy: invitedBy, // Server-derived identity, NOT from request body
            expiresAt,
            status: EmployeeInvitationStatus.PENDING,
          },
        })
      )
    );

    return apiResponse(
      {
        invitations,
        invitedCount: invitations.length,
      },
      'Invitations sent successfully',
      201
    );
  } catch (error) {
    console.error('Error sending employee invitations:', error);
    return NextResponse.json({ error: 'Failed to send invitations' }, { status: 500 });
  }
}
