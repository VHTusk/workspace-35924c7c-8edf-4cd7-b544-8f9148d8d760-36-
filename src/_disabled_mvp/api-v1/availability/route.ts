/**
 * V1 Player Availability API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/availability - Get user's availability
 * POST /api/v1/availability - Create availability slot
 * DELETE /api/v1/availability?id=xxx - Delete availability slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-request';
import { addVersionHeaders } from '@/lib/api-versioning';
import { apiError, ApiErrorCodes } from '@/lib/api-response';

/**
 * GET /api/v1/availability
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const availability = await db.playerAvailability.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const response = NextResponse.json({
      success: true,
      data: availability,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Availability] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch availability',
      meta: { version: 'v1', timestamp: new Date().toISOString() },
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}

/**
 * POST /api/v1/availability
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { dayOfWeek, startTime, endTime, isRecurring = true, specificDate, notes } = body;

    if (dayOfWeek === undefined || !startTime || !endTime) {
      return apiError(
        ApiErrorCodes.MISSING_REQUIRED_FIELD,
        'Day, start time, and end time required',
        { required: ['dayOfWeek', 'startTime', 'endTime'] }
      );
    }

    const availability = await db.playerAvailability.create({
      data: {
        userId: auth.user.id,
        sport: auth.user.sport as any,
        dayOfWeek,
        startTime,
        endTime,
        isRecurring,
        specificDate: specificDate ? new Date(specificDate) : null,
        notes,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: availability,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Availability] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to create availability',
      meta: { version: 'v1', timestamp: new Date().toISOString() },
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}

/**
 * DELETE /api/v1/availability?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError(ApiErrorCodes.MISSING_REQUIRED_FIELD, 'Availability ID required');
    }

    await db.playerAvailability.delete({
      where: { id, userId: auth.user.id },
    });

    const response = NextResponse.json({
      success: true,
      data: { deleted: true },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Availability] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete availability',
      meta: { version: 'v1', timestamp: new Date().toISOString() },
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}
