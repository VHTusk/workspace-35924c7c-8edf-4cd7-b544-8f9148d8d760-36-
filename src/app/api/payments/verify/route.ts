import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPaymentSignature, fetchPaymentDetails } from '@/lib/payments/razorpay';
import { SubscriptionStatus, SportType } from '@prisma/client';
import { getAuthenticatedEntity } from '@/lib/auth';
import { logPaymentVerifyEvent } from '@/lib/audit-logger';
import { log } from '@/lib/logger';

interface VerifyPaymentBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentType?: string;
  sport: string;
  tournamentId?: string;
}

/**
 * Verify payment after Razorpay checkout
 * Updates subscription/registration status on success
 * 
 * SECURITY: Requires authentication for all payment types
 * All database operations are wrapped in a transaction for atomicity
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate session before processing payment
    const authEntity = await getAuthenticatedEntity(request);
    
    if (!authEntity) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const userId = authEntity.type === 'user' ? authEntity.user.id : null;
    const orgId = authEntity.type === 'org' ? authEntity.org.id : null;

    const body: VerifyPaymentBody = await request.json();
    const { 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature,
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
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await fetchPaymentDetails(razorpayPaymentId);

    if (paymentDetails.status !== 'captured') {
      return NextResponse.json(
        { error: 'Payment not captured', status: paymentDetails.status },
        { status: 400 }
      );
    }

    // Find the payment ledger entry
    const ledgerEntry = await db.paymentLedger.findFirst({
      where: { razorpayId: razorpayOrderId },
    });

    if (!ledgerEntry) {
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      );
    }

    // IDEMPOTENCY: Check if payment is already processed
    // If the payment is already in PAID status, return success without re-processing
    // This prevents duplicate subscription extensions or tournament registrations
    if (ledgerEntry.status === 'PAID') {
      console.log(`[Payment] Idempotent request: Payment ${razorpayPaymentId} already processed`);
      return NextResponse.json({
        success: true,
        payment: {
          id: razorpayPaymentId,
          amount: ledgerEntry.amount,
          status: 'captured',
        },
        message: getSuccessMessage(ledgerEntry.type),
        idempotent: true,
      });
    }

    // SECURITY: Verify the authenticated user owns this payment
    if (ledgerEntry.userId && ledgerEntry.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Payment does not belong to authenticated user', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }
    
    if (ledgerEntry.orgId && ledgerEntry.orgId !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Payment does not belong to authenticated organization', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const resolvedPaymentType = ledgerEntry.type;
    const resolvedTournamentId = ledgerEntry.tournamentId ?? tournamentId;
    const sportType = (ledgerEntry.sport || sport) as SportType;
    const paymentNotes = paymentDetails.notes || {};

    // TRANSACTION: Wrap all database operations for atomicity
    // If any operation fails, all changes are rolled back
    await db.$transaction(async (tx) => {
      // Update payment ledger
      await tx.paymentLedger.update({
        where: { id: ledgerEntry.id },
        data: {
          status: 'PAID',
          paymentId: razorpayPaymentId,
        },
      });

      if (resolvedPaymentType === 'PLAYER_SUBSCRIPTION') {
        // Create or update player subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

        const existingSubscription = await tx.subscription.findFirst({
          where: {
            userId: ledgerEntry.userId!,
            sport: sportType,
          },
        });

        if (existingSubscription) {
          await tx.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              startDate,
              endDate,
              amount: paymentDetails.amount,
              paymentId: razorpayPaymentId,
            },
          });
        } else {
          await tx.subscription.create({
            data: {
              userId: ledgerEntry.userId!,
              sport: sportType,
              status: SubscriptionStatus.ACTIVE,
              startDate,
              endDate,
              amount: paymentDetails.amount,
              paymentId: razorpayPaymentId,
            },
          });
        }
      }

      if (resolvedPaymentType === 'ORG_SUBSCRIPTION_SCHOOL_CLUB' || resolvedPaymentType === 'ORG_SUBSCRIPTION_CORPORATE') {
        // Create or update organization subscription
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

      if (resolvedPaymentType === 'TOURNAMENT_ENTRY' && resolvedTournamentId) {
        // Update existing pending registration to confirmed
        const existingReg = await tx.tournamentRegistration.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId: resolvedTournamentId,
              userId: ledgerEntry.userId!,
            },
          },
        });

        if (existingReg) {
          // Update existing registration
          await tx.tournamentRegistration.update({
            where: { id: existingReg.id },
            data: {
              status: 'CONFIRMED',
              paymentId: razorpayPaymentId,
            },
          });
        } else {
          // Create new registration (shouldn't happen but fallback)
          await tx.tournamentRegistration.create({
            data: {
              tournamentId: resolvedTournamentId,
              userId: ledgerEntry.userId!,
              status: 'CONFIRMED',
              amount: paymentDetails.amount / 100, // Store in rupees
              paymentId: razorpayPaymentId,
            },
          });
        }

        // Create notification
        await tx.notification.create({
          data: {
            userId: ledgerEntry.userId!,
            sport: sportType,
            type: 'TOURNAMENT_REGISTERED',
            title: 'Registration Confirmed',
            message: `Your tournament registration has been confirmed!`,
            link: `/${sport.toLowerCase()}/tournaments/${resolvedTournamentId}`,
          },
        });
      }

      if (resolvedPaymentType === 'TEAM_TOURNAMENT_ENTRY' && resolvedTournamentId) {
        const teamId = paymentNotes.teamId;

        if (!teamId) {
          throw new Error('Missing teamId in payment notes');
        }

        await tx.tournamentTeam.update({
          where: {
            tournamentId_teamId: {
              tournamentId: resolvedTournamentId,
              teamId,
            },
          },
          data: {
            status: 'CONFIRMED',
            paymentId: razorpayPaymentId,
          },
        });
      }

      if (resolvedPaymentType === 'INTER_ORG_TOURNAMENT_ENTRY' && resolvedTournamentId) {
        const pendingRegistrations = await tx.orgTournamentRegistration.findMany({
          where: {
            tournamentId: resolvedTournamentId,
            orgId: ledgerEntry.orgId!,
          },
        });

        if (pendingRegistrations.length === 0) {
          throw new Error('Pending organization registrations not found');
        }

        await tx.orgTournamentRegistration.updateMany({
          where: {
            tournamentId: resolvedTournamentId,
            orgId: ledgerEntry.orgId!,
          },
          data: {
            status: 'CONFIRMED',
            amount: paymentDetails.amount / 100,
            paymentId: razorpayPaymentId,
          },
        });
      }
    });

    // Log payment verification event for audit
    const auditUserId = userId || ledgerEntry.orgId || 'system';
    logPaymentVerifyEvent(
      auditUserId,
      sportType,
      razorpayPaymentId,
      request,
      {
        amount: paymentDetails.amount,
        paymentType: resolvedPaymentType,
        tournamentId: resolvedTournamentId,
        success: true,
      }
    ).catch(err => log.error('Failed to log payment verify event', { error: err }));

    return NextResponse.json({
      success: true,
      payment: {
        id: razorpayPaymentId,
        amount: paymentDetails.amount,
        status: 'captured',
      },
      message: getSuccessMessage(resolvedPaymentType),
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
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
    case 'TEAM_TOURNAMENT_ENTRY':
      return 'Team registration confirmed for the tournament!';
    case 'INTER_ORG_TOURNAMENT_ENTRY':
      return 'Organization registration confirmed for the tournament!';
    default:
      return 'Payment successful!';
  }
}
