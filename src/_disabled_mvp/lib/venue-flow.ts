/**
 * VALORHIVE Venue Flow Service (v3.47.0)
 * 
 * Automates real-time match movement inside a physical tournament environment.
 * 
 * Features:
 * - Match Check-In System
 * - No-Show Detection
 * - Smart Court Assignment
 * - Dynamic Scheduling
 * - Health Monitoring
 * - Manual Override Support
 * 
 * Safety Requirements:
 * - Never auto-forfeit without human confirmation
 * - Never bypass tournament rules
 * - All overrides must be logged with reason
 */

import { db } from './db';
import { 
  CheckInStatus, 
  CourtStatus, 
  MatchReadiness, 
  VenueFlowAction,
  SportType,
  TournamentStatus,
  BracketMatchStatus,
} from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface CheckInResult {
  success: boolean;
  checkIn?: {
    id: string;
    matchId: string;
    playerId: string;
    status: CheckInStatus;
    checkedInAt?: Date;
  };
  matchReadiness?: MatchReadiness;
  message: string;
}

export interface CourtAssignmentResult {
  success: boolean;
  assignment?: {
    courtId: string;
    courtName: string;
    matchId: string;
    assignedAt: Date;
  };
  message: string;
}

export interface NoShowDetectionResult {
  success: boolean;
  noShows: Array<{
    matchId: string;
    playerId: string;
    detectedAt: Date;
    gracePeriodEnds: Date;
  }>;
  message: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    courtId?: string;
    matchId?: string;
  }>;
}

// ============================================
// 1. MATCH CHECK-IN SYSTEM
// ============================================

/**
 * Player checks in for a match
 */
export async function playerCheckIn(
  matchId: string,
  playerId: string,
  courtId?: string
): Promise<CheckInResult> {
  try {
    // Get match details
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          include: { venueFlowConfig: true },
        },
      },
    });

    if (!match) {
      return { success: false, message: 'Match not found' };
    }

    // Verify player is part of this match
    if (match.playerAId !== playerId && match.playerBId !== playerId) {
      return { success: false, message: 'Player is not in this match' };
    }

    // Check if already checked in
    const existingCheckIn = await db.matchCheckIn.findUnique({
      where: {
        matchId_playerId: { matchId, playerId },
      },
    });

    if (existingCheckIn && existingCheckIn.status === CheckInStatus.CHECKED_IN) {
      return {
        success: true,
        checkIn: existingCheckIn,
        matchReadiness: await getMatchReadiness(matchId),
        message: 'Already checked in',
      };
    }

    // Create or update check-in
    const config = match.tournament.venueFlowConfig;
    const graceMinutes = config?.noShowGraceMinutes || 15;

    const checkIn = await db.matchCheckIn.upsert({
      where: {
        matchId_playerId: { matchId, playerId },
      },
      create: {
        matchId,
        playerId,
        courtId,
        status: CheckInStatus.CHECKED_IN,
        checkedInAt: new Date(),
        gracePeriodEnds: new Date(Date.now() + graceMinutes * 60 * 1000),
        source: 'PLAYER',
      },
      update: {
        status: CheckInStatus.CHECKED_IN,
        checkedInAt: new Date(),
        courtId,
      },
    });

    // Log the check-in
    await logVenueFlowAction({
      tournamentId: match.tournamentId!,
      matchId,
      playerId,
      action: VenueFlowAction.PLAYER_CHECKIN,
      newState: JSON.stringify({ status: CheckInStatus.CHECKED_IN }),
      performedBy: playerId,
      performedByRole: 'PLAYER',
    });

    // Get updated match readiness
    const readiness = await getMatchReadiness(matchId);

    // If both players checked in, queue for court assignment
    if (readiness === MatchReadiness.READY) {
      await queueMatchForAssignment(matchId, match.tournamentId!);
    }

    // Notify opponent if configured
    if (config?.notifyPlayerReady) {
      await notifyOpponentReady(matchId, playerId);
    }

    return {
      success: true,
      checkIn,
      matchReadiness: readiness,
      message: 'Check-in successful',
    };
  } catch (error) {
    console.error('Error checking in:', error);
    return { success: false, message: 'Failed to check in' };
  }
}

/**
 * Admin/Director manually checks in a player (override)
 */
export async function adminCheckInOverride(
  matchId: string,
  playerId: string,
  adminId: string,
  reason: string
): Promise<CheckInResult> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match) {
      return { success: false, message: 'Match not found' };
    }

    const checkIn = await db.matchCheckIn.upsert({
      where: {
        matchId_playerId: { matchId, playerId },
      },
      create: {
        matchId,
        playerId,
        status: CheckInStatus.CHECKED_IN,
        checkedInAt: new Date(),
        source: 'ADMIN',
      },
      update: {
        status: CheckInStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    // Log override
    await logVenueFlowAction({
      tournamentId: match.tournamentId!,
      matchId,
      playerId,
      action: VenueFlowAction.PLAYER_CHECKIN,
      newState: JSON.stringify({ status: CheckInStatus.CHECKED_IN }),
      performedBy: adminId,
      performedByRole: 'ADMIN',
      isOverride: true,
      overrideReason: reason,
    });

    return {
      success: true,
      checkIn,
      matchReadiness: await getMatchReadiness(matchId),
      message: 'Check-in override successful',
    };
  } catch (error) {
    console.error('Error in admin check-in override:', error);
    return { success: false, message: 'Failed to override check-in' };
  }
}

/**
 * Get match readiness status
 */
export async function getMatchReadiness(matchId: string): Promise<MatchReadiness> {
  const checkIns = await db.matchCheckIn.findMany({
    where: { matchId },
  });

  const checkedInCount = checkIns.filter(
    (c) => c.status === CheckInStatus.CHECKED_IN || c.status === CheckInStatus.EXTENDED
  ).length;

  if (checkedInCount === 0) return MatchReadiness.NOT_READY;
  if (checkedInCount === 1) return MatchReadiness.PARTIAL_READY;
  
  // Check if already assigned to court
  const assignment = await db.courtAssignment.findFirst({
    where: { matchId, releasedAt: null },
  });

  if (assignment) return MatchReadiness.ASSIGNED;

  return MatchReadiness.READY;
}

// ============================================
// 2. NO-SHOW DETECTION
// ============================================

/**
 * Process potential no-shows
 * Called by cron job or after check-in grace period
 * 
 * IMPORTANT: System never auto-disqualifies - only flags for human review
 */
export async function processNoShowDetection(): Promise<NoShowDetectionResult> {
  const result: NoShowDetectionResult = {
    success: true,
    noShows: [],
    message: 'No-show detection complete',
  };

  try {
    const now = new Date();

    // Find check-ins past grace period that haven't checked in
    const potentialNoShows = await db.matchCheckIn.findMany({
      where: {
        status: CheckInStatus.NOT_CHECKED_IN,
        gracePeriodEnds: { lt: now },
        noShowDetectedAt: null,
      },
      include: {
        match: {
          include: {
            tournament: {
              include: { venueFlowConfig: true },
            },
          },
        },
      },
    });

    for (const checkIn of potentialNoShows) {
      // Only flag if auto-detection is enabled OR always notify
      const config = checkIn.match.tournament.venueFlowConfig;
      
      // Mark as no-show detected
      await db.matchCheckIn.update({
        where: { id: checkIn.id },
        data: {
          status: CheckInStatus.NO_SHOW_DETECTED,
          noShowDetectedAt: now,
        },
      });

      // Log the detection
      await logVenueFlowAction({
        tournamentId: checkIn.match.tournamentId!,
        matchId: checkIn.matchId,
        playerId: checkIn.playerId,
        action: VenueFlowAction.NO_SHOW_DETECTED,
        newState: JSON.stringify({ status: CheckInStatus.NO_SHOW_DETECTED }),
        performedBy: null,
        performedByRole: 'SYSTEM',
      });

      // Create health alert
      await createHealthAlert({
        tournamentId: checkIn.match.tournamentId!,
        alertType: 'NO_SHOW_PENDING',
        severity: 'WARNING',
        message: `Player ${checkIn.playerId} has not checked in for match ${checkIn.matchId}`,
        matchId: checkIn.matchId,
      });

      // Notify director
      await notifyDirectorNoShow(checkIn.match.tournamentId!, checkIn.matchId, checkIn.playerId);

      result.noShows.push({
        matchId: checkIn.matchId,
        playerId: checkIn.playerId,
        detectedAt: now,
        gracePeriodEnds: checkIn.gracePeriodEnds!,
      });
    }

    return result;
  } catch (error) {
    console.error('Error in no-show detection:', error);
    return { success: false, noShows: [], message: 'Failed to detect no-shows' };
  }
}

/**
 * Director confirms no-show
 */
export async function confirmNoShow(
  matchId: string,
  playerId: string,
  directorId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match) {
      return { success: false, message: 'Match not found' };
    }

    // Update check-in status
    await db.matchCheckIn.update({
      where: {
        matchId_playerId: { matchId, playerId },
      },
      data: {
        status: CheckInStatus.NO_SHOW_CONFIRMED,
        noShowConfirmedAt: new Date(),
        noShowConfirmedBy: directorId,
      },
    });

    // Log the confirmation
    await logVenueFlowAction({
      tournamentId: match.tournamentId!,
      matchId,
      playerId,
      action: VenueFlowAction.NO_SHOW_CONFIRMED,
      reason,
      performedBy: directorId,
      performedByRole: 'DIRECTOR',
    });

    // Handle the match result (walkover for opponent)
    // Get opponent
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;

    if (opponentId) {
      // Update match result
      await db.match.update({
        where: { id: matchId },
        data: {
          outcome: 'NO_SHOW',
          winnerId: opponentId,
        },
      });

      // Update bracket match if exists
      await db.bracketMatch.updateMany({
        where: { matchId },
        data: {
          status: BracketMatchStatus.COMPLETED,
          winnerId: opponentId,
        },
      });
    }

    return { success: true, message: 'No-show confirmed. Match awarded to opponent.' };
  } catch (error) {
    console.error('Error confirming no-show:', error);
    return { success: false, message: 'Failed to confirm no-show' };
  }
}

/**
 * Director grants extension to player
 */
export async function grantExtension(
  matchId: string,
  playerId: string,
  directorId: string,
  extensionMinutes: number,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const checkIn = await db.matchCheckIn.findUnique({
      where: {
        matchId_playerId: { matchId, playerId },
      },
    });

    if (!checkIn) {
      return { success: false, message: 'Check-in record not found' };
    }

    // Update check-in with extension
    await db.matchCheckIn.update({
      where: { id: checkIn.id },
      data: {
        status: CheckInStatus.EXTENDED,
        extensionCount: { increment: 1 },
        extendedById: directorId,
        gracePeriodEnds: new Date(Date.now() + extensionMinutes * 60 * 1000),
      },
    });

    // Log the extension
    await logVenueFlowAction({
      tournamentId: checkIn.matchId, // Will be updated below
      matchId,
      playerId,
      action: VenueFlowAction.EXTENSION_GRANTED,
      reason,
      newState: JSON.stringify({ extensionMinutes }),
      performedBy: directorId,
      performedByRole: 'DIRECTOR',
    });

    return {
      success: true,
      message: `Extension granted for ${extensionMinutes} minutes`,
    };
  } catch (error) {
    console.error('Error granting extension:', error);
    return { success: false, message: 'Failed to grant extension' };
  }
}

// ============================================
// 3. SMART COURT ASSIGNMENT
// ============================================

/**
 * Get available courts for a tournament
 */
export async function getAvailableCourts(tournamentId: string) {
  return db.court.findMany({
    where: {
      tournamentId,
      status: CourtStatus.AVAILABLE,
    },
    orderBy: [
      { isPriority: 'desc' },
      { matchesHosted: 'asc' }, // Prefer courts with less usage
    ],
  });
}

/**
 * Auto-assign match to available court
 */
export async function autoAssignCourt(matchId: string): Promise<CourtAssignmentResult> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          include: { venueFlowConfig: true },
        },
      },
    });

    if (!match || !match.tournamentId) {
      return { success: false, message: 'Match not found' };
    }

    // Check if auto-assignment is enabled
    const config = match.tournament.venueFlowConfig;
    if (config && !config.autoCourtAssign) {
      return { success: false, message: 'Auto court assignment is disabled' };
    }

    // Check match readiness
    const readiness = await getMatchReadiness(matchId);
    if (readiness !== MatchReadiness.READY) {
      return { success: false, message: 'Match is not ready (both players must check in)' };
    }

    // Get available courts
    const availableCourts = await getAvailableCourts(match.tournamentId);

    if (availableCourts.length === 0) {
      return { success: false, message: 'No available courts' };
    }

    // Select best court (first available, preferring priority for seed matches)
    const court = availableCourts[0];

    // Create assignment
    const assignment = await db.courtAssignment.create({
      data: {
        courtId: court.id,
        matchId,
        isAutoAssigned: true,
      },
    });

    // Update court status
    await db.court.update({
      where: { id: court.id },
      data: {
        status: CourtStatus.OCCUPIED,
        currentMatchId: matchId,
        assignedAt: new Date(),
      },
    });

    // Update match queue
    await db.matchQueue.updateMany({
      where: { matchId },
      data: {
        status: 'ASSIGNED',
        assignedCourtId: court.id,
        assignedAt: new Date(),
      },
    });

    // Log the assignment
    await logVenueFlowAction({
      tournamentId: match.tournamentId,
      courtId: court.id,
      matchId,
      action: VenueFlowAction.COURT_ASSIGNED,
      newState: JSON.stringify({ courtId: court.id, courtName: court.name }),
      performedBy: null,
      performedByRole: 'SYSTEM',
    });

    return {
      success: true,
      assignment: {
        courtId: court.id,
        courtName: court.name,
        matchId,
        assignedAt: assignment.assignedAt,
      },
      message: `Assigned to ${court.name}`,
    };
  } catch (error) {
    console.error('Error assigning court:', error);
    return { success: false, message: 'Failed to assign court' };
  }
}

/**
 * Manual court reassignment (override)
 */
export async function reassignCourt(
  matchId: string,
  newCourtId: string,
  adminId: string,
  reason: string
): Promise<CourtAssignmentResult> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match || !match.tournamentId) {
      return { success: false, message: 'Match not found' };
    }

    // Get current assignment
    const currentAssignment = await db.courtAssignment.findFirst({
      where: { matchId, releasedAt: null },
      include: { court: true },
    });

    // Get new court
    const newCourt = await db.court.findUnique({
      where: { id: newCourtId },
    });

    if (!newCourt) {
      return { success: false, message: 'Court not found' };
    }

    // Release old court if exists
    if (currentAssignment) {
      await db.courtAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          releasedAt: new Date(),
          releasedBy: adminId,
          releaseReason: reason,
        },
      });

      await db.court.update({
        where: { id: currentAssignment.courtId },
        data: {
          status: CourtStatus.AVAILABLE,
          currentMatchId: null,
        },
      });
    }

    // Create new assignment
    const assignment = await db.courtAssignment.create({
      data: {
        courtId: newCourtId,
        matchId,
        isAutoAssigned: false,
        assignedBy: adminId,
      },
    });

    // Update new court
    await db.court.update({
      where: { id: newCourtId },
      data: {
        status: CourtStatus.OCCUPIED,
        currentMatchId: matchId,
        assignedAt: new Date(),
      },
    });

    // Log the reassignment
    await logVenueFlowAction({
      tournamentId: match.tournamentId,
      courtId: newCourtId,
      matchId,
      action: VenueFlowAction.COURT_REASSIGNED,
      oldState: JSON.stringify({ oldCourtId: currentAssignment?.courtId }),
      newState: JSON.stringify({ newCourtId }),
      reason,
      performedBy: adminId,
      performedByRole: 'ADMIN',
      isOverride: true,
      overrideReason: reason,
    });

    return {
      success: true,
      assignment: {
        courtId: newCourtId,
        courtName: newCourt.name,
        matchId,
        assignedAt: assignment.assignedAt,
      },
      message: `Reassigned to ${newCourt.name}`,
    };
  } catch (error) {
    console.error('Error reassigning court:', error);
    return { success: false, message: 'Failed to reassign court' };
  }
}

/**
 * Release court after match completion
 */
export async function releaseCourt(matchId: string): Promise<{ success: boolean; message: string }> {
  try {
    const assignment = await db.courtAssignment.findFirst({
      where: { matchId, releasedAt: null },
      include: { court: true },
    });

    if (!assignment) {
      return { success: false, message: 'No active court assignment' };
    }

    // Update assignment
    await db.courtAssignment.update({
      where: { id: assignment.id },
      data: {
        releasedAt: new Date(),
        matchEndedAt: new Date(),
      },
    });

    // Update court
    await db.court.update({
      where: { id: assignment.courtId },
      data: {
        status: CourtStatus.AVAILABLE,
        currentMatchId: null,
        matchesHosted: { increment: 1 },
      },
    });

    // Log the release
    await logVenueFlowAction({
      tournamentId: assignment.match.tournamentId!,
      courtId: assignment.courtId,
      matchId,
      action: VenueFlowAction.COURT_RELEASED,
      performedBy: null,
      performedByRole: 'SYSTEM',
    });

    // Trigger next match assignment
    await processDynamicScheduling(assignment.match.tournamentId!);

    return { success: true, message: 'Court released' };
  } catch (error) {
    console.error('Error releasing court:', error);
    return { success: false, message: 'Failed to release court' };
  }
}

// ============================================
// 4. DYNAMIC SCHEDULING
// ============================================

/**
 * Queue a match for court assignment
 */
export async function queueMatchForAssignment(
  matchId: string,
  tournamentId: string
): Promise<void> {
  // Check if already queued
  const existing = await db.matchQueue.findUnique({
    where: { matchId },
  });

  if (existing) {
    // Update readiness
    await db.matchQueue.update({
      where: { matchId },
      data: {
        readiness: MatchReadiness.READY,
        readyAt: new Date(),
      },
    });
    return;
  }

  // Get next position
  const maxPosition = await db.matchQueue.aggregate({
    where: { tournamentId },
    _max: { position: true },
  });

  const position = (maxPosition._max.position || 0) + 1;

  // Create queue entry
  await db.matchQueue.create({
    data: {
      tournamentId,
      matchId,
      position,
      readiness: MatchReadiness.READY,
      readyAt: new Date(),
    },
  });

  // Log the queue
  await logVenueFlowAction({
    tournamentId,
    matchId,
    action: VenueFlowAction.MATCH_QUEUED,
    newState: JSON.stringify({ position }),
    performedBy: null,
    performedByRole: 'SYSTEM',
  });
}

/**
 * Process dynamic scheduling
 * Assigns ready matches to available courts
 */
export async function processDynamicScheduling(tournamentId: string): Promise<{
  assigned: number;
  queued: number;
  errors: string[];
}> {
  const result = {
    assigned: 0,
    queued: 0,
    errors: [] as string[],
  };

  try {
    const config = await db.venueFlowConfig.findUnique({
      where: { tournamentId },
    });

    // Check if dynamic scheduling is enabled
    if (config && !config.dynamicScheduling) {
      return result;
    }

    // Get ready matches waiting for court
    const readyMatches = await db.matchQueue.findMany({
      where: {
        tournamentId,
        readiness: MatchReadiness.READY,
        status: 'QUEUED',
      },
      orderBy: [
        { priority: 'desc' },
        { position: 'asc' },
      ],
      take: config?.maxQueueSize || 10,
    });

    // Get available courts
    const availableCourts = await getAvailableCourts(tournamentId);

    // Assign matches to courts
    for (let i = 0; i < Math.min(readyMatches.length, availableCourts.length); i++) {
      const queueEntry = readyMatches[i];
      const court = availableCourts[i];

      const assignmentResult = await autoAssignCourt(queueEntry.matchId);
      if (assignmentResult.success) {
        result.assigned++;
      } else {
        result.errors.push(`Failed to assign match ${queueEntry.matchId}: ${assignmentResult.message}`);
      }
    }

    result.queued = readyMatches.length - result.assigned;

    return result;
  } catch (error) {
    result.errors.push(`Dynamic scheduling error: ${error}`);
    return result;
  }
}

// ============================================
// 5. HEALTH MONITORING
// ============================================

/**
 * Check venue health and create alerts
 */
export async function checkVenueHealth(tournamentId: string): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: true,
    alerts: [],
  };

  try {
    const config = await db.venueFlowConfig.findUnique({
      where: { tournamentId },
    });

    const idleThreshold = config?.idleCourtAlertMinutes || 5;

    // Check for idle courts
    const courts = await db.court.findMany({
      where: { tournamentId },
    });

    const now = new Date();
    for (const court of courts) {
      if (court.status === CourtStatus.AVAILABLE && court.assignedAt) {
        const idleMinutes = (now.getTime() - court.assignedAt.getTime()) / (1000 * 60);
        if (idleMinutes >= idleThreshold) {
          result.healthy = false;
          result.alerts.push({
            type: 'IDLE_COURT',
            severity: 'WARNING',
            message: `Court ${court.name} has been idle for ${Math.round(idleMinutes)} minutes`,
            courtId: court.id,
          });
        }
      }
    }

    // Check for ready matches not assigned
    const readyMatches = await db.matchQueue.findMany({
      where: {
        tournamentId,
        readiness: MatchReadiness.READY,
        status: 'QUEUED',
      },
    });

    if (readyMatches.length > 0 && courts.filter((c) => c.status === CourtStatus.AVAILABLE).length > 0) {
      result.healthy = false;
      result.alerts.push({
        type: 'UNASSIGNED_READY_MATCH',
        severity: 'WARNING',
        message: `${readyMatches.length} ready matches waiting for court assignment`,
      });
    }

    // Check for pending no-shows
    const pendingNoShows = await db.matchCheckIn.findMany({
      where: {
        status: CheckInStatus.NO_SHOW_DETECTED,
        noShowConfirmedAt: null,
      },
    });

    if (pendingNoShows.length > 0) {
      result.healthy = false;
      result.alerts.push({
        type: 'NO_SHOW_PENDING',
        severity: 'CRITICAL',
        message: `${pendingNoShows.length} no-shows pending director confirmation`,
      });
    }

    // Create alerts in database for unresolved issues
    for (const alert of result.alerts) {
      await createHealthAlert({
        tournamentId,
        alertType: alert.type,
        severity: alert.severity,
        message: alert.message,
        courtId: alert.courtId,
        matchId: alert.matchId,
      });
    }

    return result;
  } catch (error) {
    console.error('Error checking venue health:', error);
    result.alerts.push({
      type: 'SYSTEM_ERROR',
      severity: 'CRITICAL',
      message: `Health check failed: ${error}`,
    });
    result.healthy = false;
    return result;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Log venue flow action
 */
async function logVenueFlowAction(data: {
  tournamentId: string;
  courtId?: string;
  matchId?: string;
  playerId?: string;
  action: VenueFlowAction;
  oldState?: string;
  newState?: string;
  reason?: string;
  performedBy: string | null;
  performedByRole: string;
  isOverride?: boolean;
  overrideReason?: string;
}): Promise<void> {
  try {
    await db.venueFlowLog.create({
      data: {
        tournamentId: data.tournamentId,
        courtId: data.courtId,
        matchId: data.matchId,
        playerId: data.playerId,
        action: data.action,
        oldState: data.oldState,
        newState: data.newState,
        reason: data.reason,
        performedBy: data.performedBy,
        performedByRole: data.performedByRole,
        isOverride: data.isOverride || false,
        overrideReason: data.overrideReason,
      },
    });
  } catch (error) {
    console.error('Error logging venue flow action:', error);
  }
}

/**
 * Create health alert
 */
async function createHealthAlert(data: {
  tournamentId: string;
  alertType: string;
  severity: string;
  message: string;
  courtId?: string;
  matchId?: string;
}): Promise<void> {
  try {
    await db.venueHealthAlert.create({
      data: {
        tournamentId: data.tournamentId,
        courtId: data.courtId,
        alertType: data.alertType,
        severity: data.severity,
        message: data.message,
      },
    });
  } catch (error) {
    console.error('Error creating health alert:', error);
  }
}

/**
 * Notify opponent that player is ready
 */
async function notifyOpponentReady(matchId: string, playerId: string): Promise<void> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match) return;

    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    if (!opponentId) return;

    await db.notification.create({
      data: {
        userId: opponentId,
        sport: match.tournament?.sport || SportType.CORNHOLE,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Opponent Ready',
        message: 'Your opponent has checked in. Head to the venue!',
        link: `/${match.tournament?.sport.toLowerCase()}/tournaments/${match.tournamentId}`,
      },
    });
  } catch (error) {
    console.error('Error notifying opponent:', error);
  }
}

/**
 * Notify director of no-show
 */
async function notifyDirectorNoShow(
  tournamentId: string,
  matchId: string,
  playerId: string
): Promise<void> {
  try {
    // Get tournament directors
    const staff = await db.tournamentStaff.findMany({
      where: {
        tournamentId,
        role: 'DIRECTOR',
      },
    });

    for (const director of staff) {
      await db.notification.create({
        data: {
          userId: director.userId,
          sport: SportType.CORNHOLE,
          type: 'DISPUTE_UPDATE',
          title: 'No-Show Detected',
          message: `Player ${playerId} has not checked in for match ${matchId}. Please review.`,
          link: `/admin/tournaments/${tournamentId}/matches/${matchId}`,
        },
      });
    }
  } catch (error) {
    console.error('Error notifying director:', error);
  }
}

// ============================================
// CRON PROCESSOR
// ============================================

/**
 * Run all venue flow processors
 * Called by cron job every minute
 */
export async function runVenueFlowProcessors(): Promise<{
  noShowDetection: NoShowDetectionResult;
  scheduling: { assigned: number; queued: number; errors: string[] };
  health: { tournamentsChecked: number; alertsCreated: number };
}> {
  // Process no-show detection
  const noShowDetection = await processNoShowDetection();

  // Get all active tournaments
  const activeTournaments = await db.tournament.findMany({
    where: {
      status: TournamentStatus.IN_PROGRESS,
    },
    select: { id: true },
  });

  // Process dynamic scheduling for each tournament
  let totalAssigned = 0;
  let totalQueued = 0;
  const errors: string[] = [];

  for (const tournament of activeTournaments) {
    const result = await processDynamicScheduling(tournament.id);
    totalAssigned += result.assigned;
    totalQueued += result.queued;
    errors.push(...result.errors);
  }

  // Run health checks
  let alertsCreated = 0;
  for (const tournament of activeTournaments) {
    const health = await checkVenueHealth(tournament.id);
    alertsCreated += health.alerts.length;
  }

  return {
    noShowDetection,
    scheduling: {
      assigned: totalAssigned,
      queued: totalQueued,
      errors,
    },
    health: {
      tournamentsChecked: activeTournaments.length,
      alertsCreated,
    },
  };
}
