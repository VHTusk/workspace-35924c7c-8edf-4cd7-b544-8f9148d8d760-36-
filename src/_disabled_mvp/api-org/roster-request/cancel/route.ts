import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// POST - Cancel a roster request
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = session.org;
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Find and verify the request belongs to this org
    const rosterRequest = await db.orgRosterRequest.findUnique({
      where: { id: requestId },
    });

    if (!rosterRequest || rosterRequest.orgId !== org.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (rosterRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Can only cancel pending requests' }, { status: 400 });
    }

    // Update request status
    await db.orgRosterRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
