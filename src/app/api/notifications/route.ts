import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedEntity } from '@/lib/auth';

// GET - Get notifications for logged-in user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (auth.type !== 'user') {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
      });
    }

    const where: Record<string, unknown> = { userId: auth.user.id };

    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const unreadCount = await db.notification.count({
      where: { ...where, isRead: false }
    });

    return NextResponse.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (auth.type !== 'user') {
      return NextResponse.json({ success: true, message: 'No notifications to update' });
    }

    if (markAllRead) {
      await db.notification.updateMany({
        where: { userId: auth.user.id, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationId) {
      await db.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() }
      });
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
