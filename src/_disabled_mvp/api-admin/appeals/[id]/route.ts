import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { Role, AppealStatus } from '@prisma/client';

/**
 * GET /api/admin/appeals/[id]
 * Get single appeal details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;
    if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const appeal = await db.appeal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            photoUrl: true,
          },
        },
      },
    });

    if (!appeal) {
      return NextResponse.json({ error: 'Appeal not found' }, { status: 404 });
    }

    return NextResponse.json({ appeal });
  } catch (error) {
    console.error('Get appeal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/appeals/[id]
 * Update appeal status/resolution
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;
    if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { status, resolution, resolutionType, adminNotes } = body;

    // Get existing appeal
    const existingAppeal = await db.appeal.findUnique({
      where: { id },
    });

    if (!existingAppeal) {
      return NextResponse.json({ error: 'Appeal not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = user.id;
    }
    
    if (resolution !== undefined) {
      updateData.resolution = resolution;
    }
    
    if (resolutionType) {
      updateData.resolutionType = resolutionType;
    }
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    // Update appeal
    const updatedAppeal = await db.appeal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      appeal: {
        id: updatedAppeal.id,
        status: updatedAppeal.status,
        resolution: updatedAppeal.resolution,
        resolutionType: updatedAppeal.resolutionType,
        reviewedAt: updatedAppeal.reviewedAt,
      },
    });
  } catch (error) {
    console.error('Update appeal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
