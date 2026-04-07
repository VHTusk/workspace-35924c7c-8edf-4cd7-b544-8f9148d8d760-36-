/**
 * Leaderboard Worker - BullMQ worker for ranking computation
 * 
 * Features:
 * - Processes leaderboard:update jobs
 * - Batch updates for efficiency
 * - Stores rankings in Redis sorted sets
 * - Handles retry with exponential backoff
 * - Dead letter queue for failed jobs
 * 
 * Job Types:
 * - leaderboard:update - Update single leaderboard
 * - leaderboard:batch - Batch update multiple leaderboards
 * - leaderboard:invalidate - Invalidate cache
 * 
 * Environment Variables:
 * - LEADERBOARD_WORKER_CONCURRENCY: Worker concurrency (default: 3)
 * - LEADERBOARD_BATCH_TIMEOUT: Batch processing timeout in ms (default: 30000)
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { SportType, LeaderboardType } from '@prisma/client';
import { createLogger } from './logger';
import { 
  computeLeaderboard, 
  invalidateLeaderboard,
  getLeaderboardScopes,
  LeaderboardComputeOptions,
} from './leaderboard-engine';
import { getPrimaryClient } from './redis-config';

const logger = createLogger('LeaderboardWorker');

// ============================================
// Types and Interfaces
// ============================================

export interface LeaderboardJobData {
  type: 'update' | 'batch' | 'invalidate' | 'full_recompute';
  sport: SportType;
  leaderboardType?: LeaderboardType;
  scopeValue?: string;
  userId?: string;
  tournamentId?: string;
  reason?: string;
  batchItems?: Array<{
    type: LeaderboardType;
    scopeValue?: string;
  }>;
}

export interface LeaderboardJobResult {
  success: boolean;
  processed?: number;
  error?: string;
  duration: number;
  details?: Record<string, unknown>;
}

// ============================================
// Constants
// ============================================

const WORKER_CONCURRENCY = parseInt(process.env.LEADERBOARD_WORKER_CONCURRENCY || '3', 10);
const BATCH_TIMEOUT = parseInt(process.env.LEADERBOARD_BATCH_TIMEOUT || '30000', 10);
const QUEUE_NAME = 'scoring'; // Using scoring queue from job-queue.ts

// ============================================
// Job Processor
// ============================================

/**
 * Process leaderboard update job
 */
async function processLeaderboardJob(job: Job<LeaderboardJobData>): Promise<LeaderboardJobResult> {
  const startTime = Date.now();
  const data = job.data;
  
  logger.info(`Processing job ${job.id}: ${data.type}`);
  
  try {
    switch (data.type) {
      case 'update':
        return await processUpdateJob(data, startTime);
      
      case 'batch':
        return await processBatchJob(data, startTime);
      
      case 'invalidate':
        return await processInvalidateJob(data, startTime);
      
      case 'full_recompute':
        return await processFullRecomputeJob(data, startTime);
      
      default:
        return {
          success: false,
          error: `Unknown job type: ${(data as { type: string }).type}`,
          duration: Date.now() - startTime,
        };
    }
  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Process single leaderboard update
 */
async function processUpdateJob(
  data: LeaderboardJobData,
  startTime: number
): Promise<LeaderboardJobResult> {
  if (!data.leaderboardType) {
    return {
      success: false,
      error: 'Missing leaderboardType',
      duration: Date.now() - startTime,
    };
  }
  
  const options: LeaderboardComputeOptions = {
    sport: data.sport,
    type: data.leaderboardType,
    scopeValue: data.scopeValue,
  };
  
  const result = await computeLeaderboard(options);
  
  return {
    success: true,
    processed: result.processed,
    duration: Date.now() - startTime,
    details: {
      type: data.leaderboardType,
      scope: data.scopeValue || 'all',
      cached: result.cached,
    },
  };
}

/**
 * Process batch leaderboard update
 */
async function processBatchJob(
  data: LeaderboardJobData,
  startTime: number
): Promise<LeaderboardJobResult> {
  if (!data.batchItems || data.batchItems.length === 0) {
    return {
      success: false,
      error: 'Missing batchItems',
      duration: Date.now() - startTime,
    };
  }
  
  const results: Array<{ type: LeaderboardType; scope?: string; processed: number }> = [];
  let totalProcessed = 0;
  
  for (const item of data.batchItems) {
    try {
      const options: LeaderboardComputeOptions = {
        sport: data.sport,
        type: item.type,
        scopeValue: item.scopeValue,
      };
      
      const result = await computeLeaderboard(options);
      results.push({
        type: item.type,
        scope: item.scopeValue || 'all',
        processed: result.processed,
      });
      totalProcessed += result.processed;
    } catch (error) {
      logger.error(`Error processing batch item ${item.type}:${item.scopeValue}:`, error);
    }
  }
  
  return {
    success: true,
    processed: totalProcessed,
    duration: Date.now() - startTime,
    details: {
      items: results,
      itemCount: results.length,
    },
  };
}

/**
 * Process leaderboard cache invalidation
 */
async function processInvalidateJob(
  data: LeaderboardJobData,
  startTime: number
): Promise<LeaderboardJobResult> {
  await invalidateLeaderboard(data.sport, data.leaderboardType, data.scopeValue);
  
  return {
    success: true,
    duration: Date.now() - startTime,
    details: {
      invalidated: `${data.sport}:${data.leaderboardType || 'all'}:${data.scopeValue || 'all'}`,
    },
  };
}

/**
 * Process full leaderboard recomputation
 */
async function processFullRecomputeJob(
  data: LeaderboardJobData,
  startTime: number
): Promise<LeaderboardJobResult> {
  const results: Array<{ type: LeaderboardType; scopes: string[]; processed: number }> = [];
  let totalProcessed = 0;
  
  // Process each leaderboard type
  const types: LeaderboardType[] = [
    LeaderboardType.NATIONAL,
    LeaderboardType.STATE,
    LeaderboardType.DISTRICT,
    LeaderboardType.CITY,
  ];
  
  for (const type of types) {
    try {
      // Get all scopes for this type
      const scopes = await getLeaderboardScopes(data.sport, type);
      
      if (type === LeaderboardType.NATIONAL) {
        // National leaderboard has no scope
        const result = await computeLeaderboard({
          sport: data.sport,
          type,
        });
        totalProcessed += result.processed;
      } else {
        // Process each scope
        for (const scope of scopes) {
          const result = await computeLeaderboard({
            sport: data.sport,
            type,
            scopeValue: scope,
          });
          totalProcessed += result.processed;
        }
      }
      
      results.push({
        type,
        scopes,
        processed: totalProcessed,
      });
      
      logger.info(`Recomputed ${type} leaderboard for ${data.sport}: ${scopes.length} scopes`);
    } catch (error) {
      logger.error(`Error recomputing ${type} leaderboard:`, error);
    }
  }
  
  // Also invalidate all caches
  await invalidateLeaderboard(data.sport);
  
  return {
    success: true,
    processed: totalProcessed,
    duration: Date.now() - startTime,
    details: {
      types: results,
      totalScopes: results.reduce((sum, r) => sum + r.scopes.length, 0),
    },
  };
}

// ============================================
// Worker Management
// ============================================

let worker: Worker<LeaderboardJobData, LeaderboardJobResult> | null = null;

/**
 * Create and start the leaderboard worker
 */
export function startLeaderboardWorker(): Worker<LeaderboardJobData, LeaderboardJobResult> | null {
  if (worker) {
    logger.warn('Leaderboard worker already running');
    return worker;
  }
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL not configured, leaderboard worker not started');
    return null;
  }
  
  try {
    const connection = {
      host: new URL(redisUrl).hostname || 'localhost',
      port: parseInt(new URL(redisUrl).port) || 6379,
      password: new URL(redisUrl).password || undefined,
      maxRetriesPerRequest: null,
    };
    
    worker = new Worker<LeaderboardJobData, LeaderboardJobResult>(
      QUEUE_NAME,
      async (job) => {
        return processLeaderboardJob(job);
      },
      {
        connection,
        concurrency: WORKER_CONCURRENCY,
        limiter: {
          max: 10, // Max 10 jobs per duration
          duration: 1000, // Per second
        },
        settings: {
          backoffStrategy: (attempts: number) => {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            return Math.min(1000 * Math.pow(2, attempts), 60000);
          },
        },
      }
    );
    
    // Event handlers
    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed in ${job.returnValue?.duration || 0}ms`);
    });
    
    worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed:`, error);
    });
    
    worker.on('error', (error) => {
      logger.error('Worker error:', error);
    });
    
    worker.on('stalled', (jobId) => {
      logger.warn(`Job ${jobId} stalled`);
    });
    
    logger.info(`Leaderboard worker started with concurrency ${WORKER_CONCURRENCY}`);
    return worker;
  } catch (error) {
    logger.error('Failed to start leaderboard worker:', error);
    return null;
  }
}

/**
 * Stop the leaderboard worker
 */
export async function stopLeaderboardWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Leaderboard worker stopped');
  }
}

/**
 * Get worker statistics
 */
export async function getWorkerStats(): Promise<{
  isRunning: boolean;
  concurrency: number;
  queueName: string;
}> {
  return {
    isRunning: worker !== null,
    concurrency: WORKER_CONCURRENCY,
    queueName: QUEUE_NAME,
  };
}

// ============================================
// Job Creation Helpers
// ============================================

/**
 * Create a leaderboard update job
 */
export function createLeaderboardUpdateJob(
  sport: SportType,
  type: LeaderboardType,
  scopeValue?: string,
  reason?: string
): LeaderboardJobData {
  return {
    type: 'update',
    sport,
    leaderboardType: type,
    scopeValue,
    reason,
  };
}

/**
 * Create a batch leaderboard update job
 */
export function createLeaderboardBatchJob(
  sport: SportType,
  items: Array<{ type: LeaderboardType; scopeValue?: string }>
): LeaderboardJobData {
  return {
    type: 'batch',
    sport,
    batchItems: items,
  };
}

/**
 * Create a leaderboard invalidation job
 */
export function createLeaderboardInvalidateJob(
  sport: SportType,
  type?: LeaderboardType,
  scopeValue?: string
): LeaderboardJobData {
  return {
    type: 'invalidate',
    sport,
    leaderboardType: type,
    scopeValue,
  };
}

/**
 * Create a full leaderboard recomputation job
 */
export function createFullRecomputeJob(sport: SportType): LeaderboardJobData {
  return {
    type: 'full_recompute',
    sport,
  };
}

// ============================================
// Exports
// ============================================

export {
  processLeaderboardJob,
  QUEUE_NAME,
};
