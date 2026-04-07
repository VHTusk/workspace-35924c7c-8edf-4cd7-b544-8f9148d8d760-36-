/**
 * VALORHIVE Cron Job Locking System
 * 
 * Provides distributed job locking to prevent concurrent execution of the same job.
 * Essential for ensuring idempotency and preventing duplicate tournament results.
 * 
 * Features:
 * - Redis-backed distributed locks (with in-memory fallback)
 * - Automatic lock expiration
 * - Retry with exponential backoff
 * - Job status tracking
 * 
 * @module cron-job-lock
 */

import type Redis from 'ioredis';

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Default lock timeout (5 minutes)
  DEFAULT_LOCK_TTL_MS: 5 * 60 * 1000,
  
  // Maximum retry attempts
  MAX_RETRIES: 3,
  
  // Base delay for exponential backoff (1 second)
  BASE_RETRY_DELAY_MS: 1000,
  
  // Maximum delay for exponential backoff (30 seconds)
  MAX_RETRY_DELAY_MS: 30 * 1000,
  
  // Key prefix for locks
  LOCK_PREFIX: 'cron:lock:',
  
  // Key prefix for job status
  STATUS_PREFIX: 'cron:status:',
};

// ============================================
// Types
// ============================================

export interface JobLock {
  acquired: boolean;
  lockId: string;
  expiresAt: number;
}

export interface JobStatus {
  name: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  lastRun: Date | null;
  nextRun: Date | null;
  lastError: string | null;
  lastDuration: number | null;
  runCount: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  lockedBy: string | null;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

// ============================================
// In-Memory Store (Fallback)
// ============================================

const memoryLocks = new Map<string, { lockId: string; expiresAt: number }>();
const jobStatuses = new Map<string, JobStatus>();

// Cleanup interval for memory locks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, lock] of memoryLocks.entries()) {
      if (lock.expiresAt < now) {
        memoryLocks.delete(key);
      }
    }
  }, 60 * 1000);
}

// ============================================
// Redis Client (Optional)
// ============================================

let redis: Redis | null = null;
let redisInitialized = false;

async function getRedis() {
  if (redisInitialized) return redis;
  redisInitialized = true;
  
  if (!process.env.REDIS_URL) return null;
  
  try {
    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.ping();
    console.log('[JobLock] Redis connected for distributed locking');
    return redis;
  } catch (error) {
    console.warn('[JobLock] Redis not available, using in-memory locks');
    redis = null;
    return null;
  }
}

// ============================================
// Lock Functions
// ============================================

/**
 * Generate a unique lock ID
 */
function generateLockId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Try to acquire a job lock
 * 
 * @param jobName - Name of the job
 * @param ttlMs - Lock timeout in milliseconds
 * @returns Lock result with acquisition status
 */
export async function acquireLock(jobName: string, ttlMs: number = CONFIG.DEFAULT_LOCK_TTL_MS): Promise<JobLock> {
  const lockKey = `${CONFIG.LOCK_PREFIX}${jobName}`;
  const lockId = generateLockId();
  const expiresAt = Date.now() + ttlMs;
  
  const redisClient = await getRedis();
  
  if (redisClient) {
    // Use Redis SETNX for atomic lock acquisition
    const acquired = await redisClient.set(lockKey, lockId, 'PX', ttlMs, 'NX');
    
    if (acquired === 'OK') {
      return { acquired: true, lockId, expiresAt };
    }
    
    // Check if existing lock has expired
    const existingLock = await redisClient.get(lockKey);
    const ttl = await redisClient.pttl(lockKey);
    
    return { 
      acquired: false, 
      lockId: existingLock || '', 
      expiresAt: Date.now() + (ttl > 0 ? ttl : 0) 
    };
  }
  
  // In-memory lock
  const existingLock = memoryLocks.get(lockKey);
  
  if (!existingLock || existingLock.expiresAt < Date.now()) {
    memoryLocks.set(lockKey, { lockId, expiresAt });
    return { acquired: true, lockId, expiresAt };
  }
  
  return { acquired: false, lockId: existingLock.lockId, expiresAt: existingLock.expiresAt };
}

/**
 * Release a job lock
 * 
 * @param jobName - Name of the job
 * @param lockId - Lock ID to release
 */
export async function releaseLock(jobName: string, lockId: string): Promise<void> {
  const lockKey = `${CONFIG.LOCK_PREFIX}${jobName}`;
  const redisClient = await getRedis();
  
  if (redisClient) {
    // Only release if the lock ID matches (prevents releasing another process's lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redisClient.eval(script, 1, lockKey, lockId);
    return;
  }
  
  // In-memory release
  const existingLock = memoryLocks.get(lockKey);
  if (existingLock?.lockId === lockId) {
    memoryLocks.delete(lockKey);
  }
}

/**
 * Extend a lock's TTL
 */
export async function extendLock(jobName: string, lockId: string, additionalMs: number): Promise<boolean> {
  const lockKey = `${CONFIG.LOCK_PREFIX}${jobName}`;
  const redisClient = await getRedis();
  
  if (redisClient) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await redisClient.eval(script, 1, lockKey, lockId, additionalMs);
    return result === 1;
  }
  
  const existingLock = memoryLocks.get(lockKey);
  if (existingLock?.lockId === lockId) {
    existingLock.expiresAt = Date.now() + additionalMs;
    return true;
  }
  
  return false;
}

// ============================================
// Job Status Functions
// ============================================

/**
 * Get job status
 */
export function getJobStatus(jobName: string): JobStatus {
  const existing = jobStatuses.get(jobName);
  if (existing) return existing;
  
  const status: JobStatus = {
    name: jobName,
    status: 'idle',
    lastRun: null,
    nextRun: null,
    lastError: null,
    lastDuration: null,
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    skipCount: 0,
    lockedBy: null,
  };
  
  jobStatuses.set(jobName, status);
  return status;
}

/**
 * Update job status at start
 */
export function markJobStarted(jobName: string): JobStatus {
  const status = getJobStatus(jobName);
  status.status = 'running';
  status.lastRun = new Date();
  status.runCount++;
  return status;
}

/**
 * Update job status on success
 */
export function markJobSuccess(jobName: string, duration: number): void {
  const status = getJobStatus(jobName);
  status.status = 'success';
  status.lastDuration = duration;
  status.lastError = null;
  status.successCount++;
  status.lockedBy = null;
}

/**
 * Update job status on failure
 */
export function markJobFailure(jobName: string, error: string, duration: number): void {
  const status = getJobStatus(jobName);
  status.status = 'failed';
  status.lastDuration = duration;
  status.lastError = error;
  status.failureCount++;
  status.lockedBy = null;
}

/**
 * Update job status when skipped
 */
export function markJobSkipped(jobName: string, reason: string): void {
  const status = getJobStatus(jobName);
  status.status = 'skipped';
  status.skipCount++;
  status.lockedBy = null;
}

// ============================================
// Retry with Exponential Backoff
// ============================================

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = CONFIG.MAX_RETRIES,
    baseDelayMs = CONFIG.BASE_RETRY_DELAY_MS,
    maxDelayMs = CONFIG.MAX_RETRY_DELAY_MS,
    shouldRetry = () => true,
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.5 * baseDelay;
      const delay = Math.min(baseDelay + jitter, maxDelayMs);
      
      console.log(`[JobLock] Retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
}

// ============================================
// Job Wrapper with Lock and Retry
// ============================================

/**
 * Wrap a job handler with locking and retry logic
 * 
 * @example
 * const safeJob = withLockAndRetry('my-job', async () => {
 *   // Job logic here
 * });
 * 
 * await safeJob();
 */
export function withLockAndRetry(
  jobName: string,
  handler: () => Promise<void>,
  options: {
    lockTtlMs?: number;
    retryOptions?: RetryOptions;
    onSkip?: (reason: string) => void;
  } = {}
): () => Promise<void> {
  const { lockTtlMs = CONFIG.DEFAULT_LOCK_TTL_MS, retryOptions, onSkip } = options;
  
  return async () => {
    // Try to acquire lock
    const lock = await acquireLock(jobName, lockTtlMs);
    
    if (!lock.acquired) {
      const reason = `Job already running (lock expires in ${Math.round((lock.expiresAt - Date.now()) / 1000)}s)`;
      console.log(`[JobLock] Skipping ${jobName}: ${reason}`);
      markJobSkipped(jobName, reason);
      onSkip?.(reason);
      return;
    }
    
    const startTime = Date.now();
    markJobStarted(jobName);
    
    try {
      // Execute with retry
      await withRetry(handler, retryOptions);
      
      const duration = Date.now() - startTime;
      markJobSuccess(jobName, duration);
      console.log(`[JobLock] ${jobName} completed in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      markJobFailure(jobName, errorMsg, duration);
      console.error(`[JobLock] ${jobName} failed after ${duration}ms:`, errorMsg);
      throw error;
      
    } finally {
      // Always release the lock
      await releaseLock(jobName, lock.lockId);
    }
  };
}

// ============================================
// Idempotency Helper
// ============================================

const processedJobs = new Map<string, { result: unknown; timestamp: number }>();

/**
 * Execute a job idempotently (prevent duplicate results)
 */
export async function runIdempotent<T>(
  idempotencyKey: string,
  fn: () => Promise<T>,
  ttlMs: number = 60 * 60 * 1000 // 1 hour default
): Promise<{ result: T; wasCached: boolean }> {
  const redisClient = await getRedis();
  const key = `cron:idempotent:${idempotencyKey}`;
  
  // Check if already processed
  if (redisClient) {
    const cached = await redisClient.get(key);
    if (cached) {
      return { result: JSON.parse(cached) as T, wasCached: true };
    }
  } else {
    const cached = processedJobs.get(key);
    if (cached && cached.timestamp > Date.now() - ttlMs) {
      return { result: cached.result as T, wasCached: true };
    }
  }
  
  // Execute and cache
  const result = await fn();
  
  if (redisClient) {
    await redisClient.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(result));
  } else {
    processedJobs.set(key, { result, timestamp: Date.now() });
    
    // Cleanup old entries
    if (processedJobs.size > 1000) {
      const cutoff = Date.now() - ttlMs;
      for (const [k, v] of processedJobs.entries()) {
        if (v.timestamp < cutoff) {
          processedJobs.delete(k);
        }
      }
    }
  }
  
  return { result, wasCached: false };
}

// ============================================
// Exports
// ============================================

export default {
  acquireLock,
  releaseLock,
  extendLock,
  getJobStatus,
  markJobStarted,
  markJobSuccess,
  markJobFailure,
  markJobSkipped,
  withRetry,
  withLockAndRetry,
  runIdempotent,
};
