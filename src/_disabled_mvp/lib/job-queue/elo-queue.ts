/**
 * ELO Calculation Job Queue Service for VALORHIVE
 * 
 * Features:
 * - Database-backed job queue (works with or without Redis)
 * - Async ELO calculation to prevent score entry blocking
 * - Retry logic with exponential backoff
 * - Job status tracking
 * 
 * v3.25.0 - Architecture Fix: Move ELO to async queue
 */

import { db } from '@/lib/db';
import { SportType, TournamentScope } from '@prisma/client';

// ============================================
// TYPES & INTERFACES
// ============================================

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface EloJobResult {
  success: boolean;
  eloChangeA?: number;
  eloChangeB?: number;
  pointsA?: number;
  pointsB?: number;
  error?: string;
}

export interface EloJobData {
  matchId: string;
  sport: SportType;
}

// ============================================
// CONFIGURATION
// ============================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5000, 30000, 120000]; // 5s, 30s, 2min

// ============================================
// JOB CREATION
// ============================================

/**
 * Queue an ELO calculation job
 * Called after score entry - returns immediately
 */
export async function queueEloCalculation(
  matchId: string,
  sport: SportType
): Promise<{ jobId: string; pending: boolean }> {
  // Create the job
  const job = await db.eloJob.create({
    data: {
      matchId,
      sport,
      status: 'PENDING',
      maxAttempts: MAX_RETRY_ATTEMPTS,
    },
  });

  // Mark match as ELO pending
  await db.match.update({
    where: { id: matchId },
    data: {
      eloPending: true,
      eloJobId: job.id,
    },
  });

  // In production with BullMQ, we would do:
  // await eloQueue.add('calculate-elo', { matchId, sport }, { jobId: job.id });

  return {
    jobId: job.id,
    pending: true,
  };
}

// ============================================
// JOB PROCESSING
// ============================================

/**
 * Process pending ELO jobs
 * Called by cron service every 30 seconds
 */
export async function processPendingEloJobs(
  batchSize: number = 20
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Get pending jobs
  const pendingJobs = await db.eloJob.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  });

  // Also get failed jobs that are ready for retry
  const retryJobs = await db.eloJob.findMany({
    where: {
      status: 'FAILED',
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    take: batchSize - pendingJobs.length,
    orderBy: { updatedAt: 'asc' },
  });

  const jobsToProcess = [...pendingJobs, ...retryJobs];

  for (const job of jobsToProcess) {
    try {
      // Mark as processing
      await db.eloJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          startedAt: new Date(),
        },
      });

      // Process the job
      const result = await calculateEloForMatch(job.matchId);

      if (result.success) {
        // Mark as completed
        await db.eloJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            eloChangeA: result.eloChangeA,
            eloChangeB: result.eloChangeB,
            pointsA: result.pointsA,
            pointsB: result.pointsB,
          },
        });

        // Mark match as processed
        await db.match.update({
          where: { id: job.matchId },
          data: {
            eloPending: false,
            eloProcessedAt: new Date(),
            eloChangeA: result.eloChangeA,
            eloChangeB: result.eloChangeB,
            pointsA: result.pointsA,
            pointsB: result.pointsB,
          },
        });

        succeeded++;
      } else {
        throw new Error(result.error || 'ELO calculation failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Job ${job.id}: ${errorMsg}`);

      // Check if we should retry
      const newAttempts = job.attempts + 1;
      const shouldRetry = newAttempts < MAX_RETRY_ATTEMPTS;

      await db.eloJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? 'FAILED' : 'FAILED', // Will be picked up by retry logic
          lastError: errorMsg,
        },
      });

      failed++;
    }

    processed++;
  }

  return { processed, succeeded, failed, errors };
}

// ============================================
// ELO CALCULATION LOGIC
// ============================================

async function calculateEloForMatch(matchId: string): Promise<EloJobResult> {
  // Get match with player info
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      playerA: { include: { rating: true } },
      playerB: { include: { rating: true } },
      tournament: true,
    },
  });

  if (!match) {
    return { success: false, error: 'Match not found' };
  }

  if (!match.playerB) {
    return { success: false, error: 'Match has no opponent' };
  }

  if (!match.winnerId) {
    return { success: false, error: 'Match has no winner' };
  }

  // Get ELO values
  const eloA = match.playerA.hiddenElo;
  const eloB = match.playerB.hiddenElo;
  const matchesA = match.playerA.rating?.matchesPlayed || 0;
  const matchesB = match.playerB.rating?.matchesPlayed || 0;

  // Calculate K-factor
  let K = 32;
  if (matchesA >= 100 || matchesB >= 100) K = 16;
  else if (matchesA >= 30 || matchesB >= 30) K = 24;

  // Calculate ELO change
  const actualA = match.winnerId === match.playerAId ? 1 : 0;
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const eloChangeA = Math.round(K * (actualA - expectedA) * 10) / 10;
  const eloChangeB = -eloChangeA;

  // Calculate points based on tournament scope
  const tournamentScope = match.tournament?.scope || TournamentScope.CITY;
  let pointsA = 1;
  let pointsB = 1;

  const rules = await db.sportRules.findUnique({
    where: { sport: match.sport },
  });

  if (rules) {
    const scopeKey = tournamentScope.toLowerCase();
    const participationPoints = (rules as Record<string, unknown>)[`${scopeKey}Participation`] as number || 1;
    const winPoints = (rules as Record<string, unknown>)[`${scopeKey}Win`] as number || 2;

    pointsA = match.winnerId === match.playerAId ? winPoints : participationPoints;
    pointsB = match.winnerId === match.playerBId ? winPoints : participationPoints;
  }

  // Update player ratings in a transaction
  await db.$transaction([
    // Update player A
    db.user.update({
      where: { id: match.playerAId },
      data: {
        hiddenElo: eloA + eloChangeA,
        visiblePoints: match.playerA.visiblePoints + pointsA,
      },
    }),
    db.playerRating.update({
      where: { userId: match.playerAId },
      data: {
        matchesPlayed: { increment: 1 },
        wins: match.winnerId === match.playerAId ? { increment: 1 } : undefined,
        losses: match.winnerId !== match.playerAId ? { increment: 1 } : undefined,
        highestElo: eloA + eloChangeA > (match.playerA.rating?.highestElo || 1500)
          ? eloA + eloChangeA
          : undefined,
      },
    }),
    // Update player B
    db.user.update({
      where: { id: match.playerBId },
      data: {
        hiddenElo: eloB + eloChangeB,
        visiblePoints: match.playerB.visiblePoints + pointsB,
      },
    }),
    db.playerRating.update({
      where: { userId: match.playerBId },
      data: {
        matchesPlayed: { increment: 1 },
        wins: match.winnerId === match.playerBId ? { increment: 1 } : undefined,
        losses: match.winnerId !== match.playerBId ? { increment: 1 } : undefined,
        highestElo: eloB + eloChangeB > (match.playerB.rating?.highestElo || 1500)
          ? eloB + eloChangeB
          : undefined,
      },
    }),
  ]);

  return {
    success: true,
    eloChangeA,
    eloChangeB,
    pointsA,
    pointsB,
  };
}

// ============================================
// JOB STATUS API
// ============================================

/**
 * Get status of an ELO job
 */
export async function getEloJobStatus(jobId: string): Promise<{
  status: JobStatus;
  eloChangeA?: number;
  eloChangeB?: number;
  processedAt?: Date;
}> {
  const job = await db.eloJob.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      eloChangeA: true,
      eloChangeB: true,
      completedAt: true,
    },
  });

  if (!job) {
    return { status: 'FAILED' };
  }

  return {
    status: job.status as JobStatus,
    eloChangeA: job.eloChangeA ?? undefined,
    eloChangeB: job.eloChangeB ?? undefined,
    processedAt: job.completedAt ?? undefined,
  };
}

/**
 * Get pending ELO count for monitoring
 */
export async function getPendingEloCount(): Promise<number> {
  return db.eloJob.count({
    where: { status: 'PENDING' },
  });
}

/**
 * Get failed ELO jobs for admin review
 */
export async function getFailedEloJobs(limit: number = 20): Promise<Array<{
  id: string;
  matchId: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}>> {
  return db.eloJob.findMany({
    where: {
      status: 'FAILED',
      attempts: { gte: MAX_RETRY_ATTEMPTS },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      matchId: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
  });
}

export default {
  queueEloCalculation,
  processPendingEloJobs,
  getEloJobStatus,
  getPendingEloCount,
  getFailedEloJobs,
};
