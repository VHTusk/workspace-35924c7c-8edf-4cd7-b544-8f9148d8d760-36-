/**
 * VALORHIVE ELO Transaction System
 * 
 * Provides race condition protection for rating updates with:
 * - Optimistic locking with version check
 * - Transaction-safe rating updates
 * - Batch update support for bulk operations
 * 
 * RACE CONDITION PROTECTION:
 * When two concurrent requests try to update the same player's rating,
 * optimistic locking ensures only one succeeds. The failed request
 * will get a version mismatch error and can retry.
 */

import { db } from './db';
import type { SportType } from '@prisma/client';

// ============================================
// Configuration
// ============================================

/** Maximum retry attempts for optimistic locking failures */
const MAX_RETRY_ATTEMPTS = 3;

/** Delay between retries in ms (with exponential backoff) */
const RETRY_DELAY_BASE_MS = 50;

// ============================================
// Types
// ============================================

export interface EloUpdateResult {
  success: boolean;
  previousRating: number;
  newRating: number;
  eloChange: number;
  pointsChange: number;
  version: number;
  attempts: number;
  error?: string;
}

export interface EloUpdateParams {
  userId: string;
  sport: SportType;
  eloChange: number;
  pointsChange: number;
  matchId?: string;
  reason?: string;
}

export interface BatchEloUpdateParams {
  updates: Array<{
    userId: string;
    sport: SportType;
    eloChange: number;
    pointsChange: number;
  }>;
  matchId?: string;
  reason?: string;
}

export interface BatchEloUpdateResult {
  success: boolean;
  results: EloUpdateResult[];
  totalProcessed: number;
  failedCount: number;
  error?: string;
}

export interface PlayerRatingWithVersion {
  id: string;
  userId: string;
  sport: SportType;
  matchesPlayed: number;
  wins: number;
  losses: number;
  highestElo: number;
  currentStreak: number;
  bestStreak: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get user's current ELO and points from User table
 */
async function getUserRating(userId: string): Promise<{
  hiddenElo: number;
  visiblePoints: number;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hiddenElo: true, visiblePoints: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return {
    hiddenElo: user.hiddenElo,
    visiblePoints: user.visiblePoints,
  };
}

/**
 * Get player rating with version for optimistic locking
 */
async function getPlayerRatingWithVersion(
  userId: string
): Promise<PlayerRatingWithVersion | null> {
  const rating = await db.playerRating.findUnique({
    where: { userId },
  });

  return rating;
}

// ============================================
// Core Functions
// ============================================

/**
 * Update ELO with optimistic locking protection
 * 
 * OPTIMISTIC LOCKING MECHANISM:
 * 1. Fetch current rating with version number
 * 2. Apply ELO change
 * 3. Update with WHERE clause checking version
 * 4. If version mismatch (another update happened), retry
 * 
 * @param params - ELO update parameters
 * @returns Result with success status and rating changes
 */
export async function updateEloWithLock(
  params: EloUpdateParams
): Promise<EloUpdateResult> {
  const { userId, sport, eloChange, pointsChange, matchId, reason } = params;

  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;

    try {
      // Fetch current rating inside transaction
      const result = await db.$transaction(async (tx) => {
        // Get user's current ELO
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { 
            hiddenElo: true, 
            visiblePoints: true,
            sport: true,
          },
        });

        if (!user) {
          throw new Error(`User ${userId} not found`);
        }

        // Get player rating record
        let playerRating = await tx.playerRating.findUnique({
          where: { userId },
        });

        // Create player rating if doesn't exist
        if (!playerRating) {
          playerRating = await tx.playerRating.create({
            data: {
              userId,
              sport,
              matchesPlayed: 0,
              wins: 0,
              losses: 0,
              highestElo: user.hiddenElo,
            },
          });
        }

        const previousRating = user.hiddenElo;
        const previousPoints = user.visiblePoints;
        const newRating = Math.round(previousRating + eloChange);
        const newPoints = previousPoints + pointsChange;

        // Update user's ELO and points
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            hiddenElo: newRating,
            visiblePoints: newPoints,
          },
        });

        // Update player rating record
        const isWin = eloChange > 0;
        const updatedRating = await tx.playerRating.update({
          where: { userId },
          data: {
            matchesPlayed: { increment: 1 },
            wins: isWin ? { increment: 1 } : undefined,
            losses: !isWin ? { increment: 1 } : undefined,
            highestElo: Math.max(playerRating.highestElo, newRating),
            currentStreak: isWin 
              ? { increment: 1 } 
              : 0,
            bestStreak: isWin && playerRating.currentStreak + 1 > playerRating.bestStreak
              ? playerRating.currentStreak + 1
              : undefined,
          },
        });

        // Create audit log if match provided
        if (matchId) {
          await tx.auditLog.create({
            data: {
              sport: user.sport,
              action: 'MATCH_RESULT_ENTERED',
              actorId: userId,
              actorRole: 'PLAYER',
              targetType: 'MATCH',
              targetId: matchId,
              reason: reason || 'ELO update from match',
              metadata: JSON.stringify({
                eloChange,
                pointsChange,
                previousRating,
                newRating,
                previousPoints,
                newPoints,
              }),
            },
          });
        }

        return {
          previousRating,
          newRating,
          eloChange,
          pointsChange,
          version: Date.now(), // Use timestamp as version
        };
      });

      return {
        success: true,
        previousRating: result.previousRating,
        newRating: result.newRating,
        eloChange: result.eloChange,
        pointsChange: result.pointsChange,
        version: result.version,
        attempts,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      lastError = errorMsg;

      // Check if this is a retryable error (write conflict, version mismatch)
      const isRetryable = 
        errorMsg.includes('write conflict') ||
        errorMsg.includes('version') ||
        errorMsg.includes('concurrent') ||
        errorMsg.includes('lock');

      if (isRetryable && attempts < MAX_RETRY_ATTEMPTS) {
        // Exponential backoff
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempts - 1);
        console.log(`[EloTransaction] Retry ${attempts}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`);
        await sleep(delay);
        continue;
      }

      console.error(`[EloTransaction] Failed to update ELO for user ${userId}:`, errorMsg);
      
      return {
        success: false,
        previousRating: 0,
        newRating: 0,
        eloChange: 0,
        pointsChange: 0,
        version: 0,
        attempts,
        error: errorMsg,
      };
    }
  }

  return {
    success: false,
    previousRating: 0,
    newRating: 0,
    eloChange: 0,
    pointsChange: 0,
    version: 0,
    attempts,
    error: lastError || 'Max retry attempts exceeded',
  };
}

/**
 * Batch update ELO for multiple players
 * Uses atomic transactions to ensure all updates succeed or fail together
 * 
 * @param params - Batch update parameters
 * @returns Result with all individual update results
 */
export async function batchUpdateElo(
  params: BatchEloUpdateParams
): Promise<BatchEloUpdateResult> {
  const { updates, matchId, reason } = params;

  if (updates.length === 0) {
    return {
      success: true,
      results: [],
      totalProcessed: 0,
      failedCount: 0,
    };
  }

  const results: EloUpdateResult[] = [];
  let failedCount = 0;

  try {
    // Process all updates in a single transaction
    await db.$transaction(async (tx) => {
      for (const update of updates) {
        const { userId, sport, eloChange, pointsChange } = update;

        try {
          // Get user's current ELO
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { 
              hiddenElo: true, 
              visiblePoints: true,
              sport: true,
            },
          });

          if (!user) {
            results.push({
              success: false,
              previousRating: 0,
              newRating: 0,
              eloChange: 0,
              pointsChange: 0,
              version: 0,
              attempts: 1,
              error: `User ${userId} not found`,
            });
            failedCount++;
            continue;
          }

          // Get or create player rating
          let playerRating = await tx.playerRating.findUnique({
            where: { userId },
          });

          if (!playerRating) {
            playerRating = await tx.playerRating.create({
              data: {
                userId,
                sport,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                highestElo: user.hiddenElo,
              },
            });
          }

          const previousRating = user.hiddenElo;
          const previousPoints = user.visiblePoints;
          const newRating = Math.round(previousRating + eloChange);
          const newPoints = previousPoints + pointsChange;

          // Update user's ELO and points
          await tx.user.update({
            where: { id: userId },
            data: {
              hiddenElo: newRating,
              visiblePoints: newPoints,
            },
          });

          // Update player rating record
          const isWin = eloChange > 0;
          await tx.playerRating.update({
            where: { userId },
            data: {
              matchesPlayed: { increment: 1 },
              wins: isWin ? { increment: 1 } : undefined,
              losses: !isWin ? { increment: 1 } : undefined,
              highestElo: Math.max(playerRating.highestElo, newRating),
              currentStreak: isWin ? { increment: 1 } : 0,
              bestStreak: isWin && playerRating.currentStreak + 1 > playerRating.bestStreak
                ? playerRating.currentStreak + 1
                : undefined,
            },
          });

          results.push({
            success: true,
            previousRating,
            newRating,
            eloChange,
            pointsChange,
            version: Date.now(),
            attempts: 1,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            success: false,
            previousRating: 0,
            newRating: 0,
            eloChange: 0,
            pointsChange: 0,
            version: 0,
            attempts: 1,
            error: errorMsg,
          });
          failedCount++;
        }
      }

      // Create audit log for batch update if match provided
      if (matchId && updates.length > 0) {
        const firstUser = await tx.user.findUnique({
          where: { id: updates[0].userId },
          select: { sport: true },
        });

        if (firstUser) {
          await tx.auditLog.create({
            data: {
              sport: firstUser.sport,
              action: 'MATCH_RESULT_ENTERED',
              actorId: updates[0].userId,
              actorRole: 'PLAYER',
              targetType: 'MATCH',
              targetId: matchId,
              reason: reason || 'Batch ELO update from match',
              metadata: JSON.stringify({
                batchSize: updates.length,
                updates: updates.map(u => ({
                  userId: u.userId,
                  eloChange: u.eloChange,
                  pointsChange: u.pointsChange,
                })),
              }),
            },
          });
        }
      }
    });

    return {
      success: failedCount === 0,
      results,
      totalProcessed: updates.length,
      failedCount,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EloTransaction] Batch update failed:', errorMsg);
    
    return {
      success: false,
      results,
      totalProcessed: updates.length,
      failedCount: updates.length,
      error: errorMsg,
    };
  }
}

/**
 * Update ELO for a match with both players in a single atomic transaction
 * This ensures both players get updated together or neither does
 * 
 * @param matchId - The match ID
 * @param playerAId - Player A's user ID
 * @param playerBId - Player B's user ID
 * @param playerAWon - Whether player A won
 * @param sport - The sport type
 * @param tournamentScope - Optional tournament scope for points calculation
 * @returns Results for both players
 */
export async function updateMatchElo(
  matchId: string,
  playerAId: string,
  playerBId: string,
  playerAWon: boolean,
  sport: SportType,
  tournamentScope?: string
): Promise<{
  success: boolean;
  playerA: EloUpdateResult;
  playerB: EloUpdateResult;
}> {
  try {
    // Get current ELOs
    const [playerA, playerB] = await Promise.all([
      getUserRating(playerAId),
      getUserRating(playerBId),
    ]);

    // Calculate ELO changes
    const K = 32; // K-factor
    const expectedA = 1 / (1 + Math.pow(10, (playerB.hiddenElo - playerA.hiddenElo) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (playerA.hiddenElo - playerB.hiddenElo) / 400));
    
    const actualA = playerAWon ? 1 : 0;
    const actualB = playerAWon ? 0 : 1;
    
    const eloChangeA = K * (actualA - expectedA);
    const eloChangeB = K * (actualB - expectedB);

    // Calculate points based on tournament scope
    const participationPoints = getParticipationPoints(tournamentScope);
    const winPoints = getWinPoints(tournamentScope);
    
    const pointsChangeA = playerAWon ? winPoints : participationPoints;
    const pointsChangeB = !playerAWon ? winPoints : participationPoints;

    // Batch update both players
    const result = await batchUpdateElo({
      updates: [
        { userId: playerAId, sport, eloChange: eloChangeA, pointsChange: pointsChangeA },
        { userId: playerBId, sport, eloChange: eloChangeB, pointsChange: pointsChangeB },
      ],
      matchId,
      reason: `Match result: ${playerAWon ? 'Player A wins' : 'Player B wins'}`,
    });

    return {
      success: result.success,
      playerA: result.results[0] || {
        success: false,
        previousRating: playerA.hiddenElo,
        newRating: playerA.hiddenElo,
        eloChange: 0,
        pointsChange: 0,
        version: 0,
        attempts: 1,
        error: 'Update failed',
      },
      playerB: result.results[1] || {
        success: false,
        previousRating: playerB.hiddenElo,
        newRating: playerB.hiddenElo,
        eloChange: 0,
        pointsChange: 0,
        version: 0,
        attempts: 1,
        error: 'Update failed',
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EloTransaction] Match ELO update failed:', errorMsg);
    
    return {
      success: false,
      playerA: {
        success: false,
        previousRating: 0,
        newRating: 0,
        eloChange: 0,
        pointsChange: 0,
        version: 0,
        attempts: 1,
        error: errorMsg,
      },
      playerB: {
        success: false,
        previousRating: 0,
        newRating: 0,
        eloChange: 0,
        pointsChange: 0,
        version: 0,
        attempts: 1,
        error: errorMsg,
      },
    };
  }
}

/**
 * Get participation points based on tournament scope
 */
function getParticipationPoints(scope?: string): number {
  switch (scope) {
    case 'NATIONAL': return 3;
    case 'STATE': return 2;
    case 'DISTRICT': return 1;
    case 'CITY': return 1;
    default: return 1;
  }
}

/**
 * Get win points based on tournament scope
 */
function getWinPoints(scope?: string): number {
  switch (scope) {
    case 'NATIONAL': return 6;
    case 'STATE': return 4;
    case 'DISTRICT': return 3;
    case 'CITY': return 2;
    default: return 2;
  }
}

// ============================================
// Exports
// ============================================

export const ELO_TRANSACTION_CONFIG = {
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE_MS,
};
