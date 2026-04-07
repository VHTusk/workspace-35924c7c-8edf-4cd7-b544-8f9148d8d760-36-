import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, DisputeStatus, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { safeParseInt } from '@/lib/validation';

// List all disputes with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const status = searchParams.get('status') as DisputeStatus | null;
    const page = safeParseInt(searchParams.get('page'), 1, 1, 1000);
    const limit = safeParseInt(searchParams.get('limit'), 20, 1, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      db.dispute.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.dispute.count({ where }),
    ]);

    return NextResponse.json({
      disputes: disputes.map((d) => ({
        id: d.id,
        matchId: d.matchId,
        sport: d.sport,
        status: d.status,
        reason: d.reason,
        evidence: d.evidence,
        resolution: d.resolution,
        resolvedById: d.resolvedById,
        resolvedAt: d.resolvedAt,
        createdAt: d.createdAt,
        raisedBy: d.user,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin disputes list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
