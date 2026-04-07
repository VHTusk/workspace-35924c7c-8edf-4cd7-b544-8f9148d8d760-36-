/**
 * V1 Notifications API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/notifications
 * 
 * Requires: Bearer token or session cookie
 * 
 * Query Parameters:
 * - cursor (string, optional) - Last notification ID from previous page
 * - limit (number, optional) - Results per page (default: 20, max: 50)
 * - unreadOnly (boolean, optional) - Only return unread notifications
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [...],
 *   "meta": {
 *     "nextCursor": "...",
 *     "hasMore": false,
 *     "unreadCount": 5
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, unknown> = { userId: user.id };
    if (unreadOnly) {
      where.isRead = false;
    }

    // Get notifications with cursor pagination
    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Take one extra to check for hasMore
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    // Get unread count
    const unreadCount = await db.notification.count({
      where: { userId: user.id, isRead: false }
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    const response = NextResponse.json({
      success: true,
      data: items.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() || null,
        data: n.data,
        createdAt: n.createdAt.toISOString(),
      })),
      meta: {
        nextCursor,
        hasMore,
        unreadCount,
        limit,
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error) {
    console.error('[V1 Notifications] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch notifications',
      undefined,
      500
    );
  }
}
