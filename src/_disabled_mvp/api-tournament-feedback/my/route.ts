/**
 * Get current user's feedback for a tournament
 * GET /api/tournaments/[id]/feedback/my
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
    });

    if (!session?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const feedback = await db.tournamentFeedback.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: session.userId },
      },
    });

    return NextResponse.json({
      submitted: !!feedback,
      feedback: feedback || null,
    });

  } catch (error) {
    console.error('[Feedback My API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
