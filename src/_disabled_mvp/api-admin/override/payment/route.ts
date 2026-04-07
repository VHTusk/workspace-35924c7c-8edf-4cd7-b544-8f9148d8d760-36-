/**
 * Admin Manual Override - Payment Operations
 * 
 * Allows admins to:
 * - Manually confirm a payment (when webhook fails)
 * - Process manual refunds
 * - View payment status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentLedgerStatus, RegistrationStatus, SportType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, paymentId, registrationId, userId, amount, reason } = body;

    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'confirm_payment':
        return await manuallyConfirmPayment(paymentId, registrationId, reason, session.userId);
      
      case 'process_refund':
        return await processManualRefund(paymentId, amount, reason, session.userId);
      
      case 'mark_subscription_paid':
        return await markSubscriptionPaid(userId, body.sport, amount, reason, session.userId);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin payment override error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Manually confirm a payment
 * Used when Razorpay webhook fails or payment is made offline
 */
async function manuallyConfirmPayment(
  paymentId: string | undefined,
  registrationId: string,
  reason: string,
  adminId: string
) {
  const registration = await db.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: { tournament: true, user: true },
  });

  if (!registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }

  if (registration.status === RegistrationStatus.CONFIRMED) {
    return NextResponse.json({ error: 'Registration already confirmed' }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Update registration
    await tx.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        status: RegistrationStatus.CONFIRMED,
        paymentId: paymentId || `manual-${Date.now()}`,
      },
    });

    // Update payment ledger if exists
    if (paymentId) {
      await tx.paymentLedger.updateMany({
        where: { paymentId },
        data: { status: PaymentLedgerStatus.PAID },
      });
    }

    // Create notification
    await tx.notification.create({
      data: {
        userId: registration.userId,
        sport: registration.tournament.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Registration Confirmed',
        message: `Your registration for ${registration.tournament.name} has been confirmed.`,
      },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: registration.tournament.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'REGISTRATION',
        targetId: registrationId,
        reason,
        metadata: JSON.stringify({ 
          action: 'confirm_payment', 
          paymentId,
          amount: registration.amount 
        }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Payment manually confirmed',
    registrationId,
  });
}

/**
 * Process manual refund
 * Used when Razorpay refund API fails
 */
async function processManualRefund(
  paymentId: string,
  amount: number,
  reason: string,
  adminId: string
) {
  const payment = await db.paymentLedger.findFirst({
    where: { paymentId },
    include: { user: true },
  });

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (payment.status === PaymentLedgerStatus.REFUNDED) {
    return NextResponse.json({ error: 'Payment already refunded' }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Update payment status
    await tx.paymentLedger.update({
      where: { id: payment.id },
      data: {
        status: PaymentLedgerStatus.REFUNDED,
        description: `Manual refund: ${reason}`,
      },
    });

    // Update registration if exists
    const registration = await tx.tournamentRegistration.findFirst({
      where: { paymentId },
    });

    if (registration) {
      await tx.tournamentRegistration.update({
        where: { id: registration.id },
        data: {
          status: RegistrationStatus.CANCELLED,
          cancelledAt: new Date(),
          refundAmount: amount,
          refundId: `manual-refund-${Date.now()}`,
        },
      });
    }

    // Create notification
    if (payment.userId) {
      await tx.notification.create({
        data: {
          userId: payment.userId,
          sport: payment.sport,
          type: 'REFUND_PROCESSED',
          title: 'Refund Processed',
          message: `Your refund of ₹${amount / 100} has been processed manually.`,
        },
      });
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: payment.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'PAYMENT',
        targetId: payment.id,
        reason,
        metadata: JSON.stringify({ 
          action: 'process_refund', 
          paymentId,
          amount 
        }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `Refund of ₹${amount / 100} processed manually`,
    paymentId,
  });
}

/**
 * Mark subscription as paid
 * Used when payment is made offline or via different channel
 */
async function markSubscriptionPaid(
  userId: string,
  sport: SportType,
  amount: number,
  reason: string,
  adminId: string
) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  await db.$transaction(async (tx) => {
    // Create or update subscription
    await tx.subscription.upsert({
      where: {
        userId_sport: { userId, sport },
      },
      create: {
        userId,
        sport,
        status: 'ACTIVE',
        startDate,
        endDate,
        amount,
        paymentId: `manual-sub-${Date.now()}`,
      },
      update: {
        status: 'ACTIVE',
        startDate,
        endDate,
        amount,
      },
    });

    // Create payment ledger entry
    await tx.paymentLedger.create({
      data: {
        userId,
        sport,
        amount,
        type: 'SUBSCRIPTION',
        status: PaymentLedgerStatus.PAID,
        description: `Manual subscription activation: ${reason}`,
      },
    });

    // Create notification
    await tx.notification.create({
      data: {
        userId,
        sport,
        type: 'SUBSCRIPTION_EXPIRY',
        title: 'Subscription Activated',
        message: `Your ${sport.toLowerCase()} subscription has been activated until ${endDate.toLocaleDateString()}.`,
      },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'SUBSCRIPTION',
        targetId: userId,
        reason,
        metadata: JSON.stringify({ 
          action: 'mark_subscription_paid', 
          amount,
          endDate 
        }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Subscription activated',
    userId,
    endDate,
  });
}

/**
 * Verify admin session
 */
async function verifyAdminSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || !session.user) return null;
  if (session.user.role !== 'ADMIN') return null;
  if (session.expiresAt < new Date()) return null;

  return { userId: session.user.id, role: session.user.role };
}
