/**
 * V1 Tournament Unregister API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/tournaments/[id]/unregister
 * 
 * Requires: Bearer token or session cookie
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "registrationId": "abc123",
 *     "status": "CANCELLED",
 *     "refunded": false
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RegistrationStatus, TournamentStatus } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { log } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const auth = await getAuthenticatedFromRequest(request);
    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user, session } = auth;
    const { id: tournamentId } = await params;

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return apiError(
        ApiErrorCodes.TOURNAMENT_NOT_FOUND,
        'Tournament not found',
        undefined,
        404
      );
    }

    // Check sport matches
    if (tournament.sport !== session.sport) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'This tournament is for a different sport',
        { expected: tournament.sport, provided: session.sport }
      );
    }

    // Check tournament status - can only unregister before tournament starts
    if (tournament.status === TournamentStatus.IN_PROGRESS ||
        tournament.status === TournamentStatus.COMPLETED) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Cannot unregister from a tournament that has already started or completed',
        { status: tournament.status }
      );
    }

    // Find existing registration
    const existingRegistration = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (!existingRegistration) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'Not registered for this tournament',
        undefined,
        404
      );
    }

    // Check if already cancelled
    if (existingRegistration.status === RegistrationStatus.CANCELLED) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Registration is already cancelled',
        { registrationId: existingRegistration.id }
      );
    }

    // Determine if refund is possible
    let refunded = false;
    let refundAmount = 0;

    // If paid and confirmed, initiate refund logic would go here
    // For now, we just mark as cancelled - refund handling is separate
    if (existingRegistration.amount && existingRegistration.amount > 0 &&
        existingRegistration.status === RegistrationStatus.CONFIRMED) {
      // Note: Actual refund processing would be handled by a separate job
      // Here we just indicate that refund is pending
      refunded = false; // Will be processed separately
      refundAmount = existingRegistration.amount;
    }

    // Update registration status
    const updatedRegistration = await db.tournamentRegistration.update({
      where: { id: existingRegistration.id },
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'User requested cancellation',
      },
    });

    // If there was a waitlist, we could trigger promotion here
    // This would typically be done via a separate process/job

    const response = NextResponse.json({
      success: true,
      data: {
        registrationId: updatedRegistration.id,
        status: updatedRegistration.status,
        tournamentName: tournament.name,
        refunded,
        refundAmount: refundAmount > 0 ? refundAmount : null,
        refundStatus: refundAmount > 0 ? 'PENDING' : null,
        cancelledAt: updatedRegistration.cancelledAt?.toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error: unknown) {
    log.errorWithStack('[V1 Tournament Unregister] Error:', error instanceof Error ? error : new Error(String(error)));
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to unregister from tournament',
      undefined,
      500
    );
  }
}
