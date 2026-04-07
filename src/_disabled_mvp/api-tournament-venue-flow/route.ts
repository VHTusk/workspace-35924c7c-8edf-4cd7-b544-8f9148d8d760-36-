/**
 * Venue Flow Control API (v3.47.0)
 * 
 * GET: Get venue flow status and config
 * PATCH: Update venue flow config
 * POST: Trigger venue flow actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAdminPermission } from '@/lib/admin-permissions';
import { getAuthenticatedAdmin } from '@/lib/auth';
import {
  confirmNoShow,
  grantExtension,
  reassignCourt,
  releaseCourt,
  autoAssignCourt,
  checkVenueHealth,
  processDynamicScheduling,
} from '@/lib/venue-flow';

// GET /api/tournaments/[id]/venue-flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    // Get tournament with venue flow config
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        venueFlowConfig: true,
        courts: {
          include: {
            _count: { select: { assignments: true } },
          },
        },
        matchQueue: {
          where: { status: { in: ['QUEUED', 'ASSIGNED'] } },
          orderBy: { position: 'asc' },
          take: 20,
          include: {
            match: {
              include: {
                playerA: { select: { id: true, firstName: true, lastName: true } },
                playerB: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        venueHealthAlerts: {
          where: { isResolved: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get pending no-shows
    const pendingNoShows = await db.matchCheckIn.findMany({
      where: {
        match: { tournamentId },
        status: 'NO_SHOW_DETECTED',
        noShowConfirmedAt: null,
      },
      include: {
        match: {
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Get recent flow logs
    const recentLogs = await db.venueFlowLog.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      config: tournament.venueFlowConfig,
      courts: {
        total: tournament.courts.length,
        available: tournament.courts.filter((c) => c.status === 'AVAILABLE').length,
        occupied: tournament.courts.filter((c) => c.status === 'OCCUPIED').length,
        list: tournament.courts,
      },
      matchQueue: tournament.matchQueue.map((q) => ({
        id: q.id,
        position: q.position,
        readiness: q.readiness,
        status: q.status,
        match: q.match,
        readyAt: q.readyAt,
        assignedAt: q.assignedAt,
      })),
      pendingNoShows: pendingNoShows.map((ns) => ({
        id: ns.id,
        matchId: ns.matchId,
        player: ns.player,
        detectedAt: ns.noShowDetectedAt,
        match: ns.match,
      })),
      healthAlerts: tournament.venueHealthAlerts,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        matchId: log.matchId,
        courtId: log.courtId,
        isOverride: log.isOverride,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching venue flow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/venue-flow - Trigger actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canScoreMatches',
      { tournamentId }
    );

    if (!permCheck.granted) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 });
    }

    const body = await request.json();
    const { action, matchId, playerId, courtId, extensionMinutes, reason } = body;

    let result;

    switch (action) {
      case 'confirm_no_show':
        if (!matchId || !playerId || !reason) {
          return NextResponse.json(
            { error: 'matchId, playerId, and reason required' },
            { status: 400 }
          );
        }
        result = await confirmNoShow(matchId, playerId, user.id, reason);
        break;

      case 'grant_extension':
        if (!matchId || !playerId || !extensionMinutes || !reason) {
          return NextResponse.json(
            { error: 'matchId, playerId, extensionMinutes, and reason required' },
            { status: 400 }
          );
        }
        result = await grantExtension(
          matchId,
          playerId,
          user.id,
          extensionMinutes,
          reason
        );
        break;

      case 'reassign_court':
        if (!matchId || !courtId || !reason) {
          return NextResponse.json(
            { error: 'matchId, courtId, and reason required' },
            { status: 400 }
          );
        }
        result = await reassignCourt(matchId, courtId, user.id, reason);
        break;

      case 'release_court':
        if (!matchId) {
          return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }
        result = await releaseCourt(matchId);
        break;

      case 'auto_assign_court':
        if (!matchId) {
          return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }
        result = await autoAssignCourt(matchId);
        break;

      case 'process_scheduling':
        result = await processDynamicScheduling(tournamentId);
        break;

      case 'check_health':
        result = await checkVenueHealth(tournamentId);
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const actionSucceeded =
      typeof result === 'object' && result !== null && 'success' in result
        ? result.success
        : true;

    return NextResponse.json({
      success: actionSucceeded,
      result,
    });
  } catch (error) {
    console.error('Error in venue flow action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/tournaments/[id]/venue-flow - Update config
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canEditTournament',
      { tournamentId }
    );

    if (!permCheck.granted) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 });
    }

    const body = await request.json();

    // Upsert venue flow config
    const config = await db.venueFlowConfig.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        ...body,
      },
      update: body,
    });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error updating venue flow config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
