/**
 * Redis Caching Layer for VALORHIVE
 * 
 * Features:
 * - Redis support with in-memory fallback for development
 * - Leaderboards caching (by sport, scope, time period) - 5 min TTL
 * - Tournament brackets caching - 2 min TTL (during live tournaments)
 * - Player stats caching (profile data, ratings) - 10 min TTL
 * - Organization stats caching - 15 min TTL
 * - Cache invalidation functions
 * - Cache warming support
 * - Cache hit/miss logging for monitoring
 */

import type Redis from 'ioredis';

// ============================================
// Types and Interfaces
// ============================================

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  type: 'redis' | 'memory';
  keys?: number;
  memoryUsage?: string;
}

export interface LeaderboardCacheKey {
  sport: string;
  scope: 'national' | 'state' | 'district' | 'city';
  state?: string;
  district?: string;
  city?: string;
  timePeriod?: 'all' | 'month' | 'week' | 'year';
}

export interface BracketCacheKey {
  tournamentId: string;
  sport: string;
}

export interface PlayerStatsCacheKey {
  userId: string;
  sport: string;
}

export interface OrgStatsCacheKey {
  orgId: string;
  sport: string;
}

// ============================================
// Cache Key Prefixes
// ============================================

export const CACHE_KEYS = {
  LEADERBOARD: 'lb',
  TOURNAMENT_BRACKET: 'tb',
  PLAYER_STATS: 'ps',
  PLAYER_PROFILE: 'pp',
  PLAYER_RATINGS: 'pr',
  ORG_STATS: 'os',
  ORG_PROFILE: 'op',
  ACTIVE_TOURNAMENTS: 'at',
  TOURNAMENT_DETAILS: 'td',
  MATCH_LIST: 'ml',
  WARMED: 'warmed',
} as const;

// ============================================
// Cache TTL Configurations (in seconds)
// Production Scaling (v3.80.0): Optimized for high-traffic tournament systems
// ============================================

export const CACHE_TTL = {
  // Hot leaderboards - Very short TTL for real-time accuracy
  // Production systems (Chess.com, FACEIT): 5 seconds
  LEADERBOARD: 5, // 5 seconds (was 5 minutes)
  
  // Tournament brackets - Short TTL during live matches
  // Production systems: 10 seconds for live bracket updates
  TOURNAMENT_BRACKET: 10, // 10 seconds (was 2 minutes)
  
  // Player stats - Moderate TTL
  // Production systems: 30 seconds for stat pages
  PLAYER_STATS: 30, // 30 seconds (was 10 minutes)
  
  // Organization stats - Less frequently accessed
  ORG_STATS: 60, // 1 minute (was 15 minutes)
  
  // Player profile - Can be cached longer
  PLAYER_PROFILE: 300, // 5 minutes (was 1 hour)
  
  // Player ratings - Match results invalidate these
  PLAYER_RATINGS: 30, // 30 seconds (was 10 minutes)
  
  // Active tournaments - Frequently accessed list
  ACTIVE_TOURNAMENTS: 30, // 30 seconds (was 1 minute)
  
  // Tournament details - Moderate caching
  TOURNAMENT_DETAILS: 60, // 1 minute (was 5 minutes)
  
  // Match list - Updated frequently during tournaments
  MATCH_LIST: 10, // 10 seconds (was 2 minutes)
  
  // Organization profile - Rarely changes
  ORG_PROFILE: 300, // 5 minutes (was 30 minutes)
  
  // Match state for WebSocket reconnection
  MATCH_STATE: 300, // 5 minutes - for reconnection support
  
  // Idempotency event tracking
  IDEMPOTENCY_EVENT: 3600, // 1 hour - event deduplication
} as const;

// ============================================
// In-Memory Cache (Development Fallback)
// ============================================

interface MemoryCacheEntry {
  data: string;
  expiresAt: number;
  createdAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

// Statistics tracking
let cacheHits = 0;
let cacheMisses = 0;

// ============================================
// Cache Key Generation Helpers
// ============================================

/**
 * Build cache key with prefix
 */
export function buildCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `valorhive:${prefix}:${parts.join(':')}`;
}

/**
 * Generate leaderboard cache key
 */
export function generateLeaderboardCacheKey(params: LeaderboardCacheKey): string {
  const parts: string[] = [params.sport, params.scope];
  
  if (params.state) parts.push(params.state);
  if (params.district) parts.push(params.district);
  if (params.city) parts.push(params.city);
  if (params.timePeriod) parts.push(params.timePeriod);
  
  return buildCacheKey(CACHE_KEYS.LEADERBOARD, ...parts);
}

/**
 * Generate bracket cache key
 */
export function generateBracketCacheKey(params: BracketCacheKey): string {
  return buildCacheKey(CACHE_KEYS.TOURNAMENT_BRACKET, params.tournamentId, params.sport);
}

/**
 * Generate player stats cache key
 */
export function generatePlayerStatsCacheKey(params: PlayerStatsCacheKey): string {
  return buildCacheKey(CACHE_KEYS.PLAYER_STATS, params.sport, params.userId);
}

/**
 * Generate player ratings cache key
 */
export function generatePlayerRatingsCacheKey(userId: string, sport: string): string {
  return buildCacheKey(CACHE_KEYS.PLAYER_RATINGS, sport, userId);
}

/**
 * Generate player profile cache key
 */
export function generatePlayerProfileCacheKey(userId: string, sport: string): string {
  return buildCacheKey(CACHE_KEYS.PLAYER_PROFILE, sport, userId);
}

/**
 * Generate org stats cache key
 */
export function generateOrgStatsCacheKey(params: OrgStatsCacheKey): string {
  return buildCacheKey(CACHE_KEYS.ORG_STATS, params.sport, params.orgId);
}

/**
 * Generate org profile cache key
 */
export function generateOrgProfileCacheKey(orgId: string, sport: string): string {
  return buildCacheKey(CACHE_KEYS.ORG_PROFILE, sport, orgId);
}

// ============================================
// Redis Client Management
// ============================================

let redisClient: Redis | null = null;
let redisConnectionPromise: Promise<Redis | null> | null = null;

/**
 * Check if Redis is available
 */
function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Get Redis client (lazy loaded with connection pooling)
 */
async function getRedisClient() {
  if (!isRedisAvailable()) {
    return null;
  }

  // Return existing client if connected
  if (redisClient?.status === 'ready') {
    return redisClient;
  }

  // Return existing connection promise if in progress
  if (redisConnectionPromise) {
    return redisConnectionPromise;
  }

  // Create new connection
  redisConnectionPromise = (async () => {
    try {
      const Redis = (await import('ioredis')).default;
      const client = new Redis(process.env.REDIS_URL!, {
        retryStrategy: (times) => {
          if (times > 10) {
            console.error('[Cache] Redis connection failed after 10 retries');
            return null; // Stop retrying
          }
          // Exponential backoff
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
      });

      client.on('error', (err: Error) => {
        console.error('[Cache] Redis client error:', err.message);
      });

      client.on('connect', () => {
        console.log('[Cache] Redis connected successfully');
      });

      client.on('close', () => {
        console.log('[Cache] Redis disconnected');
      });

      redisClient = client;
      return client;
    } catch (error) {
      console.warn('[Cache] Redis connection failed, using memory cache:', 
        error instanceof Error ? error.message : 'Unknown error');
      redisConnectionPromise = null;
      return null;
    }
  })();

  return redisConnectionPromise;
}

// ============================================
// Cache Service Class
// ============================================

export class CacheService {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const redis = await getRedisClient();

    if (redis) {
      try {
        const data = await redis.get(fullKey);
        if (data) {
          cacheHits++;
          this.logHit(fullKey);
          return JSON.parse(data) as T;
        }
        cacheMisses++;
        this.logMiss(fullKey);
        return null;
      } catch (error) {
        console.error('[Cache] Redis get error:', error);
        cacheMisses++;
        return null;
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(fullKey);
    if (cached && cached.expiresAt > Date.now()) {
      cacheHits++;
      this.logHit(fullKey);
      return JSON.parse(cached.data) as T;
    }

    cacheMisses++;
    this.logMiss(fullKey);
    return null;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, ttl: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const data = JSON.stringify(value);
    const redis = await getRedisClient();

    if (redis) {
      try {
        await redis.setex(fullKey, ttl, data);
        this.logSet(fullKey, ttl);
      } catch (error) {
        console.error('[Cache] Redis set error:', error);
      }
      return;
    }

    // Fallback to memory cache
    memoryCache.set(fullKey, {
      data,
      expiresAt: Date.now() + ttl * 1000,
      createdAt: Date.now(),
    });
    this.logSet(fullKey, ttl);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    const redis = await getRedisClient();

    if (redis) {
      try {
        await redis.del(fullKey);
        this.logDelete(fullKey);
      } catch (error) {
        console.error('[Cache] Redis delete error:', error);
      }
      return;
    }

    memoryCache.delete(fullKey);
    this.logDelete(fullKey);
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern);
    const redis = await getRedisClient();

    if (redis) {
      try {
        const keys = await redis.keys(fullPattern);
        if (keys.length > 0) {
          await redis.del(keys);
          this.logDeletePattern(fullPattern, keys.length);
        }
      } catch (error) {
        console.error('[Cache] Redis delete pattern error:', error);
      }
      return;
    }

    // For memory cache, iterate and delete matching keys
    const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
    let deletedCount = 0;
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        deletedCount++;
      }
    }
    this.logDeletePattern(fullPattern, deletedCount);
  }

  /**
   * Get or set cache with fallback fetcher
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const redis = await getRedisClient();

    if (redis) {
      try {
        return (await redis.exists(fullKey)) === 1;
      } catch (error) {
        console.error('[Cache] Redis exists error:', error);
        return false;
      }
    }

    const cached = memoryCache.get(fullKey);
    return cached !== undefined && cached.expiresAt > Date.now();
  }

  /**
   * Get TTL remaining for a key
   */
  async getTTL(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    const redis = await getRedisClient();

    if (redis) {
      try {
        return await redis.ttl(fullKey);
      } catch (error) {
        console.error('[Cache] Redis TTL error:', error);
        return -1;
      }
    }

    const cached = memoryCache.get(fullKey);
    if (cached) {
      return Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000));
    }
    return -1;
  }

  /**
   * Refresh TTL for a key
   */
  async refreshTTL(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const redis = await getRedisClient();

    if (redis) {
      try {
        const exists = await redis.exists(fullKey);
        if (exists) {
          await redis.expire(fullKey, ttl);
          return true;
        }
        return false;
      } catch (error) {
        console.error('[Cache] Redis refresh TTL error:', error);
        return false;
      }
    }

    const cached = memoryCache.get(fullKey);
    if (cached) {
      cached.expiresAt = Date.now() + ttl * 1000;
      return true;
    }
    return false;
  }

  // ============================================
  // Logging Methods
  // ============================================

  private logHit(key: string): void {
    if (process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] HIT: ${key}`);
    }
  }

  private logMiss(key: string): void {
    if (process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] MISS: ${key}`);
    }
  }

  private logSet(key: string, ttl: number): void {
    if (process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
    }
  }

  private logDelete(key: string): void {
    if (process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] DELETE: ${key}`);
    }
  }

  private logDeletePattern(pattern: string, count: number): void {
    if (process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] DELETE PATTERN: ${pattern} (${count} keys)`);
    }
  }
}

// ============================================
// Specialized Cache Services
// ============================================

/**
 * Leaderboard Cache Service
 * TTL: 5 minutes
 */
export class LeaderboardCache extends CacheService {
  constructor() {
    super(CACHE_KEYS.LEADERBOARD);
  }

  /**
   * Get cached leaderboard
   */
  async getLeaderboard<T>(params: LeaderboardCacheKey): Promise<T | null> {
    const key = generateLeaderboardCacheKey(params);
    return this.get<T>(key);
  }

  /**
   * Set leaderboard cache
   */
  async setLeaderboard(params: LeaderboardCacheKey, data: unknown): Promise<void> {
    const key = generateLeaderboardCacheKey(params);
    return this.set(key, data, CACHE_TTL.LEADERBOARD);
  }

  /**
   * Invalidate leaderboard cache for a sport
   */
  async invalidateSport(sport: string): Promise<void> {
    await this.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:*`);
  }

  /**
   * Invalidate all leaderboard caches for a scope
   */
  async invalidateScope(sport: string, scope: string): Promise<void> {
    await this.deletePattern(`${CACHE_KEYS.LEADERBOARD}:${sport}:${scope}:*`);
  }
}

/**
 * Tournament Bracket Cache Service
 * TTL: 2 minutes (optimized for live tournaments)
 */
export class BracketCache extends CacheService {
  constructor() {
    super(CACHE_KEYS.TOURNAMENT_BRACKET);
  }

  /**
   * Get cached bracket
   */
  async getBracket<T>(params: BracketCacheKey): Promise<T | null> {
    const key = generateBracketCacheKey(params);
    return this.get<T>(key);
  }

  /**
   * Set bracket cache
   */
  async setBracket(params: BracketCacheKey, data: unknown): Promise<void> {
    const key = generateBracketCacheKey(params);
    return this.set(key, data, CACHE_TTL.TOURNAMENT_BRACKET);
  }

  /**
   * Invalidate bracket cache for a tournament
   */
  async invalidateTournament(tournamentId: string): Promise<void> {
    await this.deletePattern(`${CACHE_KEYS.TOURNAMENT_BRACKET}:${tournamentId}:*`);
  }

  /**
   * Refresh bracket cache (extend TTL during live matches)
   */
  async refreshBracket(params: BracketCacheKey): Promise<boolean> {
    const key = generateBracketCacheKey(params);
    return this.refreshTTL(key, CACHE_TTL.TOURNAMENT_BRACKET);
  }
}

/**
 * Player Stats Cache Service
 * TTL: 10 minutes
 */
export class PlayerStatsCache extends CacheService {
  constructor() {
    super(CACHE_KEYS.PLAYER_STATS);
  }

  /**
   * Get cached player stats
   */
  async getStats<T>(params: PlayerStatsCacheKey): Promise<T | null> {
    const key = generatePlayerStatsCacheKey(params);
    return this.get<T>(key);
  }

  /**
   * Set player stats cache
   */
  async setStats(params: PlayerStatsCacheKey, data: unknown): Promise<void> {
    const key = generatePlayerStatsCacheKey(params);
    return this.set(key, data, CACHE_TTL.PLAYER_STATS);
  }

  /**
   * Get cached player profile
   */
  async getProfile<T>(userId: string, sport: string): Promise<T | null> {
    const key = generatePlayerProfileCacheKey(userId, sport);
    return this.get<T>(key);
  }

  /**
   * Set player profile cache
   */
  async setProfile(userId: string, sport: string, data: unknown): Promise<void> {
    const key = generatePlayerProfileCacheKey(userId, sport);
    return this.set(key, data, CACHE_TTL.PLAYER_PROFILE);
  }

  /**
   * Get cached player ratings
   */
  async getRatings<T>(userId: string, sport: string): Promise<T | null> {
    const key = generatePlayerRatingsCacheKey(userId, sport);
    return this.get<T>(key);
  }

  /**
   * Set player ratings cache
   */
  async setRatings(userId: string, sport: string, data: unknown): Promise<void> {
    const key = generatePlayerRatingsCacheKey(userId, sport);
    return this.set(key, data, CACHE_TTL.PLAYER_RATINGS);
  }

  /**
   * Invalidate all player caches
   */
  async invalidatePlayer(userId: string, sport: string): Promise<void> {
    // Invalidate stats
    await this.delete(generatePlayerStatsCacheKey({ userId, sport }));
    // Invalidate profile
    await this.delete(generatePlayerProfileCacheKey(userId, sport));
    // Invalidate ratings
    await this.delete(generatePlayerRatingsCacheKey(userId, sport));
  }
}

/**
 * Organization Stats Cache Service
 * TTL: 15 minutes
 */
export class OrgStatsCache extends CacheService {
  constructor() {
    super(CACHE_KEYS.ORG_STATS);
  }

  /**
   * Get cached org stats
   */
  async getStats<T>(params: OrgStatsCacheKey): Promise<T | null> {
    const key = generateOrgStatsCacheKey(params);
    return this.get<T>(key);
  }

  /**
   * Set org stats cache
   */
  async setStats(params: OrgStatsCacheKey, data: unknown): Promise<void> {
    const key = generateOrgStatsCacheKey(params);
    return this.set(key, data, CACHE_TTL.ORG_STATS);
  }

  /**
   * Get cached org profile
   */
  async getProfile<T>(orgId: string, sport: string): Promise<T | null> {
    const key = generateOrgProfileCacheKey(orgId, sport);
    return this.get<T>(key);
  }

  /**
   * Set org profile cache
   */
  async setProfile(orgId: string, sport: string, data: unknown): Promise<void> {
    const key = generateOrgProfileCacheKey(orgId, sport);
    return this.set(key, data, CACHE_TTL.ORG_PROFILE);
  }

  /**
   * Invalidate all org caches
   */
  async invalidateOrg(orgId: string, sport: string): Promise<void> {
    // Invalidate stats
    await this.delete(generateOrgStatsCacheKey({ orgId, sport }));
    // Invalidate profile
    await this.delete(generateOrgProfileCacheKey(orgId, sport));
  }
}

// ============================================
// Cache Invalidation Functions
// ============================================

/**
 * Invalidate all caches related to a match result
 */
export async function invalidateMatchResultCache(
  sport: string,
  playerIds: string[],
  tournamentId?: string
): Promise<void> {
  const leaderboardCache = new LeaderboardCache();
  const playerStatsCache = new PlayerStatsCache();

  // Invalidate leaderboard for the sport
  await leaderboardCache.invalidateSport(sport);

  // Invalidate player stats for all players involved
  for (const playerId of playerIds) {
    await playerStatsCache.invalidatePlayer(playerId, sport);
  }

  // Invalidate bracket if tournament is provided
  if (tournamentId) {
    const bracketCache = new BracketCache();
    await bracketCache.invalidateTournament(tournamentId);
  }
}

/**
 * Invalidate all caches related to a tournament
 */
export async function invalidateTournamentCache(
  tournamentId: string,
  sport: string
): Promise<void> {
  const bracketCache = new BracketCache();
  const cache = new CacheService();

  // Invalidate bracket
  await bracketCache.invalidateTournament(tournamentId);

  // Invalidate tournament details
  await cache.delete(`${CACHE_KEYS.TOURNAMENT_DETAILS}:${tournamentId}`);

  // Invalidate active tournaments list
  await cache.delete(`${CACHE_KEYS.ACTIVE_TOURNAMENTS}:${sport}`);
}

/**
 * Invalidate all caches for a player
 */
export async function invalidatePlayerCache(
  userId: string,
  sport: string
): Promise<void> {
  const playerStatsCache = new PlayerStatsCache();
  await playerStatsCache.invalidatePlayer(userId, sport);
}

/**
 * Invalidate all caches for an organization
 */
export async function invalidateOrgCache(
  orgId: string,
  sport: string
): Promise<void> {
  const orgStatsCache = new OrgStatsCache();
  await orgStatsCache.invalidateOrg(orgId, sport);
}

// ============================================
// Cache Warming Functions
// ============================================

export interface CacheWarmerOptions {
  sport: string;
  warmLeaderboards?: boolean;
  warmActiveTournaments?: boolean;
  leaderboardFetcher?: (sport: string, scope: string) => Promise<unknown>;
  tournamentsFetcher?: (sport: string) => Promise<unknown>;
}

/**
 * Warm up caches with frequently accessed data
 */
export async function warmCache(options: CacheWarmerOptions): Promise<{
  leaderboards: number;
  tournaments: number;
}> {
  const results = { leaderboards: 0, tournaments: 0 };

  // Warm leaderboards
  if (options.warmLeaderboards && options.leaderboardFetcher) {
    const leaderboardCache = new LeaderboardCache();
    const scopes = ['national', 'state', 'district', 'city'];

    for (const scope of scopes) {
      try {
        const data = await options.leaderboardFetcher(options.sport, scope);
        await leaderboardCache.setLeaderboard(
          { sport: options.sport, scope: scope as LeaderboardCacheKey['scope'] },
          data
        );
        results.leaderboards++;
      } catch (error) {
        console.error(`[Cache] Failed to warm leaderboard for ${options.sport}/${scope}:`, error);
      }
    }
  }

  // Warm active tournaments
  if (options.warmActiveTournaments && options.tournamentsFetcher) {
    const cache = new CacheService();

    try {
      const data = await options.tournamentsFetcher(options.sport);
      await cache.set(
        `${CACHE_KEYS.ACTIVE_TOURNAMENTS}:${options.sport}`,
        data,
        CACHE_TTL.ACTIVE_TOURNAMENTS
      );
      results.tournaments++;
    } catch (error) {
      console.error(`[Cache] Failed to warm active tournaments for ${options.sport}:`, error);
    }
  }

  // Mark cache as warmed
  const cache = new CacheService();
  await cache.set(
    `${CACHE_KEYS.WARMED}:${options.sport}`,
    { timestamp: Date.now(), results },
    CACHE_TTL.LEADERBOARD
  );

  console.log(`[Cache] Warmed cache for ${options.sport}:`, results);
  return results;
}

/**
 * Check if cache has been warmed for a sport
 */
export async function isCacheWarmed(sport: string): Promise<boolean> {
  const cache = new CacheService();
  return cache.exists(`${CACHE_KEYS.WARMED}:${sport}`);
}

// ============================================
// Cache Statistics and Monitoring
// ============================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  const redis = await getRedisClient();
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

  if (redis) {
    try {
      const info = await redis.info('memory');
      const dbSize = await redis.dbsize();
      const memoryLine = info.split('\n').find(line => line.startsWith('used_memory_human:'));
      
      return {
        type: 'redis',
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: dbSize,
        memoryUsage: memoryLine?.split(':')[1]?.trim() || 'unknown',
      };
    } catch (error) {
      return {
        type: 'redis',
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    }
  }

  // Memory cache statistics
  const memoryUsage = JSON.stringify([...memoryCache.values()]).length;
  
  return {
    type: 'memory',
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: Math.round(hitRate * 100) / 100,
    keys: memoryCache.size,
    memoryUsage: `${Math.round(memoryUsage / 1024)}KB`,
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Flush all cache
 */
export async function flushCache(): Promise<void> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      await redis.flushdb();
      console.log('[Cache] Flushed Redis cache');
    } catch (error) {
      console.error('[Cache] Redis flush error:', error);
    }
    return;
  }

  memoryCache.clear();
  console.log('[Cache] Flushed memory cache');
}

// ============================================
// Memory Cache Cleanup
// ============================================

// Cleanup interval for memory cache (runs every minute)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of memoryCache.entries()) {
      if (value.expiresAt < now) {
        memoryCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0 && process.env.CACHE_DEBUG === 'true') {
      console.log(`[Cache] Cleaned ${cleaned} expired entries from memory cache`);
    }
  }, 60000);
}

// ============================================
// Export Default Instance
// ============================================

// Default cache service instance
export const cache = new CacheService();

// Specialized cache instances
export const leaderboardCache = new LeaderboardCache();
export const bracketCache = new BracketCache();
export const playerStatsCache = new PlayerStatsCache();
export const orgStatsCache = new OrgStatsCache();

// Export convenience functions for backward compatibility
export const cacheGet = <T>(key: string): Promise<T | null> => cache.get<T>(key);
export const cacheSet = (key: string, value: unknown, ttl: number): Promise<void> => 
  cache.set(key, value, ttl);
export const cacheDelete = (key: string): Promise<void> => cache.delete(key);
export const cacheDeletePattern = (pattern: string): Promise<void> => 
  cache.deletePattern(pattern);
export const cacheGetOrSet = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> => cache.getOrSet(key, fetcher, ttl);

// Backward compatibility exports
export const invalidateLeaderboardCache = async (sport: string): Promise<void> => {
  await leaderboardCache.invalidateSport(sport);
};

export const invalidateBracketCache = async (tournamentId: string): Promise<void> => {
  await bracketCache.invalidateTournament(tournamentId);
};

export const invalidatePlayerStatsCache = async (userId: string, sport: string): Promise<void> => {
  await playerStatsCache.invalidatePlayer(userId, sport);
};

export const invalidateOrgStatsCache = async (orgId: string): Promise<void> => {
  // Need sport for invalidation, invalidate all sports
  const sports = ['cornhole', 'darts'];
  for (const sport of sports) {
    await orgStatsCache.invalidateOrg(orgId, sport);
  }
};

export const invalidateActiveTournamentsCache = async (sport: string): Promise<void> => {
  await cache.delete(`${CACHE_KEYS.ACTIVE_TOURNAMENTS}:${sport}`);
};
