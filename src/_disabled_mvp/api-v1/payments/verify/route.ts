/**
 * V1 Payments Verify API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/payments/verify
 * 
 * Verifies payment after Razorpay checkout.
 * Updates subscription/registration status on success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPaymentSignature, fetchPaymentDetails } from '@/lib/payments/razorpay';
import { SubscriptionStatus, SportType } from '@prisma/client';
import { getAuthenticatedEntity } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { logPaymentVerifyEvent } from '@/lib/audit-logger';
import { log } from '@/lib/logger';

interface VerifyPaymentBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentType: string;
  sport: string;
  tournamentId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate session before processing payment
    const authEntity = await getAuthenticatedEntity(request);
    
    if (!authEntity) {
      return apiError(ApiErrorCodes.UNAUTHORIZED, 'Authentication required', undefined, 401);
    }

    const userId = authEntity.type === 'user' ? authEntity.user.id : null;
    const orgId = authEntity.type === 'org' ? authEntity.org.id : null;

    const body: VerifyPaymentBody = await request.json();
    const { 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature,
      paymentType,
      sport,
      tournamentId,
    } = body;

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Invalid payment signature', undefined, 400);
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await fetchPaymentDetails(razorpayPaymentId);

    if (paymentDetails.status !== 'captured') {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Payment not captured', { status: paymentDetails.status }, 400);
    }

    // Find the payment ledger entry
    const ledgerEntry = await db.paymentLedger.findFirst({
      where: { razorpayId: razorpayOrderId },
    });

    if (!ledgerEntry) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Payment record not found', undefined, 404);
    }

    // IDEMPOTENCY: Check if payment is already processed
    if (ledgerEntry.status === 'PAID') {
      const response = NextResponse.json({
        success: true,
        data: {
          payment: {
            id: razorpayPaymentId,
            amount: ledgerEntry.amount,
            status: 'captured',
          },
          message: getSuccessMessage(paymentType),
          idempotent: true,
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

    // SECURITY: Verify the authenticated user owns this payment
    if (ledgerEntry.userId && ledgerEntry.userId !== userId) {
      return apiError(ApiErrorCodes.FORBIDDEN, 'Payment does not belong to authenticated user', undefined, 403);
    }
    
    if (ledgerEntry.orgId && ledgerEntry.orgId !== orgId) {
      return apiError(ApiErrorCodes.FORBIDDEN, 'Payment does not belong to authenticated organization', undefined, 403);
    }

    const sportType = sport as SportType;

    // TRANSACTION: Wrap all database operations for atomicity
    await db.$transaction(async (tx) => {
      // Update payment ledger
      await tx.paymentLedger.update({
        where: { id: ledgerEntry.id },
        data: {
          status: 'PAID',
          paymentId: razorpayPaymentId,
        },
      });

      if (paymentType === 'PLAYER_SUBSCRIPTION') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        await tx.subscription.upsert({
          where: {
            userId_sport: {
              userId: ledgerEntry.userId!,
              sport: sportType,
            },
          },
          create: {
            userId: ledgerEntry.userId!,
            sport: sportType,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            amount: paymentDetails.amount,
            paymentId: razorpayPaymentId,
          },
          update: {
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            amount: paymentDetails.amount,
            paymentId: razorpayPaymentId,
          },
        });
      }

      if (paymentType === 'ORG_SUBSCRIPTION_SCHOOL_CLUB' || paymentType === 'ORG_SUBSCRIPTION_CORPORATE') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        await tx.orgSubscription.upsert({
          where: { orgId: ledgerEntry.orgId! },
          create: {
            orgId: ledgerEntry.orgId!,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            amount: paymentDetails.amount,
            paymentId: razorpayPaymentId,
          },
          update: {
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            amount: paymentDetails.amount,
            paymentId: razorpayPaymentId,
          },
        });
      }

      if (paymentType === 'TOURNAMENT_ENTRY' && tournamentId) {
        const existingReg = await tx.tournamentRegistration.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId,
              userId: ledgerEntry.userId!,
            },
          },
        });

        if (existingReg) {
          await tx.tournamentRegistration.update({
            where: { id: existingReg.id },
            data: {
              status: 'CONFIRMED',
              paymentId: razorpayPaymentId,
            },
          });
        } else {
          await tx.tournamentRegistration.create({
            data: {
              tournamentId,
              userId: ledgerEntry.userId!,
              status: 'CONFIRMED',
              amount: paymentDetails.amount / 100,
              paymentId: razorpayPaymentId,
            },
          });
        }

        await tx.notification.create({
          data: {
            userId: ledgerEntry.userId!,
            sport: sportType,
            type: 'TOURNAMENT_REGISTERED',
            title: 'Registration Confirmed',
            message: `Your tournament registration has been confirmed!`,
            link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
          },
        });
      }

      if (paymentType === 'INTER_ORG_TOURNAMENT_ENTRY' && tournamentId) {
        await tx.orgTournamentRegistration.create({
          data: {
            tournamentId,
            orgId: ledgerEntry.orgId!,
            userId: ledgerEntry.userId!,
            status: 'CONFIRMED',
            amount: paymentDetails.amount / 100,
            paymentId: razorpayPaymentId,
          },
        });
      }
    });

    // Log payment verification event
    const auditUserId = userId || ledgerEntry.orgId || 'system';
    logPaymentVerifyEvent(
      auditUserId,
      sportType,
      razorpayPaymentId,
      request,
      {
        amount: paymentDetails.amount,
        paymentType,
        tournamentId,
        success: true,
      }
    ).catch(err => log.error('Failed to log payment verify event', { error: err }));

    const response = NextResponse.json({
      success: true,
      data: {
        payment: {
          id: razorpayPaymentId,
          amount: paymentDetails.amount,
          status: 'captured',
        },
        message: getSuccessMessage(paymentType),
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
    console.error('[V1 Payments Verify] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to verify payment', undefined, 500);
  }
}

function getSuccessMessage(paymentType: string): string {
  switch (paymentType) {
    case 'PLAYER_SUBSCRIPTION':
      return 'Subscription activated successfully! You are now a premium member for 1 year.';
    case 'ORG_SUBSCRIPTION_SCHOOL_CLUB':
    case 'ORG_SUBSCRIPTION_CORPORATE':
      return 'Organization subscription activated successfully!';
    case 'TOURNAMENT_ENTRY':
      return 'Tournament registration confirmed! You are now registered.';
    case 'INTER_ORG_TOURNAMENT_ENTRY':
      return 'Team registration confirmed for the tournament!';
    default:
      return 'Payment successful!';
  }
}
