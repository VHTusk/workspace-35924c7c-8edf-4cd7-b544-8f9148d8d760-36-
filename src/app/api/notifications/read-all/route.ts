import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, getAuthenticatedOrg } from '@/lib/auth';
import { NotificationType } from '@prisma/client';

// POST - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    // Try user session first, then org session
    const userAuth = await getAuthenticatedUser(request);
    const orgAuth = await getAuthenticatedOrg(request);

    if (!userAuth && !orgAuth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { types } = body; // Optional: filter by notification types

    // Build where clause
    const where: { userId?: string; orgId?: string; isRead: boolean; type?: { in: NotificationType[] } } = {
      isRead: false,
    };

    if (userAuth) {
      where.userId = userAuth.user.id;
    } else if (orgAuth) {
      // For org accounts, we would need to fetch org member IDs
      // For now, just return success
      return NextResponse.json({
        success: true,
        message: 'No notifications to mark as read',
        count: 0,
      });
    }

    // If types filter provided
    if (types && Array.isArray(types) && types.length > 0) {
      const validTypes = types.filter((type): type is NotificationType =>
        Object.values(NotificationType).includes(type as NotificationType)
      );
      if (validTypes.length > 0) {
        where.type = { in: validTypes };
      }
    }

    // Update all unread notifications
    const result = await db.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Marked ${result.count} notifications as read`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
