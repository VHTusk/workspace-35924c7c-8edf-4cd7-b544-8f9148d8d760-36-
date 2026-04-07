/**
 * Tournament Pause/Resume API
 * POST /api/director/tournament/[id]/pause - Pause tournament
 * DELETE /api/director/tournament/[id]/pause - Resume tournament
 * 
 * v3.43.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { TournamentStatus } from '@prisma/client';
import { validateStaffAccess, StaffRole } from '@/lib/tournament-staff-access';
import { dispatchNotification, buildNotificationPayload } from '@/lib/unified-notifications';

interface PauseRequest {
  reason: string; // WEATHER, MEDICAL, TECHNICAL, SECURITY, BREAK, OTHER
  notes?: string;
  estimatedDuration?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate staff access - must be HEAD_DIRECTOR or ASSISTANT_DIRECTOR
    const access = await validateStaffAccess(session.user.id, tournamentId);
    if (!access.allowed || (access.role !== StaffRole.HEAD_DIRECTOR && access.role !== StaffRole.ASSISTANT_DIRECTOR)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions', 
        reason: access.reason 
      }, { status: 403 });
    }

    // Check tournament is in IN_PROGRESS status
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: { 
        registrations: { 
          where: { status: 'CONFIRMED' },
          include: { user: { select: { id: true } } }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status !== TournamentStatus.IN_PROGRESS) {
      return NextResponse.json({ 
        error: 'Tournament must be in progress to pause',
        currentStatus: tournament.status 
      }, { status: 400 });
    }

    // Parse request body
    const body = await request.json() as PauseRequest;
    
    if (!body.reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    // Create pause record and update tournament status
    const [pause] = await db.$transaction([
      db.tournamentPause.create({
        data: {
          tournamentId,
          reason: body.reason as any,
          notes: body.notes,
          pausedBy: session.user.id,
          broadcastSent: false,
        },
      }),
      db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.PAUSED },
      }),
    ]);

    // Send broadcast notification to all participants
    const userIds = tournament.registrations.map(r => r.user.id);
    
    const notificationPayload = buildNotificationPayload('TOURNAMENT_PAUSED', {
      tournamentName: tournament.name,
      reason: body.reason.replace(/_/g, ' '),
      message: body.notes,
      tournamentId,
      sport: tournament.sport,
    });

    // Send to all participants (fire and forget)
    Promise.all(
      userIds.map(userId => 
        dispatchNotification({
          userId,
          channels: ['push', 'in_app'],
          template: 'TOURNAMENT_PAUSED',
          payload: notificationPayload,
          priority: 'high',
        })
      )
    ).catch(console.error);

    // Update pause record to mark broadcast as sent
    await db.tournamentPause.update({
      where: { id: pause.id },
      data: { broadcastSent: true },
    }).catch(() => {});

    // Log to audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'tournament_pause',
        targetId: tournamentId,
        reason: `Tournament paused: ${body.reason}`,
        metadata: JSON.stringify({
          pauseId: pause.id,
          reason: body.reason,
          notes: body.notes,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      pause: {
        id: pause.id,
        reason: pause.reason,
        pausedAt: pause.pausedAt,
      },
      message: 'Tournament paused successfully',
    });

  } catch (error) {
    console.error('[Pause API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate staff access
    const access = await validateStaffAccess(session.user.id, tournamentId);
    if (!access.allowed || (access.role !== StaffRole.HEAD_DIRECTOR && access.role !== StaffRole.ASSISTANT_DIRECTOR)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions', 
        reason: access.reason 
      }, { status: 403 });
    }

    // Check tournament is paused
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: { 
        registrations: { 
          where: { status: 'CONFIRMED' },
          include: { user: { select: { id: true } } }
        },
        pauses: {
          where: { resumedAt: null },
          orderBy: { pausedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status !== TournamentStatus.PAUSED) {
      return NextResponse.json({ 
        error: 'Tournament is not paused',
        currentStatus: tournament.status 
      }, { status: 400 });
    }

    const activePause = tournament.pauses[0];
    if (!activePause) {
      return NextResponse.json({ error: 'No active pause found' }, { status: 400 });
    }

    // Calculate duration
    const duration = Math.round((Date.now() - activePause.pausedAt.getTime()) / (1000 * 60));

    // Update pause record and tournament status
    await db.$transaction([
      db.tournamentPause.update({
        where: { id: activePause.id },
        data: {
          resumedAt: new Date(),
          resumedBy: session.user.id,
          duration,
        },
      }),
      db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      }),
    ]);

    // Send resume notification to all participants
    const userIds = tournament.registrations.map(r => r.user.id);
    
    const notificationPayload = buildNotificationPayload('TOURNAMENT_RESUMED', {
      tournamentName: tournament.name,
      tournamentId,
      sport: tournament.sport,
    });

    Promise.all(
      userIds.map(userId => 
        dispatchNotification({
          userId,
          channels: ['push', 'in_app'],
          template: 'TOURNAMENT_RESUMED',
          payload: notificationPayload,
          priority: 'high',
        })
      )
    ).catch(console.error);

    // Log to audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'tournament_resume',
        targetId: tournamentId,
        reason: `Tournament resumed after ${duration} minutes`,
        metadata: JSON.stringify({
          pauseId: activePause.id,
          duration,
          originalReason: activePause.reason,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tournament resumed successfully',
      pauseDuration: duration,
    });

  } catch (error) {
    console.error('[Resume API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
