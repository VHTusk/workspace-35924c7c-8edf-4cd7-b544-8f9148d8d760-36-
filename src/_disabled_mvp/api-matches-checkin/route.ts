/**
 * Match Check-In API (v3.47.0)
 * 
 * POST: Player check-in for match
 * GET: Get check-in status for match
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, getAuthenticatedAdmin } from '@/lib/auth';
import { playerCheckIn, adminCheckInOverride, getMatchReadiness } from '@/lib/venue-flow';

// GET /api/matches/[id]/checkin - Get check-in status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;

    const checkIns = await db.matchCheckIn.findMany({
      where: { matchId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: {
          include: { venueFlowConfig: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const readiness = await getMatchReadiness(matchId);

    // Get court assignment
    const assignment = await db.courtAssignment.findFirst({
      where: { matchId, releasedAt: null },
      include: { court: true },
    });

    return NextResponse.json({
      match: {
        id: match.id,
        playerA: match.playerA,
        playerB: match.playerB,
        scheduledTime: match.scheduledTime,
      },
      checkIns: checkIns.map((c) => ({
        id: c.id,
        player: c.player,
        status: c.status,
        checkedInAt: c.checkedInAt,
        gracePeriodEnds: c.gracePeriodEnds,
        extensionCount: c.extensionCount,
      })),
      readiness,
      courtAssignment: assignment
        ? {
            courtId: assignment.courtId,
            courtName: assignment.court.name,
            assignedAt: assignment.assignedAt,
          }
        : null,
      config: match.tournament?.venueFlowConfig ?? null,
    });
  } catch (error) {
    console.error('Error fetching check-in status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/matches/[id]/checkin - Player check-in
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const body = await request.json();
    const { playerId, courtId, adminOverride, reason } = body;

    // Get session for authorization - try user session first, then admin session
    const userAuth = await getAuthenticatedUser(request);
    const adminAuth = await getAuthenticatedAdmin(request);

    let userId: string | null = null;
    let isAdmin = false;

    // Check player session
    if (userAuth) {
      userId = userAuth.user.id;
    }

    // Check admin session
    if (adminAuth) {
      userId = adminAuth.user.id;
      isAdmin = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'].includes(
        adminAuth.user.role
      );
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let result;

    // Admin override check-in
    if (adminOverride && isAdmin) {
      if (!reason) {
        return NextResponse.json(
          { error: 'Reason required for admin override' },
          { status: 400 }
        );
      }
      result = await adminCheckInOverride(matchId, playerId, userId, reason);
    } else {
      // Player self check-in
      // Players can only check in for themselves
      if (!playerId || playerId !== userId) {
        return NextResponse.json(
          { error: 'Can only check in for yourself' },
          { status: 403 }
        );
      }
      result = await playerCheckIn(matchId, playerId, courtId);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      checkIn: result.checkIn,
      matchReadiness: result.matchReadiness,
      message: result.message,
    });
  } catch (error) {
    console.error('Error in check-in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
