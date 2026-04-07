/**
 * V1 Tournament Check-In API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/tournaments/:id/checkin - Get check-in status
 * POST /api/v1/tournaments/:id/checkin - Check-in to tournament
 * DELETE /api/v1/tournaments/:id/checkin - Cancel check-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-request';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

// GET - Get check-in status for tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        checkins: {
          select: {
            id: true,
            userId: true,
            checkedInAt: true,
            method: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        registrations: {
          where: { status: 'CONFIRMED' },
          select: {
            userId: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', { id }, 404);
    }

    const checkedInIds = new Set(tournament.checkins.map((c) => c.userId));
    const notCheckedIn = tournament.registrations.filter((r) => !checkedInIds.has(r.userId));

    const userCheckin = userId ? tournament.checkins.find((c) => c.userId === userId) : null;

    const response = NextResponse.json({
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          startDate: tournament.startDate?.toISOString() || null,
        },
        stats: {
          total: tournament.registrations.length,
          checkedIn: tournament.checkins.length,
          notCheckedIn: notCheckedIn.length,
        },
        checkedInPlayers: tournament.checkins.map((c) => ({
          id: c.id,
          userId: c.userId,
          name: `${c.user.firstName} ${c.user.lastName}`,
          checkedInAt: c.checkedInAt.toISOString(),
          method: c.method,
        })),
        notCheckedInPlayers: notCheckedIn.map((r) => ({
          userId: r.userId,
          name: `${r.user.firstName} ${r.user.lastName}`,
        })),
        userCheckin: userCheckin
          ? {
              checkedIn: true,
              checkedInAt: userCheckin.checkedInAt.toISOString(),
            }
          : { checkedIn: false },
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
    console.error('[V1 Tournament Checkin] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to fetch check-in status', undefined, 500);
  }
}

// POST - Check-in to tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;
    const body = await request.json();
    const { method = 'SELF' } = body;

    // Check tournament exists and user is registered
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        registrations: {
          where: { userId, status: 'CONFIRMED' },
        },
      },
    });

    if (!tournament) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', { id }, 404);
    }

    if (tournament.registrations.length === 0) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Not registered for this tournament',
        undefined,
        400
      );
    }

    // Check if already checked in
    const existingCheckin = await db.tournamentCheckin.findUnique({
      where: {
        tournamentId_userId: { tournamentId: id, userId },
      },
    });

    if (existingCheckin) {
      return apiError(
        ApiErrorCodes.CONFLICT,
        'Already checked in',
        { checkin: existingCheckin },
        400
      );
    }

    // Create check-in
    const checkin = await db.tournamentCheckin.create({
      data: {
        tournamentId: id,
        userId,
        method,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: checkin.id,
        tournamentId: checkin.tournamentId,
        userId: checkin.userId,
        checkedInAt: checkin.checkedInAt.toISOString(),
        method: checkin.method,
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
    console.error('[V1 Tournament Checkin] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to check in', undefined, 500);
  }
}

// DELETE - Cancel check-in
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;

    await db.tournamentCheckin.delete({
      where: {
        tournamentId_userId: { tournamentId: id, userId },
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        tournamentId: id,
        userId,
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
    console.error('[V1 Tournament Checkin] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to cancel check-in', undefined, 500);
  }
}
