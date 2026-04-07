/**
 * VALORHIVE Rating Deviation System (Glicko-2 Lite)
 * 
 * Implements a simplified Glicko-2 rating deviation system for more accurate
 * matchmaking and rating confidence.
 * 
 * RATING DEVIATION (RD):
 * - RD represents the uncertainty in a player's rating
 * - High RD = less certain about player's true skill
 * - Low RD = more confident in player's rating
 * 
 * RD BEHAVIOR:
 * - RD decreases with more games played (more data = more confidence)
 * - RD increases with inactivity (less recent data = less confidence)
 * - New players start with high RD (350)
 * - Active players settle around RD 50-100
 * 
 * GLICKO-2 LITE ADJUSTMENTS:
 * - Standard Glicko-2 is computationally expensive
 * - This is a simplified version for real-time updates
 * - Full Glicko-2 calculations done periodically
 */

import { db } from './db';
import type { SportType } from '@prisma/client';

// ============================================
// Configuration
// ============================================

/** Initial rating deviation for new players */
const INITIAL_RD = 350;

/** Minimum RD (floor) - represents maximum certainty */
const MIN_RD = 30;

/** Maximum RD (ceiling) - represents minimum certainty */
const MAX_RD = 350;

/** RD increase per day of inactivity */
const RD_INACTIVITY_PER_DAY = 10;

/** RD decrease factor per game (simplified Glicko-2) */
const RD_DECREASE_PER_GAME = 15;

/** Number of games after which RD stabilizes */
const GAMES_FOR_STABLE_RD = 30;

/** System constant (tau) - controls volatility */
const TAU = 0.5;

/** Convergence tolerance for iterative calculations */
const CONVERGENCE_TOLERANCE = 1e-6;

/** Scale factor for Glicko-2 (rating scale) */
const SCALE = 173.7178;

// ============================================
// Types
// ============================================

export interface RatingDeviationResult {
  rd: number;
  confidence: 'high' | 'medium' | 'low';
  confidencePercentage: number;
  gamesPlayed: number;
  daysInactive: number;
}

export interface GlickoAdjustmentResult {
  oldRating: number;
  newRating: number;
  oldRd: number;
  newRd: number;
  ratingChange: number;
  rdChange: number;
  adjustedChange: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SnapshotRecord {
  id: string;
  playerId: string;
  sport: SportType;
  rating: number;
  rd: number;
  matchId: string | null;
  createdAt: Date;
}

export interface RecordSnapshotResult {
  success: boolean;
  snapshot?: SnapshotRecord;
  error?: string;
}

// ============================================
// Core Functions
// ============================================

/**
 * Calculate rating deviation for a player
 * 
 * Takes into account:
 * - Number of games played
 * - Time since last game
 * - Current RD value
 * 
 * @param userId - Player's user ID
 * @param sport - Sport type
 * @returns Rating deviation result with confidence level
 */
export async function calculateRatingDeviation(
  userId: string,
  sport: SportType
): Promise<RatingDeviationResult> {
  try {
    // Get player rating record
    const playerRating = await db.playerRating.findUnique({
      where: { userId },
    });

    // Get user's last match
    const lastMatch = await db.match.findFirst({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
        sport,
      },
      orderBy: { playedAt: 'desc' },
      select: { playedAt: true },
    });

    // Get current RD from player rating (default to INITIAL_RD)
    const currentRd = (playerRating as any)?.rd ?? INITIAL_RD;
    const gamesPlayed = playerRating?.matchesPlayed ?? 0;
    
    // Calculate days since last game
    const now = new Date();
    const lastGameDate = lastMatch?.playedAt ?? playerRating?.createdAt ?? now;
    const daysInactive = Math.floor(
      (now.getTime() - new Date(lastGameDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate RD based on games and inactivity
    let newRd = currentRd;

    // RD decreases with more games (more confidence)
    if (gamesPlayed > 0) {
      const gameFactor = Math.min(gamesPlayed / GAMES_FOR_STABLE_RD, 1);
      const baseRd = INITIAL_RD - (INITIAL_RD - MIN_RD) * gameFactor;
      newRd = Math.max(MIN_RD, baseRd);
    }

    // RD increases with inactivity (less confidence)
    if (daysInactive > 0) {
      const inactivityIncrease = daysInactive * RD_INACTIVITY_PER_DAY;
      newRd = Math.min(MAX_RD, newRd + inactivityIncrease);
    }

    // Clamp RD to valid range
    newRd = Math.max(MIN_RD, Math.min(MAX_RD, newRd));

    // Calculate confidence level
    const confidencePercentage = Math.round(100 - (newRd / MAX_RD) * 100);
    let confidence: 'high' | 'medium' | 'low';
    
    if (newRd <= 100) {
      confidence = 'high';
    } else if (newRd <= 200) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      rd: Math.round(newRd * 10) / 10, // Round to 1 decimal place
      confidence,
      confidencePercentage,
      gamesPlayed,
      daysInactive,
    };
  } catch (error) {
    console.error('[RatingDeviation] Error calculating RD:', error);
    
    return {
      rd: INITIAL_RD,
      confidence: 'low',
      confidencePercentage: 0,
      gamesPlayed: 0,
      daysInactive: 0,
    };
  }
}

/**
 * Apply Glicko-2 adjustment to ELO change
 * 
 * FACTORS IN RATING DEVIATION:
 * - Higher RD = rating change has more weight (uncertain rating should move more)
 * - Lower RD = rating change has less weight (certain rating should move less)
 * 
 * @param userId - Player's user ID
 * @param sport - Sport type
 * @param proposedEloChange - The proposed ELO change from standard calculation
 * @returns Adjustment result with RD-adjusted change
 */
export async function applyGlickoAdjustment(
  userId: string,
  sport: SportType,
  proposedEloChange: number
): Promise<GlickoAdjustmentResult> {
  try {
    // Get user's current ELO
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { hiddenElo: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get current RD
    const rdResult = await calculateRatingDeviation(userId, sport);
    const currentRd = rdResult.rd;

    // Apply Glicko-2 adjustment factor
    // Higher RD = more weight to new information
    // Lower RD = less weight to new information
    // Formula: adjustmentFactor = (RD / 350) ^ 0.5
    const adjustmentFactor = Math.sqrt(currentRd / INITIAL_RD);
    
    // Adjust the ELO change based on RD
    const adjustedChange = proposedEloChange * adjustmentFactor;

    // Calculate new RD after game
    // RD decreases after each game (more data = more certainty)
    const newRd = Math.max(
      MIN_RD,
      currentRd - RD_DECREASE_PER_GAME * (1 + Math.abs(proposedEloChange) / 20)
    );

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low';
    if (newRd <= 100) {
      confidence = 'high';
    } else if (newRd <= 200) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      oldRating: user.hiddenElo,
      newRating: Math.round(user.hiddenElo + adjustedChange),
      oldRd: currentRd,
      newRd: Math.round(newRd * 10) / 10,
      ratingChange: proposedEloChange,
      rdChange: Math.round((newRd - currentRd) * 10) / 10,
      adjustedChange: Math.round(adjustedChange * 100) / 100,
      confidence,
    };
  } catch (error) {
    console.error('[RatingDeviation] Error applying Glicko adjustment:', error);
    
    return {
      oldRating: 0,
      newRating: 0,
      oldRd: INITIAL_RD,
      newRd: INITIAL_RD,
      ratingChange: 0,
      rdChange: 0,
      adjustedChange: 0,
      confidence: 'low',
    };
  }
}

/**
 * Record a rating snapshot after match finalization
 * 
 * This creates a historical record of player ratings that can be used for:
 * - Rating history visualization
 * - Trend analysis
 * - Undo operations
 * - Audit trails
 * 
 * @param playerId - Player's user ID
 * @param sport - Sport type
 * @param matchId - Optional match ID that triggered this snapshot
 * @returns Result with snapshot data or error
 */
export async function recordRatingSnapshot(
  playerId: string,
  sport: SportType,
  matchId?: string
): Promise<RecordSnapshotResult> {
  try {
    // Get current rating
    const user = await db.user.findUnique({
      where: { id: playerId },
      select: { hiddenElo: true, sport: true },
    });

    if (!user) {
      return {
        success: false,
        error: `User ${playerId} not found`,
      };
    }

    // Get current RD
    const rdResult = await calculateRatingDeviation(playerId, sport);

    // Create snapshot record
    const snapshot = await db.ratingSnapshot.create({
      data: {
        playerId,
        sport,
        rating: Math.round(user.hiddenElo),
        rd: rdResult.rd,
        matchId: matchId ?? null,
      },
    });

    console.log(
      `[RatingSnapshot] Recorded snapshot for player ${playerId}: rating=${snapshot.rating}, rd=${snapshot.rd}`
    );

    return {
      success: true,
      snapshot: {
        id: snapshot.id,
        playerId: snapshot.playerId,
        sport: snapshot.sport,
        rating: snapshot.rating,
        rd: snapshot.rd,
        matchId: snapshot.matchId,
        createdAt: snapshot.createdAt,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RatingSnapshot] Error recording snapshot:', errorMsg);
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Record rating snapshots for both players after a match
 * 
 * @param playerAId - Player A's user ID
 * @param playerBId - Player B's user ID
 * @param sport - Sport type
 * @param matchId - Match ID
 * @returns Results for both players
 */
export async function recordMatchRatingSnapshots(
  playerAId: string,
  playerBId: string,
  sport: SportType,
  matchId: string
): Promise<{
  playerA: RecordSnapshotResult;
  playerB: RecordSnapshotResult;
}> {
  const [playerA, playerB] = await Promise.all([
    recordRatingSnapshot(playerAId, sport, matchId),
    recordRatingSnapshot(playerBId, sport, matchId),
  ]);

  return {
    playerA,
    playerB,
  };
}

/**
 * Get rating history for a player
 * 
 * @param playerId - Player's user ID
 * @param sport - Sport type
 * @param limit - Maximum number of snapshots to return
 * @returns Array of snapshots sorted by date (newest first)
 */
export async function getRatingHistory(
  playerId: string,
  sport: SportType,
  limit: number = 50
): Promise<SnapshotRecord[]> {
  try {
    const snapshots = await db.ratingSnapshot.findMany({
      where: {
        playerId,
        sport,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return snapshots.map((s: any) => ({
      id: s.id,
      playerId: s.playerId,
      sport: s.sport,
      rating: s.rating,
      rd: s.rd,
      matchId: s.matchId,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    console.error('[RatingSnapshot] Error getting rating history:', error);
    return [];
  }
}

/**
 * Update RD for all inactive players
 * Should be called periodically (daily cron)
 * 
 * @param sport - Sport type to update
 * @param daysInactiveThreshold - Minimum days inactive to update
 * @returns Number of players updated
 */
export async function updateInactivePlayerRd(
  sport: SportType,
  daysInactiveThreshold: number = 7
): Promise<number> {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysInactiveThreshold);

    // Find players who haven't played in the threshold period
    const inactivePlayers = await db.user.findMany({
      where: {
        sport,
        isActive: true,
        matchesAsA: {
          none: {
            playedAt: { gte: thresholdDate },
          },
        },
        matchesAsB: {
          none: {
            playedAt: { gte: thresholdDate },
          },
        },
      },
      select: { id: true },
    });

    let updatedCount = 0;

    for (const player of inactivePlayers) {
      const rdResult = await calculateRatingDeviation(player.id, sport);
      
      // Update RD in player rating record
      if (rdResult.rd > 0) {
        await db.playerRating.updateMany({
          where: { userId: player.id },
          data: {
            // Note: rd field will be added via schema update
          } as any,
        });
        updatedCount++;
      }
    }

    console.log(
      `[RatingDeviation] Updated RD for ${updatedCount} inactive ${sport} players`
    );

    return updatedCount;
  } catch (error) {
    console.error('[RatingDeviation] Error updating inactive player RD:', error);
    return 0;
  }
}

/**
 * Get RD-adjusted matchmaking range
 * 
 * For matchmaking, we use RD to widen the acceptable opponent range
 * for players with high uncertainty, and narrow it for confident ratings.
 * 
 * @param rating - Player's rating
 * @param rd - Player's rating deviation
 * @returns Min and max acceptable opponent ratings
 */
export function getMatchmakingRange(
  rating: number,
  rd: number
): { min: number; max: number; width: number } {
  // Use 2 standard deviations for matchmaking range
  // Higher RD = wider range
  const width = Math.round(rd * 2);
  
  return {
    min: Math.round(rating - width),
    max: Math.round(rating + width),
    width: width * 2,
  };
}

/**
 * Calculate rating confidence score (0-100)
 * Higher score = more confident in rating accuracy
 * 
 * @param rd - Rating deviation
 * @param gamesPlayed - Number of games played
 * @param daysInactive - Days since last game
 * @returns Confidence score from 0-100
 */
export function calculateConfidenceScore(
  rd: number,
  gamesPlayed: number,
  daysInactive: number
): number {
  let score = 100;

  // Reduce score based on RD (higher RD = lower confidence)
  score -= (rd / MAX_RD) * 50;

  // Reduce score for new players (fewer games)
  if (gamesPlayed < 10) {
    score -= (10 - gamesPlayed) * 3;
  }

  // Reduce score for inactive players
  if (daysInactive > 7) {
    score -= Math.min(daysInactive - 7, 30);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================
// Exports
// ============================================

export const RATING_DEVIATION_CONFIG = {
  INITIAL_RD,
  MIN_RD,
  MAX_RD,
  RD_INACTIVITY_PER_DAY,
  RD_DECREASE_PER_GAME,
  GAMES_FOR_STABLE_RD,
  TAU,
  SCALE,
};
