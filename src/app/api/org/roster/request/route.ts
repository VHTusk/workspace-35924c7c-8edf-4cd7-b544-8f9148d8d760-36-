import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { SportType, RosterRequestStatus } from '@prisma/client';

const MAX_ROSTER_SIZE = 25;
const INVITATION_EXPIRY_DAYS = 7;

// POST - Send roster request to a player
export async function POST(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { playerId, message } = body;
    const orgId = session.org.id;
    const sport = session.sport as SportType;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // Check if player exists and belongs to same sport
    const player = await db.user.findUnique({
      where: { id: playerId },
      include: {
        rating: true,
      },
    });

    if (!player || player.sport !== sport) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if org has reached max roster size
    const currentRosterCount = await db.orgRosterPlayer.count({
      where: { orgId, isActive: true },
    });

    if (currentRosterCount >= MAX_ROSTER_SIZE) {
      return NextResponse.json(
        { error: `Maximum roster size of ${MAX_ROSTER_SIZE} players reached` },
        { status: 400 }
      );
    }

    // Check if player is already in a roster for this sport
    const existingRosterEntry = await db.orgRosterPlayer.findUnique({
      where: { userId_sport: { userId: playerId, sport } },
    });

    if (existingRosterEntry) {
      return NextResponse.json(
        { error: 'Player is already in another organization roster' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await db.orgRosterRequest.findUnique({
      where: {
        orgId_playerId_sport: { orgId, playerId, sport },
      },
    });

    if (existingRequest && existingRequest.status === RosterRequestStatus.PENDING) {
      return NextResponse.json(
        { error: 'A pending request already exists for this player' },
        { status: 400 }
      );
    }

    // Create roster request
    const rosterRequest = await db.orgRosterRequest.create({
      data: {
        orgId,
        playerId,
        sport,
        message,
        expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
      include: {
        org: { select: { name: true } },
        player: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: rosterRequest.id,
        playerId: rosterRequest.playerId,
        playerName: `${rosterRequest.player.firstName} ${rosterRequest.player.lastName}`,
        status: rosterRequest.status,
        expiresAt: rosterRequest.expiresAt,
      },
    });
  } catch (error) {
    console.error('Roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Cancel a roster request
export async function DELETE(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await request.json();
    const orgId = session.org.id;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Find and verify the request belongs to this org
    const rosterRequest = await db.orgRosterRequest.findUnique({
      where: { id: requestId },
    });

    if (!rosterRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (rosterRequest.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (rosterRequest.status !== RosterRequestStatus.PENDING) {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      );
    }

    // Update request status to cancelled
    await db.orgRosterRequest.update({
      where: { id: requestId },
      data: { status: RosterRequestStatus.CANCELLED, respondedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
