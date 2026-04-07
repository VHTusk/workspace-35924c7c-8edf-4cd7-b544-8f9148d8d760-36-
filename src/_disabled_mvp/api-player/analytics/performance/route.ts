import { NextRequest, NextResponse } from 'next/server';
import { getPlayerPerformanceByScope, getPlayerStrengthOfSchedule } from '@/lib/analytics';
import { validateSession } from '@/lib/auth';

/**
 * GET /api/player/analytics/performance
 *
 * Get performance breakdown by tournament scope for the authenticated player
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session (properly hashes token before lookup)
    const session = await validateSession(sessionToken);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeSOS = searchParams.get('sos') === 'true';

    const [performanceByScope, strengthOfSchedule] = await Promise.all([
      getPlayerPerformanceByScope(session.user.id),
      includeSOS ? getPlayerStrengthOfSchedule(session.user.id) : null,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        byScope: performanceByScope,
        strengthOfSchedule,
      },
    });

  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
