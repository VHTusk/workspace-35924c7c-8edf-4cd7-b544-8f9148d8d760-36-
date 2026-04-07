import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { getOrgTournamentROI } from '@/lib/analytics';

/**
 * GET /api/org/analytics/roi
 * 
 * Get tournament ROI (Return on Investment) for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const orgId = session.orgId!;
    const roiData = await getOrgTournamentROI(orgId);

    return NextResponse.json({
      success: true,
      data: roiData,
    });

  } catch (error) {
    console.error('Error fetching tournament ROI:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament ROI data' },
      { status: 500 }
    );
  }
}
