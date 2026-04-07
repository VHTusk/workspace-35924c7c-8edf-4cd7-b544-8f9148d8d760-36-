/**
 * V1 Tournament Registration API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/tournaments/[id]/register
 * 
 * Requires: Bearer token or session cookie
 * 
 * Request body:
 * {
 *   "idempotencyKey": "optional-client-key"
 * }
 * 
 * Response (Free tournament):
 * {
 *   "success": true,
 *   "data": {
 *     "registrationId": "abc123",
 *     "status": "CONFIRMED",
 *     "tournamentName": "Tournament Name"
 *   }
 * }
 * 
 * Response (Paid tournament):
 * {
 *   "success": true,
 *   "data": {
 *     "requiresPayment": true,
 *     "order": { ... },
 *     "amount": 500
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RegistrationStatus, TournamentStatus, AccountTier, AbusePattern, AbuseSeverity } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { createRazorpayOrder } from '@/lib/payments/razorpay';
import { v4 as uuidv4 } from 'uuid';
import { canRegisterForTournament } from '@/lib/profile-completeness';
import { checkSchedulingConflicts, formatConflictMessage } from '@/lib/scheduling-conflicts';
import { validateTournamentDistrictAccess } from '@/lib/challenger-permissions';
import {
  detectSuspiciousTournamentRegistration,
  detectDeviceFingerprint,
  generateDeviceFingerprint,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
  shouldBlockAction,
} from '@/lib/abuse-detection';
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

    // Parse request body
    const body = await request.json().catch(() => ({}));

    // Get client info for abuse detection
    const ipAddress = getClientIpAddress(request);
    const userAgentStr = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { registrations: true } },
      },
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

    // Check tournament status
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Tournament is not open for registration',
        { status: tournament.status }
      );
    }

    // District permission check
    if (tournament.district) {
      const districtPermission = await validateTournamentDistrictAccess(user.id, tournamentId);
      if (!districtPermission.allowed) {
        return apiError(
          ApiErrorCodes.FORBIDDEN,
          districtPermission.message || 'Access denied',
          { restrictionType: districtPermission.restrictionType }
        );
      }
    }

    // Account tier check for paid tournaments
    if (user.accountTier === AccountTier.FAN && tournament.entryFee > 0) {
      return apiError(
        ApiErrorCodes.FORBIDDEN,
        'Rookie accounts cannot register for paid tournaments. Please upgrade to Pro Player.',
        { code: 'UPGRADE_REQUIRED', entryFee: tournament.entryFee }
      );
    }

    // Check if already registered
    const existingRegistration = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (existingRegistration) {
      return apiError(
        ApiErrorCodes.CONFLICT,
        'Already registered for this tournament',
        { registrationId: existingRegistration.id, status: existingRegistration.status }
      );
    }

    // Check for scheduling conflicts
    const conflictCheck = await checkSchedulingConflicts(user.id, tournamentId);
    if (conflictCheck.hasConflicts) {
      return apiError(
        ApiErrorCodes.CONFLICT,
        formatConflictMessage(conflictCheck.conflicts),
        { conflicts: conflictCheck.conflicts.map(c => ({
          tournamentId: c.tournamentId,
          tournamentName: c.tournamentName,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
        }))}
      );
    }

    // Abuse detection
    const suspiciousRegCheck = await detectSuspiciousTournamentRegistration(user.id, tournamentId);
    if (suspiciousRegCheck.detected) {
      await recordAbuseEvent(
        AbusePattern.SUSPICIOUS_TOURNAMENT_REGISTRATIONS,
        suspiciousRegCheck.severity || AbuseSeverity.MEDIUM,
        user.id,
        undefined,
        ipAddress,
        userAgentStr,
        suspiciousRegCheck.metadata || {}
      );

      if (shouldBlockAction(suspiciousRegCheck.riskScore, suspiciousRegCheck.severity)) {
        return apiError(
          ApiErrorCodes.FORBIDDEN,
          'Registration blocked due to suspicious activity',
          { code: 'SUSPICIOUS_ACTIVITY' }
        );
      }
    }

    // Profile completeness check
    const eligibility = canRegisterForTournament(user, tournament.type);
    if (!eligibility.canRegister) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        eligibility.reason || 'Profile incomplete'
      );
    }

    // Determine entry fee
    const entryFee = tournament.entryFee || 0;
    const amountInPaise = entryFee * 100;

    // Atomic transaction
    const result = await db.$transaction(async (tx) => {
      const currentCount = await tx.tournamentRegistration.count({
        where: { tournamentId },
      });

      if (currentCount >= tournament.maxPlayers) {
        throw new Error('TOURNAMENT_FULL');
      }

      if (entryFee === 0) {
        const registration = await tx.tournamentRegistration.create({
          data: {
            tournamentId,
            userId: user.id,
            status: RegistrationStatus.CONFIRMED,
            amount: 0,
          },
        });

        return { type: 'free', registration };
      }

      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId,
          userId: user.id,
          status: RegistrationStatus.PENDING,
          amount: entryFee,
        },
      });

      return { type: 'paid', registration };
    });

    // Handle free registration
    if (result.type === 'free') {
      const response = NextResponse.json({
        success: true,
        data: {
          registrationId: result.registration.id,
          status: result.registration.status,
          tournamentName: tournament.name,
          amount: 0,
        },
        meta: {
          version: 'v1',
          timestamp: new Date().toISOString(),
        },
      });

      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-API-Immutable', 'true');
      return response;
    }

    // Handle paid registration - create payment order
    const receipt = `REG_${tournamentId.slice(0, 8)}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    const order = await createRazorpayOrder({
      amount: amountInPaise,
      receipt,
      notes: {
        paymentType: 'TOURNAMENT_ENTRY',
        tournamentId,
        userId: user.id,
        sport: tournament.sport,
        source: 'mobile_app',
      },
    });

    await db.paymentLedger.create({
      data: {
        userId: user.id,
        tournamentId,
        sport: tournament.sport,
        amount: amountInPaise,
        type: 'TOURNAMENT_ENTRY',
        status: 'INITIATED',
        razorpayId: order.id,
        description: `Tournament registration: ${tournament.name}`,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        requiresPayment: true,
        registrationId: result.registration.id,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        payer: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        amount: entryFee,
        amountDisplay: `₹${entryFee.toLocaleString('en-IN')}`,
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
    if (error instanceof Error && error.message === 'TOURNAMENT_FULL') {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Tournament is full'
      );
    }

    log.errorWithStack('[V1 Tournament Register] Error:', error instanceof Error ? error : new Error(String(error)));
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to register for tournament',
      undefined,
      500
    );
  }
}
