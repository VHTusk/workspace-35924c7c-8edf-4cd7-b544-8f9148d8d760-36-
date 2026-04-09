import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { RosterRequestStatus } from '@prisma/client';

const MAX_ROSTER_SIZE = 25;

// GET - Get org's roster and pending requests
export async function GET(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.org.id;

    // Get current roster
    const roster = await db.orgRosterPlayer.findMany({
      where: { orgId, isActive: true },
      include: {
        user: {
          include: {
            rating: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Get pending requests sent by org
    const pendingRequests = await db.orgRosterRequest.findMany({
      where: {
        orgId,
        status: RosterRequestStatus.PENDING,
      },
      include: {
        player: {
          include: {
            rating: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Check for expired requests
    const now = new Date();
    const expiredIds = pendingRequests
      .filter((r) => r.expiresAt < now)
      .map((r) => r.id);

    if (expiredIds.length > 0) {
      await db.orgRosterRequest.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: RosterRequestStatus.EXPIRED },
      });
    }

    return NextResponse.json({
      roster: roster.map((entry) => ({
        id: entry.id,
        playerId: entry.userId,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        email: entry.user.email,
        phone: entry.user.phone,
        city: entry.user.city,
        state: entry.user.state,
        elo: entry.user.hiddenElo,
        tier: entry.user.rating
          ? getEloTier(entry.user.hiddenElo, entry.user.rating.matchesPlayed)
          : 'UNRANKED',
        matchesPlayed: entry.user.rating?.matchesPlayed || 0,
        wins: entry.user.rating?.wins || 0,
        losses: entry.user.rating?.losses || 0,
        joinedAt: entry.joinedAt,
        isCaptain: false,
        tags: [],
      })),
      pendingRequests: pendingRequests
        .filter((r) => r.expiresAt >= now)
        .map((r) => ({
          id: r.id,
          playerId: r.playerId,
          firstName: r.player.firstName,
          lastName: r.player.lastName,
          elo: r.player.hiddenElo,
          tier: r.player.rating
            ? getEloTier(r.player.hiddenElo, r.player.rating.matchesPlayed)
            : 'UNRANKED',
          requestedAt: r.requestedAt,
          expiresAt: r.expiresAt,
        })),
      stats: {
        currentCount: roster.length,
        maxCount: MAX_ROSTER_SIZE,
        availableSlots: MAX_ROSTER_SIZE - roster.length,
        pendingCount: pendingRequests.filter((r) => r.expiresAt >= now).length,
      },
    });
  } catch (error) {
    console.error('Get org roster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update player in roster (captain status, tags)
export async function PUT(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.org.id;
    const body = await request.json();
    const { playerId, isCaptain, tags } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // Find the roster entry
    const rosterEntry = await db.orgRosterPlayer.findFirst({
      where: { orgId, userId: playerId },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: 'Player not in roster' }, { status: 404 });
    }

    if (isCaptain !== undefined || tags !== undefined) {
      return NextResponse.json(
        { error: 'Captain status and roster tags are not available in the current roster data model.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      player: {
        id: rosterEntry.id,
        playerId: rosterEntry.userId,
        isCaptain: false,
        tags: [],
      },
    });
  } catch (error) {
    console.error('Update roster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove player from roster
export async function DELETE(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.org.id;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // Find and delete the roster entry
    const rosterEntry = await db.orgRosterPlayer.findFirst({
      where: { orgId, userId: playerId },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: 'Player not in roster' }, { status: 404 });
    }

    await db.orgRosterPlayer.delete({
      where: { id: rosterEntry.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from roster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getEloTier(elo: number, matchCount: number): string {
  if (matchCount < 30) return 'UNRANKED';
  if (elo >= 1900) return 'DIAMOND';
  if (elo >= 1700) return 'PLATINUM';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1300) return 'SILVER';
  return 'BRONZE';
}
