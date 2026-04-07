/**
 * VALORHIVE - Refund Engine Service (v3.49.0)
 * 
 * Handles refund processing with auto/manual toggle support.
 * Part of the Financial Safety Layer.
 * 
 * Key Features:
 * - Auto/Manual refund mode toggle
 * - Configurable refund policies per tournament
 * - Razorpay refund integration
 * - Retry queue with exponential backoff
 * - Full audit trail
 */

import { db } from '@/lib/db';
import { RefundStatus, RefundMode, CancellationReason, SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface RefundCalculation {
  originalAmount: number;
  refundPercentage: number;
  platformFee: number;
  processingFee: number;
  netRefund: number;
  reason: string;
}

interface RefundResult {
  success: boolean;
  jobId?: string;
  razorpayRefundId?: string;
  status?: RefundStatus;
  error?: string;
}

interface RefundPolicyConfig {
  refundMode: RefundMode;
  beforeRegDeadline: number;
  afterRegBeforeStart: number;
  afterStartPartial: number;
  afterStartComplete: number;
  platformFeePercent: number;
  processingFeeFixed: number;
  partialRefundHours: number;
  proRataMatchRefund: boolean;
  minMatchesForRefund: number;
}

// Default refund policy
const DEFAULT_REFUND_POLICY: RefundPolicyConfig = {
  refundMode: RefundMode.MANUAL,
  beforeRegDeadline: 100,
  afterRegBeforeStart: 100,
  afterStartPartial: 50,
  afterStartComplete: 0,
  platformFeePercent: 0,
  processingFeeFixed: 0,
  partialRefundHours: 24,
  proRataMatchRefund: false,
  minMatchesForRefund: 0
};

// Retry intervals (minutes): 5, 30, 120, 360, 1440
const RETRY_INTERVALS = [5, 30, 120, 360, 1440];

// ============================================
// REFUND POLICY MANAGEMENT
// ============================================

/**
 * Get refund policy for a tournament
 */
export async function getRefundPolicy(tournamentId: string): Promise<RefundPolicyConfig> {
  // Try to get tournament-specific policy
  const policy = await db.refundPolicy.findUnique({
    where: { tournamentId }
  });

  if (policy) {
    return {
      refundMode: policy.refundMode,
      beforeRegDeadline: policy.beforeRegDeadline,
      afterRegBeforeStart: policy.afterRegBeforeStart,
      afterStartPartial: policy.afterStartPartial,
      afterStartComplete: policy.afterStartComplete,
      platformFeePercent: policy.platformFeePercent,
      processingFeeFixed: policy.processingFeeFixed,
      partialRefundHours: policy.partialRefundHours,
      proRataMatchRefund: policy.proRataMatchRefund,
      minMatchesForRefund: policy.minMatchesForRefund
    };
  }

  // Try to get global default policy
  const globalPolicy = await db.refundPolicy.findFirst({
    where: { tournamentId: null }
  });

  if (globalPolicy) {
    return {
      refundMode: globalPolicy.refundMode,
      beforeRegDeadline: globalPolicy.beforeRegDeadline,
      afterRegBeforeStart: globalPolicy.afterRegBeforeStart,
      afterStartPartial: globalPolicy.afterStartPartial,
      afterStartComplete: globalPolicy.afterStartComplete,
      platformFeePercent: globalPolicy.platformFeePercent,
      processingFeeFixed: globalPolicy.processingFeeFixed,
      partialRefundHours: globalPolicy.partialRefundHours,
      proRataMatchRefund: globalPolicy.proRataMatchRefund,
      minMatchesForRefund: globalPolicy.minMatchesForRefund
    };
  }

  return DEFAULT_REFUND_POLICY;
}

/**
 * Create or update refund policy
 */
export async function setRefundPolicy(
  tournamentId: string | null,
  config: Partial<RefundPolicyConfig>,
  createdById: string
): Promise<{ success: boolean; policyId?: string; error?: string }> {
  try {
    const existing = tournamentId
      ? await db.refundPolicy.findUnique({ where: { tournamentId } })
      : await db.refundPolicy.findFirst({ where: { tournamentId: null } });

    if (existing) {
      const updated = await db.refundPolicy.update({
        where: { id: existing.id },
        data: {
          ...config,
          updatedAt: new Date()
        }
      });
      return { success: true, policyId: updated.id };
    }

    const created = await db.refundPolicy.create({
      data: {
        tournamentId,
        ...DEFAULT_REFUND_POLICY,
        ...config,
        createdById
      }
    });

    return { success: true, policyId: created.id };
  } catch (error) {
    console.error('Error setting refund policy:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// REFUND CALCULATION
// ============================================

/**
 * Calculate refund amount based on timing and policy
 */
export async function calculateRefund(
  tournamentId: string,
  registrationId: string,
  options?: {
    matchesPlayed?: number;
    totalMatches?: number;
  }
): Promise<RefundCalculation> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      regDeadline: true,
      startDate: true,
      status: true,
      matches: {
        where: {
          OR: [
            { playerAId: (await db.tournamentRegistration.findUnique({ where: { id: registrationId } }))?.userId },
            { playerBId: (await db.tournamentRegistration.findUnique({ where: { id: registrationId } }))?.userId }
          ]
        },
        select: { id: true }
      }
    }
  });

  const registration = await db.tournamentRegistration.findUnique({
    where: { id: registrationId },
    select: { amount: true, userId: true }
  });

  if (!tournament || !registration) {
    return {
      originalAmount: 0,
      refundPercentage: 0,
      platformFee: 0,
      processingFee: 0,
      netRefund: 0,
      reason: 'Registration not found'
    };
  }

  const policy = await getRefundPolicy(tournamentId);
  const now = new Date();
  const regDeadline = tournament.regDeadline;
  const startDate = tournament.startDate;

  let refundPercentage = 0;
  let reason = '';

  // Determine refund percentage based on timing
  if (now < regDeadline) {
    // Before registration deadline
    refundPercentage = policy.beforeRegDeadline;
    reason = 'Refund before registration deadline';
  } else if (now < startDate) {
    // After reg deadline, before tournament start
    refundPercentage = policy.afterRegBeforeStart;
    reason = 'Refund after registration deadline';
  } else if (tournament.status === 'IN_PROGRESS') {
    // Tournament in progress
    if (policy.proRataMatchRefund && options?.totalMatches) {
      const matchesPlayed = options.matchesPlayed || 0;
      const matchRatio = matchesPlayed / options.totalMatches;
      refundPercentage = policy.afterStartPartial * (1 - matchRatio);
      reason = `Pro-rata refund (${matchesPlayed}/${options.totalMatches} matches played)`;
    } else {
      refundPercentage = policy.afterStartPartial;
      reason = 'Partial refund during tournament';
    }
  } else {
    // Tournament completed
    refundPercentage = policy.afterStartComplete;
    reason = 'No refund - tournament completed';
  }

  // Calculate amounts
  const originalAmount = registration.amount;
  const grossRefund = Math.round(originalAmount * refundPercentage / 100);
  const platformFee = Math.round(grossRefund * policy.platformFeePercent / 100);
  const processingFee = policy.processingFeeFixed;
  const netRefund = Math.max(0, grossRefund - platformFee - processingFee);

  return {
    originalAmount,
    refundPercentage,
    platformFee,
    processingFee,
    netRefund,
    reason
  };
}

// ============================================
// REFUND JOB MANAGEMENT
// ============================================

/**
 * Create a refund job (for individual player)
 */
export async function createRefundJob(
  tournamentId: string,
  registrationId: string,
  options?: {
    reason?: string;
    initiatedById?: string;
    approvedById?: string; // For manual mode
  }
): Promise<RefundResult> {
  try {
    const registration = await db.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        userId: true,
        amount: true,
        paymentId: true,
        user: { select: { firstName: true, lastName: true } }
      }
    });

    if (!registration) {
      return { success: false, error: 'Registration not found' };
    }

    // Calculate refund
    const calculation = await calculateRefund(tournamentId, registrationId);

    if (calculation.netRefund <= 0) {
      return { success: false, error: 'No refund amount applicable' };
    }

    // Get policy to check mode
    const policy = await getRefundPolicy(tournamentId);
    const initialStatus = policy.refundMode === RefundMode.AUTO && options?.approvedById
      ? RefundStatus.PENDING
      : policy.refundMode === RefundMode.MANUAL && !options?.approvedById
        ? RefundStatus.PENDING
        : RefundStatus.PENDING;

    // Create refund job
    const job = await db.refundJob.create({
      data: {
        tournamentId,
        registrationId,
        playerId: registration.userId,
        originalAmount: calculation.originalAmount,
        refundAmount: Math.round(calculation.originalAmount * calculation.refundPercentage / 100),
        platformFee: calculation.platformFee,
        processingFee: calculation.processingFee,
        netRefund: calculation.netRefund,
        status: initialStatus,
        razorpayPaymentId: registration.paymentId,
        cancellationNotes: options?.reason || calculation.reason,
        approvedById: options?.approvedById,
        approvedAt: options?.approvedById ? new Date() : null,
        maxRetries: RETRY_INTERVALS.length
      }
    });

    // If auto mode or pre-approved, queue for processing
    if (policy.refundMode === RefundMode.AUTO || options?.approvedById) {
      await queueRefundForProcessing(job.id);
    }

    return {
      success: true,
      jobId: job.id,
      status: job.status
    };

  } catch (error) {
    console.error('Error creating refund job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Approve a pending refund (for manual mode)
 */
export async function approveRefundJob(
  jobId: string,
  approvedById: string,
  notes?: string
): Promise<RefundResult> {
  try {
    const job = await db.refundJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return { success: false, error: 'Refund job not found' };
    }

    if (job.status !== RefundStatus.PENDING) {
      return { success: false, error: `Cannot approve job with status: ${job.status}` };
    }

    // Update job
    const updated = await db.refundJob.update({
      where: { id: jobId },
      data: {
        status: RefundStatus.INITIATED,
        approvedById,
        approvedAt: new Date(),
        approvalNotes: notes
      }
    });

    // Queue for processing
    await queueRefundForProcessing(jobId);

    return {
      success: true,
      jobId: updated.id,
      status: updated.status
    };

  } catch (error) {
    console.error('Error approving refund job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Queue refund for processing
 */
async function queueRefundForProcessing(jobId: string): Promise<void> {
  await db.refundJob.update({
    where: { id: jobId },
    data: {
      status: RefundStatus.INITIATED,
      nextRetryAt: new Date() // Process immediately
    }
  });
}

// ============================================
// REFUND PROCESSING (RAZORPAY)
// ============================================

/**
 * Process a refund through Razorpay
 */
export async function processRefund(jobId: string): Promise<RefundResult> {
  const job = await db.refundJob.findUnique({
    where: { id: jobId }
  });

  if (!job) {
    return { success: false, error: 'Refund job not found' };
  }

  if (!job.razorpayPaymentId) {
    await db.refundJob.update({
      where: { id: jobId },
      data: {
        status: RefundStatus.MANUAL_REVIEW,
        lastError: 'No Razorpay payment ID found'
      }
    });
    return { success: false, error: 'No payment ID found' };
  }

  try {
    // Update status to processing
    await db.refundJob.update({
      where: { id: jobId },
      data: {
        status: RefundStatus.PROCESSING,
        lastRetryAt: new Date()
      }
    });

    // Call Razorpay refund API
    const refundResponse = await initiateRazorpayRefund(
      job.razorpayPaymentId,
      job.netRefund,
      `Refund for tournament cancellation`
    );

    if (refundResponse.success) {
      // Update job as completed
      await db.refundJob.update({
        where: { id: jobId },
        data: {
          status: RefundStatus.COMPLETED,
          razorpayRefundId: refundResponse.refundId,
          completedAt: new Date()
        }
      });

      // Update registration
      if (job.registrationId) {
        await db.tournamentRegistration.update({
          where: { id: job.registrationId },
          data: {
            refundId: refundResponse.refundId,
            refundAmount: job.netRefund,
            cancelledAt: new Date()
          }
        });
      }

      // Send notification
      await sendRefundNotification(job.playerId!, job.netRefund, 'completed');

      return {
        success: true,
        jobId,
        razorpayRefundId: refundResponse.refundId,
        status: RefundStatus.COMPLETED
      };

    } else {
      throw new Error(refundResponse.error || 'Razorpay refund failed');
    }

  } catch (error) {
    console.error('Refund processing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const retryCount = job.retryCount + 1;

    // Check if we should retry
    if (retryCount < job.maxRetries) {
      const nextRetryDelay = RETRY_INTERVALS[retryCount] || RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
      const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 1000);

      await db.refundJob.update({
        where: { id: jobId },
        data: {
          retryCount,
          lastError: errorMessage,
          nextRetryAt,
          status: RefundStatus.INITIATED
        }
      });

      return {
        success: false,
        jobId,
        error: `Refund failed, scheduled for retry (${retryCount}/${job.maxRetries}): ${errorMessage}`
      };
    } else {
      // Max retries reached, mark for manual review
      await db.refundJob.update({
        where: { id: jobId },
        data: {
          status: RefundStatus.MANUAL_REVIEW,
          lastError: `Max retries reached: ${errorMessage}`
        }
      });

      return {
        success: false,
        jobId,
        error: `Refund failed after ${retryCount} attempts, marked for manual review`
      };
    }
  }
}

/**
 * Initiate Razorpay refund
 * 
 * CRITICAL: All amounts are in PAISE (minor units).
 * The refund amount should already be in paise - NO multiplication needed.
 */
async function initiateRazorpayRefund(
  paymentId: string,
  amountPaise: number,
  notes: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  // SECURITY: Must have Razorpay credentials configured
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('[Refund] Razorpay credentials not configured');
    return {
      success: false,
      error: 'Payment gateway not configured. Cannot process refund.'
    };
  }

  try {
    // CRITICAL: Amount is ALREADY in paise - do NOT multiply by 100
    // Razorpay API expects amounts in the smallest currency unit (paise for INR)
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountPaise,  // Already in paise - no conversion needed
        notes: { reason: notes }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Refund] Razorpay refund failed:', error);
      return { 
        success: false, 
        error: error.error?.description || 'Razorpay refund failed' 
      };
    }

    const data = await response.json();
    console.log(`[Refund] Successfully processed refund ${data.id} for payment ${paymentId}`);
    return { success: true, refundId: data.id };

  } catch (error) {
    console.error('[Refund] Razorpay refund error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Razorpay API error'
    };
  }
}

// ============================================
// BATCH REFUND PROCESSING
// ============================================

/**
 * Process all refunds for a cancelled tournament
 */
export async function processTournamentRefunds(
  tournamentId: string,
  reason: CancellationReason,
  cancelledById: string
): Promise<{
  success: boolean;
  totalJobs: number;
  autoQueued: number;
  pendingApproval: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalJobs = 0;
  let autoQueued = 0;
  let pendingApproval = 0;

  try {
    // Get policy
    const policy = await getRefundPolicy(tournamentId);

    // Get all paid registrations
    const registrations = await db.tournamentRegistration.findMany({
      where: {
        tournamentId,
        paymentId: { not: null }
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        paymentId: true
      }
    });

    // Create refund jobs for each registration
    for (const reg of registrations) {
      const result = await createRefundJob(tournamentId, reg.id, {
        reason: `Tournament cancelled: ${reason}`,
        initiatedById: cancelledById
      });

      if (result.success) {
        totalJobs++;
        if (policy.refundMode === RefundMode.AUTO) {
          autoQueued++;
        } else {
          pendingApproval++;
        }
      } else {
        errors.push(`Registration ${reg.id}: ${result.error}`);
      }
    }

    // Update cancellation log
    await db.cancellationLog.create({
      data: {
        tournamentId,
        sport: (await db.tournament.findUnique({ where: { id: tournamentId } }))!.sport,
        reason,
        cancelledById,
        totalRegistrations: registrations.length,
        totalPaid: registrations.filter(r => r.paymentId).length,
        totalAmount: registrations.reduce((sum, r) => sum + r.amount, 0),
        refundMode: policy.refundMode,
        refundsInitiated: totalJobs,
        refundsPending: pendingApproval
      }
    });

    return {
      success: true,
      totalJobs,
      autoQueued,
      pendingApproval,
      errors
    };

  } catch (error) {
    console.error('Error processing tournament refunds:', error);
    return {
      success: false,
      totalJobs,
      autoQueued,
      pendingApproval,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Process pending refund jobs (cron job)
 */
export async function processPendingRefunds(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  pendingApproval: number;
}> {
  const now = new Date();

  // Get jobs ready for processing
  const jobs = await db.refundJob.findMany({
    where: {
      status: { in: [RefundStatus.INITIATED, RefundStatus.PROCESSING] },
      nextRetryAt: { lte: now },
      retryCount: { lt: 5 }
    },
    take: 50
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let pendingApproval = 0;

  for (const job of jobs) {
    const result = await processRefund(job.id);
    processed++;
    if (result.success) {
      succeeded++;
    } else {
      failed++;
      if (result.status === RefundStatus.MANUAL_REVIEW) {
        pendingApproval++;
      }
    }
  }

  return { processed, succeeded, failed, pendingApproval };
}

// ============================================
// NOTIFICATIONS
// ============================================

async function sendRefundNotification(
  playerId: string,
  amount: number,
  status: 'initiated' | 'completed'
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: playerId },
    select: { sport: true, firstName: true, email: true }
  });

  if (!user) return;

  const title = status === 'initiated'
    ? 'Refund Initiated'
    : 'Refund Completed';

  const message = status === 'initiated'
    ? `Your refund of ₹${amount} has been initiated and will be processed shortly.`
    : `Your refund of ₹${amount} has been completed. Please check your account.`;

  await db.notification.create({
    data: {
      userId: playerId,
      sport: user.sport,
      type: 'REFUND_PROCESSED',
      title,
      message,
      isRead: false
    }
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get refund jobs for a tournament
 */
export async function getTournamentRefundJobs(tournamentId: string): Promise<any[]> {
  return db.refundJob.findMany({
    where: { tournamentId },
    include: {
      registration: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get pending refunds requiring approval
 */
export async function getPendingApprovals(limit: number = 50): Promise<any[]> {
  return db.refundJob.findMany({
    where: { status: RefundStatus.PENDING },
    include: {
      tournament: { select: { id: true, name: true } },
      registration: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } }
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: limit
  });
}

// ============================================
// EXPORTS
// ============================================

export const RefundEngineService = {
  getPolicy: getRefundPolicy,
  setPolicy: setRefundPolicy,
  calculate: calculateRefund,
  createJob: createRefundJob,
  approve: approveRefundJob,
  process: processRefund,
  processTournament: processTournamentRefunds,
  processPending: processPendingRefunds,
  getJobs: getTournamentRefundJobs,
  getPendingApprovals
};
