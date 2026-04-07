import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { Role, AppealStatus, AppealType } from '@prisma/client';

/**
 * GET /api/admin/appeals
 * List all appeals with filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;
    if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as AppealStatus | null;
    const type = searchParams.get('type') as AppealType | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (type) {
      where.type = type;
    }

    // Get appeals with user info
    const appeals = await db.appeal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { submittedAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count
    const total = await db.appeal.count({ where });

    // Get stats by status
    const statsByStatus = await db.appeal.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Get stats by type
    const statsByType = await db.appeal.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    return NextResponse.json({
      appeals: appeals.map((appeal) => ({
        id: appeal.id,
        type: appeal.type,
        status: appeal.status,
        reason: appeal.reason,
        evidence: appeal.evidence,
        relatedId: appeal.relatedId,
        priority: appeal.priority,
        submittedAt: appeal.submittedAt,
        reviewedAt: appeal.reviewedAt,
        resolution: appeal.resolution,
        resolutionType: appeal.resolutionType,
        user: appeal.user ? {
          id: appeal.user.id,
          firstName: appeal.user.firstName,
          lastName: appeal.user.lastName,
          email: appeal.user.email,
          phone: appeal.user.phone,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: statsByStatus.find((s) => s.status === AppealStatus.PENDING)?._count.id || 0,
        underReview: statsByStatus.find((s) => s.status === AppealStatus.UNDER_REVIEW)?._count.id || 0,
        approved: statsByStatus.find((s) => s.status === AppealStatus.APPROVED)?._count.id || 0,
        rejected: statsByStatus.find((s) => s.status === AppealStatus.REJECTED)?._count.id || 0,
        escalated: statsByStatus.find((s) => s.status === AppealStatus.ESCALATED)?._count.id || 0,
        byType: statsByType.map((t) => ({ type: t.type, count: t._count.id })),
      },
    });
  } catch (error) {
    console.error('Admin appeals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
