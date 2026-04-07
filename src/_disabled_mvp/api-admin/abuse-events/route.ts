import { NextRequest, NextResponse } from 'next/server';
import { Role, AbusePattern, AbuseSeverity } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { safeParseInt } from '@/lib/validation';

/**
 * GET /api/admin/abuse-events
 * List abuse events with filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    // Only ADMIN can view abuse events
    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Only ADMIN can view abuse events' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const pattern = searchParams.get('pattern') as AbusePattern | null;
    const severity = searchParams.get('severity') as AbuseSeverity | null;
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const deviceId = searchParams.get('deviceId');
    const ipAddress = searchParams.get('ipAddress');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const page = safeParseInt(searchParams.get('page'), 1, 1, 1000);
    const limit = safeParseInt(searchParams.get('limit'), 50, 1, 100);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (pattern) {
      where.pattern = pattern;
    }

    if (severity) {
      where.severity = severity;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    if (startDateStr || endDateStr) {
      where.detectedAt = {};
      if (startDateStr) {
        (where.detectedAt as Record<string, Date>).gte = new Date(startDateStr);
      }
      if (endDateStr) {
        (where.detectedAt as Record<string, Date>).lte = new Date(endDateStr);
      }
    }

    // Get total count
    const total = await db.abuseEvent.count({ where });

    // Get abuse events
    const events = await db.abuseEvent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            sport: true,
            isActive: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get summary statistics
    const stats = await db.abuseEvent.groupBy({
      by: ['pattern'],
      _count: {
        id: true,
      },
      where: {
        status: 'PENDING',
      },
    });

    const severityStats = await db.abuseEvent.groupBy({
      by: ['severity'],
      _count: {
        id: true,
      },
      where: {
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        pattern: event.pattern,
        severity: event.severity,
        status: event.status,
        detectedAt: event.detectedAt,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
        resolution: event.resolution,
        actionTaken: event.actionTaken,
        reviewedAt: event.reviewedAt,
        user: event.user ? {
          id: event.user.id,
          name: `${event.user.firstName} ${event.user.lastName}`,
          email: event.user.email,
          phone: event.user.phone,
          sport: event.user.sport,
          isActive: event.user.isActive,
        } : null,
        reviewer: event.reviewer ? {
          id: event.reviewer.id,
          name: `${event.reviewer.firstName} ${event.reviewer.lastName}`,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        byPattern: stats.map((s) => ({
          pattern: s.pattern,
          count: s._count.id,
        })),
        bySeverity: severityStats.map((s) => ({
          severity: s.severity,
          count: s._count.id,
        })),
        totalPending: stats.reduce((sum, s) => sum + s._count.id, 0),
      },
    });
  } catch (error) {
    log.error('Admin abuse events error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/abuse-events
 * Update abuse event status (mark as resolved/false positive)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    // Only ADMIN can update abuse events
    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Only ADMIN can update abuse events' }, { status: 403 });
    }

    const body = await request.json();
    const { eventId, action, resolution, actionTaken, actionDetails } = body;

    if (!eventId || !action) {
      return NextResponse.json(
        { error: 'eventId and action are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['REVIEW', 'RESOLVE', 'FALSE_POSITIVE', 'BLOCK_USER', 'BLOCK_DEVICE'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the abuse event
    const abuseEvent = await db.abuseEvent.findUnique({
      where: { id: eventId },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!abuseEvent) {
      return NextResponse.json(
        { error: 'Abuse event not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    let updateData: Record<string, unknown> = {
      reviewedBy: user.id,
      reviewedAt: new Date(),
    };

    switch (action) {
      case 'REVIEW':
        updateData.status = 'REVIEWED';
        updateData.resolution = resolution || 'Reviewed by admin';
        break;

      case 'RESOLVE':
        updateData.status = 'RESOLVED';
        updateData.resolution = resolution || 'Resolved by admin';
        updateData.actionTaken = actionTaken;
        updateData.actionDetails = actionDetails ? JSON.stringify(actionDetails) : null;
        break;

      case 'FALSE_POSITIVE':
        updateData.status = 'FALSE_POSITIVE';
        updateData.resolution = resolution || 'Marked as false positive';
        break;

      case 'BLOCK_USER':
        if (!abuseEvent.userId) {
          return NextResponse.json(
            { error: 'Cannot block user: no user associated with this event' },
            { status: 400 }
          );
        }
        // Block the user
        await db.user.update({
          where: { id: abuseEvent.userId },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: `Blocked due to abuse: ${abuseEvent.pattern}`,
          },
        });
        updateData.status = 'RESOLVED';
        updateData.resolution = resolution || 'User blocked';
        updateData.actionTaken = 'USER_BLOCKED';
        break;

      case 'BLOCK_DEVICE':
        if (!abuseEvent.deviceId) {
          return NextResponse.json(
            { error: 'Cannot block device: no device associated with this event' },
            { status: 400 }
          );
        }
        // Block the device fingerprint
        const deviceFingerprint = await db.deviceFingerprint.findUnique({
          where: { id: abuseEvent.deviceId },
        });
        if (deviceFingerprint) {
          await db.deviceFingerprint.update({
            where: { id: abuseEvent.deviceId },
            data: {
              isBlocked: true,
              blockedReason: `Blocked due to abuse: ${abuseEvent.pattern}`,
              blockedAt: new Date(),
            },
          });
        }
        updateData.status = 'RESOLVED';
        updateData.resolution = resolution || 'Device blocked';
        updateData.actionTaken = 'DEVICE_BLOCKED';
        break;
    }

    // Update the abuse event
    const updated = await db.abuseEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    log.info('Abuse event updated', {
      eventId,
      action,
      adminId: user.id,
      previousStatus: abuseEvent.status,
      newStatus: updated.status,
    });

    return NextResponse.json({
      success: true,
      event: {
        id: updated.id,
        status: updated.status,
        resolution: updated.resolution,
        actionTaken: updated.actionTaken,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    log.error('Update abuse event error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
