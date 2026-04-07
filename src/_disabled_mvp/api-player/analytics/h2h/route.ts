import { NextRequest, NextResponse } from 'next/server';
import { getPlayerHeadToHeadHistory } from '@/lib/analytics';
import { validateSession } from '@/lib/auth';

/**
 * GET /api/player/analytics/h2h
 *
 * Get head-to-head history between authenticated player and opponent
 *
 * Query params:
 * - opponentId: ID of the opponent (required)
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
    const opponentId = searchParams.get('opponentId');

    if (!opponentId) {
      return NextResponse.json(
        { error: 'opponentId query parameter is required' },
        { status: 400 }
      );
    }

    const h2hData = await getPlayerHeadToHeadHistory(session.user.id, opponentId);

    if (!h2hData) {
      return NextResponse.json(
        { error: 'Opponent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: h2hData,
    });

  } catch (error) {
    console.error('Error fetching head-to-head data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch head-to-head data' },
      { status: 500 }
    );
  }
}
