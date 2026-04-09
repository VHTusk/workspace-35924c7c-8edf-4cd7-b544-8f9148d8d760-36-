import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

// POST - Send roster invitation to a player
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
    const { playerId, message } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // Check if player exists and is in same sport
    const player = await db.user.findUnique({
      where: { id: playerId },
    });

    if (!player || player.sport !== org.sport) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check current roster size
    const currentRosterCount = await db.orgRosterPlayer.count({
      where: { orgId: org.id, isActive: true },
    });

    if (currentRosterCount >= 25) {
      return NextResponse.json({ error: 'Roster is full (max 25 players)' }, { status: 400 });
    }

    // Check if player is already in a roster for this sport
    const existingRoster = await db.orgRosterPlayer.findUnique({
      where: { userId_sport: { userId: playerId, sport: org.sport as SportType } },
    });

    if (existingRoster) {
      return NextResponse.json({ error: 'Player is already in another organization roster' }, { status: 400 });
    }

    // Check for existing pending request
    const existingRequest = await db.orgRosterRequest.findFirst({
      where: { 
        orgId: org.id, 
        playerId,
        sport: org.sport as SportType,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'Pending request already exists for this player' }, { status: 400 });
    }

    // Create roster request (7 days expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const rosterRequest = await db.orgRosterRequest.create({
      data: {
        orgId: org.id,
        playerId,
        sport: org.sport as SportType,
        message,
        expiresAt,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: rosterRequest.id,
        playerId,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Send roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
