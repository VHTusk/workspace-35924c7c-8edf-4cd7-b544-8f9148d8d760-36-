/**
 * Redis Health Check Module for VALORHIVE
 * 
 * Provides comprehensive health check and monitoring utilities:
 * - Ping check for connectivity
 * - Memory usage monitoring
 * - Connection pool status
 * - Latency measurement
 * - Key statistics
 * 
 * Used for:
 * - Health endpoints (/api/health/redis)
 * - Monitoring dashboards
 * - Alerting systems
 */

import type { Redis as RedisType } from 'ioredis';

// ============================================
// Types and Interfaces
// ============================================

export interface RedisHealthStatus {
  healthy: boolean;
  connected: boolean;
  latency?: number;
  error?: string;
  timestamp: string;
  details?: RedisHealthDetails;
}

export interface RedisHealthDetails {
  version: string;
  mode: 'standalone' | 'sentinel' | 'cluster';
  role: 'master' | 'slave';
  uptime: number;
  connectedClients: number;
  blockedClients: number;
  usedMemory: number;
  usedMemoryPeak: number;
  usedMemoryPercentage: number;
  totalKeys: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  hitRate: number;
  opsPerSecond: number;
  networkBytesIn: number;
  networkBytesOut: number;
  connectionsReceived: number;
  totalCommands: number;
  lastSaveTime: number;
  changesSinceLastSave: number;
}

export interface RedisMemoryInfo {
  usedMemory: number;
  usedMemoryPeak: number;
  usedMemoryRss: number;
  usedMemoryPercentage: number;
  memoryFragmentationRatio: number;
  maxMemory: number;
  maxMemoryPolicy: string;
}

export interface RedisConnectionPoolStatus {
  activeConnections: number;
  idleConnections: number;
  waitingForConnection: number;
  maxConnections: number;
  minConnections: number;
}

export interface RedisLatencyResult {
  min: number;
  max: number;
  avg: number;
  samples: number[];
}

// ============================================
// Health Check Functions
// ============================================

/**
 * Check basic Redis connectivity with PING command
 */
export async function checkRedisPing(client: RedisType | null): Promise<{
  success: boolean;
  latency: number;
  error?: string;
}> {
  if (!client) {
    return {
      success: false,
      latency: 0,
      error: 'Redis client not initialized',
    };
  }

  try {
    const startTime = performance.now();
    const result = await client.ping();
    const endTime = performance.now();
    const latency = Math.round((endTime - startTime) * 1000) / 1000; // ms with 3 decimal places

    return {
      success: result === 'PONG',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      latency: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get comprehensive Redis health status
 */
export async function getRedisHealth(client: RedisType | null): Promise<RedisHealthStatus> {
  const timestamp = new Date().toISOString();

  // Check basic connectivity first
  const pingResult = await checkRedisPing(client);
  
  if (!pingResult.success) {
    return {
      healthy: false,
      connected: false,
      latency: pingResult.latency,
      error: pingResult.error,
      timestamp,
    };
  }

  try {
    const details = await getRedisHealthDetails(client!);
    
    // Determine health based on various metrics
    const healthy = determineHealth(pingResult.latency, details);

    return {
      healthy,
      connected: true,
      latency: pingResult.latency,
      timestamp,
      details,
    };
  } catch (error) {
    return {
      healthy: false,
      connected: true,
      latency: pingResult.latency,
      error: error instanceof Error ? error.message : 'Failed to get health details',
      timestamp,
    };
  }
}

/**
 * Get detailed Redis health information
 */
export async function getRedisHealthDetails(client: RedisType): Promise<RedisHealthDetails> {
  // Run all info commands in parallel for efficiency
  const [infoServer, infoMemory, infoStats, infoKeyspace] = await Promise.all([
    client.info('server'),
    client.info('memory'),
    client.info('stats'),
    client.info('keyspace'),
  ]);

  // Parse server info
  const serverInfo = parseRedisInfo(infoServer);
  const memoryInfo = parseRedisInfo(infoMemory);
  const statsInfo = parseRedisInfo(infoStats);
  const keyspaceInfo = parseRedisInfo(infoKeyspace);

  // Calculate total keys across all databases
  const totalKeys = Object.keys(keyspaceInfo)
    .filter(key => key.startsWith('db'))
    .reduce((sum, dbKey) => {
      const dbStats = keyspaceInfo[dbKey];
      const match = dbStats.match(/keys=(\d+)/);
      return sum + (match ? parseInt(match[1], 10) : 0);
    }, 0);

  // Calculate hit rate
  const keyspaceHits = parseInt(statsInfo.keyspace_hits || '0', 10);
  const keyspaceMisses = parseInt(statsInfo.keyspace_misses || '0', 10);
  const totalRequests = keyspaceHits + keyspaceMisses;
  const hitRate = totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0;

  // Calculate memory percentage
  const usedMemory = parseInt(memoryInfo.used_memory || '0', 10);
  const maxMemory = parseInt(memoryInfo.maxmemory || '0', 10);
  const usedMemoryPercentage = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

  // Determine mode and role
  const mode = detectRedisMode(serverInfo);
  const role = serverInfo.role as 'master' | 'slave' || 'master';

  return {
    version: serverInfo.redis_version || 'unknown',
    mode,
    role,
    uptime: parseInt(serverInfo.uptime_in_seconds || '0', 10),
    connectedClients: parseInt(serverInfo.connected_clients || '0', 10),
    blockedClients: parseInt(serverInfo.blocked_clients || '0', 10),
    usedMemory,
    usedMemoryPeak: parseInt(memoryInfo.used_memory_peak || '0', 10),
    usedMemoryPercentage,
    totalKeys,
    keyspaceHits,
    keyspaceMisses,
    hitRate: Math.round(hitRate * 100) / 100,
    opsPerSecond: parseInt(statsInfo.instantaneous_ops_per_sec || '0', 10),
    networkBytesIn: parseInt(statsInfo.total_net_input_bytes || '0', 10),
    networkBytesOut: parseInt(statsInfo.total_net_output_bytes || '0', 10),
    connectionsReceived: parseInt(statsInfo.total_connections_received || '0', 10),
    totalCommands: parseInt(statsInfo.total_commands_processed || '0', 10),
    lastSaveTime: parseInt(statsInfo.rdb_last_save_time || '0', 10),
    changesSinceLastSave: parseInt(statsInfo.rdb_changes_since_last_save || '0', 10),
  };
}

/**
 * Get Redis memory usage information
 */
export async function getRedisMemoryInfo(client: RedisType): Promise<RedisMemoryInfo> {
  const info = await client.info('memory');
  const parsed = parseRedisInfo(info);

  const usedMemory = parseInt(parsed.used_memory || '0', 10);
  const maxMemory = parseInt(parsed.maxmemory || '0', 10);

  return {
    usedMemory,
    usedMemoryPeak: parseInt(parsed.used_memory_peak || '0', 10),
    usedMemoryRss: parseInt(parsed.used_memory_rss || '0', 10),
    usedMemoryPercentage: maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0,
    memoryFragmentationRatio: parseFloat(parsed.mem_fragmentation_ratio || '1'),
    maxMemory,
    maxMemoryPolicy: parsed.maxmemory_policy || 'noeviction',
  };
}

/**
 * Measure Redis latency over multiple samples
 */
export async function measureRedisLatency(
  client: RedisType,
  samples: number = 10
): Promise<RedisLatencyResult> {
  const latencies: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await client.ping();
    const end = performance.now();
    latencies.push(Math.round((end - start) * 1000) / 1000);
  }

  return {
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    avg: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 1000) / 1000,
    samples: latencies,
  };
}

/**
 * Get connection pool status (for monitoring)
 * Note: ioredis doesn't expose pool directly, so we estimate based on client state
 */
export function getRedisPoolStatus(client: RedisType): RedisConnectionPoolStatus {
  // Get client state information
  const status = client.status;
  
  // Map ioredis status to our pool status
  // Note: This is a simplified view as ioredis manages connections internally
  return {
    activeConnections: status === 'ready' ? 1 : 0,
    idleConnections: status === 'ready' ? 0 : 1,
    waitingForConnection: status === 'connecting' || status === 'reconnecting' ? 1 : 0,
    maxConnections: 10, // Default pool size
    minConnections: 1,
  };
}

/**
 * Check if Redis is in a healthy state for production use
 */
export function isRedisHealthyForProduction(health: RedisHealthStatus): boolean {
  if (!health.healthy || !health.connected) {
    return false;
  }

  // Check latency threshold (under 100ms is acceptable for most use cases)
  if (health.latency && health.latency > 100) {
    return false;
  }

  // Check memory usage (under 90% is safe)
  if (health.details && health.details.usedMemoryPercentage > 90) {
    return false;
  }

  return true;
}

/**
 * Get rate limit specific statistics
 */
export async function getRateLimitStats(
  client: RedisType,
  prefix: string = 'vh:rl:'
): Promise<{
  totalKeys: number;
  keysByTier: Record<string, number>;
  memoryUsage: number;
}> {
  try {
    // Get all rate limit keys
    const keys = await client.keys(`${prefix}*`);
    
    // Count by tier
    const keysByTier: Record<string, number> = {};
    for (const key of keys) {
      // Extract tier from key (format: prefix:TIER:identifier)
      const parts = key.replace(prefix, '').split(':');
      const tier = parts[0] || 'unknown';
      keysByTier[tier] = (keysByTier[tier] || 0) + 1;
    }

    // Calculate memory usage for rate limit keys
    let memoryUsage = 0;
    if (keys.length > 0 && keys.length <= 100) {
      // Only sample first 100 keys to avoid blocking
      const sampleKeys = keys.slice(0, 100);
      const sizes = await Promise.all(
        sampleKeys.map(key => client.strlen(key).catch(() => 0))
      );
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      memoryUsage = avgSize * keys.length;
    }

    return {
      totalKeys: keys.length,
      keysByTier,
      memoryUsage,
    };
  } catch (error) {
    console.error('[RedisHealth] Failed to get rate limit stats:', error);
    return {
      totalKeys: 0,
      keysByTier: {},
      memoryUsage: 0,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse Redis INFO command output into key-value object
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const line of info.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex);
      const value = trimmed.slice(colonIndex + 1);
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Detect Redis deployment mode from server info
 */
function detectRedisMode(serverInfo: Record<string, string>): 'standalone' | 'sentinel' | 'cluster' {
  // Check for cluster
  if (serverInfo.cluster_enabled === '1') {
    return 'cluster';
  }
  
  // Check for sentinel
  if (serverInfo.redis_mode === 'sentinel') {
    return 'sentinel';
  }
  
  return 'standalone';
}

/**
 * Determine if Redis is healthy based on metrics
 */
function determineHealth(latency: number, details: RedisHealthDetails): boolean {
  // Latency check (under 50ms is healthy)
  if (latency > 50) {
    return false;
  }
  
  // Memory check (under 90% is healthy)
  if (details.usedMemoryPercentage > 90) {
    return false;
  }
  
  // Hit rate check (above 50% is healthy, but only if there's traffic)
  if (details.keyspaceHits + details.keyspaceMisses > 100 && details.hitRate < 50) {
    return false;
  }
  
  return true;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format uptime to human readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}
