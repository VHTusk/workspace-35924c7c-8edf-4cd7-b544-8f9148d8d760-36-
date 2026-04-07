import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';
import { RosterRequestStatus } from '@prisma/client';

const MAX_ROSTER_SIZE = 25;

// GET - Get player's roster requests
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all roster requests for this player
    const requests = await db.orgRosterRequest.findMany({
      where: { playerId: userId },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            type: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Check for expired requests and update them
    const now = new Date();
    const expiredRequests = requests.filter(
      (r) => r.status === RosterRequestStatus.PENDING && r.expiresAt < now
    );

    if (expiredRequests.length > 0) {
      await db.orgRosterRequest.updateMany({
        where: {
          id: { in: expiredRequests.map((r) => r.id) },
        },
        data: { status: RosterRequestStatus.EXPIRED },
      });
    }

    // Check if player is already in a roster
    const currentRoster = await db.orgRosterPlayer.findUnique({
      where: { userId_sport: { userId, sport: session.user.sport } },
      include: { org: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        status: r.expiresAt < now && r.status === RosterRequestStatus.PENDING
          ? 'EXPIRED'
          : r.status,
        message: r.message,
        requestedAt: r.requestedAt,
        expiresAt: r.expiresAt,
        organization: r.org,
      })),
      currentRoster: currentRoster
        ? { orgId: currentRoster.orgId, orgName: currentRoster.org.name }
        : null,
    });
  } catch (error) {
    console.error('Get roster requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Accept or Decline a roster request
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const sport = session.user.sport;
    const body = await request.json();
    const { requestId, action } = body; // action: 'accept' or 'decline'

    if (!requestId || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Request ID and valid action (accept/decline) are required' },
        { status: 400 }
      );
    }

    // Find the request
    const rosterRequest = await db.orgRosterRequest.findUnique({
      where: { id: requestId },
      include: { org: true },
    });

    if (!rosterRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (rosterRequest.playerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (rosterRequest.status !== RosterRequestStatus.PENDING) {
      return NextResponse.json(
        { error: 'This request is no longer pending' },
        { status: 400 }
      );
    }

    // Check if expired
    if (rosterRequest.expiresAt < new Date()) {
      await db.orgRosterRequest.update({
        where: { id: requestId },
        data: { status: RosterRequestStatus.EXPIRED },
      });
      return NextResponse.json({ error: 'This request has expired' }, { status: 400 });
    }

    if (action === 'decline') {
      // Decline the request
      await db.orgRosterRequest.update({
        where: { id: requestId },
        data: {
          status: RosterRequestStatus.DECLINED,
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, action: 'declined' });
    }

    // Accept the request
    // Check if player is already in a roster
    const existingRoster = await db.orgRosterPlayer.findUnique({
      where: { userId_sport: { userId, sport } },
    });

    if (existingRoster) {
      return NextResponse.json(
        { error: 'You are already in an organization roster' },
        { status: 400 }
      );
    }

    // Check if org has reached max roster size
    const rosterCount = await db.orgRosterPlayer.count({
      where: { orgId: rosterRequest.orgId, isActive: true },
    });

    if (rosterCount >= MAX_ROSTER_SIZE) {
      return NextResponse.json(
        { error: 'Organization has reached maximum roster size' },
        { status: 400 }
      );
    }

    // Use transaction to add player to roster and update request
    await db.$transaction([
      db.orgRosterPlayer.create({
        data: {
          orgId: rosterRequest.orgId,
          userId,
          sport,
        },
      }),
      db.orgRosterRequest.update({
        where: { id: requestId },
        data: {
          status: RosterRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      }),
      // Cancel any other pending requests for this player
      db.orgRosterRequest.updateMany({
        where: {
          playerId: userId,
          sport,
          status: RosterRequestStatus.PENDING,
          id: { not: requestId },
        },
        data: { status: RosterRequestStatus.CANCELLED },
      }),
    ]);

    return NextResponse.json({
      success: true,
      action: 'accepted',
      organization: {
        id: rosterRequest.org.id,
        name: rosterRequest.org.name,
      },
    });
  } catch (error) {
    console.error('Respond to roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
