import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// POST - Player declines roster invitation
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Find the request
    const rosterRequest = await db.orgRosterRequest.findUnique({
      where: { id: requestId },
    });

    if (!rosterRequest || rosterRequest.playerId !== user.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (rosterRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is no longer pending' }, { status: 400 });
    }

    // Update request status
    await db.orgRosterRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decline roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
