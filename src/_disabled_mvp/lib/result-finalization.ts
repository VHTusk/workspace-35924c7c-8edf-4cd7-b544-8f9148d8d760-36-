/**
 * VALORHIVE - Result Finalization Service (v3.48.0)
 * 
 * Handles the finalization window, disputes, and result locking
 * for the Completion & Trust Layer.
 * 
 * Key Features:
 * - Configurable finalization window (default 48 hours)
 * - Dispute management during finalization window
 * - Result locking after window closes
 * - Admin unlock capabilities for corrections
 */

import { db } from '@/lib/db';
import { FinalizationStatus, DisputeStatus, CompletionAction, SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface FinalizationWindowResult {
  success: boolean;
  tournamentId: string;
  windowId?: string;
  status: FinalizationStatus;
  windowEndsAt?: Date;
  message?: string;
  error?: string;
}

interface DisputeResult {
  success: boolean;
  disputeId?: string;
  status?: DisputeStatus;
  message?: string;
  error?: string;
}

interface LockResult {
  success: boolean;
  lockedAt?: Date;
  message?: string;
  error?: string;
}

// Default finalization window duration (hours)
const DEFAULT_FINALIZATION_WINDOW_HOURS = 48;

// ============================================
// FINALIZATION WINDOW MANAGEMENT
// ============================================

/**
 * Start the finalization window for a completed tournament
 */
export async function startFinalizationWindow(
  tournamentId: string,
  options?: {
    customDurationHours?: number;
    startedById?: string;
  }
): Promise<FinalizationWindowResult> {
  try {
    // Check if tournament exists and is completed
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        finalizationWindow: true
      }
    });

    if (!tournament) {
      return {
        success: false,
        tournamentId,
        status: FinalizationStatus.PENDING,
        error: 'Tournament not found'
      };
    }

    // Check if window already exists
    if (tournament.finalizationWindow) {
      return {
        success: false,
        tournamentId,
        windowId: tournament.finalizationWindow.id,
        status: tournament.finalizationWindow.status,
        windowEndsAt: tournament.finalizationWindow.windowEndsAt,
        error: 'Finalization window already exists'
      };
    }

    // Calculate window timing
    const now = new Date();
    const duration = options?.customDurationHours || DEFAULT_FINALIZATION_WINDOW_HOURS;
    const windowEndsAt = new Date(now.getTime() + duration * 60 * 60 * 1000);

    // Create finalization window
    const window = await db.finalizationWindow.create({
      data: {
        tournamentId,
        sport: tournament.sport,
        windowStartsAt: now,
        windowEndsAt,
        customDuration: options?.customDurationHours || null,
        status: FinalizationStatus.WINDOW_OPEN
      }
    });

    // Log action
    await logFinalizationAction(tournamentId, CompletionAction.FINALIZATION_STARTED, {
      windowId: window.id,
      windowEndsAt: windowEndsAt.toISOString(),
      durationHours: duration,
      startedById: options?.startedById
    });

    // Send notifications to participants
    await sendFinalizationNotifications(tournamentId, 'WINDOW_OPENED');

    return {
      success: true,
      tournamentId,
      windowId: window.id,
      status: FinalizationStatus.WINDOW_OPEN,
      windowEndsAt,
      message: `Finalization window opened. Closes at ${windowEndsAt.toISOString()}`
    };

  } catch (error) {
    console.error('Error starting finalization window:', error);
    return {
      success: false,
      tournamentId,
      status: FinalizationStatus.PENDING,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get finalization window status
 */
export async function getFinalizationStatus(
  tournamentId: string
): Promise<{
  exists: boolean;
  status: FinalizationStatus | null;
  window: any | null;
  timeRemaining?: number;
}> {
  const window = await db.finalizationWindow.findUnique({
    where: { tournamentId },
    include: {
      tournament: {
        select: {
          name: true,
          sport: true,
          status: true
        }
      }
    }
  });

  if (!window) {
    return {
      exists: false,
      status: null,
      window: null
    };
  }

  const now = new Date();
  const timeRemaining = Math.max(0, window.windowEndsAt.getTime() - now.getTime());

  return {
    exists: true,
    status: window.status,
    window,
    timeRemaining
  };
}

/**
 * Process finalization window (cron job)
 * Closes windows that have expired
 */
export async function processFinalizationWindows(): Promise<{
  processed: number;
  closed: number;
  locked: number;
  disputed: number;
}> {
  const now = new Date();

  // Find windows that should be closed
  const expiredWindows = await db.finalizationWindow.findMany({
    where: {
      status: FinalizationStatus.WINDOW_OPEN,
      windowEndsAt: { lte: now }
    }
  });

  let closed = 0;
  let locked = 0;
  let disputed = 0;

  for (const window of expiredWindows) {
    // Check for active disputes
    const activeDisputes = await db.tournamentDispute.count({
      where: {
        tournamentId: window.tournamentId,
        status: DisputeStatus.OPEN,
        blocksFinalization: true
      }
    });

    if (activeDisputes > 0) {
      // Mark as disputed
      await db.finalizationWindow.update({
        where: { id: window.id },
        data: { status: FinalizationStatus.DISPUTED }
      });
      disputed++;
    } else {
      // Close and lock
      await db.finalizationWindow.update({
        where: { id: window.id },
        data: {
          status: FinalizationStatus.LOCKED,
          lockedAt: now
        }
      });

      // Lock the snapshot
      await lockTournamentResults(window.tournamentId, 'SYSTEM', 'Finalization window expired');

      closed++;
      locked++;
    }
  }

  return {
    processed: expiredWindows.length,
    closed,
    locked,
    disputed
  };
}

// ============================================
// DISPUTE MANAGEMENT
// ============================================

/**
 * Raise a dispute during finalization window
 */
export async function raiseDispute(
  tournamentId: string,
  raisedById: string,
  options: {
    disputedEntityId?: string;
    disputeType: string;
    reason: string;
    evidence?: string[];
    blocksFinalization?: boolean;
  }
): Promise<DisputeResult> {
  try {
    // Check finalization window is open
    const window = await db.finalizationWindow.findUnique({
      where: { tournamentId }
    });

    if (!window || window.status !== FinalizationStatus.WINDOW_OPEN) {
      return {
        success: false,
        error: 'Finalization window is not open for disputes'
      };
    }

    // Create dispute
    const dispute = await db.tournamentDispute.create({
      data: {
        tournamentId,
        sport: window.sport,
        raisedById,
        disputedEntityId: options.disputedEntityId,
        disputeType: options.disputeType,
        reason: options.reason,
        evidence: options.evidence ? JSON.stringify(options.evidence) : null,
        status: DisputeStatus.OPEN,
        blocksFinalization: options.blocksFinalization !== false
      }
    });

    // Update window stats
    await db.finalizationWindow.update({
      where: { tournamentId },
      data: {
        totalDisputes: { increment: 1 },
        activeDisputes: { increment: 1 }
      }
    });

    // Log action
    await logFinalizationAction(tournamentId, CompletionAction.DISPUTE_RAISED, {
      disputeId: dispute.id,
      raisedById,
      disputeType: options.disputeType,
      blocksFinalization: options.blocksFinalization !== false
    });

    // Notify relevant parties
    await sendDisputeNotifications(tournamentId, dispute.id, 'RAISED');

    return {
      success: true,
      disputeId: dispute.id,
      status: DisputeStatus.OPEN,
      message: 'Dispute raised successfully'
    };

  } catch (error) {
    console.error('Error raising dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Resolve a dispute
 */
export async function resolveDispute(
  disputeId: string,
  resolvedById: string,
  resolution: string,
  options?: {
    blocksFinalization?: boolean;
  }
): Promise<DisputeResult> {
  try {
    const dispute = await db.tournamentDispute.findUnique({
      where: { id: disputeId },
      include: { tournament: true }
    });

    if (!dispute) {
      return {
        success: false,
        error: 'Dispute not found'
      };
    }

    // Update dispute
    const updated = await db.tournamentDispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolvedById,
        resolvedAt: new Date(),
        blocksFinalization: options?.blocksFinalization ?? false
      }
    });

    // Update window stats
    await db.finalizationWindow.update({
      where: { tournamentId: dispute.tournamentId },
      data: {
        activeDisputes: { decrement: 1 },
        resolvedDisputes: { increment: 1 }
      }
    });

    // Log action
    await logFinalizationAction(dispute.tournamentId, CompletionAction.DISPUTE_RESOLVED, {
      disputeId,
      resolvedById,
      resolution,
      previousStatus: dispute.status
    });

    // Check if all disputes resolved, can now lock
    const remainingActive = await db.tournamentDispute.count({
      where: {
        tournamentId: dispute.tournamentId,
        status: DisputeStatus.OPEN,
        blocksFinalization: true
      }
    });

    if (remainingActive === 0) {
      // Update window status if was disputed
      const window = await db.finalizationWindow.findUnique({
        where: { tournamentId: dispute.tournamentId }
      });

      if (window?.status === FinalizationStatus.DISPUTED) {
        await db.finalizationWindow.update({
          where: { tournamentId: dispute.tournamentId },
          data: { status: FinalizationStatus.WINDOW_CLOSED }
        });
      }
    }

    // Send notifications
    await sendDisputeNotifications(dispute.tournamentId, disputeId, 'RESOLVED');

    return {
      success: true,
      disputeId,
      status: DisputeStatus.RESOLVED,
      message: 'Dispute resolved successfully'
    };

  } catch (error) {
    console.error('Error resolving dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get disputes for a tournament
 */
export async function getTournamentDisputes(
  tournamentId: string,
  options?: {
    status?: DisputeStatus;
    includeResolved?: boolean;
  }
): Promise<any[]> {
  const where: any = { tournamentId };

  if (options?.status) {
    where.status = options.status;
  } else if (!options?.includeResolved) {
    where.status = { not: DisputeStatus.RESOLVED };
  }

  return db.tournamentDispute.findMany({
    where,
    include: {
      raisedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// ============================================
// RESULT LOCKING
// ============================================

/**
 * Lock tournament results
 */
export async function lockTournamentResults(
  tournamentId: string,
  lockedById: string,
  reason: string
): Promise<LockResult> {
  try {
    // Check if already locked
    const window = await db.finalizationWindow.findUnique({
      where: { tournamentId }
    });

    if (!window) {
      return {
        success: false,
        error: 'Finalization window not found'
      };
    }

    if (window.status === FinalizationStatus.LOCKED) {
      return {
        success: false,
        message: 'Results already locked'
      };
    }

    // Check for blocking disputes
    const blockingDisputes = await db.tournamentDispute.count({
      where: {
        tournamentId,
        status: DisputeStatus.OPEN,
        blocksFinalization: true
      }
    });

    if (blockingDisputes > 0) {
      return {
        success: false,
        error: `Cannot lock: ${blockingDisputes} blocking disputes active`
      };
    }

    const now = new Date();

    // Update finalization window
    await db.finalizationWindow.update({
      where: { tournamentId },
      data: {
        status: FinalizationStatus.LOCKED,
        lockedAt: now,
        lockedById,
        lockReason: reason
      }
    });

    // Lock snapshot
    await db.tournamentSnapshot.update({
      where: { tournamentId },
      data: {
        lockedAt: now,
        lockedById
      }
    });

    // Log action
    await logFinalizationAction(tournamentId, CompletionAction.FINALIZATION_LOCKED, {
      lockedById,
      reason,
      lockedAt: now.toISOString()
    });

    // Send notifications
    await sendFinalizationNotifications(tournamentId, 'LOCKED');

    return {
      success: true,
      lockedAt: now,
      message: 'Tournament results locked successfully'
    };

  } catch (error) {
    console.error('Error locking results:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Unlock results temporarily (admin only)
 */
export async function unlockResults(
  tournamentId: string,
  unlockedById: string,
  reason: string,
  expiresAt?: Date
): Promise<LockResult> {
  try {
    // Validate admin permission
    const hasPermission = await validateUnlockPermission(unlockedById);
    if (!hasPermission) {
      return {
        success: false,
        error: 'Insufficient permissions to unlock results'
      };
    }

    const window = await db.finalizationWindow.findUnique({
      where: { tournamentId }
    });

    if (!window || window.status !== FinalizationStatus.LOCKED) {
      return {
        success: false,
        error: 'Results are not locked'
      };
    }

    const now = new Date();
    const expiry = expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default 24h

    // Update window
    await db.finalizationWindow.update({
      where: { tournamentId },
      data: {
        status: FinalizationStatus.OVERRIDDEN,
        unlockedAt: now,
        unlockedById,
        unlockReason: reason,
        unlockExpiresAt: expiry
      }
    });

    // Log action
    await logFinalizationAction(tournamentId, CompletionAction.UNLOCK_GRANTED, {
      unlockedById,
      reason,
      expiresAt: expiry.toISOString()
    });

    return {
      success: true,
      message: `Results unlocked until ${expiry.toISOString()}`
    };

  } catch (error) {
    console.error('Error unlocking results:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if results are locked
 */
export async function areResultsLocked(tournamentId: string): Promise<{
  isLocked: boolean;
  status: FinalizationStatus | null;
  canModify: boolean;
  reason?: string;
}> {
  const window = await db.finalizationWindow.findUnique({
    where: { tournamentId }
  });

  if (!window) {
    return {
      isLocked: false,
      status: null,
      canModify: true,
      reason: 'No finalization window'
    };
  }

  // Check if temporarily unlocked
  if (window.status === FinalizationStatus.OVERRIDDEN && window.unlockExpiresAt) {
    const now = new Date();
    if (now < window.unlockExpiresAt) {
      return {
        isLocked: true,
        status: window.status,
        canModify: true,
        reason: `Temporarily unlocked until ${window.unlockExpiresAt.toISOString()}`
      };
    }
  }

  return {
    isLocked: window.status === FinalizationStatus.LOCKED,
    status: window.status,
    canModify: window.status !== FinalizationStatus.LOCKED
  };
}

// ============================================
// HELPERS
// ============================================

async function logFinalizationAction(
  tournamentId: string,
  action: CompletionAction,
  details: Record<string, any>
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { sport: true }
  });

  if (!tournament) return;

  await db.tournamentCompletionLog.create({
    data: {
      tournamentId,
      sport: tournament.sport,
      action,
      status: 'SUCCESS',
      details: JSON.stringify(details),
      actorId: details.actorId || details.lockedById || details.unlockedById || null,
      actorRole: 'SYSTEM',
      executedAt: new Date()
    }
  });
}

async function validateUnlockPermission(userId: string): Promise<boolean> {
  const assignment = await db.adminAssignment.findFirst({
    where: {
      userId,
      isActive: true,
      adminRole: { in: ['SUPER_ADMIN', 'SPORT_ADMIN'] }
    }
  });

  return assignment !== null;
}

async function sendFinalizationNotifications(
  tournamentId: string,
  event: string
): Promise<void> {
  try {
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          select: { userId: true }
        },
        teamRegistrations: {
          where: { status: 'CONFIRMED' },
          select: {
            team: {
              select: {
                members: {
                  select: { userId: true }
                }
              }
            }
          }
        }
      }
    });

    if (!tournament) return;

    // Collect all participant user IDs
    const userIds = new Set<string>();
    
    // Individual registrations
    for (const reg of tournament.registrations) {
      userIds.add(reg.userId);
    }
    
    // Team registrations
    for (const teamReg of tournament.teamRegistrations) {
      for (const member of teamReg.team.members) {
        userIds.add(member.userId);
      }
    }

    // Map event to notification type and message
    const eventConfig: Record<string, { type: string; title: string; getMessage: (name: string) => string }> = {
      WINDOW_OPENED: {
        type: 'FINALIZATION_WINDOW_OPENED',
        title: 'Results Review Period',
        getMessage: (name) => `Results for ${name} are now under a 48-hour review period. Raise any disputes before finalization.`
      },
      LOCKED: {
        type: 'FINALIZATION_LOCKED',
        title: 'Results Finalized',
        getMessage: (name) => `Results for ${name} have been officially finalized and locked.`
      }
    };

    const config = eventConfig[event];
    if (!config) {
      console.log(`[Finalization] Unknown event: ${event}`);
      return;
    }

    // Create notifications for all participants
    for (const userId of userIds) {
      await db.notification.create({
        data: {
          userId,
          sport: tournament.sport,
          type: config.type as any,
          title: config.title,
          message: config.getMessage(tournament.name),
          link: `/${tournament.sport.toLowerCase()}/tournaments/${tournamentId}`
        }
      });
    }

    console.log(`[Finalization] Tournament ${tournamentId}: ${event} - Notified ${userIds.size} participants`);
  } catch (error) {
    console.error(`[Finalization] Error sending notifications for ${tournamentId}:`, error);
  }
}

async function sendDisputeNotifications(
  tournamentId: string,
  disputeId: string,
  event: string
): Promise<void> {
  try {
    // Get dispute and tournament details
    const dispute = await db.tournamentDispute.findUnique({
      where: { id: disputeId },
      include: {
        tournament: {
          select: { name: true, sport: true }
        },
        raisedBy: {
          select: { firstName: true }
        }
      }
    });

    if (!dispute) return;

    // Map event to notification type and message
    const eventConfig: Record<string, { type: string; title: string; getMessage: (dispute: any) => string }> = {
      RAISED: {
        type: 'DISPUTE_RAISED',
        title: 'Dispute Raised',
        getMessage: (d) => `A dispute has been raised for ${d.tournament.name}: "${d.reason?.substring(0, 100) || 'No reason provided'}"`
      },
      RESOLVED: {
        type: 'DISPUTE_RESOLVED_NOTIFICATION',
        title: 'Dispute Resolved',
        getMessage: (d) => `Your dispute for ${d.tournament.name} has been resolved.`
      }
    };

    const config = eventConfig[event];
    if (!config) {
      console.log(`[Dispute] Unknown event: ${event}`);
      return;
    }

    // Notify the person who raised the dispute
    await db.notification.create({
      data: {
        userId: dispute.raisedById,
        sport: dispute.tournament.sport,
        type: config.type as any,
        title: config.title,
        message: config.getMessage(dispute),
        link: `/${dispute.tournament.sport.toLowerCase()}/tournaments/${tournamentId}`
      }
    });

    console.log(`[Dispute] Tournament ${tournamentId}, Dispute ${disputeId}: ${event} - Notified user ${dispute.raisedById}`);
  } catch (error) {
    console.error(`[Dispute] Error sending notifications for dispute ${disputeId}:`, error);
  }
}

// ============================================
// EXPORTS
// ============================================

export const ResultFinalizationService = {
  startWindow: startFinalizationWindow,
  getStatus: getFinalizationStatus,
  processWindows: processFinalizationWindows,
  raiseDispute,
  resolveDispute,
  getDisputes: getTournamentDisputes,
  lockResults: lockTournamentResults,
  unlockResults,
  isLocked: areResultsLocked
};
