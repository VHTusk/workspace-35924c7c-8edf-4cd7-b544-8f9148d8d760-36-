import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { SubscriptionStatus, SportType, UserSportEnrollmentSource, WebhookEventStatus, RegistrationStatus } from '@prisma/client';
import {
  checkIdempotency,
  storeWebhookEvent,
  processWebhookWithRetry,
} from '@/lib/webhook-retry';
import { storeUPIDetailsFromWebhook, deriveBankFromVPA } from '@/lib/payments/upi-reconciliation';
import { log, paymentLog } from '@/lib/logger';
import { ensureUserSportEnrollment } from '@/lib/user-sport';

/**
 * Razorpay Webhook Handler with Idempotency & Retry
 * Handles payment.captured, payment.failed, order.paid events
 * 
 * Setup: Go to Razorpay Dashboard → Settings → Webhooks
 * Add URL: https://yourdomain.com/api/payments/webhook
 * Events: payment.captured, payment.failed, order.paid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    
    // FIX: Parse payload before using it in error log
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      log.error('Invalid webhook body - could not parse JSON');
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    if (!isValid) {
      // FIX: Now payload is defined before we use it
      log.error('Invalid webhook signature', { eventId: payload?.event_id });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = payload.event;
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id || Date.now().toString();

    // Check idempotency
    const { exists, event: existingEvent } = await checkIdempotency('razorpay', eventId, event);

    if (exists) {
      // Return cached result if already processed
      if (existingEvent?.status === WebhookEventStatus.COMPLETED) {
        log.info('Webhook already processed', { eventId, event });
        return NextResponse.json({ received: true, cached: true });
      }

      // If still processing, acknowledge but don't reprocess
      if (existingEvent?.status === WebhookEventStatus.PROCESSING) {
        log.info('Webhook already processing', { eventId, event });
        return NextResponse.json({ received: true, processing: true });
      }
    }

    // Store event for idempotency and retry
    const webhookEvent = await storeWebhookEvent('razorpay', eventId, event, body, signature);

    paymentLog.webhookReceived(event, eventId, payload.payload?.payment?.entity?.amount || 0);

    // Process with retry logic
    const result = await processWebhookWithRetry(
      webhookEvent.id,
      webhookEvent.idempotencyKey,
      async () => {
        // Handle different events
        switch (event) {
          case 'payment.captured':
            await handlePaymentCaptured(payload);
            break;
          case 'payment.failed':
            await handlePaymentFailed(payload);
            break;
          case 'order.paid':
            await handleOrderPaid(payload);
            break;
          default:
            log.info('Unhandled webhook event', { event });
        }
      }
    );

    if (result.success) {
      return NextResponse.json({ received: true });
    } else {
      // Acknowledge receipt even if processing failed (will retry)
      return NextResponse.json({ received: true, retrying: true });
    }
  } catch (error) {
    log.errorWithStack('Webhook error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCaptured(payload: {
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
        method?: string;
        vpa?: string;
        bank?: string;
        notes?: Record<string, string>;
      };
    };
  };
}) {
  const payment = payload.payload.payment.entity;
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const paymentMethod = payment.method || 'unknown';

  // Find the payment ledger entry
  const ledgerEntry = await db.paymentLedger.findFirst({
    where: { razorpayId: orderId },
  });

  if (!ledgerEntry) {
    log.error('Payment ledger not found for order', { orderId });
    throw new Error(`Payment ledger not found for order: ${orderId}`);
  }

  // Build update data with UPI details if applicable
  const updateData: any = {
    status: 'PAID',
    paymentId,
    paymentMethod,
    reconciledAt: new Date(),
  };

  // Store UPI details for UPI payments
  if (paymentMethod === 'upi' && payment.vpa) {
    updateData.upiVpa = payment.vpa;
    updateData.upiBank = payment.bank || deriveBankFromVPA(payment.vpa);
    log.info('UPI payment detected', { vpa: payment.vpa, bank: updateData.upiBank });
  }

  // Update payment ledger
  await db.paymentLedger.update({
    where: { id: ledgerEntry.id },
    data: updateData,
  });

  const paymentType = ledgerEntry.type;
  const sport = ledgerEntry.sport as SportType;

  // Process based on payment type
  if (paymentType === 'PLAYER_SUBSCRIPTION' && ledgerEntry.userId) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    await ensureUserSportEnrollment(
      db,
      ledgerEntry.userId,
      sport,
      UserSportEnrollmentSource.MEMBERSHIP_PURCHASE,
    );

    const existingSubscription = await db.subscription.findFirst({
      where: {
        userId: ledgerEntry.userId,
        sport,
      },
    });

    if (existingSubscription) {
      await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          amount: payment.amount,
          paymentId,
        },
      });
    } else {
      await db.subscription.create({
        data: {
          userId: ledgerEntry.userId,
          sport,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          amount: payment.amount,
          paymentId,
        },
      });
    }

    paymentLog.success(orderId, paymentId, payment.amount);
    log.info('Player subscription activated', { userId: ledgerEntry.userId });
  }

  if ((paymentType === 'ORG_SUBSCRIPTION_SCHOOL_CLUB' || paymentType === 'ORG_SUBSCRIPTION_CORPORATE') && ledgerEntry.orgId) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    await db.orgSubscription.upsert({
      where: { orgId: ledgerEntry.orgId },
      create: {
        orgId: ledgerEntry.orgId,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        amount: payment.amount,
        paymentId,
      },
      update: {
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        amount: payment.amount,
        paymentId,
      },
    });

    paymentLog.success(orderId, paymentId, payment.amount);
    log.info('Org subscription activated', { orgId: ledgerEntry.orgId });
  }

  // Handle individual tournament entry payment
  if (paymentType === 'TOURNAMENT_ENTRY' && ledgerEntry.userId) {
    await ensureUserSportEnrollment(
      db,
      ledgerEntry.userId,
      sport,
      UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
    );

    // Get the notes from Razorpay order
    const notes = payment.notes || {};
    const tournamentId = notes.tournamentId;

    if (tournamentId) {
      // Update registration status to CONFIRMED
      const registration = await db.tournamentRegistration.update({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: ledgerEntry.userId,
          },
        },
        data: {
          status: RegistrationStatus.CONFIRMED,
          paymentId,
        },
        include: {
          tournament: {
            select: { name: true, sport: true },
          },
        },
      });

      // Create notification
      await db.notification.create({
        data: {
          userId: ledgerEntry.userId,
          sport: registration.tournament.sport as SportType,
          type: 'TOURNAMENT_REGISTERED',
          title: 'Registration Confirmed!',
          message: `Your registration for ${registration.tournament.name} has been confirmed.`,
          link: `/${registration.tournament.sport.toLowerCase()}/tournaments/${tournamentId}`,
        },
      });

      paymentLog.success(orderId, paymentId, payment.amount);
      log.info('Tournament registration confirmed', { 
        userId: ledgerEntry.userId, 
        tournamentId 
      });
    }
  }

  // Handle team tournament entry payment
  if (paymentType === 'TEAM_TOURNAMENT_ENTRY' && ledgerEntry.userId) {
    const notes = payment.notes || {};
    const tournamentId = notes.tournamentId;
    const teamId = notes.teamId;

    if (tournamentId && teamId) {
      // Update team registration status to CONFIRMED
      const registration = await db.tournamentTeam.update({
        where: {
          tournamentId_teamId: {
            tournamentId,
            teamId,
          },
        },
        data: {
          status: RegistrationStatus.CONFIRMED,
          paymentId,
        },
        include: {
          tournament: {
            select: { name: true, sport: true },
          },
          team: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      });

      // Create notifications for all team members
      for (const member of registration.team.members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            sport: registration.tournament.sport as SportType,
            type: 'TOURNAMENT_REGISTERED',
            title: 'Team Registration Confirmed!',
            message: `Your team "${registration.team.name}" is registered for ${registration.tournament.name}!`,
            link: `/${registration.tournament.sport.toLowerCase()}/tournaments/${tournamentId}`,
          },
        });
      }

      paymentLog.success(orderId, paymentId, payment.amount);
      log.info('Team tournament registration confirmed', { teamId, tournamentId });
    }
  }
}

async function handlePaymentFailed(payload: {
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        error_description?: string;
      };
    };
  };
}) {
  const payment = payload.payload.payment.entity;
  const orderId = payment.order_id;

  // Update payment ledger
  await db.paymentLedger.updateMany({
    where: { razorpayId: orderId },
    data: {
      status: 'FAILED',
      description: payment.error_description || 'Payment failed',
    },
  });

  paymentLog.failed(orderId, payment.error_description || 'Payment failed');
}

async function handleOrderPaid(payload: {
  payload: {
    order: {
      entity: {
        id: string;
        amount: number;
        notes?: Record<string, string>;
      };
    };
  };
}) {
  // This is an alternative event that fires when order is fully paid
  const orderId = payload.payload.order.entity.id;
  const amount = payload.payload.order.entity.amount;
  log.info('Order paid event received', { orderId, amount });
}
