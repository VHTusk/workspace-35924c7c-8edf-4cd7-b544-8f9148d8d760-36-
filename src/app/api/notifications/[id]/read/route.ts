import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, getAuthenticatedOrg } from '@/lib/auth';

// POST - Mark a single notification as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;
    
    // Try user session first, then org session
    const userAuth = await getAuthenticatedUser(request);
    const orgAuth = await getAuthenticatedOrg(request);

    if (!userAuth && !orgAuth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = userAuth?.user.id;
    const orgId = orgAuth?.org.id;

    // Verify notification belongs to user or org
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Check ownership
    if (userId && notification.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mark as read
    const updatedNotification = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
      notification: updatedNotification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
