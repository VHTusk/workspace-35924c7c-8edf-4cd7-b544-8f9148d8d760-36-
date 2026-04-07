/**
 * VALORHIVE - Payment Recovery Service (v3.49.0)
 * 
 * Handles failed webhook recovery and payment reconciliation.
 * Part of the Financial Safety Layer.
 * 
 * Key Features:
 * - Webhook failure recovery with exponential backoff
 * - Payment status polling
 * - Daily reconciliation with Razorpay
 * - Ghost entry prevention
 * - Manual review queue
 */

import { db } from '@/lib/db';
import { RecoveryStatus, SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface WebhookPayload {
  entity: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
        method: string;
        email: string;
        contact: string;
        created_at: number;
      };
    };
  };
}

interface RecoveryResult {
  success: boolean;
  recoveryId?: string;
  status?: RecoveryStatus;
  error?: string;
}

interface ReconciliationResult {
  matched: number;
  missing: number;
  extra: number;
  discrepancies: any[];
}

// Retry intervals (minutes): 5, 30, 120, 360, 1440 (1 day)
const RETRY_INTERVALS = [5, 30, 120, 360, 1440];

// ============================================
// WEBHOOK FAILURE HANDLING
// ============================================

/**
 * Store failed webhook for recovery
 */
export async function storeFailedWebhook(
  payload: WebhookPayload,
  error: string
): Promise<{ success: boolean; recoveryId?: string }> {
  try {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      return { success: false };
    }

    // Check if recovery already exists
    const existing = await db.paymentRecovery.findFirst({
      where: {
        razorpayPaymentId: paymentEntity.id,
        status: { not: RecoveryStatus.RECOVERED }
      }
    });

    if (existing) {
      return { success: true, recoveryId: existing.id };
    }

    // Create recovery record
    const recovery = await db.paymentRecovery.create({
      data: {
        razorpayOrderId: paymentEntity.order_id,
        razorpayPaymentId: paymentEntity.id,
        amount: paymentEntity.amount / 100, // Convert from paise
        webhookPayload: JSON.stringify(payload),
        originalWebhookAt: new Date(paymentEntity.created_at * 1000),
        status: RecoveryStatus.PENDING,
        nextAttemptAt: new Date(Date.now() + RETRY_INTERVALS[0] * 60 * 1000)
      }
    });

    return { success: true, recoveryId: recovery.id };
  } catch (err) {
    console.error('Error storing failed webhook:', err);
    return { success: false };
  }
}

/**
 * Process pending recovery attempts
 */
export async function processRecoveryQueue(): Promise<{
  processed: number;
  recovered: number;
  failed: number;
  pending: number;
}> {
  const now = new Date();

  // Get recoveries ready for processing
  const recoveries = await db.paymentRecovery.findMany({
    where: {
      status: { in: [RecoveryStatus.PENDING, RecoveryStatus.IN_PROGRESS] },
      nextAttemptAt: { lte: now },
      recoveryAttempts: { lt: 5 }
    },
    take: 50
  });

  let processed = 0;
  let recovered = 0;
  let failed = 0;
  let pending = 0;

  for (const recovery of recoveries) {
    const result = await attemptRecovery(recovery.id);
    processed++;

    if (result.status === RecoveryStatus.RECOVERED) {
      recovered++;
    } else if (result.status === RecoveryStatus.FAILED) {
      failed++;
    } else {
      pending++;
    }
  }

  return { processed, recovered, failed, pending };
}

/**
 * Attempt to recover a payment
 */
export async function attemptRecovery(recoveryId: string): Promise<RecoveryResult> {
  const recovery = await db.paymentRecovery.findUnique({
    where: { id: recoveryId }
  });

  if (!recovery) {
    return { success: false, error: 'Recovery not found' };
  }

  // Update status to in progress
  await db.paymentRecovery.update({
    where: { id: recoveryId },
    data: {
      status: RecoveryStatus.IN_PROGRESS,
      lastAttemptAt: new Date(),
      recoveryAttempts: { increment: 1 }
    }
  });

  try {
    // Parse stored webhook
    const payload: WebhookPayload = JSON.parse(recovery.webhookPayload || '{}');
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity) {
      throw new Error('Invalid webhook payload');
    }

    // Verify payment status with Razorpay
    const paymentStatus = await verifyPaymentStatus(recovery.razorpayPaymentId!);

    if (paymentStatus.status === 'captured') {
      // Payment is successful, process it
      await processSuccessfulPayment(recovery, paymentEntity);
      
      await db.paymentRecovery.update({
        where: { id: recoveryId },
        data: {
          status: RecoveryStatus.RECOVERED,
          resolvedAt: new Date()
        }
      });

      return {
        success: true,
        recoveryId,
        status: RecoveryStatus.RECOVERED
      };
    } else if (paymentStatus.status === 'failed') {
      // Payment failed
      await db.paymentRecovery.update({
        where: { id: recoveryId },
        data: {
          status: RecoveryStatus.FAILED,
          lastError: 'Payment failed on gateway',
          resolvedAt: new Date()
        }
      });

      return {
        success: false,
        recoveryId,
        status: RecoveryStatus.FAILED,
        error: 'Payment failed'
      };
    } else {
      // Payment still pending, schedule retry
      const attempts = recovery.recoveryAttempts + 1;
      const nextDelay = RETRY_INTERVALS[Math.min(attempts, RETRY_INTERVALS.length - 1)];
      const nextAttemptAt = new Date(Date.now() + nextDelay * 60 * 1000);

      await db.paymentRecovery.update({
        where: { id: recoveryId },
        data: {
          status: RecoveryStatus.PENDING,
          nextAttemptAt,
          lastError: `Payment still pending, retry scheduled`
        }
      });

      return {
        success: false,
        recoveryId,
        status: RecoveryStatus.PENDING,
        error: 'Payment pending'
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const attempts = recovery.recoveryAttempts + 1;

    if (attempts >= 5) {
      // Max attempts reached
      await db.paymentRecovery.update({
        where: { id: recoveryId },
        data: {
          status: RecoveryStatus.FAILED,
          lastError: `Max retries reached: ${errorMessage}`,
          resolvedAt: new Date()
        }
      });

      return {
        success: false,
        recoveryId,
        status: RecoveryStatus.FAILED,
        error: errorMessage
      };
    } else {
      // Schedule retry
      const nextDelay = RETRY_INTERVALS[Math.min(attempts, RETRY_INTERVALS.length - 1)];
      const nextAttemptAt = new Date(Date.now() + nextDelay * 60 * 1000);

      await db.paymentRecovery.update({
        where: { id: recoveryId },
        data: {
          status: RecoveryStatus.PENDING,
          nextAttemptAt,
          lastError: errorMessage
        }
      });

      return {
        success: false,
        recoveryId,
        status: RecoveryStatus.PENDING,
        error: errorMessage
      };
    }
  }
}

// ============================================
// PAYMENT VERIFICATION
// ============================================

/**
 * Verify payment status with Razorpay
 */
async function verifyPaymentStatus(paymentId: string): Promise<{
  status: string;
  amount?: number;
  orderId?: string;
}> {
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    // Mock response for development
    console.log(`[Mock Razorpay] Verifying payment ${paymentId}`);
    return { status: 'captured' };
  }

  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Razorpay API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      amount: data.amount / 100,
      orderId: data.order_id
    };
  } catch (error) {
    console.error('Error verifying payment status:', error);
    throw error;
  }
}

/**
 * Process successful payment from recovery
 */
async function processSuccessfulPayment(
  recovery: any,
  paymentEntity: any
): Promise<void> {
  // Find registration by order ID
  const registration = await db.tournamentRegistration.findFirst({
    where: {
      paymentId: recovery.razorpayOrderId
    }
  });

  if (registration) {
    // Update registration
    await db.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        paymentId: recovery.razorpayPaymentId,
        status: 'CONFIRMED'
      }
    });

    // Update recovery with registration link
    await db.paymentRecovery.update({
      where: { id: recovery.id },
      data: {
        registrationId: registration.id,
        tournamentId: registration.tournamentId
      }
    });

    // Create payment ledger entry
    await db.paymentLedger.create({
      data: {
        userId: registration.userId,
        tournamentId: registration.tournamentId,
        sport: registration.sport,
        amount: recovery.amount,
        type: 'REGISTRATION_FEE',
        status: 'PAID',
        paymentId: recovery.razorpayPaymentId,
        razorpayId: recovery.razorpayPaymentId,
        description: `Registration fee recovered via webhook retry`
      }
    });

    // Send confirmation notification
    await db.notification.create({
      data: {
        userId: registration.userId,
        sport: registration.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Payment Confirmed',
        message: `Your payment of ₹${recovery.amount} has been confirmed. You are now registered!`,
        isRead: false
      }
    });
  }
}

// ============================================
// RECONCILIATION
// ============================================

/**
 * Run daily reconciliation with Razorpay
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    matched: 0,
    missing: 0,
    extra: 0,
    discrepancies: []
  };

  // Get all pending payments from yesterday
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingPayments = await db.paymentLedger.findMany({
    where: {
      status: 'INITIATED',
      createdAt: { gte: yesterday }
    }
  });

  for (const payment of pendingPayments) {
    if (!payment.razorpayId) continue;

    try {
      const status = await verifyPaymentStatus(payment.razorpayId);

      if (status.status === 'captured') {
        // Payment was successful but not recorded
        await db.paymentLedger.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            description: `${payment.description} (reconciled)`
          }
        });

        result.matched++;

        // Update registration if exists
        if (payment.tournamentId && payment.userId) {
          await db.tournamentRegistration.updateMany({
            where: {
              tournamentId: payment.tournamentId,
              userId: payment.userId,
              status: 'PENDING'
            },
            data: { status: 'CONFIRMED' }
          });
        }
      } else if (status.status === 'failed') {
        // Payment failed
        await db.paymentLedger.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            description: `${payment.description} (payment failed)`
          }
        });

        result.discrepancies.push({
          paymentId: payment.id,
          type: 'payment_failed',
          razorpayId: payment.razorpayId
        });
      } else {
        // Still pending
        result.missing++;
      }
    } catch (error) {
      console.error(`Reconciliation error for payment ${payment.id}:`, error);
      result.discrepancies.push({
        paymentId: payment.id,
        type: 'verification_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Check for ghost entries (registrations without payment confirmation)
  const ghostRegistrations = await db.tournamentRegistration.findMany({
    where: {
      status: 'PENDING',
      paymentId: { not: null },
      createdAt: { gte: yesterday }
    }
  });

  for (const reg of ghostRegistrations) {
    // Verify if payment exists on Razorpay
    try {
      const status = await verifyPaymentStatus(reg.paymentId!);

      if (status.status === 'captured') {
        // Ghost entry - payment confirmed but registration not updated
        await db.tournamentRegistration.update({
          where: { id: reg.id },
          data: { status: 'CONFIRMED' }
        });

        result.extra++;
      }
    } catch (error) {
      console.error(`Ghost registration check error for ${reg.id}:`, error);
    }
  }

  return result;
}

/**
 * Manual recovery trigger
 */
export async function triggerManualRecovery(
  paymentId: string,
  resolvedById: string,
  notes?: string
): Promise<RecoveryResult> {
  const recovery = await db.paymentRecovery.findFirst({
    where: {
      razorpayPaymentId: paymentId,
      status: { not: RecoveryStatus.RECOVERED }
    }
  });

  if (!recovery) {
    return { success: false, error: 'Recovery not found or already resolved' };
  }

  const result = await attemptRecovery(recovery.id);

  if (result.success) {
    await db.paymentRecovery.update({
      where: { id: recovery.id },
      data: {
        resolvedById,
        resolutionNotes: notes
      }
    });
  }

  return result;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get pending recoveries
 */
export async function getPendingRecoveries(limit: number = 50): Promise<any[]> {
  return db.paymentRecovery.findMany({
    where: {
      status: { in: [RecoveryStatus.PENDING, RecoveryStatus.IN_PROGRESS, RecoveryStatus.FAILED] }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get recovery statistics
 */
export async function getRecoveryStats(): Promise<{
  pending: number;
  recovered: number;
  failed: number;
  totalAmountPending: number;
}> {
  const [pending, recovered, failed] = await Promise.all([
    db.paymentRecovery.count({ where: { status: RecoveryStatus.PENDING } }),
    db.paymentRecovery.count({ where: { status: RecoveryStatus.RECOVERED } }),
    db.paymentRecovery.count({ where: { status: RecoveryStatus.FAILED } })
  ]);

  const pendingAmounts = await db.paymentRecovery.aggregate({
    where: { status: RecoveryStatus.PENDING },
    _sum: { amount: true }
  });

  return {
    pending,
    recovered,
    failed,
    totalAmountPending: pendingAmounts._sum.amount || 0
  };
}

// ============================================
// EXPORTS
// ============================================

export const PaymentRecoveryService = {
  storeFailedWebhook,
  processQueue: processRecoveryQueue,
  attempt: attemptRecovery,
  reconcile: runReconciliation,
  triggerManual: triggerManualRecovery,
  getPending: getPendingRecoveries,
  getStats: getRecoveryStats
};
