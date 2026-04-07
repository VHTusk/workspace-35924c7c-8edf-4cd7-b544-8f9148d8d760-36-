import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// POST - Player accepts roster invitation
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
      include: { org: true },
    });

    if (!rosterRequest || rosterRequest.playerId !== user.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (rosterRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is no longer pending' }, { status: 400 });
    }

    if (rosterRequest.expiresAt < new Date()) {
      await db.orgRosterRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ error: 'Request has expired' }, { status: 400 });
    }

    // Check if already in a roster
    const existingRoster = await db.orgRosterPlayer.findUnique({
      where: { userId_sport: { userId: user.id, sport: user.sport } },
    });

    if (existingRoster) {
      return NextResponse.json({ error: 'You are already in another organization roster' }, { status: 400 });
    }

    // Check org roster size
    const rosterCount = await db.orgRosterPlayer.count({
      where: { orgId: rosterRequest.orgId, isActive: true },
    });

    if (rosterCount >= 25) {
      return NextResponse.json({ error: 'Organization roster is full' }, { status: 400 });
    }

    // Add to roster
    await db.orgRosterPlayer.create({
      data: {
        orgId: rosterRequest.orgId,
        userId: user.id,
        sport: user.sport,
        isActive: true,
      },
    });

    // Update request status
    await db.orgRosterRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: rosterRequest.org.id,
        name: rosterRequest.org.name,
      },
    });
  } catch (error) {
    console.error('Accept roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
