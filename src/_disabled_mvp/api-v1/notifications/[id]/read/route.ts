/**
 * V1 Mark Notification Read API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/notifications/[id]/read
 * 
 * Requires: Bearer token or session cookie
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "notification_id",
 *     "isRead": true,
 *     "readAt": "2025-01-08T12:00:00.000Z"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: notificationId } = await params;

    // Find notification
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'Notification not found',
        undefined,
        404
      );
    }

    // Verify ownership
    if (notification.userId !== user.id) {
      return apiError(
        ApiErrorCodes.FORBIDDEN,
        'Access denied',
        undefined,
        403
      );
    }

    // Mark as read
    const updated = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        isRead: updated.isRead,
        readAt: updated.readAt?.toISOString() || null,
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
    console.error('[V1 Notification Read] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to mark notification as read',
      undefined,
      500
    );
  }
}
