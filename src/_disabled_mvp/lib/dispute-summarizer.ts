/**
 * VALORHIVE - Dispute Summarization Service
 * 
 * DISABLED (v3.78.0) - LLM-based summarization has been deactivated.
 * Returns basic dispute context without AI analysis.
 * 
 * Reason: Early users need direct human support to build trust,
 * reading disputes manually will be faster and more accurate.
 */

import { db } from '@/lib/db';

// ============================================
// Types
// ============================================

export interface DisputeSummary {
  oneLiner: string;              // Simple statement about the dispute
  timeline: string[];            // Chronological bullet points
  claimingPlayer: string;        // Name of player who raised dispute
  respondingPlayer: string;      // Name of the other player
  matchDetails: string;          // Tournament, match number, etc.
  evidenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  suggestedAction: string;       // Suggestion for admin
  generatedAt: string;
  model: string;
  aiDisabled: boolean;           // Flag indicating AI was not used
}

// ============================================
// Main Function (AI Disabled)
// ============================================

/**
 * Generate a basic dispute summary WITHOUT AI
 * Simply formats the dispute data for human review
 */
export async function summarizeDispute(disputeId: string): Promise<DisputeSummary> {
  // Get dispute with related data
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hiddenElo: true,
        },
      },
    },
  });

  if (!dispute) {
    throw new Error(`Dispute ${disputeId} not found`);
  }

  // Get match with tournament info
  const match = await db.match.findUnique({
    where: { id: dispute.matchId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
      playerA: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hiddenElo: true,
        },
      },
      playerB: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hiddenElo: true,
        },
      },
      history: {
        orderBy: { editedAt: 'asc' },
        take: 10,
      },
      bracketMatch: {
        select: {
          roundNumber: true,
          matchNumber: true,
        },
      },
    },
  });

  if (!match) {
    throw new Error(`Match for dispute ${disputeId} not found`);
  }

  // Determine claiming and responding player
  const isPlayerAClaiming = match.playerAId === dispute.raisedById;
  const claimingPlayer = isPlayerAClaiming ? match.playerA : match.playerB;
  const respondingPlayer = isPlayerAClaiming ? match.playerB : match.playerA;

  // Parse evidence count
  let evidenceCount = 0;
  if (dispute.evidence) {
    try {
      const evidence = JSON.parse(dispute.evidence);
      evidenceCount = Array.isArray(evidence) ? evidence.length : 1;
    } catch {
      evidenceCount = dispute.evidence ? 1 : 0;
    }
  }

  // Build basic timeline (no AI analysis)
  const timeline: string[] = [];
  
  timeline.push(`Match played on ${match.playedAt.toLocaleDateString()} at ${match.playedAt.toLocaleTimeString()}`);
  
  if (match.history && match.history.length > 0) {
    for (const edit of match.history) {
      if (edit.oldScoreA !== null && edit.oldScoreB !== null) {
        timeline.push(`Score edited from ${edit.oldScoreA}-${edit.oldScoreB} to ${edit.newScoreA}-${edit.newScoreB}`);
      } else {
        timeline.push(`Initial score entered: ${edit.newScoreA}-${edit.newScoreB}`);
      }
    }
  }
  
  timeline.push(`Dispute raised on ${dispute.createdAt.toLocaleDateString()}: ${dispute.reason.substring(0, 100)}${dispute.reason.length > 100 ? '...' : ''}`);

  // Determine evidence strength (simple heuristic)
  let evidenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' = 'NONE';
  if (evidenceCount >= 3) {
    evidenceStrength = 'STRONG';
  } else if (evidenceCount >= 1) {
    evidenceStrength = 'MODERATE';
  } else if (dispute.reason.length > 50) {
    evidenceStrength = 'WEAK';
  }

  // Build basic summary (no AI)
  const summary: DisputeSummary = {
    oneLiner: `${claimingPlayer.firstName} ${claimingPlayer.lastName} disputed the match result`,
    timeline,
    claimingPlayer: `${claimingPlayer.firstName} ${claimingPlayer.lastName}`,
    respondingPlayer: `${respondingPlayer.firstName} ${respondingPlayer.lastName}`,
    matchDetails: `${match.tournament?.name || 'Unknown Tournament'} - Round ${match.bracketMatch?.roundNumber || 'N/A'}`,
    evidenceStrength,
    suggestedAction: 'Review all evidence and player statements before making a decision. Contact both players if needed.',
    generatedAt: new Date().toISOString(),
    model: 'disabled',
    aiDisabled: true,
  };

  console.log(`[DisputeSummarizer] Generated basic summary for dispute ${disputeId} (AI disabled)`);
  return summary;
}

// ============================================
// Cache Functions (simplified - no actual caching needed)
// ============================================

export async function invalidateDisputeSummaryCache(_disputeId: string): Promise<void> {
  // No-op since we don't cache without AI
  console.log(`[DisputeSummarizer] Cache invalidation skipped (AI disabled)`);
}

// ============================================
// Batch Processing
// ============================================

export async function summarizeMultipleDisputes(
  disputeIds: string[]
): Promise<Map<string, DisputeSummary | Error>> {
  const results = new Map<string, DisputeSummary | Error>();

  // Process in parallel with concurrency limit
  const concurrencyLimit = 10;
  const batches: string[][] = [];
  
  for (let i = 0; i < disputeIds.length; i += concurrencyLimit) {
    batches.push(disputeIds.slice(i, i + concurrencyLimit));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (disputeId) => {
        try {
          const summary = await summarizeDispute(disputeId);
          results.set(disputeId, summary);
        } catch (error) {
          results.set(disputeId, error instanceof Error ? error : new Error('Unknown error'));
        }
      })
    );
  }

  return results;
}

// ============================================
// Export Service Object
// ============================================

export const DisputeSummarizerService = {
  summarize: summarizeDispute,
  invalidateCache: invalidateDisputeSummaryCache,
  summarizeMultiple: summarizeMultipleDisputes,
};
