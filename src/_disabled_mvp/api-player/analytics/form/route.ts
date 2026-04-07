import { NextRequest, NextResponse } from 'next/server';
import { getPlayerFormIndicator } from '@/lib/analytics';
import { validateSession } from '@/lib/auth';

/**
 * GET /api/player/analytics/form
 *
 * Get form indicator for the authenticated player
 *
 * Query params:
 * - matches: number of recent matches to consider (default: 10)
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
    const matches = parseInt(searchParams.get('matches') || '10', 10);

    const formIndicator = await getPlayerFormIndicator(session.user.id, matches);

    return NextResponse.json({
      success: true,
      data: formIndicator,
    });

  } catch (error) {
    console.error('Error fetching form indicator:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form indicator' },
      { status: 500 }
    );
  }
}
