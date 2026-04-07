/**
 * VALORHIVE - Admin Dispute Summary API
 * 
 * GET /api/admin/disputes/[id]/summary
 * Returns a basic summary of a tournament dispute (AI disabled as of v3.78.0)
 * 
 * DELETE /api/admin/disputes/[id]/summary
 * Invalidate cached dispute summary (no-op since no caching)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { summarizeDispute, invalidateDisputeSummaryCache } from '@/lib/dispute-summarizer';
import { getAuthenticatedAdmin } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify admin authentication
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id: disputeId } = await params;

    // Check if dispute exists
    const dispute = await db.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, status: true },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // Generate summary (AI disabled - returns basic context)
    const summary = await summarizeDispute(disputeId);

    return NextResponse.json({
      success: true,
      data: summary,
      meta: {
        aiDisabled: true,
        message: 'AI summarization has been disabled. Manual review recommended.',
      },
    });

  } catch (error) {
    console.error('Dispute summary error:', error);
    return NextResponse.json(
      { error: 'Failed to generate dispute summary' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/disputes/[id]/summary
 * Invalidate cached dispute summary (no-op since caching disabled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify admin authentication
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id: disputeId } = await params;

    // Invalidate cache (no-op since caching disabled)
    await invalidateDisputeSummaryCache(disputeId);

    return NextResponse.json({
      success: true,
      message: 'Summary cache invalidated (no caching active)',
    });

  } catch (error) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
