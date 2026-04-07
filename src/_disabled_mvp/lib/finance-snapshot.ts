/**
 * VALORHIVE - Finance Snapshot Service (v3.49.0)
 * 
 * Captures complete financial state of tournaments for:
 * - Completion records
 * - Audit trail
 * - Tax reporting
 * - Payout verification
 * 
 * Part of the Financial Safety Layer.
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface FinanceSnapshotData {
  grossCollections: number;
  platformFeesCollected: number;
  paymentGatewayFees: number;
  netCollections: number;
  entryFeesTotal: number;
  earlyBirdTotal: number;
  addOnsTotal: number;
  totalRegistrations: number;
  paidRegistrations: number;
  freeRegistrations: number;
  totalRefundsInitiated: number;
  totalRefundsCompleted: number;
  totalRefundAmount: number;
  pendingRefundAmount: number;
  prizePoolCollected: number;
  prizePoolPaid: number;
  prizePoolPending: number;
  organizerPayout: number;
  platformRevenue: number;
}

interface SnapshotResult {
  success: boolean;
  snapshotId?: string;
  error?: string;
}

// ============================================
// SNAPSHOT CREATION
// ============================================

/**
 * Create a financial snapshot for a tournament
 */
export async function createFinanceSnapshot(
  tournamentId: string
): Promise<SnapshotResult> {
  try {
    // Check if snapshot already exists
    const existing = await db.tournamentFinanceSnapshot.findUnique({
      where: { tournamentId }
    });

    if (existing) {
      return {
        success: true,
        snapshotId: existing.id
      };
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        sport: true,
        entryFee: true,
        earlyBirdFee: true,
        prizePool: true,
        registrations: {
          include: {
            user: { select: { id: true } }
          }
        },
        teamRegistrations: {
          include: {
            team: { select: { id: true } }
          }
        }
      }
    });

    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Calculate financial data
    const data = await calculateFinancialData(tournamentId, tournament);

    // Create snapshot
    const snapshot = await db.tournamentFinanceSnapshot.create({
      data: {
        tournamentId,
        sport: tournament.sport,
        ...data,
        reconciliationStatus: 'PENDING'
      }
    });

    return {
      success: true,
      snapshotId: snapshot.id
    };

  } catch (error) {
    console.error('Error creating finance snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate all financial data for a tournament
 */
async function calculateFinancialData(
  tournamentId: string,
  tournament: any
): Promise<FinanceSnapshotData> {
  // Get payment records
  const paymentLedger = await db.paymentLedger.findMany({
    where: {
      tournamentId,
      type: 'REGISTRATION_FEE'
    }
  });

  // Calculate collections
  const grossCollections = paymentLedger
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  // Get refund data
  const refundJobs = await db.refundJob.findMany({
    where: { tournamentId }
  });

  const totalRefundsInitiated = refundJobs.length;
  const totalRefundsCompleted = refundJobs.filter(r => r.status === 'COMPLETED').length;
  const totalRefundAmount = refundJobs
    .filter(r => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r.netRefund, 0);
  const pendingRefundAmount = refundJobs
    .filter(r => r.status === 'PENDING' || r.status === 'INITIATED')
    .reduce((sum, r) => sum + r.netRefund, 0);

  // Calculate registration counts
  const registrations = tournament.registrations || [];
  const teamRegistrations = tournament.teamRegistrations || [];

  const totalRegistrations = registrations.length + teamRegistrations.length;
  const paidRegistrations = registrations.filter((r: any) => r.paymentId).length +
    teamRegistrations.filter((r: any) => r.paymentId).length;
  const freeRegistrations = totalRegistrations - paidRegistrations;

  // Calculate fees
  const platformFeePercent = 5; // 5% platform fee (configurable)
  const gatewayFeePercent = 2; // 2% Razorpay fee

  const platformFeesCollected = Math.round(grossCollections * platformFeePercent / 100);
  const paymentGatewayFees = Math.round(grossCollections * gatewayFeePercent / 100);
  const netCollections = grossCollections - paymentGatewayFees;

  // Prize pool
  const prizePoolCollected = tournament.prizePool || 0;
  const prizePoolPaid = await calculatePrizePoolPaid(tournamentId);
  const prizePoolPending = prizePoolCollected - prizePoolPaid;

  // Calculate organizer payout and platform revenue
  const organizerPayout = Math.max(0, netCollections - platformFeesCollected - prizePoolPaid - pendingRefundAmount);
  const platformRevenue = platformFeesCollected;

  return {
    grossCollections,
    platformFeesCollected,
    paymentGatewayFees,
    netCollections,
    entryFeesTotal: grossCollections, // Simplified
    earlyBirdTotal: 0, // Calculate from registrations
    addOnsTotal: 0,
    totalRegistrations,
    paidRegistrations,
    freeRegistrations,
    totalRefundsInitiated,
    totalRefundsCompleted,
    totalRefundAmount,
    pendingRefundAmount,
    prizePoolCollected,
    prizePoolPaid,
    prizePoolPending,
    organizerPayout,
    platformRevenue
  };
}

/**
 * Calculate prize pool already paid out
 */
async function calculatePrizePoolPaid(tournamentId: string): Promise<number> {
  const payouts = await db.prizePayout.findMany({
    where: {
      tournamentId,
      status: 'COMPLETED'
    },
    select: { amount: true }
  });

  return payouts.reduce((sum, p) => sum + p.amount, 0);
}

// ============================================
// RECONCILIATION
// ============================================

/**
 * Reconcile snapshot with actual payment gateway data
 */
export async function reconcileSnapshot(
  snapshotId: string,
  reconciledById: string
): Promise<{
  success: boolean;
  status: 'MATCHED' | 'DISCREPANCY';
  discrepancies?: string;
  error?: string;
}> {
  try {
    const snapshot = await db.tournamentFinanceSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        tournament: true
      }
    });

    if (!snapshot) {
      return { success: false, status: 'DISCREPANCY', error: 'Snapshot not found' };
    }

    // Verify against payment gateway
    const gatewayData = await fetchGatewayData(snapshot.tournamentId);

    // Compare
    const discrepancies: string[] = [];

    if (Math.abs(gatewayData.totalCollected - snapshot.grossCollections) > 1) {
      discrepancies.push(`Collection mismatch: local ${snapshot.grossCollections}, gateway ${gatewayData.totalCollected}`);
    }

    if (Math.abs(gatewayData.totalRefunded - snapshot.totalRefundAmount) > 1) {
      discrepancies.push(`Refund mismatch: local ${snapshot.totalRefundAmount}, gateway ${gatewayData.totalRefunded}`);
    }

    const status = discrepancies.length === 0 ? 'MATCHED' : 'DISCREPANCY';

    // Update snapshot
    await db.tournamentFinanceSnapshot.update({
      where: { id: snapshotId },
      data: {
        reconciliationStatus: status,
        reconciledAt: new Date(),
        reconciledById,
        discrepancyNotes: discrepancies.length > 0 ? JSON.stringify(discrepancies) : null
      }
    });

    return {
      success: true,
      status,
      discrepancies: discrepancies.length > 0 ? JSON.stringify(discrepancies) : undefined
    };

  } catch (error) {
    console.error('Error reconciling snapshot:', error);
    return {
      success: false,
      status: 'DISCREPANCY',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch financial data from Razorpay (mock for now)
 */
async function fetchGatewayData(tournamentId: string): Promise<{
  totalCollected: number;
  totalRefunded: number;
}> {
  // In production, this would call Razorpay API
  // For now, return local data
  const payments = await db.paymentLedger.findMany({
    where: {
      tournamentId,
      type: 'REGISTRATION_FEE'
    }
  });

  return {
    totalCollected: payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0),
    totalRefunded: payments
      .filter(p => p.status === 'REFUNDED')
      .reduce((sum, p) => sum + p.amount, 0)
  };
}

/**
 * Run daily reconciliation for all pending snapshots
 */
export async function runDailyReconciliation(
  reconciledById: string
): Promise<{
  processed: number;
  matched: number;
  discrepancies: number;
  errors: string[];
}> {
  const pendingSnapshots = await db.tournamentFinanceSnapshot.findMany({
    where: { reconciliationStatus: 'PENDING' }
  });

  let processed = 0;
  let matched = 0;
  let discrepancies = 0;
  const errors: string[] = [];

  for (const snapshot of pendingSnapshots) {
    const result = await reconcileSnapshot(snapshot.id, reconciledById);
    processed++;

    if (result.success) {
      if (result.status === 'MATCHED') {
        matched++;
      } else {
        discrepancies++;
      }
    } else {
      errors.push(`Snapshot ${snapshot.id}: ${result.error}`);
    }
  }

  return { processed, matched, discrepancies, errors };
}

// ============================================
// LOCKING
// ============================================

/**
 * Lock a snapshot (prevent further modifications)
 */
export async function lockSnapshot(
  snapshotId: string,
  lockedById: string
): Promise<SnapshotResult> {
  try {
    const snapshot = await db.tournamentFinanceSnapshot.findUnique({
      where: { id: snapshotId }
    });

    if (!snapshot) {
      return { success: false, error: 'Snapshot not found' };
    }

    if (snapshot.lockedAt) {
      return { success: false, error: 'Snapshot already locked' };
    }

    // Verify reconciliation status
    if (snapshot.reconciliationStatus === 'DISCREPANCY') {
      return { success: false, error: 'Cannot lock snapshot with discrepancies' };
    }

    await db.tournamentFinanceSnapshot.update({
      where: { id: snapshotId },
      data: { lockedAt: new Date() }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        sport: snapshot.sport,
        action: 'PRIZE_PAYOUT_RECORDED',
        actorId: lockedById,
        actorRole: 'ADMIN',
        targetType: 'finance_snapshot',
        targetId: snapshotId,
        tournamentId: snapshot.tournamentId,
        reason: 'Finance snapshot locked',
        metadata: JSON.stringify({
          grossCollections: snapshot.grossCollections,
          platformRevenue: snapshot.platformRevenue,
          organizerPayout: snapshot.organizerPayout
        })
      }
    });

    return { success: true, snapshotId };

  } catch (error) {
    console.error('Error locking snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get snapshot for a tournament
 */
export async function getTournamentSnapshot(tournamentId: string): Promise<any> {
  return db.tournamentFinanceSnapshot.findUnique({
    where: { tournamentId },
    include: {
      tournament: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
          location: true
        }
      }
    }
  });
}

/**
 * Get financial summary for admin dashboard
 */
export async function getFinancialSummary(
  sport?: SportType,
  period?: { start: Date; end: Date }
): Promise<{
  totalGross: number;
  totalPlatformRevenue: number;
  totalPayouts: number;
  totalRefunds: number;
  tournamentCount: number;
}> {
  const where: any = {};

  if (sport) {
    where.sport = sport;
  }

  if (period) {
    where.capturedAt = {
      gte: period.start,
      lte: period.end
    };
  }

  const snapshots = await db.tournamentFinanceSnapshot.findMany({ where });

  return {
    totalGross: snapshots.reduce((sum, s) => sum + s.grossCollections, 0),
    totalPlatformRevenue: snapshots.reduce((sum, s) => sum + s.platformRevenue, 0),
    totalPayouts: snapshots.reduce((sum, s) => sum + s.organizerPayout, 0),
    totalRefunds: snapshots.reduce((sum, s) => sum + s.totalRefundAmount, 0),
    tournamentCount: snapshots.length
  };
}

/**
 * Get snapshots pending reconciliation
 */
export async function getPendingReconciliation(limit: number = 20): Promise<any[]> {
  return db.tournamentFinanceSnapshot.findMany({
    where: { reconciliationStatus: 'PENDING' },
    include: {
      tournament: {
        select: { name: true, sport: true }
      }
    },
    orderBy: { capturedAt: 'asc' },
    take: limit
  });
}

/**
 * Get snapshots with discrepancies
 */
export async function getDiscrepancies(limit: number = 20): Promise<any[]> {
  return db.tournamentFinanceSnapshot.findMany({
    where: { reconciliationStatus: 'DISCREPANCY' },
    include: {
      tournament: {
        select: { name: true, sport: true }
      }
    },
    orderBy: { capturedAt: 'desc' },
    take: limit
  });
}

// ============================================
// EXPORTS
// ============================================

export const FinanceSnapshotService = {
  create: createFinanceSnapshot,
  reconcile: reconcileSnapshot,
  runDailyReconciliation,
  lock: lockSnapshot,
  get: getTournamentSnapshot,
  getSummary: getFinancialSummary,
  getPendingReconciliation,
  getDiscrepancies
};
