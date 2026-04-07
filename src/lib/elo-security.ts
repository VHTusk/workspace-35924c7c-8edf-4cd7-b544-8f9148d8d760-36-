/**
 * VALORHIVE ELO Security & Anti-Manipulation System
 * 
 * Security features:
 * 1. Daily ELO Growth Cap - Prevents rapid rating manipulation
 * 2. Team ELO Weighted Algorithm - Prevents sandbagging in team tournaments
 * 3. Match Result Immutability - Auto-locks results after 72 hours
 */

import { db } from './db';

// ============================================
// Configuration
// ============================================

/** Maximum ELO gain per day (prevents rapid grinding/manipulation) */
const DAILY_ELO_GAIN_CAP = 100;

/** Maximum ELO gain per hour (prevents burst manipulation) */
const HOURLY_ELO_GAIN_CAP = 50;

/** Hours after which match results become immutable (locked) */
const RESULT_LOCK_HOURS = 72;

/** Minimum ELO (floor, cannot go below) */
const MIN_ELO = 100;

/** Maximum ELO (ceiling, cannot exceed) */
const MAX_ELO = 3000;

// ============================================
// Daily ELO Growth Cap
// ============================================

interface EloCapResult {
  allowed: boolean;
  currentGain: number;
  dailyCap: number;
  hourlyCap: number;
  remainingDaily: number;
  remainingHourly: number;
  cappedGain?: number;
}

/**
 * Check and apply daily ELO growth cap
 * Prevents a user from gaining more than the cap in a 24-hour period
 * 
 * @param userId - User whose ELO is being updated
 * @param proposedGain - The proposed ELO gain (positive number)
 * @returns Result indicating if the gain is allowed or should be capped
 */
export async function checkDailyEloCap(
  userId: string,
  proposedGain: number
): Promise<EloCapResult> {
  try {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    // Get user's current ELO
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { hiddenElo: true },
    });

    if (!user) {
      return {
        allowed: false,
        currentGain: 0,
        dailyCap: DAILY_ELO_GAIN_CAP,
        hourlyCap: HOURLY_ELO_GAIN_CAP,
        remainingDaily: DAILY_ELO_GAIN_CAP,
        remainingHourly: HOURLY_ELO_GAIN_CAP,
      };
    }

    // Get all ELO gains today from matches
    const todayMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
        winnerId: userId,
        playedAt: { gte: dayStart },
      },
      select: {
        eloChangeA: true,
        eloChangeB: true,
        playerAId: true,
        playedAt: true,
      },
    });

    // Calculate today's gains
    let dailyGain = 0;
    let hourlyGain = 0;

    for (const match of todayMatches) {
      const eloChange = match.playerAId === userId 
        ? (match.eloChangeA || 0) 
        : (match.eloChangeB || 0);

      if (eloChange > 0) {
        dailyGain += eloChange;

        // Check if match was in current hour
        if (match.playedAt >= hourStart) {
          hourlyGain += eloChange;
        }
      }
    }

    const remainingDaily = Math.max(0, DAILY_ELO_GAIN_CAP - dailyGain);
    const remainingHourly = Math.max(0, HOURLY_ELO_GAIN_CAP - hourlyGain);

    // Check if proposed gain exceeds caps
    const wouldExceedDaily = dailyGain + proposedGain > DAILY_ELO_GAIN_CAP;
    const wouldExceedHourly = hourlyGain + proposedGain > HOURLY_ELO_GAIN_CAP;

    if (wouldExceedDaily || wouldExceedHourly) {
      // Cap to the lower remaining amount
      const cappedGain = Math.min(remainingDaily, remainingHourly);

      return {
        allowed: true, // Still allowed but capped
        currentGain: dailyGain,
        dailyCap: DAILY_ELO_GAIN_CAP,
        hourlyCap: HOURLY_ELO_GAIN_CAP,
        remainingDaily,
        remainingHourly,
        cappedGain: Math.max(0, cappedGain),
      };
    }

    return {
      allowed: true,
      currentGain: dailyGain,
      dailyCap: DAILY_ELO_GAIN_CAP,
      hourlyCap: HOURLY_ELO_GAIN_CAP,
      remainingDaily,
      remainingHourly,
    };
  } catch (error) {
    console.error('[EloSecurity] Error checking daily cap:', error);
    // Fail open but log
    return {
      allowed: true,
      currentGain: 0,
      dailyCap: DAILY_ELO_GAIN_CAP,
      hourlyCap: HOURLY_ELO_GAIN_CAP,
      remainingDaily: DAILY_ELO_GAIN_CAP,
      remainingHourly: HOURLY_ELO_GAIN_CAP,
    };
  }
}

/**
 * Apply ELO change with daily cap enforcement
 * Returns the actual ELO change that should be applied
 */
export async function applyEloWithCap(
  userId: string,
  proposedGain: number
): Promise<number> {
  if (proposedGain <= 0) {
    return proposedGain; // Losses are not capped
  }

  const capResult = await checkDailyEloCap(userId, proposedGain);

  if (capResult.cappedGain !== undefined) {
    console.log(
      `[EloSecurity] ELO gain capped for user ${userId}: ${proposedGain} -> ${capResult.cappedGain}`
    );
    return capResult.cappedGain;
  }

  return proposedGain;
}

// ============================================
// Team ELO Weighted Algorithm
// ============================================

/**
 * Calculate weighted team ELO for doubles/team tournaments
 * 
 * WEIGHTED ALGORITHM (prevents sandbagging):
 * - Higher-rated players contribute MORE to team ELO
 * - This prevents teams from "hiding" strong players behind weak ones
 * - Formula: WeightedELO = Σ(playerELO * weight) / Σ(weights)
 * - Where weight = (playerELO - 1000) / 500 + 0.5 (min 0.5, max 2.0)
 * 
 * Example:
 * - Player A (ELO 2000): weight = (2000-1000)/500 + 0.5 = 2.5 → capped at 2.0
 * - Player B (ELO 1200): weight = (1200-1000)/500 + 0.5 = 0.9
 * - Team ELO = (2000 * 2.0 + 1200 * 0.9) / (2.0 + 0.9) = 1696.55
 * 
 * This is HIGHER than simple average (1600), preventing sandbagging
 */
export function calculateWeightedTeamElo(playerElos: number[]): number {
  if (playerElos.length === 0) return 1000;
  if (playerElos.length === 1) return playerElos[0];

  let weightedSum = 0;
  let weightSum = 0;

  for (const elo of playerElos) {
    // Weight formula: higher ELO = higher weight
    // Base weight 0.5, scales up for higher ELOs
    const weight = Math.max(0.5, Math.min(2.0, (elo - 1000) / 500 + 0.5));
    weightedSum += elo * weight;
    weightSum += weight;
  }

  return Math.round(weightedSum / weightSum);
}

/**
 * Calculate simple average ELO (for comparison/logging)
 */
export function calculateAverageTeamElo(playerElos: number[]): number {
  if (playerElos.length === 0) return 1000;
  return Math.round(playerElos.reduce((a, b) => a + b, 0) / playerElos.length);
}

/**
 * Get team ELO with weighted algorithm
 * Fetches ELOs from database for team members
 */
export async function getWeightedTeamElo(teamId: string): Promise<number> {
  try {
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { hiddenElo: true },
        },
      },
    });

    const elos = teamMembers.map((m) => m.user.hiddenElo);
    return calculateWeightedTeamElo(elos);
  } catch (error) {
    console.error('[EloSecurity] Error getting weighted team ELO:', error);
    return 1000; // Default ELO
  }
}

/**
 * Update team ELO using weighted algorithm
 * Should be called when team members change or ELOs update
 */
export async function updateTeamWeightedElo(teamId: string): Promise<number> {
  try {
    const weightedElo = await getWeightedTeamElo(teamId);

    await db.team.update({
      where: { id: teamId },
      data: { teamElo: weightedElo },
    });

    return weightedElo;
  } catch (error) {
    console.error('[EloSecurity] Error updating team weighted ELO:', error);
    throw error;
  }
}

// ============================================
// Match Result Immutability
// ============================================

/**
 * Check if a match result is locked (immutable)
 * Results become locked after RESULT_LOCK_HOURS hours
 */
export async function isMatchResultLocked(matchId: string): Promise<{
  locked: boolean;
  lockedAt?: Date;
  reason?: string;
}> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        playedAt: true,
        updatedAt: true,
        outcome: true,
      },
    });

    if (!match) {
      return { locked: true, reason: 'Match not found' };
    }

    // Check for special outcomes that are always locked
    if (match.outcome === 'WALKOVER' || match.outcome === 'FORFEIT' || match.outcome === 'BYE') {
      return { locked: true, reason: 'Special outcome matches are always locked' };
    }

    // Check time since match
    const lockTime = new Date(match.playedAt);
    lockTime.setHours(lockTime.getHours() + RESULT_LOCK_HOURS);

    if (new Date() >= lockTime) {
      return {
        locked: true,
        lockedAt: lockTime,
        reason: `Match result locked after ${RESULT_LOCK_HOURS} hours`,
      };
    }

    return { locked: false };
  } catch (error) {
    console.error('[EloSecurity] Error checking match lock status:', error);
    // Fail closed - lock on error for safety
    return { locked: true, reason: 'Error checking lock status' };
  }
}

/**
 * Check if a user can edit a match result
 * Only admins can override locked results
 */
export async function canEditMatchResult(
  matchId: string,
  isAdmin: boolean
): Promise<{
  canEdit: boolean;
  reason?: string;
}> {
  const lockStatus = await isMatchResultLocked(matchId);

  if (!lockStatus.locked) {
    return { canEdit: true };
  }

  if (isAdmin) {
    return {
      canEdit: true,
      reason: 'Admin override for locked result',
    };
  }

  return {
    canEdit: false,
    reason: lockStatus.reason,
  };
}

// ============================================
// ELO Boundaries
// ============================================

/**
 * Ensure ELO stays within bounds
 */
export function clampElo(elo: number): number {
  return Math.max(MIN_ELO, Math.min(MAX_ELO, elo));
}

/**
 * Check if ELO change is suspicious (potential manipulation)
 */
export function isSuspiciousEloChange(
  oldElo: number,
  newElo: number,
  matchCount: number
): { suspicious: boolean; reason?: string } {
  const change = Math.abs(newElo - oldElo);
  const changePercent = change / oldElo;

  // Single match should not change ELO by more than 50
  if (change > 50 && matchCount === 1) {
    return {
      suspicious: true,
      reason: `Single match ELO change of ${change} exceeds threshold of 50`,
    };
  }

  // Rapid rise from low ELO
  if (oldElo < 1200 && newElo > 1500 && matchCount < 10) {
    return {
      suspicious: true,
      reason: `Rapid ELO rise from ${oldElo} to ${newElo} in only ${matchCount} matches`,
    };
  }

  return { suspicious: false };
}

// ============================================
// Exports
// ============================================

export const ELO_SECURITY_CONFIG = {
  DAILY_ELO_GAIN_CAP,
  HOURLY_ELO_GAIN_CAP,
  RESULT_LOCK_HOURS,
  MIN_ELO,
  MAX_ELO,
};
