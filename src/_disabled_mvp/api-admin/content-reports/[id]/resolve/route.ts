/**
 * Content Reports Resolution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveReport } from '@/lib/content-moderation';

// POST /api/admin/content-reports/[id]/resolve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reviewerId, action } = body;

    if (!reviewerId || !action) {
      return NextResponse.json(
        { error: 'reviewerId and action are required' },
        { status: 400 }
      );
    }

    const validActions = ['warning', 'content_removed', 'account_suspended', 'dismissed'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const report = await resolveReport(id, reviewerId, action);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Failed to resolve report:', error);
    return NextResponse.json({ error: 'Failed to resolve report' }, { status: 500 });
  }
}
