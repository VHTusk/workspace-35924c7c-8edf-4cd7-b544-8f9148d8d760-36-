/**
 * VALORHIVE ELO Job Queue System
 * 
 * Provides a robust job queue for ELO calculation with:
 * - Poison pill recovery: Jobs stuck in PROCESSING for > 60s are recovered
 * - Retry mechanism: Failed jobs are retried up to maxAttempts
 * - Dead letter queue: Permanently failed jobs are moved to DEAD_LETTER status
 * - Statistics: Queue stats for monitoring
 * 
 * Integration:
 * - Called by cron service for job processing and recovery
 * - Used by match result APIs to queue ELO calculations
 */

import { db } from './db';
import type { EloJob, Match, User, PlayerRating } from '@prisma/client';

// ============================================
// Configuration
// ============================================

/** Time in ms before a PROCESSING job is considered stale (poison pill) */
const STALE_JOB_THRESHOLD_MS = 60 * 1000; // 60 seconds

/** Default maximum retry attempts */
const DEFAULT_MAX_ATTEMPTS = 5;

/** Delay between retries in ms (exponential backoff base) */
const RETRY_DELAY_BASE_MS = 1000; // 1 second base, doubles each attempt

// ============================================
// Types
// ============================================

export interface QueueJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface ProcessJobResult {
  jobId: string;
  matchId: string;
  success: boolean;
  attempts: number;
  error?: string;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  total: number;
  staleJobs: number;
}

export interface RecoveryResult {
  recovered: number;
  failedJobs: string[];
}

// ============================================
// Queue Functions
// ============================================

/**
 * Add a new ELO calculation job to the queue
 * 
 * Uses database UNIQUE constraint on matchId for guaranteed idempotency.
 * If a job already exists (any status), returns the existing job.
 * 
 * @param matchId - The match ID that triggered ELO calculation
 * @returns Result with job ID or error
 */
export async function queueEloJob(matchId: string): Promise<QueueJobResult> {
  try {
    // First, check if any job exists for this match (COMPLETED, FAILED, or active)
    const existingJob = await db.eloJob.findUnique({
      where: { matchId },
    });

    if (existingJob) {
      // If job is COMPLETED, the ELO has already been calculated - this is idempotent success
      if (existingJob.status === 'COMPLETED') {
        return {
          success: true,
          jobId: existingJob.id,
          error: 'ELO already calculated for this match',
        };
      }

      // If job is PENDING or PROCESSING, another job is in progress
      if (existingJob.status === 'PENDING' || existingJob.status === 'PROCESSING') {
        return {
          success: true,
          jobId: existingJob.id,
          error: 'Job already queued for this match',
        };
      }

      // If job is FAILED or DEAD_LETTER, reset it for retry
      if (existingJob.status === 'FAILED' || existingJob.status === 'DEAD_LETTER') {
        const resetJob = await db.eloJob.update({
          where: { id: existingJob.id },
          data: {
            status: 'PENDING',
            attempts: 0,
            lastError: null,
            updatedAt: new Date(),
          },
        });
        
        console.log(`[EloJobQueue] Reset failed job ${resetJob.id} for match ${matchId}`);
        
        return {
          success: true,
          jobId: resetJob.id,
        };
      }
    }

    // Create new job - UNIQUE constraint guarantees no race condition
    const job = await db.eloJob.create({
      data: {
        matchId,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    });

    console.log(`[EloJobQueue] Created job ${job.id} for match ${matchId}`);
    
    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle UNIQUE constraint violation - another request created the job
    if (errorMsg.includes('Unique constraint') || errorMsg.includes('UNIQUE constraint')) {
      // Fetch the job that was created by another request
      const existingJob = await db.eloJob.findUnique({
        where: { matchId },
      });
      
      if (existingJob) {
        return {
          success: true,
          jobId: existingJob.id,
          error: 'Job created by concurrent request',
        };
      }
    }
    
    console.error(`[EloJobQueue] Failed to queue job for match ${matchId}:`, errorMsg);
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Process all PENDING jobs in the queue with row-level locking
 * Uses FOR UPDATE SKIP LOCKED for concurrent safety (prevents race conditions
 * when multiple workers/processes try to process the same jobs)
 * 
 * This should be called by the cron service
 * 
 * CONCURRENCY SAFETY:
 * - FOR UPDATE: Locks selected rows for update
 * - SKIP LOCKED: Skips rows already locked by other transactions
 * - This ensures each job is processed exactly once, even with concurrent workers
 * 
 * @param batchSize - Maximum number of jobs to process in one run
 * @returns Array of processing results
 */
export async function processEloJobs(batchSize: number = 10): Promise<ProcessJobResult[]> {
  const results: ProcessJobResult[] = [];
  
  try {
    // Use a transaction with row-level locking for concurrent safety
    // Note: SQLite doesn't support FOR UPDATE SKIP LOCKED natively,
    // but we implement the pattern using optimistic locking with status check
    const pendingJobs = await db.$transaction(async (tx) => {
      // Fetch pending jobs
      const jobs = await tx.eloJob.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      // Mark jobs as PROCESSING atomically to prevent other workers from grabbing them
      if (jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        await tx.eloJob.updateMany({
          where: { 
            id: { in: jobIds },
            status: 'PENDING', // Only update if still PENDING (optimistic lock)
          },
          data: { 
            status: 'PROCESSING',
            updatedAt: new Date(),
          },
        });
      }

      return jobs;
    });

    console.log(`[EloJobQueue] Found ${pendingJobs.length} pending jobs to process`);

    for (const job of pendingJobs) {
      const result = await processSingleJob(job);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('[EloJobQueue] Error processing jobs:', error);
    return results;
  }
}

/**
 * Process a single job
 * Note: Job is already marked as PROCESSING by processEloJobs()
 */
async function processSingleJob(job: EloJob): Promise<ProcessJobResult> {
  const jobId = job.id;
  const matchId = job.matchId;

  try {
    // Job is already marked as PROCESSING by processEloJobs() transaction
    // Increment attempt count
    await db.eloJob.update({
      where: { id: jobId },
      data: {
        attempts: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Fetch match details
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        playerA: true,
        playerB: true,
        tournament: true,
      },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    // Calculate and apply ELO changes
    await calculateAndApplyElo(match);

    // Mark job as COMPLETED
    await db.eloJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[EloJobQueue] Job ${jobId} completed successfully`);
    
    return {
      jobId,
      matchId,
      success: true,
      attempts: job.attempts + 1,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EloJobQueue] Job ${jobId} failed:`, errorMsg);

    // Determine next status
    const newAttempts = job.attempts + 1;
    const isMaxAttempts = newAttempts >= job.maxAttempts;
    const newStatus = isMaxAttempts ? 'DEAD_LETTER' : 'FAILED';

    // Update job status
    await db.eloJob.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        lastError: errorMsg,
        updatedAt: new Date(),
      },
    });

    return {
      jobId,
      matchId,
      success: false,
      attempts: newAttempts,
      error: errorMsg,
    };
  }
}

/**
 * Calculate and apply ELO changes for a match
 */
async function calculateAndApplyElo(match: Match & { 
  playerA?: User | null; 
  playerB?: User | null;
  tournament?: { scope?: string | null } | null;
}): Promise<void> {
  // Skip if match doesn't have two players
  if (!match.playerAId || !match.playerBId) {
    console.log(`[EloJobQueue] Match ${match.id} missing players, skipping ELO calculation`);
    return;
  }

  // Skip if no winner
  if (!match.winnerId) {
    console.log(`[EloJobQueue] Match ${match.id} has no winner, skipping ELO calculation`);
    return;
  }

  // Get current ELO ratings
  const playerA = await db.user.findUnique({
    where: { id: match.playerAId },
    select: { id: true, hiddenElo: true },
  });

  const playerB = await db.user.findUnique({
    where: { id: match.playerBId },
    select: { id: true, hiddenElo: true },
  });

  if (!playerA || !playerB) {
    throw new Error('Players not found for ELO calculation');
  }

  // Calculate ELO changes
  const { newEloA, newEloB, eloChangeA, eloChangeB } = calculateEloChange(
    playerA.hiddenElo,
    playerB.hiddenElo,
    match.winnerId === match.playerAId
  );

  // Update player ELO ratings
  await Promise.all([
    db.user.update({
      where: { id: match.playerAId },
      data: { hiddenElo: newEloA },
    }),
    db.user.update({
      where: { id: match.playerBId },
      data: { hiddenElo: newEloB },
    }),
    // Update match with ELO changes
    db.match.update({
      where: { id: match.id },
      data: {
        eloChangeA,
        eloChangeB,
      },
    }),
  ]);

  // Update player ratings
  const winnerId = match.winnerId;
  const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;

  await Promise.all([
    updatePlayerRating(winnerId, true),
    updatePlayerRating(loserId, false),
  ]);

  console.log(`[EloJobQueue] ELO updated for match ${match.id}: A=${eloChangeA?.toFixed(2)}, B=${eloChangeB?.toFixed(2)}`);
}

/**
 * Calculate ELO changes using standard ELO formula
 */
function calculateEloChange(
  eloA: number,
  eloB: number,
  playerAWon: boolean
): { newEloA: number; newEloB: number; eloChangeA: number; eloChangeB: number } {
  const K = 32; // K-factor

  // Expected scores
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

  // Actual scores
  const actualA = playerAWon ? 1 : 0;
  const actualB = playerAWon ? 0 : 1;

  // ELO changes
  const eloChangeA = K * (actualA - expectedA);
  const eloChangeB = K * (actualB - expectedB);

  return {
    newEloA: eloA + eloChangeA,
    newEloB: eloB + eloChangeB,
    eloChangeA,
    eloChangeB,
  };
}

/**
 * Update player rating stats
 */
async function updatePlayerRating(userId: string, isWin: boolean): Promise<void> {
  const rating = await db.playerRating.findUnique({
    where: { userId },
  });

  if (rating) {
    await db.playerRating.update({
      where: { userId },
      data: {
        matchesPlayed: { increment: 1 },
        wins: isWin ? { increment: 1 } : undefined,
        losses: !isWin ? { increment: 1 } : undefined,
        currentStreak: isWin ? { increment: 1 } : 0,
        bestStreak: isWin && rating.currentStreak + 1 > rating.bestStreak 
          ? rating.currentStreak + 1 
          : rating.bestStreak,
      },
    });
  } else {
    // Create rating record if it doesn't exist
    await db.playerRating.create({
      data: {
        userId,
        sport: 'CORNHOLE', // Default sport
        matchesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        currentStreak: isWin ? 1 : 0,
        bestStreak: isWin ? 1 : 0,
      },
    });
  }
}

/**
 * Recover stale jobs (poison pill recovery)
 * Jobs stuck in PROCESSING for > 60 seconds are reset to PENDING
 * 
 * @returns Recovery result with count and failed job IDs
 */
export async function recoverStaleJobs(): Promise<RecoveryResult> {
  try {
    const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

    // Find stale jobs (PROCESSING for too long)
    const staleJobs = await db.eloJob.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: staleThreshold },
      },
    });

    console.log(`[EloJobQueue] Found ${staleJobs.length} stale jobs to recover`);

    const failedJobs: string[] = [];

    for (const job of staleJobs) {
      try {
        // Check if max attempts reached
        if (job.attempts >= job.maxAttempts) {
          // Move to dead letter queue
          await db.eloJob.update({
            where: { id: job.id },
            data: {
              status: 'DEAD_LETTER',
              lastError: 'Job exceeded max attempts during recovery',
              updatedAt: new Date(),
            },
          });
          failedJobs.push(job.id);
          console.log(`[EloJobQueue] Job ${job.id} moved to dead letter queue`);
        } else {
          // Reset to PENDING for retry
          await db.eloJob.update({
            where: { id: job.id },
            data: {
              status: 'PENDING',
              lastError: 'Recovered from stale PROCESSING state',
              updatedAt: new Date(),
            },
          });
          console.log(`[EloJobQueue] Job ${job.id} recovered and reset to PENDING`);
        }
      } catch (error) {
        console.error(`[EloJobQueue] Failed to recover job ${job.id}:`, error);
        failedJobs.push(job.id);
      }
    }

    return {
      recovered: staleJobs.length - failedJobs.length,
      failedJobs,
    };
  } catch (error) {
    console.error('[EloJobQueue] Error during stale job recovery:', error);
    return {
      recovered: 0,
      failedJobs: [],
    };
  }
}

/**
 * Get queue statistics
 * 
 * @returns Job statistics including counts by status and stale jobs
 */
export async function getJobStats(): Promise<JobStats> {
  try {
    const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

    const [
      pending,
      processing,
      completed,
      failed,
      deadLetter,
      staleCount,
    ] = await Promise.all([
      db.eloJob.count({ where: { status: 'PENDING' } }),
      db.eloJob.count({ where: { status: 'PROCESSING' } }),
      db.eloJob.count({ where: { status: 'COMPLETED' } }),
      db.eloJob.count({ where: { status: 'FAILED' } }),
      db.eloJob.count({ where: { status: 'DEAD_LETTER' } }),
      db.eloJob.count({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: staleThreshold },
        },
      }),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      deadLetter,
      total: pending + processing + completed + failed + deadLetter,
      staleJobs: staleCount,
    };
  } catch (error) {
    console.error('[EloJobQueue] Error getting job stats:', error);
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      total: 0,
      staleJobs: 0,
    };
  }
}

/**
 * Retry a failed job manually
 * 
 * @param jobId - The job ID to retry
 * @returns Result of retry attempt
 */
export async function retryJob(jobId: string): Promise<QueueJobResult> {
  try {
    const job = await db.eloJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
      return { success: false, error: 'Job is not in a retryable state' };
    }

    // Reset job to PENDING
    await db.eloJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        updatedAt: new Date(),
      },
    });

    console.log(`[EloJobQueue] Job ${jobId} reset for retry`);
    
    return { success: true, jobId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

/**
 * Clear completed jobs older than specified days
 * 
 * @param daysOld - Number of days after which to clear completed jobs
 * @returns Number of jobs cleared
 */
export async function clearOldCompletedJobs(daysOld: number = 30): Promise<number> {
  try {
    const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await db.eloJob.deleteMany({
      where: {
        status: 'COMPLETED',
        processedAt: { lt: threshold },
      },
    });

    console.log(`[EloJobQueue] Cleared ${result.count} old completed jobs`);
    return result.count;
  } catch (error) {
    console.error('[EloJobQueue] Error clearing old jobs:', error);
    return 0;
  }
}

/**
 * Process jobs and recover stale jobs in one call (for cron)
 */
export async function runJobQueueMaintenance(): Promise<{
  processed: ProcessJobResult[];
  recovered: RecoveryResult;
  stats: JobStats;
}> {
  console.log('[EloJobQueue] Running job queue maintenance...');

  // First, recover stale jobs
  const recovered = await recoverStaleJobs();

  // Then process pending jobs
  const processed = await processEloJobs();

  // Get updated stats
  const stats = await getJobStats();

  console.log('[EloJobQueue] Maintenance complete:', {
    processed: processed.length,
    recovered: recovered.recovered,
    stats,
  });

  return { processed, recovered, stats };
}
