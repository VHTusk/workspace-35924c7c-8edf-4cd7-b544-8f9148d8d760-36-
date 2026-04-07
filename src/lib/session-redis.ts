/**
 * Redis Session Storage for VALORHIVE
 * 
 * Implements Redis-backed session management for:
 * - Distributed session storage across instances
 * - Session TTL and sliding expiration
 * - Multi-device session management
 * - Session cleanup for expired sessions
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string
 * - SESSION_TTL: Session TTL in seconds (default: 7 days)
 * - SESSION sliding_expiration: Enable sliding expiration (default: true)
 */

import IORedis from 'ioredis';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';

const logger = createLogger('RedisSession');

// ============================================
// Types and Interfaces
// ============================================

export interface SessionData {
  id: string;
  userId?: string;
  orgId?: string;
  sport: string;
  accountType: 'PLAYER' | 'ORG';
  expiresAt: number; // Unix timestamp
  createdAt: number;
  lastActivityAt: number;
  deviceInfo?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  operatorName?: string;
  operatorEmail?: string;
  refreshTokenId?: string;
  isRedisBacked: boolean;
}

export interface SessionCreateOptions {
  userId?: string;
  orgId?: string;
  sport: string;
  accountType: 'PLAYER' | 'ORG';
  ttlSeconds?: number;
  deviceInfo?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  operatorName?: string;
  operatorEmail?: string;
  refreshTokenId?: string;
}

export interface SessionUpdateOptions {
  lastActivityAt?: number;
  deviceInfo?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  expiresAt?: number;
}

export interface SessionFilter {
  userId?: string;
  orgId?: string;
  sport?: string;
  accountType?: 'PLAYER' | 'ORG';
  deviceFingerprint?: string;
}

// ============================================
// Configuration
// ============================================

const SESSION_PREFIX = 'session:';
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '604800', 10); // 7 days default
const SLIDING_EXPIRATION = process.env.SESSION_SLIDING_EXPIRATION !== 'false';
const SESSION_CLEANUP_INTERVAL = parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600000', 10); // 1 hour

let redisClient: IORedis | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

// ============================================
// Initialization
// ============================================

/**
 * Initialize Redis session storage
 */
export async function initializeRedisSession(): Promise<boolean> {
  try {
    redisClient = await getPrimaryClient();
    
    if (!redisClient) {
      logger.warn('Redis client not available, falling back to database sessions');
      return false;
    }

    // Start cleanup interval
    startCleanupInterval();
    
    logger.info('Redis session storage initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis session storage:', error);
    return false;
  }
}

/**
 * Get Redis client (lazy initialization)
 */
async function getClient(): Promise<IORedis | null> {
  if (!redisClient) {
    redisClient = await getPrimaryClient();
  }
  return redisClient;
}

// ============================================
// Session Operations
// ============================================

/**
 * Create a new session in Redis
 */
export async function createSession(
  token: string,
  options: SessionCreateOptions
): Promise<SessionData | null> {
  const client = await getClient();
  
  if (!client) {
    logger.warn('Redis not available for session creation');
    return null;
  }

  const ttl = options.ttlSeconds || SESSION_TTL;
  const now = Date.now();
  
  const session: SessionData = {
    id: token,
    userId: options.userId,
    orgId: options.orgId,
    sport: options.sport,
    accountType: options.accountType,
    expiresAt: now + (ttl * 1000),
    createdAt: now,
    lastActivityAt: now,
    deviceInfo: options.deviceInfo,
    ipAddress: options.ipAddress,
    deviceFingerprint: options.deviceFingerprint,
    operatorName: options.operatorName,
    operatorEmail: options.operatorEmail,
    refreshTokenId: options.refreshTokenId,
    isRedisBacked: true,
  };

  try {
    const key = `${SESSION_PREFIX}${token}`;
    
    // Store session with TTL
    await client.setex(
      key,
      ttl,
      JSON.stringify(session)
    );

    // Add to user/org index for quick lookup
    if (options.userId) {
      await client.sadd(`user_sessions:${options.userId}`, token);
      await client.expire(`user_sessions:${options.userId}`, ttl);
    }
    
    if (options.orgId) {
      await client.sadd(`org_sessions:${options.orgId}`, token);
      await client.expire(`org_sessions:${options.orgId}`, ttl);
    }

    logger.debug(`Session created: ${token.substring(0, 8)}...`);
    return session;
  } catch (error) {
    logger.error('Failed to create session in Redis:', error);
    return null;
  }
}

/**
 * Get a session from Redis
 */
export async function getSession(token: string): Promise<SessionData | null> {
  const client = await getClient();
  
  if (!client) {
    return null;
  }

  try {
    const key = `${SESSION_PREFIX}${token}`;
    const data = await client.get(key);
    
    if (!data) {
      return null;
    }

    const session = JSON.parse(data) as SessionData;
    
    // Check if expired
    if (session.expiresAt < Date.now()) {
      await deleteSession(token);
      return null;
    }

    // Apply sliding expiration
    if (SLIDING_EXPIRATION) {
      const ttlRemaining = Math.floor((session.expiresAt - Date.now()) / 1000);
      if (ttlRemaining > 0) {
        await client.expire(key, ttlRemaining);
      }
    }

    return session;
  } catch (error) {
    logger.error('Failed to get session from Redis:', error);
    return null;
  }
}

/**
 * Update a session in Redis
 */
export async function updateSession(
  token: string,
  updates: SessionUpdateOptions
): Promise<SessionData | null> {
  const client = await getClient();
  
  if (!client) {
    return null;
  }

  try {
    const session = await getSession(token);
    
    if (!session) {
      return null;
    }

    // Apply updates
    const updatedSession: SessionData = {
      ...session,
      ...updates,
      lastActivityAt: updates.lastActivityAt || Date.now(),
    };

    // Handle TTL extension
    if (updates.expiresAt) {
      const newTtl = Math.floor((updates.expiresAt - Date.now()) / 1000);
      if (newTtl > 0) {
        const key = `${SESSION_PREFIX}${token}`;
        await client.setex(key, newTtl, JSON.stringify(updatedSession));
      }
    } else {
      const key = `${SESSION_PREFIX}${token}`;
      const ttlRemaining = Math.floor((session.expiresAt - Date.now()) / 1000);
      if (ttlRemaining > 0) {
        await client.setex(key, ttlRemaining, JSON.stringify(updatedSession));
      }
    }

    return updatedSession;
  } catch (error) {
    logger.error('Failed to update session in Redis:', error);
    return null;
  }
}

/**
 * Delete a session from Redis
 */
export async function deleteSession(token: string): Promise<boolean> {
  const client = await getClient();
  
  if (!client) {
    return false;
  }

  try {
    // Get session first to remove from indexes
    const session = await getSession(token);
    
    const key = `${SESSION_PREFIX}${token}`;
    await client.del(key);
    
    // Remove from indexes
    if (session?.userId) {
      await client.srem(`user_sessions:${session.userId}`, token);
    }
    
    if (session?.orgId) {
      await client.srem(`org_sessions:${session.orgId}`, token);
    }

    logger.debug(`Session deleted: ${token.substring(0, 8)}...`);
    return true;
  } catch (error) {
    logger.error('Failed to delete session from Redis:', error);
    return false;
  }
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const client = await getClient();
  
  if (!client) {
    return 0;
  }

  try {
    const tokens = await client.smembers(`user_sessions:${userId}`);
    let deleted = 0;
    
    for (const token of tokens) {
      if (await deleteSession(token)) {
        deleted++;
      }
    }
    
    await client.del(`user_sessions:${userId}`);
    
    logger.info(`Deleted ${deleted} sessions for user ${userId}`);
    return deleted;
  } catch (error) {
    logger.error('Failed to delete user sessions:', error);
    return 0;
  }
}

/**
 * Delete all sessions for an organization
 */
export async function deleteOrgSessions(orgId: string): Promise<number> {
  const client = await getClient();
  
  if (!client) {
    return 0;
  }

  try {
    const tokens = await client.smembers(`org_sessions:${orgId}`);
    let deleted = 0;
    
    for (const token of tokens) {
      if (await deleteSession(token)) {
        deleted++;
      }
    }
    
    await client.del(`org_sessions:${orgId}`);
    
    logger.info(`Deleted ${deleted} sessions for org ${orgId}`);
    return deleted;
  } catch (error) {
    logger.error('Failed to delete org sessions:', error);
    return 0;
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionData[]> {
  const client = await getClient();
  
  if (!client) {
    return [];
  }

  try {
    const tokens = await client.smembers(`user_sessions:${userId}`);
    const sessions: SessionData[] = [];
    
    for (const token of tokens) {
      const session = await getSession(token);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  } catch (error) {
    logger.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Get session count for a user
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const client = await getClient();
  
  if (!client) {
    return 0;
  }

  try {
    return await client.scard(`user_sessions:${userId}`);
  } catch (error) {
    logger.error('Failed to get user session count:', error);
    return 0;
  }
}

/**
 * Extend session TTL
 */
export async function extendSession(
  token: string,
  additionalSeconds: number
): Promise<boolean> {
  const client = await getClient();
  
  if (!client) {
    return false;
  }

  try {
    const session = await getSession(token);
    
    if (!session) {
      return false;
    }

    const newExpiresAt = session.expiresAt + (additionalSeconds * 1000);
    const newTtl = Math.floor((newExpiresAt - Date.now()) / 1000);
    
    if (newTtl <= 0) {
      return false;
    }

    const key = `${SESSION_PREFIX}${token}`;
    session.expiresAt = newExpiresAt;
    
    await client.setex(key, newTtl, JSON.stringify(session));
    
    return true;
  } catch (error) {
    logger.error('Failed to extend session:', error);
    return false;
  }
}

// ============================================
// Session Cleanup
// ============================================

/**
 * Start automatic cleanup interval
 */
function startCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(async () => {
    await cleanupExpiredSessions();
  }, SESSION_CLEANUP_INTERVAL);

  // Don't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const client = await getClient();
  
  if (!client) {
    return 0;
  }

  try {
    let cleaned = 0;
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${SESSION_PREFIX}*`,
        'COUNT',
        100
      );
      
      cursor = nextCursor;
      
      for (const key of keys) {
        const data = await client.get(key);
        
        if (data) {
          try {
            const session = JSON.parse(data) as SessionData;
            
            if (session.expiresAt < Date.now()) {
              const token = key.replace(SESSION_PREFIX, '');
              await deleteSession(token);
              cleaned++;
            }
          } catch {
            // Invalid JSON, delete the key
            await client.del(key);
            cleaned++;
          }
        }
      }
    } while (cursor !== '0');

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
    
    return cleaned;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Stop cleanup interval
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// ============================================
// Health Check
// ============================================

/**
 * Get Redis session storage stats
 */
export async function getSessionStats(): Promise<{
  totalSessions: number;
  keyspace: Record<string, string>;
}> {
  const client = await getClient();
  
  if (!client) {
    return { totalSessions: 0, keyspace: {} };
  }

  try {
    let totalSessions = 0;
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${SESSION_PREFIX}*`,
        'COUNT',
        100
      );
      
      cursor = nextCursor;
      totalSessions += keys.length;
    } while (cursor !== '0');

    const info = await client.info('keyspace');
    const keyspace: Record<string, string> = {};
    
    for (const line of info.split('\n')) {
      if (line.startsWith('db')) {
        const [db, stats] = line.split(':');
        keyspace[db] = stats?.trim() || '';
      }
    }

    return { totalSessions, keyspace };
  } catch (error) {
    logger.error('Failed to get session stats:', error);
    return { totalSessions: 0, keyspace: {} };
  }
}

// ============================================
// Shutdown
// ============================================

/**
 * Shutdown Redis session storage
 */
export function shutdownRedisSession(): void {
  stopCleanupInterval();
  redisClient = null;
  logger.info('Redis session storage shutdown');
}
