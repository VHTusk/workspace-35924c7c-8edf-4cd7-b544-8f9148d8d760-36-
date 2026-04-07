/**
 * VALORHIVE Match Confirmation System
 * 
 * SECURITY: Double confirmation for in-person matches
 * - Both players must confirm the result
 * - Referee submission counts as one confirmation
 * - Disputes can be raised during confirmation window
 * - Auto-confirms after 24 hours if no dispute
 */

import { db } from './db';

// ============================================
// Configuration
// ============================================

/** Hours after which an unconfirmed match auto-confirms */
const AUTO_CONFIRM_HOURS = 24;

/** Hours after which a confirmed match becomes immutable */
const IMMUTABILITY_HOURS = 72;

// ============================================
// Types
// ============================================

export interface MatchConfirmationStatus {
  matchId: string;
  status: 'PENDING' | 'PARTIALLY_CONFIRMED' | 'CONFIRMED' | 'DISPUTED' | 'LOCKED';
  playerAConfirmed: boolean;
  playerBConfirmed: boolean;
  refereeSubmitted: boolean;
  confirmationDeadline: Date;
  canDispute: boolean;
  canEdit: boolean;
}

// ============================================
// Match Confirmation Functions
// ============================================

/**
 * Get the confirmation status for a match
 */
export async function getMatchConfirmationStatus(matchId: string): Promise<MatchConfirmationStatus | null> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        refereeId: true,
        verificationStatus: true,
        playerScoreStatus: true,
        playedAt: true,
        outcome: true,
        winnerId: true,
        scoreA: true,
        scoreB: true,
      },
    });

    if (!match) return null;

    // Check for confirmations in MatchCheckIn or a new confirmation model
    // For now, we use the existing verificationStatus and playerScoreStatus fields
    const playerAConfirmed = match.playerScoreStatus === 'CONFIRMED';
    const playerBConfirmed = match.verificationStatus === 'VERIFIED';
    const refereeSubmitted = !!match.refereeId;

    // Calculate deadline
    const confirmationDeadline = new Date(match.playedAt);
    confirmationDeadline.setHours(confirmationDeadline.getHours() + AUTO_CONFIRM_HOURS);

    // Determine status
    let status: MatchConfirmationStatus['status'];
    const isLocked = match.verificationStatus === 'VERIFIED' || 
                     (match.playedAt && new Date() >= new Date(match.playedAt.getTime() + IMMUTABILITY_HOURS * 60 * 60 * 1000));

    if (match.verificationStatus === 'DISPUTED') {
      status = 'DISPUTED';
    } else if (isLocked) {
      status = 'LOCKED';
    } else if (playerAConfirmed && playerBConfirmed) {
      status = 'CONFIRMED';
    } else if (playerAConfirmed || playerBConfirmed || refereeSubmitted) {
      status = 'PARTIALLY_CONFIRMED';
    } else {
      status = 'PENDING';
    }

    const canDispute = !isLocked && match.verificationStatus !== 'DISPUTED';
    const canEdit = !isLocked;

    return {
      matchId: match.id,
      status,
      playerAConfirmed,
      playerBConfirmed,
      refereeSubmitted,
      confirmationDeadline,
      canDispute,
      canEdit,
    };
  } catch (error) {
    console.error('[MatchConfirmation] Error getting status:', error);
    return null;
  }
}

/**
 * Submit player confirmation for a match result
 * 
 * @param matchId - The match ID
 * @param playerId - The player confirming
 * @param confirmScore - Whether the player confirms the score
 * @param proposedScoreA - Optional alternative score A if disputing
 * @param proposedScoreB - Optional alternative score B if disputing
 */
export async function submitMatchConfirmation(
  matchId: string,
  playerId: string,
  confirmScore: boolean,
  proposedScoreA?: number,
  proposedScoreB?: number
): Promise<{
  success: boolean;
  status: MatchConfirmationStatus['status'];
  error?: string;
}> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        playerAId: true,
        playerBId: true,
        scoreA: true,
        scoreB: true,
        winnerId: true,
        verificationStatus: true,
      },
    });

    if (!match) {
      return { success: false, status: 'PENDING', error: 'Match not found' };
    }

    // Verify player is part of the match
    if (match.playerAId !== playerId && match.playerBId !== playerId) {
      return { success: false, status: 'PENDING', error: 'Not a participant in this match' };
    }

    // Check if already locked
    if (match.verificationStatus === 'VERIFIED') {
      return { success: false, status: 'LOCKED', error: 'Match is already verified and locked' };
    }

    if (match.verificationStatus === 'DISPUTED') {
      return { success: false, status: 'DISPUTED', error: 'Match is under dispute' };
    }

    // Handle dispute case
    if (!confirmScore) {
      // Create dispute
      if (proposedScoreA !== undefined && proposedScoreB !== undefined) {
        await db.match.update({
          where: { id: matchId },
          data: {
            verificationStatus: 'DISPUTED',
            playerScoreStatus: 'DISPUTED',
          },
        });

        // Create dispute record
        await db.dispute.create({
          data: {
            matchId,
            raisedById: playerId,
            sport: 'CORNHOLE', // Will be overwritten by actual sport
            reason: `Score dispute: Player proposes ${proposedScoreA}-${proposedScoreB} (original: ${match.scoreA}-${match.scoreB})`,
          },
        });

        console.log(`[MatchConfirmation] Match ${matchId} disputed by player ${playerId}`);
        return { success: true, status: 'DISPUTED' };
      }

      return { success: false, status: 'PENDING', error: 'Proposed scores required for dispute' };
    }

    // Handle confirmation
    const isPlayerA = match.playerAId === playerId;

    // For in-person matches, we need both players to confirm
    // Update the match status accordingly
    if (isPlayerA) {
      await db.match.update({
        where: { id: matchId },
        data: {
          playerScoreStatus: 'CONFIRMED',
        },
      });
    } else {
      // If both confirmed, mark as verified
      const shouldVerify = match.playerScoreStatus === 'CONFIRMED';
      await db.match.update({
        where: { id: matchId },
        data: {
          verificationStatus: shouldVerify ? 'VERIFIED' : match.verificationStatus,
        },
      });

      if (shouldVerify) {
        console.log(`[MatchConfirmation] Match ${matchId} fully confirmed and verified`);
        return { success: true, status: 'CONFIRMED' };
      }
    }

    console.log(`[MatchConfirmation] Player ${playerId} confirmed match ${matchId}`);
    return { success: true, status: 'PARTIALLY_CONFIRMED' };
  } catch (error) {
    console.error('[MatchConfirmation] Error submitting confirmation:', error);
    return { success: false, status: 'PENDING', error: 'Failed to submit confirmation' };
  }
}

/**
 * Submit referee score (counts as one confirmation)
 */
export async function submitRefereeScore(
  matchId: string,
  refereeId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string
): Promise<{
  success: boolean;
  status: MatchConfirmationStatus['status'];
  error?: string;
}> {
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        verificationStatus: true,
        playerScoreStatus: true,
      },
    });

    if (!match) {
      return { success: false, status: 'PENDING', error: 'Match not found' };
    }

    if (match.verificationStatus === 'VERIFIED') {
      return { success: false, status: 'LOCKED', error: 'Match is already verified' };
    }

    // If player has already confirmed, referee submission completes verification
    const shouldVerify = match.playerScoreStatus === 'CONFIRMED';

    await db.match.update({
      where: { id: matchId },
      data: {
        scoreA,
        scoreB,
        winnerId,
        refereeId,
        verificationStatus: shouldVerify ? 'VERIFIED' : match.verificationStatus,
      },
    });

    console.log(`[MatchConfirmation] Referee ${refereeId} submitted score for match ${matchId}`);
    return { success: true, status: shouldVerify ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED' };
  } catch (error) {
    console.error('[MatchConfirmation] Error submitting referee score:', error);
    return { success: false, status: 'PENDING', error: 'Failed to submit referee score' };
  }
}

/**
 * Process auto-confirmation for matches past the deadline
 * This should be called by the cron service
 */
export async function processAutoConfirmations(): Promise<{
  processed: number;
  confirmed: number;
  disputed: number;
}> {
  const result = { processed: 0, confirmed: 0, disputed: 0 };

  try {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() - AUTO_CONFIRM_HOURS);

    // Find matches past the confirmation deadline that aren't yet verified
    const pendingMatches = await db.match.findMany({
      where: {
        verificationStatus: 'PENDING',
        playedAt: { lt: deadline },
      },
      take: 100,
    });

    for (const match of pendingMatches) {
      result.processed++;

      // Auto-confirm if no dispute was raised
      await db.match.update({
        where: { id: match.id },
        data: {
          verificationStatus: 'VERIFIED',
        },
      });

      result.confirmed++;
    }

    if (result.processed > 0) {
      console.log(`[MatchConfirmation] Auto-confirmed ${result.confirmed} matches`);
    }

    return result;
  } catch (error) {
    console.error('[MatchConfirmation] Error processing auto-confirmations:', error);
    return result;
  }
}

// ============================================
// Exports
// ============================================

export const MATCH_CONFIRMATION_CONFIG = {
  AUTO_CONFIRM_HOURS,
  IMMUTABILITY_HOURS,
};
