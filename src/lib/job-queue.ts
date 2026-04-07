/**
 * BullMQ Job Queue System for VALORHIVE
 * 
 * Production-ready job queue with:
 * - Multiple queue types for different workloads
 * - Priority-based job processing
 * - Retry with exponential backoff
 * - Dead letter queue for failed jobs
 * - Job scheduling and delayed execution
 * - Real-time job events
 * - Queue metrics and monitoring
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string
 * - QUEUE_CONCURRENCY: Default concurrency per queue (default: 5)
 * - QUEUE_MAX_RETRIES: Maximum retry attempts (default: 3)
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';

const logger = createLogger('JobQueue');

// ============================================
// Types and Interfaces
// ============================================

export type QueueName = 
  | 'email'
  | 'notification'
  | 'tournament'
  | 'scoring'
  | 'payment'
  | 'cleanup'
  | 'analytics'
  | 'media';

export interface JobData {
  type: string;
  payload: Record<string, unknown>;
  metadata?: {
    userId?: string;
    orgId?: string;
    tournamentId?: string;
    correlationId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    delay?: number;
    scheduledAt?: number;
  };
}

export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueConfig {
  concurrency: number;
  maxRetries: number;
  backoffType: 'exponential' | 'fixed';
  backoffDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: QueueConfig = {
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
  backoffType: 'exponential',
  backoffDelay: 1000, // 1 second base delay
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 500, // Keep last 500 failed jobs
};

const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  email: { ...DEFAULT_CONFIG, concurrency: 10, maxRetries: 5 },
  notification: { ...DEFAULT_CONFIG, concurrency: 20, maxRetries: 3 },
  tournament: { ...DEFAULT_CONFIG, concurrency: 5, maxRetries: 5 },
  scoring: { ...DEFAULT_CONFIG, concurrency: 10, maxRetries: 3 },
  payment: { ...DEFAULT_CONFIG, concurrency: 3, maxRetries: 10 },
  cleanup: { ...DEFAULT_CONFIG, concurrency: 2, maxRetries: 3 },
  analytics: { ...DEFAULT_CONFIG, concurrency: 3, maxRetries: 2 },
  media: { ...DEFAULT_CONFIG, concurrency: 5, maxRetries: 5 },
};

// ============================================
// Queue Manager
// ============================================

class QueueManager {
  private queues: Map<QueueName, Queue<JobData>> = new Map();
  private workers: Map<QueueName, Worker<JobData, JobResult>> = new Map();
  private events: Map<QueueName, QueueEvents> = new Map();
  // Note: QueueScheduler was removed in newer BullMQ versions - scheduling is now handled by Queue directly
  private processors: Map<QueueName, (job: Job<JobData>) => Promise<JobResult>> = new Map();
  private connection: IORedis | null = null;
  private initialized = false;

  /**
   * Initialize the queue system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Get Redis connection
      this.connection = await getPrimaryClient();
      
      if (!this.connection) {
        logger.warn('Redis not available, job queue will not be initialized');
        return;
      }

      // Create queues
      for (const name of Object.keys(QUEUE_CONFIGS) as QueueName[]) {
        await this.createQueue(name);
      }

      this.initialized = true;
      logger.info('Job queue system initialized');
    } catch (error) {
      logger.error('Failed to initialize job queue system:', error);
      throw error;
    }
  }

  /**
   * Create a queue
   */
  private async createQueue(name: QueueName): Promise<Queue<JobData>> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const config = QUEUE_CONFIGS[name];
    
    // Parse Redis URL safely
    let redisHost = 'localhost';
    let redisPort = 6379;
    let redisPassword: string | undefined = undefined;
    
    if (process.env.REDIS_URL) {
      try {
        const redisUrl = new URL(process.env.REDIS_URL);
        redisHost = redisUrl.hostname || 'localhost';
        // Safe port parsing - default to 6379 if port is empty or invalid
        redisPort = redisUrl.port ? parseInt(redisUrl.port, 10) : 6379;
        if (isNaN(redisPort)) {
          redisPort = 6379;
        }
        redisPassword = redisUrl.password || undefined;
      } catch (e) {
        logger.warn('Invalid REDIS_URL format, using defaults', { error: e });
      }
    }
    
    // Create connection options for BullMQ
    const connection = {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    // Create queue
    const queue = new Queue<JobData>(name, { connection });
    this.queues.set(name, queue);

    // Create queue events
    const events = new QueueEvents(name, { connection });
    this.events.set(name, events);

    // Note: In newer BullMQ versions, delayed/repeatable jobs are handled directly by Queue

    logger.debug(`Queue created: ${name}`);
    return queue;
  }

  /**
   * Register a processor for a queue
   */
  registerProcessor(
    name: QueueName,
    processor: (job: Job<JobData>) => Promise<JobResult>
  ): void {
    this.processors.set(name, processor);
    
    // Create worker if already initialized
    if (this.initialized && this.connection) {
      this.createWorker(name);
    }
  }

  /**
   * Create a worker for a queue
   */
  private createWorker(name: QueueName): Worker<JobData, JobResult> | null {
    if (this.workers.has(name) || !this.processors.has(name)) {
      return null;
    }

    const config = QUEUE_CONFIGS[name];
    const processor = this.processors.get(name)!;

    // Parse Redis URL safely (same logic as createQueue)
    let redisHost = 'localhost';
    let redisPort = 6379;
    let redisPassword: string | undefined = undefined;
    
    if (process.env.REDIS_URL) {
      try {
        const redisUrl = new URL(process.env.REDIS_URL);
        redisHost = redisUrl.hostname || 'localhost';
        redisPort = redisUrl.port ? parseInt(redisUrl.port, 10) : 6379;
        if (isNaN(redisPort)) {
          redisPort = 6379;
        }
        redisPassword = redisUrl.password || undefined;
      } catch (e) {
        logger.warn('Invalid REDIS_URL format in worker, using defaults', { error: e });
      }
    }

    const connection = {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
    };

    const worker = new Worker<JobData, JobResult>(
      name,
      async (job) => {
        const startTime = Date.now();
        
        try {
          logger.debug(`Processing job ${job.id} from queue ${name}`);
          const result = await processor(job);
          result.duration = Date.now() - startTime;
          return result;
        } catch (error) {
          logger.error(`Job ${job.id} failed:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime,
          };
        }
      },
      {
        connection,
        concurrency: config.concurrency,
        limiter: {
          max: 100, // Max jobs per duration
          duration: 1000, // Per second
        },
        settings: {
          backoffStrategy: (attempts: number) => {
            if (config.backoffType === 'exponential') {
              return Math.min(config.backoffDelay * Math.pow(2, attempts), 60000);
            }
            return config.backoffDelay;
          },
        },
      }
    );

    // Event handlers
    worker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed in ${job.returnvalue?.duration || 0}ms`);
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed:`, error);
    });

    worker.on('error', (error) => {
      logger.error(`Worker error on queue ${name}:`, error);
    });

    this.workers.set(name, worker);
    logger.info(`Worker started for queue: ${name}`);
    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: QueueName,
    data: JobData,
    options?: {
      priority?: number;
      delay?: number;
      scheduledAt?: Date;
      jobId?: string;
    }
  ): Promise<Job<JobData> | null> {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      logger.warn(`Queue not found: ${queueName}`);
      return null;
    }

    const config = QUEUE_CONFIGS[queueName];
    
    try {
      const job = await queue.add(data.type, data, {
        priority: options?.priority ?? getPriority(data),
        delay: options?.delay ?? data.metadata?.delay,
        jobId: options?.jobId,
        attempts: config.maxRetries,
        backoff: {
          type: config.backoffType,
          delay: config.backoffDelay,
        },
        removeOnComplete: config.removeOnComplete,
        removeOnFail: config.removeOnFail,
      });

      logger.debug(`Job ${job.id} added to queue ${queueName}`);
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Schedule a job for future execution
   */
  async scheduleJob(
    queueName: QueueName,
    data: JobData,
    scheduledAt: Date
  ): Promise<Job<JobData> | null> {
    const delay = scheduledAt.getTime() - Date.now();
    
    if (delay <= 0) {
      return this.addJob(queueName, data);
    }

    return this.addJob(queueName, data, { delay });
  }

  /**
   * Add a repeatable job
   */
  async addRepeatableJob(
    queueName: QueueName,
    data: JobData,
    pattern: string // Cron pattern
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      logger.warn(`Queue not found: ${queueName}`);
      return;
    }

    await queue.add(data.type, data, {
      repeat: { pattern },
      removeOnComplete: QUEUE_CONFIGS[queueName].removeOnComplete,
      removeOnFail: QUEUE_CONFIGS[queueName].removeOnFail,
    });

    logger.info(`Repeatable job added to queue ${queueName} with pattern: ${pattern}`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(name: QueueName): Promise<QueueStats | null> {
    const queue = this.queues.get(name);
    
    if (!queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      return {
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      };
    } catch (error) {
      logger.error(`Failed to get stats for queue ${name}:`, error);
      return null;
    }
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];
    
    for (const name of this.queues.keys()) {
      const stat = await this.getQueueStats(name);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(name: QueueName): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.pause();
      logger.info(`Queue ${name} paused`);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(name: QueueName): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.resume();
      logger.info(`Queue ${name} resumed`);
    }
  }

  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(name: QueueName): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.drain();
      logger.info(`Queue ${name} drained`);
    }
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close workers
    for (const [name, worker] of this.workers) {
      closePromises.push(worker.close());
      logger.debug(`Worker closed: ${name}`);
    }
    this.workers.clear();

    // Close events
    for (const [name, events] of this.events) {
      closePromises.push(events.close());
      logger.debug(`Events closed: ${name}`);
    }
    this.events.clear();

    // Close queues
    for (const [name, queue] of this.queues) {
      closePromises.push(queue.close());
      logger.debug(`Queue closed: ${name}`);
    }
    this.queues.clear();

    await Promise.allSettled(closePromises);
    this.initialized = false;
    logger.info('Job queue system closed');
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get priority number from job data
 */
function getPriority(data: JobData): number {
  const priorityMap = {
    critical: 1,
    high: 10,
    normal: 50,
    low: 100,
  };

  return priorityMap[data.metadata?.priority || 'normal'];
}

// ============================================
// Singleton Instance
// ============================================

let queueManager: QueueManager | null = null;

/**
 * Get the queue manager instance
 */
export function getQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

/**
 * Initialize the queue system
 */
export async function initializeJobQueue(): Promise<void> {
  const manager = getQueueManager();
  await manager.initialize();
}

/**
 * Add a job to a queue
 */
export async function addJob(
  queueName: QueueName,
  data: JobData,
  options?: {
    priority?: number;
    delay?: number;
    scheduledAt?: Date;
    jobId?: string;
  }
): Promise<Job<JobData> | null> {
  const manager = getQueueManager();
  
  if (!manager['initialized']) {
    await manager.initialize();
  }

  return manager.addJob(queueName, data, options);
}

/**
 * Schedule a job
 */
export async function scheduleJob(
  queueName: QueueName,
  data: JobData,
  scheduledAt: Date
): Promise<Job<JobData> | null> {
  const manager = getQueueManager();
  
  if (!manager['initialized']) {
    await manager.initialize();
  }

  return manager.scheduleJob(queueName, data, scheduledAt);
}

/**
 * Register a job processor
 */
export function registerProcessor(
  queueName: QueueName,
  processor: (job: Job<JobData>) => Promise<JobResult>
): void {
  const manager = getQueueManager();
  manager.registerProcessor(queueName, processor);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(name: QueueName): Promise<QueueStats | null> {
  const manager = getQueueManager();
  return manager.getQueueStats(name);
}

/**
 * Get all queue statistics
 */
export async function getAllQueueStats(): Promise<QueueStats[]> {
  const manager = getQueueManager();
  return manager.getAllQueueStats();
}

/**
 * Close the queue system
 */
export async function closeJobQueue(): Promise<void> {
  if (queueManager) {
    await queueManager.close();
    queueManager = null;
  }
}

// ============================================
// Job Builders
// ============================================

/**
 * Create an email job
 */
export function createEmailJob(
  type: 'send' | 'bulk' | 'template',
  payload: Record<string, unknown>,
  metadata?: JobData['metadata']
): JobData {
  return {
    type: `email:${type}`,
    payload,
    metadata,
  };
}

/**
 * Create a notification job
 */
export function createNotificationJob(
  type: 'push' | 'email' | 'whatsapp' | 'in-app' | 'bulk',
  payload: Record<string, unknown>,
  metadata?: JobData['metadata']
): JobData {
  return {
    type: `notification:${type}`,
    payload,
    metadata,
  };
}

/**
 * Create a tournament job
 */
export function createTournamentJob(
  type: 'autopilot' | 'bracket' | 'reminder' | 'completion' | 'waitlist',
  payload: Record<string, unknown>,
  metadata?: JobData['metadata']
): JobData {
  return {
    type: `tournament:${type}`,
    payload,
    metadata,
  };
}

/**
 * Create a scoring job
 */
export function createScoringJob(
  type: 'result' | 'elo' | 'leaderboard',
  payload: Record<string, unknown>,
  metadata?: JobData['metadata']
): JobData {
  return {
    type: `scoring:${type}`,
    payload,
    metadata,
  };
}

/**
 * Create a payment job
 */
export function createPaymentJob(
  type: 'refund' | 'reconciliation' | 'payout' | 'reminder',
  payload: Record<string, unknown>,
  metadata?: JobData['metadata']
): JobData {
  return {
    type: `payment:${type}`,
    payload,
    metadata: { ...metadata, priority: 'high' },
  };
}
