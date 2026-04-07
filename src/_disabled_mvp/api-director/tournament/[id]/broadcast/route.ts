/**
 * Director Broadcast API
 * POST /api/director/tournament/[id]/broadcast - Send broadcast to participants
 * GET /api/director/tournament/[id]/broadcast - Get broadcast history
 * 
 * v3.43.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateStaffAccess } from '@/lib/tournament-staff-access';
import { dispatchNotification, buildNotificationPayload } from '@/lib/unified-notifications';

interface BroadcastRequest {
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'URGENT' | 'SCHEDULE';
  sendPush?: boolean;
  sendWhatsApp?: boolean;
}

// Pre-built message templates
const TEMPLATES: Record<string, Partial<BroadcastRequest>> = {
  weather_delay: {
    title: 'Weather Delay',
    message: 'Matches are temporarily paused due to weather conditions. Please stay nearby for updates.',
    type: 'WARNING',
    sendPush: true,
  },
  court_unavailable: {
    title: 'Court Unavailable',
    message: 'A court is temporarily out of service. Match schedules may be adjusted.',
    type: 'WARNING',
    sendPush: true,
  },
  lunch_break: {
    title: 'Lunch Break',
    message: 'Tournament is on lunch break. Matches will resume in 1 hour.',
    type: 'SCHEDULE',
    sendPush: true,
  },
  check_in_reminder: {
    title: 'Check-in Reminder',
    message: 'Please check in at the registration desk at least 15 minutes before your match.',
    type: 'INFO',
    sendPush: true,
  },
  matches_starting: {
    title: 'Matches Starting',
    message: 'Matches are now live! Please report to your assigned courts.',
    type: 'URGENT',
    sendPush: true,
  },
  day_complete: {
    title: 'Day Complete',
    message: "Today's matches have concluded. Check the schedule for tomorrow's timings.",
    type: 'INFO',
    sendPush: true,
  },
};

export async function GET(
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
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get broadcast history
    const broadcasts = await db.directorBroadcast.findMany({
      where: { tournamentId },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      broadcasts,
      templates: Object.keys(TEMPLATES).map(key => ({
        id: key,
        ...TEMPLATES[key],
      })),
    });

  } catch (error) {
    console.error('[Broadcast API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

    // Validate staff access
    const access = await validateStaffAccess(session.user.id, tournamentId, 'manage_announcements');
    if (!access.allowed) {
      return NextResponse.json({ 
        error: 'Insufficient permissions', 
        reason: access.reason 
      }, { status: 403 });
    }

    // Get tournament with participants
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          include: { user: { select: { id: true, phone: true } } },
        },
      },
    });

    if (!tournament) {
      return NextRequest.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Parse request
    const body = await request.json() as BroadcastRequest & { templateId?: string };

    // Apply template if specified
    let broadcastData = { ...body };
    if (body.templateId && TEMPLATES[body.templateId]) {
      broadcastData = {
        ...TEMPLATES[body.templateId],
        ...body,
      };
    }

    // Validate required fields
    if (!broadcastData.title || !broadcastData.message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    // Create broadcast record
    const broadcast = await db.directorBroadcast.create({
      data: {
        tournamentId,
        senderId: session.user.id,
        title: broadcastData.title,
        message: broadcastData.message,
        type: broadcastData.type || 'INFO',
        sendPush: broadcastData.sendPush ?? false,
        sendWhatsApp: broadcastData.sendWhatsApp ?? false,
        deliveredCount: 0,
        readCount: 0,
      },
    });

    // Also create TournamentAnnouncement for persistence
    await db.tournamentAnnouncement.create({
      data: {
        tournamentId,
        title: broadcastData.title,
        message: broadcastData.message,
      },
    });

    // Send notifications
    const userIds = tournament.registrations.map(r => r.user.id);
    let deliveredCount = 0;

    const notificationPayload = buildNotificationPayload('TOURNAMENT_ANNOUNCEMENT', {
      tournamentName: tournament.name,
      tournamentId,
      message: broadcastData.message,
      sport: tournament.sport,
    });

    const channels: ('push' | 'in_app')[] = broadcastData.sendPush 
      ? ['push', 'in_app'] 
      : ['in_app'];

    // Send notifications
    const results = await Promise.allSettled(
      userIds.map(userId =>
        dispatchNotification({
          userId,
          channels,
          template: 'TOURNAMENT_ANNOUNCEMENT',
          payload: {
            ...notificationPayload,
            title: broadcastData.title!,
          },
          priority: broadcastData.type === 'URGENT' ? 'high' : 'normal',
        })
      )
    );

    deliveredCount = results.filter(r => r.status === 'fulfilled').length;

    // Update broadcast with delivery count
    await db.directorBroadcast.update({
      where: { id: broadcast.id },
      data: { deliveredCount },
    });

    // WhatsApp notification (placeholder - would need WhatsApp provider)
    if (broadcastData.sendWhatsApp) {
      const phones = tournament.registrations
        .map(r => r.user.phone)
        .filter(Boolean);
      
      // TODO: Integrate WhatsApp API
      console.log(`[Broadcast] Would send WhatsApp to ${phones.length} users: ${broadcastData.title}`);
    }

    // Log to audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'director_broadcast',
        targetId: tournamentId,
        reason: `Broadcast sent: ${broadcastData.title}`,
        metadata: JSON.stringify({
          broadcastId: broadcast.id,
          title: broadcastData.title,
          type: broadcastData.type,
          deliveredCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      broadcast: {
        id: broadcast.id,
        title: broadcast.title,
        sentAt: broadcast.sentAt,
        deliveredCount,
      },
      message: `Broadcast delivered to ${deliveredCount} participants`,
    });

  } catch (error) {
    console.error('[Broadcast API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
