/**
 * Distributed Rate Limiting System for VALORHIVE
 * 
 * Production-ready distributed rate limiting with:
 * - Redis support with ioredis (standalone, cluster, sentinel)
 * - Atomic increment with Lua script for race-condition safety
 * - Automatic Redis connection management with exponential backoff
 * - Graceful fallback to in-memory when Redis unavailable
 * - Metrics tracking for rate limit hits/misses
 * - Health check integration
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string (optional, e.g., redis://REDIS_HOST:6379)
 * - RATE_LIMIT_PREFIX: Key prefix for rate limit keys (default: 'vh:rl:')
 * - REDIS_CLUSTER_NODES: Comma-separated cluster nodes (for cluster mode)
 * - REDIS_SENTINEL_HOSTS: Comma-separated sentinel hosts (for HA)
 */

import { RATE_LIMITS, RateLimitTier, RateLimitResult } from './rate-limit-types';
import { 
  getRedisConfig, 
  createRetryStrategy, 
  isReconnectableError,
  getTLSOptions,
  getClusterConfig,
  getSentinelConfig,
  isRedisConfigured,
  type ClusterConfig,
  type SentinelConfig,
} from './redis-config';

// ============================================
// Types and Interfaces
// ============================================

export interface DistributedRateLimitConfig {
  prefix: string;
  redisUrl?: string;
  enableMetrics: boolean;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitMetrics {
  totalChecks: number;
  allowedRequests: number;
  blockedRequests: number;
  redisHits: number;
  redisMisses: number;
  memoryHits: number;
  fallbackCount: number;
  errors: number;
  averageLatency: number;
  latencySamples: number[];
  byTier: Record<RateLimitTier, { allowed: number; blocked: number }>;
}

// ============================================
// Metrics Tracking
// ============================================

const metrics: RateLimitMetrics = {
  totalChecks: 0,
  allowedRequests: 0,
  blockedRequests: 0,
  redisHits: 0,
  redisMisses: 0,
  memoryHits: 0,
  fallbackCount: 0,
  errors: 0,
  averageLatency: 0,
  latencySamples: [],
  byTier: {
    PUBLIC: { allowed: 0, blocked: 0 },
    AUTHENTICATED: { allowed: 0, blocked: 0 },
    ORGANIZATION: { allowed: 0, blocked: 0 },
    ADMIN: { allowed: 0, blocked: 0 },
    WEBHOOK: { allowed: 0, blocked: 0 },
    LOGIN: { allowed: 0, blocked: 0 },
    REGISTER: { allowed: 0, blocked: 0 },
    TOURNAMENT_JOIN: { allowed: 0, blocked: 0 },
    MATCH_SCORE: { allowed: 0, blocked: 0 },
    PASSWORD_RESET: { allowed: 0, blocked: 0 },
    OTP_SEND: { allowed: 0, blocked: 0 },
    BRACKET_GENERATE: { allowed: 0, blocked: 0 },
  },
};

/**
 * Record a rate limit check in metrics
 */
function recordMetrics(
  allowed: boolean,
  tier: RateLimitTier,
  source: 'redis' | 'memory',
  latencyMs: number
): void {
  metrics.totalChecks++;

  // Ensure the tier exists in byTier (defensive programming)
  if (!metrics.byTier[tier]) {
    metrics.byTier[tier] = { allowed: 0, blocked: 0 };
  }

  if (allowed) {
    metrics.allowedRequests++;
    metrics.byTier[tier].allowed++;
  } else {
    metrics.blockedRequests++;
    metrics.byTier[tier].blocked++;
  }

  if (source === 'redis') {
    metrics.redisHits++;
  } else {
    metrics.memoryHits++;
  }

  // Update rolling average latency
  metrics.latencySamples.push(latencyMs);
  if (metrics.latencySamples.length > 1000) {
    metrics.latencySamples.shift();
  }
  metrics.averageLatency =
    metrics.latencySamples.reduce((a, b) => a + b, 0) / metrics.latencySamples.length;
}

/**
 * Get current rate limit metrics
 */
export function getRateLimitMetrics(): Readonly<RateLimitMetrics> {
  return { ...metrics };
}

/**
 * Reset rate limit metrics
 */
export function resetRateLimitMetrics(): void {
  metrics.totalChecks = 0;
  metrics.allowedRequests = 0;
  metrics.blockedRequests = 0;
  metrics.redisHits = 0;
  metrics.redisMisses = 0;
  metrics.memoryHits = 0;
  metrics.fallbackCount = 0;
  metrics.errors = 0;
  metrics.averageLatency = 0;
  metrics.latencySamples = [];
  
  for (const tier of Object.keys(metrics.byTier) as RateLimitTier[]) {
    metrics.byTier[tier] = { allowed: 0, blocked: 0 };
  }
}

// ============================================
// In-Memory Fallback Store
// ============================================

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute for memory store
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 60 * 1000);
}

// ============================================
// Redis Client Management
// ============================================

type RedisLikeClient = import('ioredis').Redis | import('ioredis').Cluster;

let redisClient: RedisLikeClient | null = null;
let redisConnectionPromise: Promise<RedisLikeClient | null> | null = null;
let isRedisConnected = false;
let useRedis = false;
let currentMode: 'standalone' | 'cluster' | 'sentinel' | 'memory' = 'memory';

// Lua script for atomic increment + expiry
// This ensures that the increment and expiry setting are atomic
// preventing race conditions in distributed environments
const INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

let incrementScriptSha: string | null = null;

/**
 * Get the Redis key prefix
 */
function getRedisPrefix(): string {
  return process.env.RATE_LIMIT_PREFIX || 'vh:rl:';
}

/**
 * Initialize Redis client for standalone mode
 */
async function initializeStandaloneRedis(): Promise<import('ioredis').Redis | null> {
  try {
    const Redis = (await import('ioredis')).default;
    const config = getRedisConfig();
    const tlsOptions = getTLSOptions();

    const client = new Redis(config.url!, {
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      retryStrategy: createRetryStrategy(config.maxRetries, config.retryDelay),
      reconnectOnError: isReconnectableError,
      lazyConnect: true,
      keepAlive: config.keepAlive,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
      enableReadyCheck: config.enableReadyCheck,
      enableOfflineQueue: config.enableOfflineQueue,
      connectionName: config.connectionName,
      tls: tlsOptions,
    });

    return client;
  } catch (error) {
    console.error('[DistributedRateLimit] Failed to initialize standalone Redis:', error);
    return null;
  }
}

/**
 * Initialize Redis client for cluster mode
 */
async function initializeClusterRedis(clusterConfig: ClusterConfig): Promise<import('ioredis').Cluster | null> {
  try {
    const Redis = (await import('ioredis')).default;
    const tlsOptions = getTLSOptions();

    const nodes = clusterConfig.nodes.map(node => {
      const [host, port] = node.split(':');
      return { host: host || process.env.REDIS_HOST || 'redis', port: port ? parseInt(port, 10) : 6379 };
    });

    const client = new Redis.Cluster(nodes, {
      scaleReads: clusterConfig.scaleReads,
      maxRedirections: clusterConfig.maxRedirections,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 100,
      enableReadyCheck: true,
      slotsRefreshTimeout: 1000,
      clusterRetryStrategy: (times: number) => {
        if (times > 5) {
          console.error('[DistributedRateLimit] Cluster connection failed after 5 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      redisOptions: {
        tls: tlsOptions,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
      },
    });

    return client;
  } catch (error) {
    console.error('[DistributedRateLimit] Failed to initialize Redis Cluster:', error);
    return null;
  }
}

/**
 * Initialize Redis Sentinel client
 * Note: ioredis supports sentinel natively
 */
async function initializeSentinelRedis(sentinelConfig: SentinelConfig): Promise<import('ioredis').Redis | null> {
  try {
    const Redis = (await import('ioredis')).default;
    
    const sentinels = sentinelConfig.hosts.map(host => {
      const [hostname, port] = host.split(':');
      return { host: hostname, port: port ? parseInt(port, 10) : 26379 };
    });

    const client = new Redis({
      sentinels,
      name: sentinelConfig.masterName,
      password: sentinelConfig.password,
      sentinelPassword: sentinelConfig.sentinelPassword,
      role: 'master', // Connect to master for writes
      maxRetriesPerRequest: 3,
      retryStrategy: createRetryStrategy(5, 100),
      lazyConnect: true,
      enableReadyCheck: true,
    });

    return client;
  } catch (error) {
    console.error('[DistributedRateLimit] Failed to initialize Redis Sentinel:', error);
    return null;
  }
}

/**
 * Setup common event handlers for Redis client
 */
function setupRedisEventHandlers(
  client: import('ioredis').Redis | import('ioredis').Cluster
): void {
  client.on('connect', () => {
    console.log('[DistributedRateLimit] Redis connecting...');
  });

  client.on('ready', async () => {
    console.log('[DistributedRateLimit] Redis connected successfully');
    isRedisConnected = true;
    useRedis = true;
    
    // Load the Lua script for atomic operations
    try {
      incrementScriptSha = String(await client.script('LOAD', INCREMENT_SCRIPT));
      console.log('[DistributedRateLimit] Lua script loaded:', incrementScriptSha);
    } catch (error) {
      console.error('[DistributedRateLimit] Failed to load Lua script:', error);
    }
  });

  client.on('error', (err: Error) => {
    console.error('[DistributedRateLimit] Redis error:', err.message);
    isRedisConnected = false;
    metrics.errors++;
  });

  client.on('close', () => {
    console.log('[DistributedRateLimit] Redis connection closed');
    isRedisConnected = false;
  });

  client.on('reconnecting', () => {
    console.log('[DistributedRateLimit] Redis reconnecting...');
  });

  // Cluster-specific events
  if ('+switch-master' in client) {
    client.on('+switch-master', (data: { name: string }) => {
      console.log(`[DistributedRateLimit] Sentinel master switch: ${data.name}`);
    });
  }
}

/**
 * Initialize Redis client with support for standalone, cluster, and sentinel
 */
async function initializeRedis(): Promise<typeof redisClient> {
  // Return existing client if connected
  if (redisClient && isRedisConnected) {
    return redisClient;
  }

  // Return existing connection promise if in progress
  if (redisConnectionPromise) {
    return redisConnectionPromise;
  }

  redisConnectionPromise = (async () => {
    try {
      let client: import('ioredis').Redis | import('ioredis').Cluster | null = null;

      // Check for cluster configuration first
      const clusterConfig = getClusterConfig();
      if (clusterConfig) {
        console.log('[DistributedRateLimit] Initializing Redis Cluster mode');
        currentMode = 'cluster';
        client = await initializeClusterRedis(clusterConfig);
      }

      // Check for sentinel configuration
      if (!client) {
        const sentinelConfig = getSentinelConfig();
        if (sentinelConfig) {
          console.log('[DistributedRateLimit] Initializing Redis Sentinel mode');
          currentMode = 'sentinel';
          client = await initializeSentinelRedis(sentinelConfig);
        }
      }

      // Fall back to standalone Redis
      if (!client) {
        console.log('[DistributedRateLimit] Initializing standalone Redis mode');
        currentMode = 'standalone';
        client = await initializeStandaloneRedis();
      }

      if (!client) {
        throw new Error('Failed to initialize Redis client');
      }

      // Setup event handlers
      setupRedisEventHandlers(client);

      // Attempt connection
      await client.connect();
      
      redisClient = client;
      return client;
    } catch (error) {
      console.warn('[DistributedRateLimit] Redis connection failed, using in-memory fallback:', 
        error instanceof Error ? error.message : 'Unknown error');
      redisConnectionPromise = null;
      useRedis = false;
      isRedisConnected = false;
      currentMode = 'memory';
      metrics.fallbackCount++;
      return null;
    }
  })();

  return redisConnectionPromise;
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  mode: 'standalone' | 'cluster' | 'sentinel' | 'memory';
  latency?: number;
}> {
  if (!redisClient || !isRedisConnected) {
    return { healthy: false, mode: currentMode };
  }
  
  try {
    const start = performance.now();
    const result = await redisClient.ping();
    const latency = performance.now() - start;
    
    return {
      healthy: result === 'PONG',
      mode: currentMode,
      latency: Math.round(latency * 1000) / 1000,
    };
  } catch {
    return { healthy: false, mode: currentMode };
  }
}

// ============================================
// Distributed Rate Limiter Class
// ============================================

export class DistributedRateLimiter {
  private prefix: string;
  private enableMetrics: boolean;

  constructor(config?: Partial<DistributedRateLimitConfig>) {
    this.prefix = config?.prefix || getRedisPrefix();
    this.enableMetrics = config?.enableMetrics ?? true;
    
    // Initialize Redis on first instantiation
    if (isRedisConfigured() && !redisClient) {
      initializeRedis().catch(err => {
        console.error('[DistributedRateLimit] Failed to initialize Redis:', err);
      });
    }
  }

  /**
   * Build full rate limit key
   */
  private buildKey(identifier: string, tier: RateLimitTier): string {
    return `${this.prefix}${tier}:${identifier}`;
  }

  /**
   * Check rate limit using Redis or in-memory fallback
   * Atomic increment with expiry using Lua script
   */
  async check(identifier: string, tier: RateLimitTier): Promise<RateLimitResult> {
    const config = RATE_LIMITS[tier];
    const key = this.buildKey(identifier, tier);
    const startTime = performance.now();

    // Try Redis first
    if (useRedis && redisClient && isRedisConnected) {
      try {
        const result = await this.checkWithRedis(key, config.requests, config.windowMs);
        const latency = performance.now() - startTime;
        
        if (this.enableMetrics) {
          recordMetrics(result.allowed, tier, 'redis', latency);
        }
        
        return result;
      } catch (error) {
        console.warn('[DistributedRateLimit] Redis check failed, falling back to memory:', 
          error instanceof Error ? error.message : 'Unknown error');
        metrics.fallbackCount++;
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory
    const result = this.checkWithMemory(key, config.requests, config.windowMs);
    const latency = performance.now() - startTime;
    
    if (this.enableMetrics) {
      recordMetrics(result.allowed, tier, 'memory', latency);
    }
    
    return result;
  }

  /**
   * Check rate limit using Redis with Lua script for atomic operations
   */
  private async checkWithRedis(
    key: string, 
    maxRequests: number, 
    windowMs: number
  ): Promise<RateLimitResult> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }

    const now = Date.now();
    const ttl = windowMs; // TTL in milliseconds

    // Use EVALSHA for atomic increment + expiry
    let current: number;
    
    if (incrementScriptSha) {
      try {
        current = Number(await redisClient.evalsha(incrementScriptSha, 1, key, ttl.toString()));
      } catch (error) {
        // Script might not be loaded, try loading it again
        if (error instanceof Error && error.message.includes('NOSCRIPT')) {
          incrementScriptSha = String(await redisClient.script('LOAD', INCREMENT_SCRIPT));
          current = Number(await redisClient.evalsha(incrementScriptSha!, 1, key, ttl.toString()));
        } else {
          throw error;
        }
      }
    } else {
      // Use EVAL directly if script SHA not available
      current = Number(await redisClient.eval(INCREMENT_SCRIPT, 1, key, ttl.toString()));
    }

    const count = current;
    const remaining = Math.max(0, maxRequests - count);

    // Get TTL for reset time
    const ttlResult = await redisClient.pttl(key);
    const resetAt = now + (ttlResult > 0 ? ttlResult : windowMs);

    if (count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: maxRequests,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
      limit: maxRequests,
    };
  }

  /**
   * Check rate limit using in-memory store (fallback)
   */
  private checkWithMemory(
    key: string, 
    maxRequests: number, 
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Start new window
      memoryStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
        limit: maxRequests,
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        limit: maxRequests,
      };
    }

    // Increment count
    entry.count++;
    memoryStore.set(key, entry);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
      limit: maxRequests,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, tier: RateLimitTier): Promise<void> {
    const key = this.buildKey(identifier, tier);

    if (useRedis && redisClient && isRedisConnected) {
      try {
        await redisClient.del(key);
        return;
      } catch (error) {
        console.warn('[DistributedRateLimit] Redis delete failed:', error);
      }
    }

    memoryStore.delete(key);
  }

  /**
   * Get current count for an identifier (without incrementing)
   */
  async getCount(identifier: string, tier: RateLimitTier): Promise<number> {
    const key = this.buildKey(identifier, tier);

    if (useRedis && redisClient && isRedisConnected) {
      try {
        const count = await redisClient.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        console.warn('[DistributedRateLimit] Redis get failed:', error);
      }
    }

    const entry = memoryStore.get(key);
    if (entry && entry.resetAt > Date.now()) {
      return entry.count;
    }
    return 0;
  }

  /**
   * Get the current mode (redis/cluster/sentinel/memory)
   */
  getMode(): 'redis' | 'cluster' | 'sentinel' | 'memory' {
    if (!useRedis || !isRedisConnected) {
      return 'memory';
    }
    return currentMode === 'standalone' ? 'redis' : currentMode;
  }

  /**
   * Check if Redis is being used
   */
  isUsingRedis(): boolean {
    return useRedis && isRedisConnected;
  }

  /**
   * Force fallback to in-memory (useful for testing or emergency situations)
   */
  forceMemoryMode(): void {
    console.log('[DistributedRateLimit] Forcing memory mode');
    useRedis = false;
  }

  /**
   * Re-enable Redis mode
   */
  async enableRedisMode(): Promise<boolean> {
    if (!isRedisConfigured()) {
      console.log('[DistributedRateLimit] Redis not configured, cannot enable Redis mode');
      return false;
    }

    const client = await initializeRedis();
    if (client) {
      useRedis = true;
      console.log('[DistributedRateLimit] Redis mode re-enabled');
      return true;
    }
    
    return false;
  }

  /**
   * Get statistics about the rate limiter
   */
  async getStats(): Promise<{
    mode: 'redis' | 'cluster' | 'sentinel' | 'memory';
    redisConnected: boolean;
    memoryKeysCount: number;
    metrics: RateLimitMetrics;
  }> {
    const stats = {
      mode: this.getMode(),
      redisConnected: isRedisConnected,
      memoryKeysCount: memoryStore.size,
      metrics: this.enableMetrics ? getRateLimitMetrics() : null!,
    };

    return stats;
  }
}

// ============================================
// Singleton Instance
// ============================================

let distributedRateLimiterInstance: DistributedRateLimiter | null = null;

/**
 * Get the singleton DistributedRateLimiter instance
 */
export function getDistributedRateLimiter(): DistributedRateLimiter {
  if (!distributedRateLimiterInstance) {
    distributedRateLimiterInstance = new DistributedRateLimiter();
  }
  return distributedRateLimiterInstance;
}

/**
 * Initialize Redis connection explicitly
 */
export async function initializeDistributedRateLimiter(): Promise<boolean> {
  if (!isRedisConfigured()) {
    console.log('[DistributedRateLimit] REDIS_URL not configured, using in-memory rate limiting');
    return false;
  }

  const client = await initializeRedis();
  if (client) {
    console.log('[DistributedRateLimit] Initialized with Redis');
    return true;
  }
  
  console.log('[DistributedRateLimit] Initialized with in-memory fallback');
  return false;
}

/**
 * Shutdown Redis connection gracefully
 */
export async function shutdownDistributedRateLimiter(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[DistributedRateLimit] Redis connection closed gracefully');
    } catch (error) {
      console.error('[DistributedRateLimit] Error closing Redis connection:', error);
    }
    redisClient = null;
    isRedisConnected = false;
    useRedis = false;
    currentMode = 'memory';
  }
}

// ============================================
// Export Convenience Functions
// ============================================

/**
 * Check rate limit using distributed rate limiter
 */
export async function checkDistributedRateLimit(
  identifier: string,
  tier: RateLimitTier = 'PUBLIC'
): Promise<RateLimitResult> {
  const limiter = getDistributedRateLimiter();
  return limiter.check(identifier, tier);
}

/**
 * Reset rate limit using distributed rate limiter
 */
export async function resetDistributedRateLimit(
  identifier: string,
  tier: RateLimitTier
): Promise<void> {
  const limiter = getDistributedRateLimiter();
  return limiter.reset(identifier, tier);
}
