import { NextRequest, NextResponse } from 'next/server';
import { getPlayerStrengthOfSchedule } from '@/lib/analytics';
import { validateSession } from '@/lib/auth';

/**
 * GET /api/player/analytics/sos
 *
 * Get strength of schedule for the authenticated player
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

    const strengthOfSchedule = await getPlayerStrengthOfSchedule(session.user.id);

    return NextResponse.json({
      success: true,
      data: strengthOfSchedule,
    });

  } catch (error) {
    console.error('Error fetching strength of schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strength of schedule' },
      { status: 500 }
    );
  }
}
