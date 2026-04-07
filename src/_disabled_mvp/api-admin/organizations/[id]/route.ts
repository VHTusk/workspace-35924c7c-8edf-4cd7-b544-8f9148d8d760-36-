import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role } from '@prisma/client';

// Get organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const org = await db.organization.findUnique({
      where: { id },
      include: {
        subscription: true,
        roster: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                hiddenElo: true,
                city: true,
              },
            },
          },
          take: 50,
        },
        orgAdmins: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        tournamentRegs: {
          include: {
            tournament: {
              select: { id: true, name: true, status: true, startDate: true },
            },
          },
          orderBy: { registeredAt: 'desc' },
          take: 10,
        },
        hostedIntraOrgs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        sponsors: {
          select: { id: true, name: true, tier: true },
        },
        _count: {
          select: { roster: true, tournamentRegs: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        sport: org.sport,
        planTier: org.planTier,
        email: org.email,
        phone: org.phone,
        city: org.city,
        district: org.district,
        state: org.state,
        pinCode: org.pinCode,
        logoUrl: org.logoUrl,
        tosAcceptedAt: org.tosAcceptedAt,
        privacyAcceptedAt: org.privacyAcceptedAt,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        subscription: org.subscription,
        admins: org.orgAdmins.map((a) => ({
          id: a.id,
          role: a.role,
          isActive: a.isActive,
          user: a.user,
          invitedAt: a.invitedAt,
          acceptedAt: a.acceptedAt,
        })),
        roster: org.roster.map((r) => ({
          id: r.id,
          isActive: r.isActive,
          joinedAt: r.joinedAt,
          user: {
            ...r.user,
            elo: Math.round(r.user.hiddenElo),
          },
        })),
        recentTournaments: org.tournamentRegs.map((r) => ({
          id: r.id,
          tournament: r.tournament,
          registeredAt: r.registeredAt,
        })),
        hostedTournaments: org.hostedIntraOrgs,
        sponsors: org.sponsors,
        counts: {
          roster: org._count.roster,
          tournamentRegs: org._count.tournamentRegs,
        },
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update organization
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Only ADMIN can update organizations' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const org = await db.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'type', 'email', 'phone', 'city', 'district', 'state', 'pinCode', 'logoUrl', 'planTier',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await db.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: updated.id,
        name: updated.name,
        planTier: updated.planTier,
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
