import { NextRequest, NextResponse } from 'next/server';
import { getPlayerWinRateTrend } from '@/lib/analytics';
import { validateSession } from '@/lib/auth';

/**
 * GET /api/player/analytics/trend
 *
 * Get win rate trend data for the authenticated player
 *
 * Query params:
 * - months: number of months to look back (default: 12)
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
    const months = parseInt(searchParams.get('months') || '12', 10);

    const trendData = await getPlayerWinRateTrend(session.user.id, months);

    return NextResponse.json({
      success: true,
      data: trendData,
    });

  } catch (error) {
    console.error('Error fetching win rate trend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch win rate trend' },
      { status: 500 }
    );
  }
}
