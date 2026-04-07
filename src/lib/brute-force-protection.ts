/**
 * VALORHIVE Brute Force Protection
 * 
 * Implements protection against brute force attacks on authentication endpoints.
 * 
 * Features:
 * - Track failed login attempts by email, phone, and IP
 * - Progressive lockout delays
 * - Account lockout after max attempts
 * - Redis-backed for distributed protection (with in-memory fallback)
 * 
 * @module brute-force-protection
 */

import { db } from '@/lib/db';
import { ACCOUNT_LOCKOUT } from '@/lib/constants';
import type Redis from 'ioredis';

// ============================================
// Types
// ============================================

interface FailedAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

interface LockoutResult {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutUntil?: Date;
  reason?: string;
}

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Maximum failed attempts before lockout
  MAX_FAILED_ATTEMPTS: ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS,
  
  // Lockout duration in milliseconds
  LOCKOUT_DURATION_MS: ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MINUTES * 60 * 1000,
  
  // Window for counting failed attempts (15 minutes)
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,
  
  // Progressive delay thresholds
  PROGRESSIVE_DELAYS: [
    { afterAttempts: 3, delayMs: 30 * 1000 },     // 30 seconds after 3 attempts
    { afterAttempts: 5, delayMs: 60 * 1000 },     // 1 minute after 5 attempts
    { afterAttempts: 7, delayMs: 5 * 60 * 1000 }, // 5 minutes after 7 attempts
  ],
  
  // Key prefixes for tracking
  KEY_PREFIXES: {
    EMAIL: 'bf:email:',
    PHONE: 'bf:phone:',
    IP: 'bf:ip:',
    GLOBAL: 'bf:global:',
  },
};

// ============================================
// In-Memory Store (Fallback)
// ============================================

const memoryStore = new Map<string, FailedAttempt>();

// Cleanup interval for memory store
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      // Remove entries older than the attempt window + lockout duration
      if (now - value.lastAttempt > CONFIG.ATTEMPT_WINDOW_MS + CONFIG.LOCKOUT_DURATION_MS) {
        memoryStore.delete(key);
      }
    }
  }, 60 * 1000); // Cleanup every minute
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
    console.log('[BruteForce] Redis connected for distributed protection');
    return redis;
  } catch (error) {
    console.warn('[BruteForce] Redis not available, using in-memory fallback');
    redis = null;
    return null;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get failed attempts for a key
 */
async function getFailedAttempts(key: string): Promise<FailedAttempt | null> {
  const redisClient = await getRedis();
  
  if (redisClient) {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  }
  
  return memoryStore.get(key) || null;
}

/**
 * Set failed attempts for a key
 */
async function setFailedAttempts(key: string, data: FailedAttempt): Promise<void> {
  const redisClient = await getRedis();
  
  if (redisClient) {
    // Set with expiry (attempt window + lockout duration)
    const ttl = Math.ceil((CONFIG.ATTEMPT_WINDOW_MS + CONFIG.LOCKOUT_DURATION_MS) / 1000);
    await redisClient.setex(key, ttl, JSON.stringify(data));
    return;
  }
  
  memoryStore.set(key, data);
}

/**
 * Delete failed attempts for a key
 */
async function clearStoredFailedAttempts(key: string): Promise<void> {
  const redisClient = await getRedis();
  
  if (redisClient) {
    await redisClient.del(key);
    return;
  }
  
  memoryStore.delete(key);
}

/**
 * Get progressive delay based on attempt count
 */
function getProgressiveDelay(attemptCount: number): number {
  for (let i = CONFIG.PROGRESSIVE_DELAYS.length - 1; i >= 0; i--) {
    const threshold = CONFIG.PROGRESSIVE_DELAYS[i];
    if (attemptCount >= threshold.afterAttempts) {
      return threshold.delayMs;
    }
  }
  return 0;
}

// ============================================
// Main Functions
// ============================================

/**
 * Check if an identifier (email, phone, or IP) is locked out
 * 
 * @param identifier - The identifier to check
 * @param type - The type of identifier (email, phone, ip)
 * @returns Lockout result with status and remaining attempts
 */
export async function checkLockout(
  identifier: string,
  type: 'email' | 'phone' | 'ip'
): Promise<LockoutResult> {
  const prefix = CONFIG.KEY_PREFIXES[type.toUpperCase() as keyof typeof CONFIG.KEY_PREFIXES];
  const key = `${prefix}${identifier.toLowerCase()}`;
  
  const attempts = await getFailedAttempts(key);
  
  if (!attempts) {
    return {
      isLocked: false,
      remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
    };
  }
  
  const now = Date.now();
  
  // Check if currently locked out
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: new Date(attempts.lockedUntil),
      reason: `Account temporarily locked due to too many failed attempts. Try again after ${new Date(attempts.lockedUntil).toLocaleTimeString()}`,
    };
  }
  
  // Check if attempt window has expired (reset counter)
  if (now - attempts.firstAttempt > CONFIG.ATTEMPT_WINDOW_MS) {
    await clearStoredFailedAttempts(key);
    return {
      isLocked: false,
      remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
    };
  }
  
  // Check progressive delay
  const delay = getProgressiveDelay(attempts.count);
  if (delay > 0 && now - attempts.lastAttempt < delay) {
    const retryAfter = new Date(attempts.lastAttempt + delay);
    return {
      isLocked: true,
      remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS - attempts.count,
      lockoutUntil: retryAfter,
      reason: `Too many attempts. Please wait ${Math.ceil(delay / 1000)} seconds before trying again.`,
    };
  }
  
  return {
    isLocked: false,
    remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS - attempts.count,
  };
}

/**
 * Record a failed login attempt
 * 
 * @param identifier - The identifier that failed
 * @param type - The type of identifier
 * @param ip - The IP address of the request (for additional tracking)
 */
export async function recordFailedAttempt(
  identifier: string,
  type: 'email' | 'phone' | 'ip',
  ip?: string
): Promise<LockoutResult> {
  const prefix = CONFIG.KEY_PREFIXES[type.toUpperCase() as keyof typeof CONFIG.KEY_PREFIXES];
  const key = `${prefix}${identifier.toLowerCase()}`;
  
  const now = Date.now();
  let attempts = await getFailedAttempts(key);
  
  if (!attempts || now - attempts.firstAttempt > CONFIG.ATTEMPT_WINDOW_MS) {
    // Start new attempt tracking
    attempts = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
  } else {
    // Increment existing attempts
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Check if should lock out
    if (attempts.count >= CONFIG.MAX_FAILED_ATTEMPTS) {
      attempts.lockedUntil = now + CONFIG.LOCKOUT_DURATION_MS;
    }
  }
  
  await setFailedAttempts(key, attempts);
  
  // Also track by IP if provided (for detecting distributed attacks)
  if (ip && type !== 'ip') {
    const ipKey = `${CONFIG.KEY_PREFIXES.IP}${ip}`;
    let ipAttempts = await getFailedAttempts(ipKey);
    
    if (!ipAttempts || now - ipAttempts.firstAttempt > CONFIG.ATTEMPT_WINDOW_MS) {
      ipAttempts = {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
    } else {
      ipAttempts.count++;
      ipAttempts.lastAttempt = now;
    }
    
    await setFailedAttempts(ipKey, ipAttempts);
  }
  
  // Return current lockout status
  return checkLockout(identifier, type);
}

/**
 * Clear failed attempts after successful login
 * 
 * @param identifier - The identifier to clear
 * @param type - The type of identifier
 */
export async function clearFailedAttempts(
  identifier: string,
  type: 'email' | 'phone' | 'ip'
): Promise<void> {
  const prefix = CONFIG.KEY_PREFIXES[type.toUpperCase() as keyof typeof CONFIG.KEY_PREFIXES];
  const key = `${prefix}${identifier.toLowerCase()}`;
  
  await clearStoredFailedAttempts(key);
}

/**
 * Check if an IP is rate limited for login attempts
 * (Stricter limits for IP-based tracking to prevent distributed attacks)
 */
export async function checkIpRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `${CONFIG.KEY_PREFIXES.IP}${ip}`;
  const attempts = await getFailedAttempts(key);
  
  if (!attempts) {
    return { allowed: true };
  }
  
  const now = Date.now();
  
  // Reset if outside window
  if (now - attempts.firstAttempt > CONFIG.ATTEMPT_WINDOW_MS) {
    return { allowed: true };
  }
  
  // Check progressive delay
  const delay = getProgressiveDelay(attempts.count);
  if (delay > 0 && now - attempts.lastAttempt < delay) {
    return {
      allowed: false,
      retryAfter: Math.ceil((attempts.lastAttempt + delay - now) / 1000),
    };
  }
  
  // Allow max 10 attempts per IP per window
  if (attempts.count >= 10) {
    return {
      allowed: false,
      retryAfter: Math.ceil((attempts.firstAttempt + CONFIG.ATTEMPT_WINDOW_MS - now) / 1000),
    };
  }
  
  return { allowed: true };
}

/**
 * Get brute force protection stats (for admin dashboard)
 */
export async function getProtectionStats(): Promise<{
  activeLockouts: number;
  topIps: Array<{ ip: string; attempts: number }>;
}> {
  const redisClient = await getRedis();
  
  if (redisClient) {
    const keys = await redisClient.keys(`${CONFIG.KEY_PREFIXES.GLOBAL}*`);
    let activeLockouts = 0;
    const ipAttempts: Map<string, number> = new Map();
    
    for (const key of keys) {
      const data = await getFailedAttempts(key);
      if (data?.lockedUntil && data.lockedUntil > Date.now()) {
        activeLockouts++;
      }
      if (key.startsWith(CONFIG.KEY_PREFIXES.IP)) {
        const ip = key.replace(CONFIG.KEY_PREFIXES.IP, '');
        ipAttempts.set(ip, data?.count || 0);
      }
    }
    
    const topIps = Array.from(ipAttempts.entries())
      .map(([ip, attempts]) => ({ ip, attempts }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);
    
    return { activeLockouts, topIps };
  }
  
  // Memory store stats
  let activeLockouts = 0;
  const ipAttempts: Map<string, number> = new Map();
  
  for (const [key, data] of memoryStore.entries()) {
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      activeLockouts++;
    }
    if (key.startsWith(CONFIG.KEY_PREFIXES.IP)) {
      const ip = key.replace(CONFIG.KEY_PREFIXES.IP, '');
      ipAttempts.set(ip, data.count);
    }
  }
  
  const topIps = Array.from(ipAttempts.entries())
    .map(([ip, attempts]) => ({ ip, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 10);
  
  return { activeLockouts, topIps };
}

export default {
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  checkIpRateLimit,
  getProtectionStats,
};
