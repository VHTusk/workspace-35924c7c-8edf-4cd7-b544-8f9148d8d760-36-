/**
 * V1 Match Check-In API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/matches/:id/checkin - Get check-in status
 * POST /api/v1/matches/:id/checkin - Player check-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-request';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { playerCheckIn, getMatchReadiness } from '@/lib/venue-flow';

// GET /api/v1/matches/:id/checkin - Get check-in status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;

    const checkIns = await db.matchCheckIn.findMany({
      where: { matchId },
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        gracePeriodEnds: true,
        extensionCount: true,
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
      select: {
        id: true,
        scheduledTime: true,
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            venueFlowConfig: true,
          },
        },
      },
    });

    if (!match) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Match not found', { id: matchId }, 404);
    }

    const readiness = await getMatchReadiness(matchId);

    // Get court assignment
    const assignment = await db.courtAssignment.findFirst({
      where: { matchId, releasedAt: null },
      select: {
        courtId: true,
        assignedAt: true,
        court: {
          select: { name: true },
        },
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        match: {
          id: match.id,
          tournament: match.tournament ? {
            id: match.tournament.id,
            name: match.tournament.name,
          } : null,
          playerA: match.playerA ? {
            id: match.playerA.id,
            name: `${match.playerA.firstName} ${match.playerA.lastName}`,
          } : null,
          playerB: match.playerB ? {
            id: match.playerB.id,
            name: `${match.playerB.firstName} ${match.playerB.lastName}`,
          } : null,
          scheduledTime: match.scheduledTime?.toISOString() || null,
        },
        checkIns: checkIns.map((c) => ({
          id: c.id,
          player: c.player ? {
            id: c.player.id,
            name: `${c.player.firstName} ${c.player.lastName}`,
          } : null,
          status: c.status,
          checkedInAt: c.checkedInAt?.toISOString() || null,
          gracePeriodEnds: c.gracePeriodEnds?.toISOString() || null,
          extensionCount: c.extensionCount,
        })),
        readiness,
        courtAssignment: assignment
          ? {
              courtId: assignment.courtId,
              courtName: assignment.court.name,
              assignedAt: assignment.assignedAt.toISOString(),
            }
          : null,
        config: match.tournament?.venueFlowConfig || null,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Match Checkin] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to fetch check-in status', undefined, 500);
  }
}

// POST /api/v1/matches/:id/checkin - Player check-in
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;
    const body = await request.json();
    const { courtId } = body;

    // Player self check-in
    const result = await playerCheckIn(matchId, userId, courtId);

    if (!result.success) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        result.message || 'Check-in failed',
        undefined,
        400
      );
    }

    const response = NextResponse.json({
      success: true,
      data: {
        checkIn: result.checkIn ? {
          id: result.checkIn.id,
          status: result.checkIn.status,
          checkedInAt: result.checkIn.checkedInAt?.toISOString() || null,
        } : null,
        matchReadiness: result.matchReadiness,
        message: result.message,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Match Checkin] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to check in', undefined, 500);
  }
}
