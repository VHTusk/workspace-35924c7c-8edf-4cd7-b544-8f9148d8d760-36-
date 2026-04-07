/**
 * Cache Invalidation Layer for VALORHIVE
 * 
 * Features:
 * - User cache invalidation
 * - Tournament cache invalidation
 * - Leaderboard cache invalidation
 * - Tag-based cache invalidation
 * - Redis pub/sub for cross-instance invalidation
 * - TTL management
 * 
 * @version v3.83.0
 */

import { cache, CACHE_KEYS, CACHE_TTL, cacheDeletePattern } from './cache';

// Re-export for backward compatibility
export const deletePattern = cacheDeletePattern;

// ============================================
// Types and Interfaces
// ============================================

export interface CacheInvalidationOptions {
  /** Tags to invalidate */
  tags?: string[];
  /** Whether to publish invalidation to other instances */
  publishInvalidation?: boolean;
  /** Reason for invalidation (for logging) */
  reason?: string;
}

export interface CacheInvalidationResult {
  /** Number of keys invalidated */
  keysInvalidated: number;
  /** Tags that were invalidated */
  tags: string[];
  /** Time taken in milliseconds */
  duration: number;
}

export interface TagInvalidationMessage {
  /** Tags to invalidate */
  tags: string[];
  /** Timestamp of invalidation */
  timestamp: number;
  /** Instance ID that triggered invalidation */
  instanceId: string;
  /** Reason for invalidation */
  reason?: string;
}

// ============================================
// Constants
// ============================================

/** Redis pub/sub channel for cache invalidation */
export const CACHE_INVALIDATION_CHANNEL = 'valorhive:cache:invalidation';

/** Cache tag prefixes */
export const CACHE_TAGS = {
  USER: 'user',
  TOURNAMENT: 'tournament',
  LEADERBOARD: 'leaderboard',
  PLAYER_STATS: 'player_stats',
  ORG_STATS: 'org_stats',
  MATCH: 'match',
  BRACKET: 'bracket',
  SESSION: 'session',
} as const;

// ============================================
// Tag-Based Cache Invalidation
// ============================================

/**
 * Build a cache tag for a specific entity
 */
export function buildTag(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Build user cache tag
 */
export function buildUserTag(userId: string): string {
  return buildTag(CACHE_TAGS.USER, userId);
}

/**
 * Build tournament cache tag
 */
export function buildTournamentTag(tournamentId: string): string {
  return buildTag(CACHE_TAGS.TOURNAMENT, tournamentId);
}

/**
 * Build leaderboard cache tag
 */
export function buildLeaderboardTag(sport: string, scope?: string): string {
  if (scope) {
    return buildTag(CACHE_TAGS.LEADERBOARD, sport, scope);
  }
  return buildTag(CACHE_TAGS.LEADERBOARD, sport);
}

/**
 * Build player stats cache tag
 */
export function buildPlayerStatsTag(userId: string): string {
  return buildTag(CACHE_TAGS.PLAYER_STATS, userId);
}

/**
 * Build org stats cache tag
 */
export function buildOrgStatsTag(orgId: string): string {
  return buildTag(CACHE_TAGS.ORG_STATS, orgId);
}

/**
 * Build match cache tag
 */
export function buildMatchTag(matchId: string): string {
  return buildTag(CACHE_TAGS.MATCH, matchId);
}

// ============================================
// User Cache Invalidation
// ============================================

/**
 * Invalidate all caches related to a user
 * @param userId - User ID to invalidate
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateUserCache(
  userId: string,
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  const tags = options?.tags || [buildUserTag(userId)];
  let keysInvalidated = 0;
  
  try {
    // Invalidate user profile cache
    await cache.delete(`${CACHE_KEYS.PLAYER_PROFILE}:*:${userId}`);
    keysInvalidated++;
    
    // Invalidate user stats cache
    await cache.delete(`${CACHE_KEYS.PLAYER_STATS}:*:${userId}`);
    keysInvalidated++;
    
    // Invalidate user ratings cache
    await cache.delete(`${CACHE_KEYS.PLAYER_RATINGS}:*:${userId}`);
    keysInvalidated++;
    
    // Invalidate any sessions linked to user (for security)
    await cache.delete(`session:user:${userId}`);
    keysInvalidated++;
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating user cache:', error);
    throw error;
  }
}

// ============================================
// Tournament Cache Invalidation
// ============================================

/**
 * Invalidate all caches related to a tournament
 * @param tournamentId - Tournament ID to invalidate
 * @param sport - Sport type for leaderboard invalidation
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateTournamentCache(
  tournamentId: string,
  sport?: string,
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  const tags = options?.tags || [buildTournamentTag(tournamentId)];
  let keysInvalidated = 0;
  
  try {
    // Invalidate tournament details
    await cache.delete(`${CACHE_KEYS.TOURNAMENT_DETAILS}:${tournamentId}`);
    keysInvalidated++;
    
    // Invalidate tournament bracket
    await cache.delete(`${CACHE_KEYS.TOURNAMENT_BRACKET}:${tournamentId}:*`);
    keysInvalidated++;
    
    // Invalidate tournament matches
    await cache.delete(`${CACHE_KEYS.MATCH_LIST}:tournament:${tournamentId}`);
    keysInvalidated++;
    
    // Invalidate active tournaments list if sport is provided
    if (sport) {
      await cache.delete(`${CACHE_KEYS.ACTIVE_TOURNAMENTS}:${sport}`);
      keysInvalidated++;
      
      // Invalidate leaderboard for the sport
      tags.push(buildLeaderboardTag(sport));
      await cache.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:*`);
      keysInvalidated++;
    }
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating tournament cache:', error);
    throw error;
  }
}

// ============================================
// Leaderboard Cache Invalidation
// ============================================

/**
 * Invalidate leaderboard caches
 * @param sport - Sport type
 * @param scope - Optional scope (national, state, district, city)
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateLeaderboardCache(
  sport: string,
  scope?: string,
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  const tags = options?.tags || [buildLeaderboardTag(sport, scope)];
  let keysInvalidated = 0;
  
  try {
    if (scope) {
      // Invalidate specific scope
      await cache.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:${scope}:*`);
      keysInvalidated++;
    } else {
      // Invalidate all scopes for the sport
      await cache.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:*`);
      keysInvalidated++;
    }
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating leaderboard cache:', error);
    throw error;
  }
}

// ============================================
// Match Result Cache Invalidation
// ============================================

/**
 * Invalidate caches after a match result
 * @param sport - Sport type
 * @param playerIds - Player IDs involved in the match
 * @param tournamentId - Optional tournament ID
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateMatchResultCache(
  sport: string,
  playerIds: string[],
  tournamentId?: string,
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  const tags: string[] = options?.tags || [];
  let keysInvalidated = 0;
  
  try {
    // Add player tags
    for (const playerId of playerIds) {
      tags.push(buildPlayerStatsTag(playerId));
    }
    
    // Invalidate leaderboard for the sport
    tags.push(buildLeaderboardTag(sport));
    await cache.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:*`);
    keysInvalidated++;
    
    // Invalidate player stats for all players involved
    for (const playerId of playerIds) {
      await cache.delete(`${CACHE_KEYS.PLAYER_STATS}:${sport}:${playerId}`);
      keysInvalidated++;
      await cache.delete(`${CACHE_KEYS.PLAYER_PROFILE}:${sport}:${playerId}`);
      keysInvalidated++;
      await cache.delete(`${CACHE_KEYS.PLAYER_RATINGS}:${sport}:${playerId}`);
      keysInvalidated++;
    }
    
    // Invalidate bracket if tournament is provided
    if (tournamentId) {
      tags.push(buildTournamentTag(tournamentId));
      await cache.delete(`${CACHE_KEYS.TOURNAMENT_BRACKET}:${tournamentId}:${sport}`);
      keysInvalidated++;
      await cache.delete(`${CACHE_KEYS.MATCH_LIST}:tournament:${tournamentId}`);
      keysInvalidated++;
    }
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating match result cache:', error);
    throw error;
  }
}

// ============================================
// Complete Cache Invalidation
// ============================================

/**
 * Invalidate all caches (use with caution!)
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateAllCache(
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  const tags = options?.tags || ['all'];
  let keysInvalidated = 0;
  
  try {
    // Flush the entire cache
    await cache.deletePattern('valorhive:*');
    keysInvalidated = 1; // Pattern delete counts as one operation
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason || 'FULL_CACHE_FLUSH' });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating all cache:', error);
    throw error;
  }
}

// ============================================
// Tag-Based Batch Invalidation
// ============================================

/**
 * Invalidate caches by tags
 * @param tags - Tags to invalidate
 * @param options - Invalidation options
 * @returns Invalidation result
 */
export async function invalidateByTags(
  tags: string[],
  options?: CacheInvalidationOptions
): Promise<CacheInvalidationResult> {
  const startTime = Date.now();
  let keysInvalidated = 0;
  
  try {
    for (const tag of tags) {
      // Delete all keys matching the tag
      await cache.deletePattern(`valorhive:*:${tag}:*`);
      keysInvalidated++;
    }
    
    // Publish invalidation to other instances
    if (options?.publishInvalidation !== false) {
      await publishInvalidationMessage({ tags, reason: options?.reason });
    }
    
    return {
      keysInvalidated,
      tags,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Error invalidating by tags:', error);
    throw error;
  }
}

// ============================================
// Redis Pub/Sub Integration
// ============================================

let redisPublisher: import('ioredis').default | null = null;
let redisSubscriber: import('ioredis').default | null = null;
let invalidationCallback: ((message: TagInvalidationMessage) => void) | null = null;

/**
 * Initialize Redis pub/sub for cache invalidation
 */
export async function initializeCacheInvalidationPubSub(
  onInvalidation?: (message: TagInvalidationMessage) => void
): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.log('[CacheInvalidation] Redis not configured, skipping pub/sub initialization');
    return;
  }

  try {
    const Redis = (await import('ioredis')).default;

    // Create publisher client
    redisPublisher = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
    });

    // Create subscriber client
    redisSubscriber = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Subscriber needs this set to null
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
    });

    // Subscribe to invalidation channel
    await redisSubscriber.subscribe(CACHE_INVALIDATION_CHANNEL);

    // Handle messages
    redisSubscriber.on('message', (channel: string, message: string) => {
      if (channel !== CACHE_INVALIDATION_CHANNEL) return;

      try {
        const parsedMessage: TagInvalidationMessage = JSON.parse(message);

        // Ignore messages from this instance
        if (parsedMessage.instanceId === getInstanceId()) {
          return;
        }

        // Process invalidation
        if (invalidationCallback) {
          invalidationCallback(parsedMessage);
        }

        // Default behavior: invalidate the tags
        invalidateByTags(parsedMessage.tags, { publishInvalidation: false });
      } catch (error) {
        console.error('[CacheInvalidation] Error processing invalidation message:', error);
      }
    });

    // Set callback
    invalidationCallback = onInvalidation ?? null;

    console.log('[CacheInvalidation] Redis pub/sub initialized');
  } catch (error) {
    console.error('[CacheInvalidation] Failed to initialize Redis pub/sub:', error);
  }
}

/**
 * Publish invalidation message to other instances
 */
async function publishInvalidationMessage(message: Omit<TagInvalidationMessage, 'instanceId' | 'timestamp'>): Promise<void> {
  if (!redisPublisher) {
    return;
  }

  try {
    const fullMessage: TagInvalidationMessage = {
      ...message,
      instanceId: getInstanceId(),
      timestamp: Date.now(),
    };

    await redisPublisher.publish(CACHE_INVALIDATION_CHANNEL, JSON.stringify(fullMessage));
  } catch (error) {
    console.error('[CacheInvalidation] Failed to publish invalidation message:', error);
  }
}

/**
 * Get unique instance ID
 */
let instanceId: string | null = null;
function getInstanceId(): string {
  if (!instanceId) {
    instanceId = `${process.pid || 'unknown'}-${Date.now()}`;
  }
  return instanceId;
}

/**
 * Shutdown Redis pub/sub connections
 */
export async function shutdownCacheInvalidationPubSub(): Promise<void> {
  try {
    if (redisSubscriber) {
      await redisSubscriber.unsubscribe(CACHE_INVALIDATION_CHANNEL);
      await redisSubscriber.quit();
      redisSubscriber = null;
    }

    if (redisPublisher) {
      await redisPublisher.quit();
      redisPublisher = null;
    }

    console.log('[CacheInvalidation] Redis pub/sub shutdown complete');
  } catch (error) {
    console.error('[CacheInvalidation] Error during shutdown:', error);
  }
}

// ============================================
// TTL Management
// ============================================

/**
 * Refresh TTL for a cache key
 * @param key - Cache key
 * @param ttl - New TTL in seconds
 * @returns Success status
 */
export async function refreshCacheTTL(key: string, ttl: number): Promise<boolean> {
  return cache.refreshTTL(key, ttl);
}

/**
 * Get remaining TTL for a cache key
 * @param key - Cache key
 * @returns TTL in seconds, -1 if key doesn't exist, -2 if no expiry
 */
export async function getCacheTTL(key: string): Promise<number> {
  return cache.getTTL(key);
}

/**
 * Extend TTL for frequently accessed data
 * @param key - Cache key
 * @param additionalSeconds - Seconds to add
 * @returns Success status
 */
export async function extendCacheTTL(key: string, additionalSeconds: number): Promise<boolean> {
  const currentTTL = await cache.getTTL(key);
  
  if (currentTTL < 0) {
    return false;
  }
  
  const newTTL = currentTTL + additionalSeconds;
  return cache.refreshTTL(key, newTTL);
}

// ============================================
// Export Default Instance
// ============================================

export const cacheInvalidation = {
  invalidateUserCache,
  invalidateTournamentCache,
  invalidateLeaderboardCache,
  invalidateMatchResultCache,
  invalidateAllCache,
  invalidateByTags,
  initializeCacheInvalidationPubSub,
  shutdownCacheInvalidationPubSub,
  refreshCacheTTL,
  getCacheTTL,
  extendCacheTTL,
};
