/**
 * VALORHIVE - Cancellation Handler Service (v3.49.0)
 * 
 * Handles tournament cancellation workflow including:
 * - Cancellation validation
 * - Refund triggering
 * - Notification dispatch
 * - Audit logging
 * 
 * Part of the Financial Safety Layer.
 */

import { db } from '@/lib/db';
import { TournamentStatus, CancellationReason, RefundMode, SportType } from '@prisma/client';
import { RefundEngineService } from './refund-engine';

// ============================================
// TYPES
// ============================================

interface CancellationResult {
  success: boolean;
  cancellationId?: string;
  refundsInitiated: number;
  refundsPending: number;
  errors: string[];
}

interface CancellationImpact {
  totalRegistrations: number;
  paidRegistrations: number;
  totalAmount: number;
  teamRegistrations: number;
  matchesPlayed: number;
}

// ============================================
// CANCELLATION VALIDATION
// ============================================

/**
 * Validate if tournament can be cancelled
 */
export async function validateCancellation(
  tournamentId: string
): Promise<{
  canCancel: boolean;
  reason?: string;
  impact?: CancellationImpact;
}> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' }
      },
      teamRegistrations: {
        where: { status: 'CONFIRMED' }
      },
      matches: {
        where: { outcome: 'PLAYED' }
      }
    }
  });

  if (!tournament) {
    return { canCancel: false, reason: 'Tournament not found' };
  }

  if (tournament.status === TournamentStatus.CANCELLED) {
    return { canCancel: false, reason: 'Tournament already cancelled' };
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    return { canCancel: false, reason: 'Cannot cancel completed tournament' };
  }

  // Calculate impact
  const paidRegistrations = tournament.registrations.filter(r => r.paymentId);
  const impact: CancellationImpact = {
    totalRegistrations: tournament.registrations.length,
    paidRegistrations: paidRegistrations.length,
    totalAmount: paidRegistrations.reduce((sum, r) => sum + (r.amount || 0), 0),
    teamRegistrations: tournament.teamRegistrations.length,
    matchesPlayed: tournament.matches.length
  };

  return { canCancel: true, impact };
}

// ============================================
// CANCELLATION EXECUTION
// ============================================

/**
 * Cancel a tournament
 */
export async function cancelTournament(
  tournamentId: string,
  reason: CancellationReason,
  cancelledById: string,
  options?: {
    notes?: string;
    skipRefunds?: boolean;
    notifyPlayers?: boolean;
  }
): Promise<CancellationResult> {
  const errors: string[] = [];
  let refundsInitiated = 0;
  let refundsPending = 0;

  try {
    // Validate cancellation
    const validation = await validateCancellation(tournamentId);
    if (!validation.canCancel) {
      return {
        success: false,
        refundsInitiated: 0,
        refundsPending: 0,
        errors: [validation.reason || 'Cannot cancel tournament']
      };
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      return {
        success: false,
        refundsInitiated: 0,
        refundsPending: 0,
        errors: ['Tournament not found']
      };
    }

    // Update tournament status
    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.CANCELLED,
        updatedAt: new Date()
      }
    });

    // Process refunds
    if (!options?.skipRefunds && validation.impact!.paidRegistrations > 0) {
      const refundResult = await RefundEngineService.processTournament(
        tournamentId,
        reason,
        cancelledById
      );

      refundsInitiated = refundResult.totalJobs;
      refundsPending = refundResult.pendingApproval;
      errors.push(...refundResult.errors);
    }

    // Create cancellation log
    const cancellationLog = await db.cancellationLog.create({
      data: {
        tournamentId,
        sport: tournament.sport,
        reason,
        notes: options?.notes,
        cancelledById,
        totalRegistrations: validation.impact!.totalRegistrations,
        totalPaid: validation.impact!.paidRegistrations,
        totalAmount: validation.impact!.totalAmount,
        refundMode: (await RefundEngineService.getPolicy(tournamentId)).refundMode,
        refundsInitiated,
        refundsPending
      }
    });

    // Send notifications
    if (options?.notifyPlayers !== false) {
      await sendCancellationNotifications(tournamentId, reason, options?.notes);
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'TOURNAMENT_CANCEL',
        actorId: cancelledById,
        actorRole: 'ADMIN',
        targetType: 'tournament',
        targetId: tournamentId,
        tournamentId,
        reason: options?.notes || reason,
        metadata: JSON.stringify({
          cancellationId: cancellationLog.id,
          refundMode: (await RefundEngineService.getPolicy(tournamentId)).refundMode,
          refundsInitiated,
          refundsPending
        })
      }
    });

    return {
      success: true,
      cancellationId: cancellationLog.id,
      refundsInitiated,
      refundsPending,
      errors
    };

  } catch (error) {
    console.error('Error cancelling tournament:', error);
    return {
      success: false,
      refundsInitiated,
      refundsPending,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

// ============================================
// BULK CANCELLATION
// ============================================

/**
 * Cancel multiple tournaments (for admin use)
 */
export async function bulkCancelTournaments(
  tournamentIds: string[],
  reason: CancellationReason,
  cancelledById: string,
  notes?: string
): Promise<{
  success: number;
  failed: number;
  results: Map<string, CancellationResult>;
}> {
  const results = new Map<string, CancellationResult>();
  let success = 0;
  let failed = 0;

  for (const tournamentId of tournamentIds) {
    const result = await cancelTournament(tournamentId, reason, cancelledById, { notes });
    results.set(tournamentId, result);

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, results };
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Send cancellation notifications to all participants
 */
async function sendCancellationNotifications(
  tournamentId: string,
  reason: CancellationReason,
  notes?: string
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, sport: true }
  });

  if (!tournament) return;

  // Get all registered users
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'CONFIRMED'
    },
    select: { userId: true }
  });

  const teamRegistrations = await db.tournamentTeam.findMany({
    where: {
      tournamentId,
      status: 'CONFIRMED'
    },
    select: {
      team: {
        select: {
          members: { select: { userId: true } }
        }
      }
    }
  });

  // Collect unique user IDs
  const userIds = new Set<string>();
  registrations.forEach(r => userIds.add(r.userId));
  teamRegistrations.forEach(tr => {
    tr.team.members.forEach(m => userIds.add(m.userId));
  });

  // Create notifications
  const reasonText = formatCancellationReason(reason);
  const message = notes
    ? `${tournament.name} has been cancelled. Reason: ${reasonText}. ${notes}`
    : `${tournament.name} has been cancelled. Reason: ${reasonText}. A refund will be processed if applicable.`;

  const notificationData = Array.from(userIds).map(userId => ({
    userId,
    sport: tournament.sport,
    type: 'TOURNAMENT_CANCELLED' as const,
    title: 'Tournament Cancelled',
    message,
    isRead: false
  }));

  // Batch create notifications
  await db.notification.createMany({
    data: notificationData,
    skipDuplicates: true
  });

  // Update cancellation log
  await db.cancellationLog.updateMany({
    where: { tournamentId },
    data: {
      playersNotified: true,
      notifiedAt: new Date()
    }
  });
}

/**
 * Format cancellation reason for display
 */
function formatCancellationReason(reason: CancellationReason): string {
  const reasonMap: Record<CancellationReason, string> = {
    ORGANIZER_DECISION: 'Organizer Decision',
    INSUFFICIENT_PLAYERS: 'Insufficient Registrations',
    VENUE_UNAVAILABLE: 'Venue Unavailable',
    WEATHER: 'Weather Conditions',
    GOVERNMENT_ORDER: 'Government Order',
    SYSTEM_ERROR: 'Technical Issues',
    OTHER: 'Other Reasons'
  };

  return reasonMap[reason] || reason;
}

// ============================================
// RESCHEDULING SUPPORT
// ============================================

/**
 * Reschedule a tournament (alternative to cancellation)
 */
export async function rescheduleTournament(
  tournamentId: string,
  newStartDate: Date,
  newEndDate: Date,
  newRegDeadline: Date,
  rescheduledById: string,
  options?: {
    notifyPlayers?: boolean;
    allowWithdrawal?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true, startDate: true }
  });

  if (!tournament) {
    return { success: false, error: 'Tournament not found' };
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    return { success: false, error: 'Cannot reschedule completed tournament' };
  }

  if (tournament.status === TournamentStatus.CANCELLED) {
    return { success: false, error: 'Cannot reschedule cancelled tournament' };
  }

  if (newStartDate <= new Date()) {
    return { success: false, error: 'New start date must be in the future' };
  }

  // Update tournament dates
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      startDate: newStartDate,
      endDate: newEndDate,
      regDeadline: newRegDeadline,
      updatedAt: new Date()
    }
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      sport: (await db.tournament.findUnique({ where: { id: tournamentId } }))!.sport,
      action: 'ADMIN_OVERRIDE',
      actorId: rescheduledById,
      actorRole: 'ADMIN',
      targetType: 'tournament',
      targetId: tournamentId,
      tournamentId,
      reason: `Rescheduled from ${tournament.startDate.toISOString()} to ${newStartDate.toISOString()}`,
      metadata: JSON.stringify({
        oldStartDate: tournament.startDate,
        newStartDate,
        newEndDate,
        newRegDeadline
      })
    }
  });

  // Send notifications
  if (options?.notifyPlayers !== false) {
    await sendRescheduleNotifications(tournamentId, newStartDate, options?.allowWithdrawal);
  }

  return { success: true };
}

/**
 * Send reschedule notifications
 */
async function sendRescheduleNotifications(
  tournamentId: string,
  newStartDate: Date,
  allowWithdrawal?: boolean
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, sport: true, location: true }
  });

  if (!tournament) return;

  const registrations = await db.tournamentRegistration.findMany({
    where: { tournamentId, status: 'CONFIRMED' },
    select: { userId: true }
  });

  const message = allowWithdrawal
    ? `${tournament.name} has been rescheduled to ${newStartDate.toLocaleDateString()}. You may withdraw for a full refund if the new date doesn't work for you.`
    : `${tournament.name} has been rescheduled to ${newStartDate.toLocaleDateString()} at ${tournament.location}.`;

  await db.notification.createMany({
    data: registrations.map(r => ({
      userId: r.userId,
      sport: tournament.sport,
      type: 'TOURNAMENT_CANCELLED' as const,
      title: 'Tournament Rescheduled',
      message,
      isRead: false
    })),
    skipDuplicates: true
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get cancellation history for a tournament
 */
export async function getCancellationHistory(tournamentId: string): Promise<any[]> {
  return db.cancellationLog.findMany({
    where: { tournamentId },
    include: {
      tournament: {
        select: { name: true }
      }
    },
    orderBy: { cancelledAt: 'desc' }
  });
}

/**
 * Get recent cancellations (admin dashboard)
 */
export async function getRecentCancellations(limit: number = 20): Promise<any[]> {
  return db.cancellationLog.findMany({
    include: {
      tournament: {
        select: { name: true, sport: true }
      }
    },
    orderBy: { cancelledAt: 'desc' },
    take: limit
  });
}

// ============================================
// EXPORTS
// ============================================

export const CancellationHandlerService = {
  validate: validateCancellation,
  cancel: cancelTournament,
  bulkCancel: bulkCancelTournaments,
  reschedule: rescheduleTournament,
  getHistory: getCancellationHistory,
  getRecent: getRecentCancellations
};
