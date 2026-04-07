import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { getOrgPlayerDevelopment } from '@/lib/analytics';

/**
 * GET /api/org/analytics/development
 * 
 * Get player development tracking for an organization
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
    const developmentData = await getOrgPlayerDevelopment(orgId);

    return NextResponse.json({
      success: true,
      data: developmentData,
    });

  } catch (error) {
    console.error('Error fetching player development:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player development data' },
      { status: 500 }
    );
  }
}
