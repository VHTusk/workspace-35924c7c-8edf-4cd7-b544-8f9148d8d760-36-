import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, SportType, OrgType, OrgPlanTier } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

// List all organizations with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const type = searchParams.get('type') as OrgType | null;
    const planTier = searchParams.get('planTier') as OrgPlanTier | null;
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;
    if (type) where.type = type;
    if (planTier) where.planTier = planTier;
    if (city) where.city = { contains: city };
    if (state) where.state = state;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        include: {
          _count: {
            select: { roster: true, tournamentRegs: true, hostedIntraOrgs: true },
          },
          subscription: {
            select: { status: true, endDate: true, planTier: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        type: org.type,
        sport: org.sport,
        planTier: org.planTier,
        email: org.email,
        phone: org.phone,
        city: org.city,
        state: org.state,
        createdAt: org.createdAt,
        subscription: org.subscription,
        rosterCount: org._count.roster,
        tournamentRegsCount: org._count.tournamentRegs,
        hostedTournamentsCount: org._count.hostedIntraOrgs,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin organizations list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
