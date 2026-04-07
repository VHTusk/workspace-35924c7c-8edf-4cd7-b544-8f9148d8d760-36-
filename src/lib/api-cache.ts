/**
 * API Caching Layer for VALORHIVE Heavy Endpoints
 * 
 * Features:
 * - CacheConfig interface with TTL, stale-while-revalidate, varyBy headers
 * - cacheResponse() function for caching API responses
 * - invalidateCache() for pattern and tag-based invalidation
 * - withApiCache() middleware wrapper
 * - Cache headers in responses (X-Cache, X-Cache-TTL, Cache-Control)
 * 
 * Cache Configurations:
 * - Leaderboard: 60s TTL, invalidate on match completion
 * - City stats: 300s TTL, invalidate on user update
 * - District stats: 300s TTL
 * - Player ranking: 60s TTL
 * - Tournament list: 30s TTL
 * - Public player profile: 120s TTL
 * 
 * @version v4.3.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { cache, CACHE_TTL } from './cache';
import { invalidateByTags, CACHE_TAGS } from './cache-invalidation';

// ============================================
// Types and Interfaces
// ============================================

/**
 * Configuration for API endpoint caching
 */
export interface CacheConfig {
  /** Time to live in seconds */
  ttl: number;
  /** Serve stale data while refreshing in background (seconds) */
  staleWhileRevalidate?: number;
  /** Headers to vary cache key by */
  varyBy?: string[];
  /** Function to determine if request should skip cache */
  skipCache?: (request: NextRequest) => boolean;
  /** Tags to associate with this cache entry for invalidation */
  tags?: string[];
}

/**
 * Result from cacheResponse function
 */
export interface CacheResult<T> {
  /** The cached or fresh data */
  data: T;
  /** Whether data came from cache */
  fromCache: boolean;
  /** Cache key used */
  cacheKey: string;
  /** Remaining TTL in seconds */
  ttlRemaining: number;
  /** Whether stale data was served */
  isStale: boolean;
}

/**
 * Cache headers to add to response
 */
export interface CacheHeaders {
  /** X-Cache header (HIT/MISS/STALE) */
  'X-Cache': 'HIT' | 'MISS' | 'STALE';
  /** X-Cache-TTL header (remaining seconds) */
  'X-Cache-TTL': string;
  /** Cache-Control header */
  'Cache-Control': string;
}

/**
 * Handler function type for API endpoints
 */
export type ApiHandler<T> = (request: NextRequest) => Promise<T>;

// ============================================
// Cache Key Prefixes for API Endpoints
// ============================================

export const API_CACHE_PREFIXES = {
  LEADERBOARD: 'api:leaderboard',
  CITY_STATS: 'api:city:stats',
  CITY_LEADERBOARD: 'api:city:leaderboard',
  DISTRICT_STATS: 'api:district:stats',
  PLAYER_RANKING: 'api:player:ranking',
  PLAYER_PROFILE: 'api:player:profile',
  TOURNAMENT_LIST: 'api:tournament:list',
  TOURNAMENT_DETAILS: 'api:tournament:details',
} as const;

// ============================================
// Predefined Cache Configurations
// ============================================

/**
 * Cache configurations for heavy endpoints
 */
export const ENDPOINT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Leaderboard - 60s TTL, invalidate on match completion
  leaderboard: {
    ttl: 60,
    staleWhileRevalidate: 30,
    varyBy: ['sport', 'scope', 'location', 'search', 'limit', 'page'],
    tags: [CACHE_TAGS.LEADERBOARD],
  },
  
  // City stats - 300s TTL, invalidate on user update
  cityStats: {
    ttl: 300,
    staleWhileRevalidate: 60,
    varyBy: ['sport'],
    tags: [CACHE_TAGS.ORG_STATS],
  },
  
  // City leaderboard - 60s TTL
  cityLeaderboard: {
    ttl: 60,
    staleWhileRevalidate: 30,
    varyBy: ['limit', 'offset', 'period'],
    tags: [CACHE_TAGS.LEADERBOARD],
  },
  
  // District stats - 300s TTL
  districtStats: {
    ttl: 300,
    staleWhileRevalidate: 60,
    varyBy: ['sport', 'district'],
    tags: [CACHE_TAGS.ORG_STATS],
  },
  
  // Player ranking - 60s TTL
  playerRanking: {
    ttl: 60,
    staleWhileRevalidate: 30,
    varyBy: ['sport'],
    tags: [CACHE_TAGS.PLAYER_STATS, CACHE_TAGS.LEADERBOARD],
  },
  
  // Tournament list - 30s TTL
  tournamentList: {
    ttl: 30,
    staleWhileRevalidate: 15,
    varyBy: ['sport', 'status', 'scope', 'city', 'state', 'search', 'page', 'limit'],
    tags: [CACHE_TAGS.TOURNAMENT],
  },
  
  // Public player profile - 120s TTL
  playerProfile: {
    ttl: 120,
    staleWhileRevalidate: 60,
    varyBy: ['sport'],
    tags: [CACHE_TAGS.USER, CACHE_TAGS.PLAYER_STATS],
  },
};

// ============================================
// Cache Key Generation
// ============================================

/**
 * Generate cache key from URL and relevant headers
 */
export function generateCacheKey(
  prefix: string,
  request: NextRequest,
  varyBy: string[] = []
): string {
  const url = new URL(request.url);
  const parts: string[] = [prefix];
  
  // Add path segments
  parts.push(url.pathname);
  
  // Add relevant query parameters
  if (varyBy.length > 0) {
    const params = new URLSearchParams();
    for (const param of varyBy.sort()) {
      const value = url.searchParams.get(param);
      if (value) {
        params.set(param, value);
      }
    }
    const queryString = params.toString();
    if (queryString) {
      parts.push(queryString);
    }
  }
  
  // Add relevant headers if specified
  const varyHeaders = varyBy.filter(h => h.startsWith('header:'));
  for (const headerKey of varyHeaders) {
    const headerName = headerKey.replace('header:', '');
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      parts.push(`${headerName}=${headerValue}`);
    }
  }
  
  return `valorhive:${parts.join(':')}`;
}

/**
 * Generate cache key with explicit key parts
 */
export function generateCacheKeyFromParts(prefix: string, ...parts: (string | number)[]): string {
  return `valorhive:${prefix}:${parts.join(':')}`;
}

// ============================================
// Cache Response Function
// ============================================

/**
 * Cache response with stale-while-revalidate support
 * 
 * @param request - The incoming request
 * @param cacheKey - Cache key to use
 * @param config - Cache configuration
 * @param handler - Function to execute if cache miss
 * @returns Cached or fresh data with metadata
 */
export async function cacheResponse<T>(
  request: NextRequest,
  cacheKey: string,
  config: CacheConfig,
  handler: ApiHandler<T>
): Promise<CacheResult<T>> {
  // Check if we should skip cache
  if (config.skipCache?.(request)) {
    const data = await handler(request);
    return {
      data,
      fromCache: false,
      cacheKey,
      ttlRemaining: 0,
      isStale: false,
    };
  }
  
  // Try to get from cache
  const cached = await cache.get<{ data: T; timestamp: number; tags?: string[] }>(cacheKey);
  const now = Date.now();
  
  if (cached) {
    const age = Math.floor((now - cached.timestamp) / 1000);
    const isExpired = age >= config.ttl;
    const isStale = isExpired && config.staleWhileRevalidate 
      ? age < config.ttl + config.staleWhileRevalidate
      : false;
    
    // Return cached data if valid or within stale-while-revalidate window
    if (!isExpired || isStale) {
      const ttlRemaining = isStale 
        ? config.ttl + (config.staleWhileRevalidate || 0) - age
        : config.ttl - age;
      
      // If stale, trigger background refresh (don't await)
      if (isStale) {
        refreshInBackground(request, cacheKey, config, handler, cached.tags);
      }
      
      return {
        data: cached.data,
        fromCache: true,
        cacheKey,
        ttlRemaining: Math.max(0, ttlRemaining),
        isStale,
      };
    }
  }
  
  // Cache miss - execute handler and cache result
  const data = await handler(request);
  
  // Store in cache
  await cache.set(cacheKey, { 
    data, 
    timestamp: now,
    tags: config.tags,
  }, config.ttl + (config.staleWhileRevalidate || 0));
  
  return {
    data,
    fromCache: false,
    cacheKey,
    ttlRemaining: config.ttl,
    isStale: false,
  };
}

/**
 * Background refresh for stale-while-revalidate
 */
function refreshInBackground<T>(
  request: NextRequest,
  cacheKey: string,
  config: CacheConfig,
  handler: ApiHandler<T>,
  tags?: string[]
): void {
  // Execute refresh asynchronously without blocking
  (async () => {
    try {
      const data = await handler(request);
      await cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        tags,
      }, config.ttl + (config.staleWhileRevalidate || 0));
      
      if (process.env.CACHE_DEBUG === 'true') {
        console.log(`[ApiCache] Background refresh completed: ${cacheKey}`);
      }
    } catch (error) {
      console.error(`[ApiCache] Background refresh failed for ${cacheKey}:`, error);
    }
  })().catch(err => {
    console.error('[ApiCache] Unhandled error in background refresh:', err);
  });
}

// ============================================
// Cache Invalidation Functions
// ============================================

/**
 * Invalidate cache by pattern
 * 
 * @param pattern - Pattern to match (supports wildcards *)
 * @returns Number of keys invalidated
 */
export async function invalidateCache(pattern: string): Promise<number> {
  await cache.deletePattern(pattern);
  return 1; // Pattern delete counts as one operation
}

/**
 * Invalidate cache by tags
 * 
 * @param tags - Tags to invalidate
 * @returns Invalidation result
 */
export async function invalidateCacheByTags(tags: string[]): Promise<{ keysInvalidated: number; tags: string[] }> {
  const result = await invalidateByTags(tags, { publishInvalidation: true });
  return {
    keysInvalidated: result.keysInvalidated,
    tags: result.tags,
  };
}

/**
 * Invalidate leaderboard cache for a sport
 */
export async function invalidateLeaderboardCacheForSport(sport: string): Promise<void> {
  await cache.deletePattern(`${API_CACHE_PREFIXES.LEADERBOARD}:*:${sport}:*`);
  await cache.deletePattern(`valorhive:${API_CACHE_PREFIXES.CITY_LEADERBOARD}:*`);
}

/**
 * Invalidate player profile cache
 */
export async function invalidatePlayerProfileCache(userId: string, sport?: string): Promise<void> {
  if (sport) {
    await cache.delete(`${API_CACHE_PREFIXES.PLAYER_PROFILE}:${userId}:${sport}`);
    await cache.delete(`${API_CACHE_PREFIXES.PLAYER_RANKING}:${userId}:${sport}`);
  } else {
    await cache.deletePattern(`${API_CACHE_PREFIXES.PLAYER_PROFILE}:${userId}:*`);
    await cache.deletePattern(`${API_CACHE_PREFIXES.PLAYER_RANKING}:${userId}:*`);
  }
}

/**
 * Invalidate tournament list cache
 */
export async function invalidateTournamentListCache(sport?: string): Promise<void> {
  if (sport) {
    await cache.deletePattern(`${API_CACHE_PREFIXES.TOURNAMENT_LIST}:*:${sport}:*`);
  } else {
    await cache.deletePattern(`${API_CACHE_PREFIXES.TOURNAMENT_LIST}:*`);
  }
}

/**
 * Invalidate city stats cache
 */
export async function invalidateCityStatsCache(cityId: string, sport?: string): Promise<void> {
  if (sport) {
    await cache.delete(`${API_CACHE_PREFIXES.CITY_STATS}:${cityId}:${sport}`);
  } else {
    await cache.deletePattern(`${API_CACHE_PREFIXES.CITY_STATS}:${cityId}:*`);
  }
}

// ============================================
// Cache Headers Helper
// ============================================

/**
 * Build cache headers for response
 */
export function buildCacheHeaders(
  fromCache: boolean,
  ttlRemaining: number,
  ttl: number,
  isStale: boolean = false
): CacheHeaders {
  return {
    'X-Cache': isStale ? 'STALE' : fromCache ? 'HIT' : 'MISS',
    'X-Cache-TTL': String(Math.max(0, ttlRemaining)),
    'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`,
  };
}

/**
 * Add cache headers to NextResponse
 */
export function addCacheHeaders<T>(
  response: NextResponse<T>,
  fromCache: boolean,
  ttlRemaining: number,
  ttl: number,
  isStale: boolean = false
): NextResponse<T> {
  const headers = buildCacheHeaders(fromCache, ttlRemaining, ttl, isStale);
  
  response.headers.set('X-Cache', headers['X-Cache']);
  response.headers.set('X-Cache-TTL', headers['X-Cache-TTL']);
  response.headers.set('Cache-Control', headers['Cache-Control']);
  
  return response;
}

// ============================================
// withApiCache Middleware Wrapper
// ============================================

/**
 * Middleware wrapper for API endpoints with caching
 * 
 * Usage:
 * ```typescript
 * export const GET = withApiCache(
 *   async (request) => {
 *     // Your handler logic
 *     return { data: '...' };
 *   },
 *   {
 *     ttl: 60,
 *     prefix: API_CACHE_PREFIXES.LEADERBOARD,
 *     varyBy: ['sport', 'scope'],
 *   }
 * );
 * ```
 */
export function withApiCache<T>(
  handler: ApiHandler<T>,
  options: {
    /** Cache key prefix */
    prefix: string;
    /** Cache configuration */
    config?: Partial<CacheConfig>;
    /** Vary by query parameters */
    varyBy?: string[];
    /** Tags for invalidation */
    tags?: string[];
    /** Custom cache key generator */
    keyGenerator?: (request: NextRequest) => string;
    /** Transform response before caching */
    transform?: (data: T) => unknown;
  }
): (request: NextRequest) => Promise<NextResponse> {
  const fullConfig: CacheConfig = {
    ttl: options.config?.ttl ?? CACHE_TTL.PLAYER_STATS,
    staleWhileRevalidate: options.config?.staleWhileRevalidate,
    varyBy: options.varyBy ?? [],
    skipCache: options.config?.skipCache,
    tags: options.tags ?? [],
  };
  
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(request)
        : generateCacheKey(options.prefix, request, fullConfig.varyBy);
      
      // Execute with caching
      const result = await cacheResponse<T>(
        request,
        cacheKey,
        fullConfig,
        async () => {
          const data = await handler(request);
          return options.transform ? options.transform(data) as T : data;
        }
      );
      
      // Build response
      const response = NextResponse.json(result.data);
      
      // Add cache headers
      addCacheHeaders(
        response,
        result.fromCache,
        result.ttlRemaining,
        fullConfig.ttl,
        result.isStale
      );
      
      // Add X-Cache-Key header in debug mode
      if (process.env.CACHE_DEBUG === 'true') {
        response.headers.set('X-Cache-Key', cacheKey);
      }
      
      return response;
      
    } catch (error) {
      console.error('[ApiCache] Error in withApiCache:', error);
      
      // On cache error, execute handler without caching
      const data = await handler(request);
      const response = NextResponse.json(data);
      response.headers.set('X-Cache', 'MISS');
      response.headers.set('X-Cache-Error', 'true');
      return response;
    }
  };
}

// ============================================
// Cache Invalidation Triggers
// ============================================

/**
 * Trigger: Match score submitted
 * Invalidates: Leaderboard cache, player stats cache
 */
export async function onMatchScoreSubmitted(
  sport: string,
  playerIds: string[],
  tournamentId?: string
): Promise<void> {
  // Invalidate leaderboard cache
  await invalidateLeaderboardCacheForSport(sport);
  
  // Invalidate player profile caches
  for (const playerId of playerIds) {
    await invalidatePlayerProfileCache(playerId, sport);
  }
  
  // Invalidate tournament-related caches if applicable
  if (tournamentId) {
    await invalidateTournamentListCache(sport);
  }
  
  if (process.env.CACHE_DEBUG === 'true') {
    console.log(`[ApiCache] Cache invalidated after match score submitted: sport=${sport}, players=${playerIds.length}`);
  }
}

/**
 * Trigger: User profile updated
 * Invalidates: Player profile cache, city stats cache
 */
export async function onUserProfileUpdated(
  userId: string,
  sport: string,
  cityId?: string
): Promise<void> {
  // Invalidate player profile cache
  await invalidatePlayerProfileCache(userId, sport);
  
  // Invalidate city stats cache if city changed
  if (cityId) {
    await invalidateCityStatsCache(cityId, sport);
  }
  
  if (process.env.CACHE_DEBUG === 'true') {
    console.log(`[ApiCache] Cache invalidated after user profile updated: userId=${userId}`);
  }
}

/**
 * Trigger: Tournament status changed
 * Invalidates: Tournament list cache, tournament details cache
 */
export async function onTournamentStatusChanged(
  tournamentId: string,
  sport: string,
  _newStatus: string
): Promise<void> {
  // Invalidate tournament list cache
  await invalidateTournamentListCache(sport);
  
  // Invalidate tournament details cache
  await cache.delete(`${API_CACHE_PREFIXES.TOURNAMENT_DETAILS}:${tournamentId}`);
  
  if (process.env.CACHE_DEBUG === 'true') {
    console.log(`[ApiCache] Cache invalidated after tournament status changed: tournamentId=${tournamentId}`);
  }
}

// ============================================
// Export Default
// ============================================

export const apiCache = {
  cacheResponse,
  invalidateCache,
  invalidateCacheByTags,
  invalidateLeaderboardCacheForSport,
  invalidatePlayerProfileCache,
  invalidateTournamentListCache,
  invalidateCityStatsCache,
  buildCacheHeaders,
  addCacheHeaders,
  withApiCache,
  onMatchScoreSubmitted,
  onUserProfileUpdated,
  onTournamentStatusChanged,
  generateCacheKey,
  generateCacheKeyFromParts,
};
