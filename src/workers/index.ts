/**
 * VALORHIVE Background Worker Service
 * 
 * Entry point for background job processing
 * Handles: emails, notifications, ELO, brackets, reports
 * 
 * Uses BullMQ with Redis for job queue management
 * 
 * All handlers call service functions directly (no HTTP overhead)
 */

import { Worker, Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import logger from '@/lib/logger';
import { workerHandlers, JobResult } from '@/lib/workers/handlers';

// ============================================
// Configuration
// ============================================

const REDIS_URL = process.env.REDIS_URL;
const QUEUE_NAME = process.env.QUEUE_NAME || 'valorhive-jobs';
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '10', 10);

// ============================================
// Redis Connection
// ============================================

// Parse Redis URL safely
function parseRedisUrl(): { host: string; port: number; password?: string } {
  const defaults = { host: 'localhost', port: 6379 };
  
  if (!REDIS_URL) {
    return defaults;
  }
  
  try {
    const url = new URL(REDIS_URL);
    const host = url.hostname || defaults.host;
    // Safe port parsing - default to 6379 if port is empty or invalid
    let port = url.port ? parseInt(url.port, 10) : defaults.port;
    if (isNaN(port)) {
      port = defaults.port;
    }
    const password = url.password || undefined;
    
    return { host, port, password };
  } catch (e) {
    logger.warn('Invalid REDIS_URL format, using defaults', { error: e });
    return defaults;
  }
}

const redisConfig = parseRedisUrl();

const connection = new IORedis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', { error: err.message });
});

connection.on('connect', () => {
  logger.info('Connected to Redis');
});

// ============================================
// Job Processing
// ============================================

// Track processed jobs for health metrics
let jobsProcessed = 0;
let jobsFailed = 0;
let lastSuccessAt: Date | null = null;

/**
 * Process a job by calling the appropriate handler directly
 */
async function processJob(job: { id: string; name: string; data: unknown }): Promise<JobResult> {
  const { type, payload } = job.data as { type: string; payload: Record<string, unknown> };
  
  logger.info(`Processing job ${job.id}`, { type });
  
  const handler = workerHandlers[type];
  
  if (!handler) {
    logger.warn(`No handler for job type: ${type}`);
    return { success: false, error: 'Unknown job type' };
  }

  try {
    const result = await handler(payload);
    
    if (result.success) {
      jobsProcessed++;
      lastSuccessAt = new Date();
      logger.info(`Job ${job.id} completed`, { type });
    } else {
      jobsFailed++;
      logger.error(`Job ${job.id} failed`, { type, error: result.error });
      throw new Error(result.error || 'Job failed');
    }
    
    return result;
  } catch (error) {
    jobsFailed++;
    logger.error(`Job ${job.id} threw error`, { 
      type, 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    throw error;
  }
}

// ============================================
// Worker Setup
// ============================================

const worker = new Worker(
  QUEUE_NAME,
  async (job) => processJob(job),
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 100,
      duration: 1000, // 100 jobs per second max
    },
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, { error: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// ============================================
// Health Check Server
// ============================================

import http from 'http';

const HEALTH_PORT = process.env.WORKER_HEALTH_PORT || 3001;

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    const healthy = connection.status === 'ready';
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      queue: QUEUE_NAME,
      concurrency: CONCURRENCY,
      redis: connection.status,
      metrics: {
        jobsProcessed,
        jobsFailed,
        lastSuccessAt,
      },
    }));
  } else if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      queue: QUEUE_NAME,
      concurrency: CONCURRENCY,
      redis: connection.status,
      metrics: {
        jobsProcessed,
        jobsFailed,
        lastSuccessAt,
      },
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Health check server running on port ${HEALTH_PORT}`);
});

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await worker.close();
    await connection.quit();
    healthServer.close();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error instanceof Error ? error.message : 'Unknown' });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// Startup
// ============================================

logger.info('VALORHIVE Background Worker started');
logger.info(`Queue: ${QUEUE_NAME}`);
logger.info(`Concurrency: ${CONCURRENCY}`);
logger.info(`Redis: ${redisConfig.host}:${redisConfig.port}`);
logger.info(`Handlers registered: ${Object.keys(workerHandlers).join(', ')}`);
