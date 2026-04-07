/**
 * Admin Push Notifications API
 * POST: Send bulk push notifications
 * GET: Get push notification statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  sendBulkPushNotifications, 
  getPushNotificationStats, 
  isPushNotificationsConfigured,
  cleanupInvalidTokens 
} from '@/lib/push-notifications';
import { validateAdminSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        data: {
          configured: isPushNotificationsConfigured(),
          message: isPushNotificationsConfigured() 
            ? 'Push notifications are configured and ready'
            : 'Push notifications require FCM configuration',
        },
      });
    }

    if (action === 'cleanup') {
      const removed = await cleanupInvalidTokens();
      return NextResponse.json({
        success: true,
        data: { removedTokens: removed },
      });
    }

    const stats = await getPushNotificationStats();

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting push notification stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get push notification stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userIds, title, body: message, data } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds array is required' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'body is required' },
        { status: 400 }
      );
    }

    // Limit bulk notifications to prevent abuse
    if (userIds.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 users per batch' },
        { status: 400 }
      );
    }

    const result = await sendBulkPushNotifications(userIds, title, message, data);

    return NextResponse.json({
      success: result.success,
      data: {
        totalUsers: userIds.length,
        totalSent: result.totalSent,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error sending bulk push notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}
