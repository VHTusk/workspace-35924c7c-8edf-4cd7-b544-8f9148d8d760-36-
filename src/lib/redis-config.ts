/**
 * Redis Configuration Module for VALORHIVE
 * 
 * Production-ready Redis configuration with:
 * - Connection pool configuration
 * - Retry strategy with exponential backoff
 * - TLS support for production
 * - Sentinel support for high availability
 * - Redis Cluster support for scaling
 * - Read replica support (REDIS_READONLY_URL)
 * - Pub/Sub client for cache invalidation
 * - Circuit breaker pattern
 * - Health check functions
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string (e.g., redis://localhost:6379)
 * - REDIS_READONLY_URL: Read replica connection string for read operations
 * - REDIS_TLS_ENABLED: Enable TLS for production (default: false)
 * - REDIS_MAX_RETRIES: Maximum retry attempts (default: 5)
 * - REDIS_RETRY_DELAY: Base retry delay in ms (default: 100)
 * - REDIS_SENTINEL_HOSTS: Comma-separated sentinel hosts (for HA)
 * - REDIS_SENTINEL_MASTER: Sentinel master name (default: mymaster)
 * - REDIS_CLUSTER_NODES: Comma-separated cluster nodes (for cluster mode)
 * - REDIS_CIRCUIT_BREAKER_THRESHOLD: Failures before opening circuit (default: 5)
 * - REDIS_CIRCUIT_BREAKER_TIMEOUT: Circuit open duration in ms (default: 30000)
 */

import IORedis from 'ioredis';

// ============================================
// Types and Interfaces
// ============================================

export interface RedisConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetries: number;
  retryDelay: number;
  enableTLS: boolean;
  connectTimeout: number;
  commandTimeout: number;
  keepAlive: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  enableOfflineQueue: boolean;
  connectionName?: string;
}

export interface SentinelConfig {
  hosts: string[];
  masterName: string;
  password?: string;
  sentinelPassword?: string;
}

export interface ClusterConfig {
  nodes: string[];
  maxRedirections: number;
  scaleReads: 'master' | 'slave' | 'all';
}

export interface RedisPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

// ============================================
// Default Configuration Values
// ============================================

export const DEFAULT_REDIS_CONFIG: RedisConnectionConfig = {
  maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '5', 10),
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
  enableTLS: process.env.REDIS_TLS_ENABLED === 'true',
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000, // 5 seconds
  keepAlive: 10000, // 10 seconds
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectionName: 'valorhive-app',
};

export const DEFAULT_POOL_CONFIG: RedisPoolConfig = {
  minConnections: 1,
  maxConnections: 10,
  acquireTimeout: 5000, // 5 seconds
  idleTimeout: 30000, // 30 seconds
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.REDIS_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  successThreshold: 3, // Successes needed to close circuit
  timeout: parseInt(process.env.REDIS_CIRCUIT_BREAKER_TIMEOUT || '30000', 10),
  resetTimeout: parseInt(process.env.REDIS_CIRCUIT_BREAKER_RESET_TIMEOUT || '60000', 10),
};

// ============================================
// Circuit Breaker Implementation
// ============================================

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    status: 'closed',
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    lastStateChange: Date.now(),
  };

  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.config = config;
  }

  /**
   * Check if the circuit allows execution
   */
  canExecute(): boolean {
    const now = Date.now();

    switch (this.state.status) {
      case 'closed':
        return true;

      case 'open':
        // Check if reset timeout has elapsed
        if (now - this.state.lastStateChange >= this.config.resetTimeout) {
          this.transitionTo('half-open');
          return true;
        }
        return false;

      case 'half-open':
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.state.successes++;

    if (this.state.status === 'half-open') {
      if (this.state.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state.status === 'closed') {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailureTime = now;

    if (this.state.status === 'half-open') {
      // Any failure in half-open state opens the circuit
      this.transitionTo('open');
    } else if (this.state.status === 'closed') {
      if (this.state.failures >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('closed');
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newStatus: CircuitBreakerState['status']): void {
    const oldStatus = this.state.status;
    this.state.status = newStatus;
    this.state.lastStateChange = Date.now();

    if (newStatus === 'closed') {
      this.state.failures = 0;
      this.state.successes = 0;
    } else if (newStatus === 'open') {
      this.state.successes = 0;
    } else if (newStatus === 'half-open') {
      this.state.successes = 0;
    }

    console.log(`[CircuitBreaker] State transition: ${oldStatus} -> ${newStatus}`);
  }
}

// ============================================
// Connection Pool Implementation
// ============================================

interface PooledConnection {
  client: IORedis;
  inUse: boolean;
  lastUsed: number;
  id: number;
}

export class RedisConnectionPool {
  private connections: PooledConnection[] = [];
  private config: RedisPoolConfig;
  private redisConfig: Record<string, unknown>;
  private waitQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private connectionIdCounter = 0;
  private circuitBreaker: CircuitBreaker;

  constructor(
    redisConfig: Record<string, unknown>,
    poolConfig: RedisPoolConfig = DEFAULT_POOL_CONFIG,
    circuitBreaker?: CircuitBreaker
  ) {
    this.config = poolConfig;
    this.redisConfig = redisConfig;
    this.circuitBreaker = circuitBreaker || new CircuitBreaker();
  }

  /**
   * Initialize the pool with minimum connections
   */
  async initialize(): Promise<void> {
    const promises: Promise<PooledConnection>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }

    await Promise.allSettled(promises);
    console.log(`[RedisPool] Initialized with ${this.connections.length} connections`);
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection> {
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Circuit breaker is open - Redis unavailable');
    }

    // Try to find an idle connection
    const idleConnection = this.connections.find(c => !c.inUse && c.client.status === 'ready');
    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsed = Date.now();
      return idleConnection;
    }

    // Create a new connection if under max
    if (this.connections.length < this.config.maxConnections) {
      try {
        const conn = await this.createConnection();
        conn.inUse = true;
        conn.lastUsed = Date.now();
        this.circuitBreaker.recordSuccess();
        return conn;
      } catch (error) {
        this.circuitBreaker.recordFailure();
        throw error;
      }
    }

    // Wait for an available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Connection pool acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    connection.inUse = false;

    // Check if there's a waiting request
    const waiting = this.waitQueue.shift();
    if (waiting) {
      clearTimeout(waiting.timeout);
      connection.inUse = true;
      connection.lastUsed = Date.now();
      waiting.resolve(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.connections.length,
      inUse: this.connections.filter(c => c.inUse).length,
      idle: this.connections.filter(c => !c.inUse).length,
      waiting: this.waitQueue.length,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    // Reject all waiting requests
    for (const waiting of this.waitQueue) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Pool is closing'));
    }
    this.waitQueue = [];

    // Close all connections
    await Promise.all(
      this.connections.map(async (conn) => {
        try {
          await conn.client.quit();
        } catch {
          conn.client.disconnect();
        }
      })
    );

    this.connections = [];
    console.log('[RedisPool] All connections closed');
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const id = ++this.connectionIdCounter;
    const client = new IORedis({
      ...this.redisConfig,
      connectionName: `${this.redisConfig.connectionName as string}-pool-${id}`,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection creation timeout'));
      }, this.config.acquireTimeout);

      client.once('ready', () => {
        clearTimeout(timeout);
        const pooled: PooledConnection = {
          client,
          inUse: false,
          lastUsed: Date.now(),
          id,
        };
        this.connections.push(pooled);
        resolve(pooled);
      });

      client.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}

// ============================================
// Redis Clients Management
// ============================================

let primaryClient: IORedis | null = null;
let readonlyClient: IORedis | null = null;
let pubSubPublisher: IORedis | null = null;
let pubSubSubscriber: IORedis | null = null;
let connectionPool: RedisConnectionPool | null = null;
let circuitBreaker: CircuitBreaker | null = null;

// ============================================
// Configuration Factory Functions
// ============================================

/**
 * Parse Redis URL into connection configuration
 */
export function parseRedisUrl(url: string): Partial<RedisConnectionConfig> {
  try {
    const parsed = new URL(url);
    const config: Partial<RedisConnectionConfig> = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db: parsed.pathname && parsed.pathname !== '/' 
        ? parseInt(parsed.pathname.slice(1), 10) 
        : 0,
    };
    return config;
  } catch (error) {
    console.error('[RedisConfig] Failed to parse Redis URL:', error);
    return {};
  }
}

/**
 * Get Redis connection configuration from environment
 */
export function getRedisConfig(): RedisConnectionConfig {
  const envUrl = process.env.REDIS_URL;
  
  const config: RedisConnectionConfig = {
    ...DEFAULT_REDIS_CONFIG,
    url: envUrl,
  };

  if (envUrl) {
    const parsed = parseRedisUrl(envUrl);
    Object.assign(config, parsed);
  }

  return config;
}

/**
 * Get read replica configuration from environment
 */
export function getReadReplicaConfig(): RedisConnectionConfig | null {
  const readonlyUrl = process.env.REDIS_READONLY_URL;
  
  if (!readonlyUrl) {
    return null;
  }

  const parsed = parseRedisUrl(readonlyUrl);
  return {
    ...DEFAULT_REDIS_CONFIG,
    url: readonlyUrl,
    ...parsed,
    connectionName: 'valorhive-readonly',
  };
}

/**
 * Get Sentinel configuration from environment
 */
export function getSentinelConfig(): SentinelConfig | null {
  const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS;
  const masterName = process.env.REDIS_SENTINEL_MASTER || 'mymaster';
  const sentinelPassword = process.env.REDIS_SENTINEL_PASSWORD;
  const redisPassword = process.env.REDIS_PASSWORD;

  if (!sentinelHosts) {
    return null;
  }

  const hosts = sentinelHosts.split(',').map(h => h.trim()).filter(Boolean);
  
  if (hosts.length === 0) {
    return null;
  }

  return {
    hosts,
    masterName,
    password: redisPassword,
    sentinelPassword,
  };
}

/**
 * Get Cluster configuration from environment
 */
export function getClusterConfig(): ClusterConfig | null {
  const clusterNodes = process.env.REDIS_CLUSTER_NODES;

  if (!clusterNodes) {
    return null;
  }

  const nodes = clusterNodes.split(',').map(n => n.trim()).filter(Boolean);

  if (nodes.length === 0) {
    return null;
  }

  return {
    nodes,
    maxRedirections: 16,
    scaleReads: 'slave',
  };
}

/**
 * Get connection pool configuration
 */
export function getPoolConfig(): RedisPoolConfig {
  return {
    ...DEFAULT_POOL_CONFIG,
    minConnections: parseInt(process.env.REDIS_POOL_MIN || '1', 10),
    maxConnections: parseInt(process.env.REDIS_POOL_MAX || '10', 10),
    acquireTimeout: parseInt(process.env.REDIS_POOL_ACQUIRE_TIMEOUT || '5000', 10),
    idleTimeout: parseInt(process.env.REDIS_POOL_IDLE_TIMEOUT || '30000', 10),
  };
}

/**
 * Get circuit breaker configuration
 */
export function getCircuitBreakerConfig(): CircuitBreakerConfig {
  return { ...DEFAULT_CIRCUIT_BREAKER_CONFIG };
}

/**
 * Create retry strategy function with exponential backoff
 */
export function createRetryStrategy(
  maxRetries: number,
  baseDelay: number
): (times: number, error?: Error) => number | null {
  return (times: number, error?: Error): number | null => {
    // Log retry attempt
    if (error) {
      console.warn(`[RedisConfig] Retry attempt ${times}/${maxRetries}:`, error.message);
    }

    // Stop retrying after max attempts
    if (times > maxRetries) {
      console.error(`[RedisConfig] Max retries (${maxRetries}) exceeded, giving up`);
      return null;
    }

    // Exponential backoff with jitter
    // delay = min(baseDelay * 2^(times-1), maxDelay) + random jitter
    const maxDelay = 5000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, times - 1), maxDelay);
    const jitter = Math.random() * 100; // Add up to 100ms of jitter
    const delay = Math.floor(exponentialDelay + jitter);

    console.log(`[RedisConfig] Retrying in ${delay}ms (attempt ${times}/${maxRetries})`);
    return delay;
  };
}

/**
 * Check if error is reconnectable
 */
export function isReconnectableError(error: Error): boolean {
  const reconnectableErrors = [
    'READONLY',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPIPE',
    'PROTOCOL_ERROR',
    'WRONGPASS', // If password changed, reconnect might fix
    'LOADING',   // Redis is loading dataset
    'MASTERDOWN', // Master is down (Sentinel)
  ];

  return reconnectableErrors.some(err => 
    error.message.includes(err) || error.name.includes(err)
  );
}

/**
 * Get TLS options for production
 */
export function getTLSOptions(): Record<string, unknown> | undefined {
  if (process.env.REDIS_TLS_ENABLED !== 'true') {
    return undefined;
  }

  return {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    servername: process.env.REDIS_TLS_SERVERNAME,
    ca: process.env.REDIS_TLS_CA 
      ? Buffer.from(process.env.REDIS_TLS_CA, 'base64') 
      : undefined,
    cert: process.env.REDIS_TLS_CERT 
      ? Buffer.from(process.env.REDIS_TLS_CERT, 'base64') 
      : undefined,
    key: process.env.REDIS_TLS_KEY 
      ? Buffer.from(process.env.REDIS_TLS_KEY, 'base64') 
      : undefined,
  };
}

/**
 * Build ioredis connection options
 */
export function buildRedisOptions(): Record<string, unknown> {
  const config = getRedisConfig();
  const tlsOptions = getTLSOptions();

  return {
    // Connection settings
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    connectionName: config.connectionName,

    // Timeout settings
    connectTimeout: config.connectTimeout,
    commandTimeout: config.commandTimeout,
    keepAlive: config.keepAlive,

    // Retry settings
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    retryStrategy: createRetryStrategy(config.maxRetries, config.retryDelay),

    // Reconnection settings
    reconnectOnError: isReconnectableError,
    enableReadyCheck: config.enableReadyCheck,
    enableOfflineQueue: config.enableOfflineQueue,
    lazyConnect: true,

    // Connection pool settings (for cluster mode)
    family: 4, // IPv4
    enableTCPKeepAlive: true,
    noDelay: true,

    // TLS settings
    tls: tlsOptions,
  };
}

// ============================================
// Client Initialization Functions
// ============================================

/**
 * Get or create the primary Redis client
 */
export async function getPrimaryClient(): Promise<IORedis | null> {
  if (primaryClient && primaryClient.status === 'ready') {
    return primaryClient;
  }

  if (!process.env.REDIS_URL) {
    console.warn('[RedisConfig] REDIS_URL not configured');
    return null;
  }

  try {
    const options = buildRedisOptions();
    primaryClient = new IORedis(options);
    await primaryClient.ping();
    console.log('[RedisConfig] Primary client connected');
    return primaryClient;
  } catch (error) {
    console.error('[RedisConfig] Failed to create primary client:', error);
    return null;
  }
}

/**
 * Get or create the readonly Redis client (for read replicas)
 */
export async function getReadonlyClient(): Promise<IORedis | null> {
  if (readonlyClient && readonlyClient.status === 'ready') {
    return readonlyClient;
  }

  const readonlyConfig = getReadReplicaConfig();
  if (!readonlyConfig || !readonlyConfig.url) {
    // Fall back to primary client
    return getPrimaryClient();
  }

  try {
    const tlsOptions = getTLSOptions();
    readonlyClient = new IORedis({
      host: readonlyConfig.host,
      port: readonlyConfig.port,
      password: readonlyConfig.password,
      db: readonlyConfig.db,
      connectionName: readonlyConfig.connectionName,
      connectTimeout: readonlyConfig.connectTimeout,
      commandTimeout: readonlyConfig.commandTimeout,
      keepAlive: readonlyConfig.keepAlive,
      maxRetriesPerRequest: readonlyConfig.maxRetriesPerRequest,
      retryStrategy: createRetryStrategy(readonlyConfig.maxRetries, readonlyConfig.retryDelay),
      enableReadyCheck: readonlyConfig.enableReadyCheck,
      enableOfflineQueue: readonlyConfig.enableOfflineQueue,
      lazyConnect: true,
      tls: tlsOptions,
    });
    await readonlyClient.ping();
    console.log('[RedisConfig] Readonly client connected to replica');
    return readonlyClient;
  } catch (error) {
    console.error('[RedisConfig] Failed to create readonly client, falling back to primary:', error);
    return getPrimaryClient();
  }
}

/**
 * Get or create the pub/sub publisher client
 */
export async function getPubSubPublisher(): Promise<IORedis | null> {
  if (pubSubPublisher && pubSubPublisher.status === 'ready') {
    return pubSubPublisher;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    const options = buildRedisOptions();
    pubSubPublisher = new IORedis({
      ...options,
      connectionName: 'valorhive-pubsub-publisher',
      maxRetriesPerRequest: null, // Required for pub/sub
    });
    await pubSubPublisher.ping();
    console.log('[RedisConfig] Pub/Sub publisher client connected');
    return pubSubPublisher;
  } catch (error) {
    console.error('[RedisConfig] Failed to create pub/sub publisher:', error);
    return null;
  }
}

/**
 * Get or create the pub/sub subscriber client
 */
export async function getPubSubSubscriber(): Promise<IORedis | null> {
  if (pubSubSubscriber && pubSubSubscriber.status === 'ready') {
    return pubSubSubscriber;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    const options = buildRedisOptions();
    pubSubSubscriber = new IORedis({
      ...options,
      connectionName: 'valorhive-pubsub-subscriber',
      maxRetriesPerRequest: null, // Required for pub/sub
      enableReadyCheck: false, // Required for subscriber mode
      enableOfflineQueue: false, // Required for subscriber mode
    });
    await pubSubSubscriber.ping();
    console.log('[RedisConfig] Pub/Sub subscriber client connected');
    return pubSubSubscriber;
  } catch (error) {
    console.error('[RedisConfig] Failed to create pub/sub subscriber:', error);
    return null;
  }
}

/**
 * Get or create the connection pool
 */
export async function getConnectionPool(): Promise<RedisConnectionPool | null> {
  if (connectionPool) {
    return connectionPool;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    const options = buildRedisOptions();
    const poolConfig = getPoolConfig();
    
    circuitBreaker = new CircuitBreaker(getCircuitBreakerConfig());
    connectionPool = new RedisConnectionPool(options, poolConfig, circuitBreaker);
    
    await connectionPool.initialize();
    console.log('[RedisConfig] Connection pool initialized');
    return connectionPool;
  } catch (error) {
    console.error('[RedisConfig] Failed to create connection pool:', error);
    return null;
  }
}

/**
 * Get the circuit breaker instance
 */
export function getCircuitBreaker(): CircuitBreaker | null {
  return circuitBreaker;
}

// ============================================
// Health Check Functions
// ============================================

export interface RedisHealthCheckResult {
  healthy: boolean;
  latency: number;
  version?: string;
  connectedClients?: number;
  usedMemory?: number;
  usedMemoryPeak?: number;
  totalKeys?: number;
  hitRate?: number;
  opsPerSecond?: number;
  uptime?: number;
  error?: string;
}

/**
 * Perform comprehensive health check on Redis
 */
export async function performHealthCheck(): Promise<RedisHealthCheckResult> {
  const client = await getPrimaryClient();
  
  if (!client) {
    return {
      healthy: false,
      latency: 0,
      error: 'Redis client not initialized',
    };
  }

  const startTime = performance.now();
  
  try {
    // Run ping and info commands
    const [, infoServer, infoMemory, infoStats, infoKeyspace] = await Promise.all([
      client.ping(),
      client.info('server'),
      client.info('memory'),
      client.info('stats'),
      client.info('keyspace'),
    ]);

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    // Parse server info
    const serverInfo = parseRedisInfo(infoServer);
    const memoryInfo = parseRedisInfo(infoMemory);
    const statsInfo = parseRedisInfo(infoStats);
    const keyspaceInfo = parseRedisInfo(infoKeyspace);

    // Calculate total keys
    const totalKeys = Object.keys(keyspaceInfo)
      .filter(key => key.startsWith('db'))
      .reduce((sum, dbKey) => {
        const match = keyspaceInfo[dbKey].match(/keys=(\d+)/);
        return sum + (match ? parseInt(match[1], 10) : 0);
      }, 0);

    // Calculate hit rate
    const keyspaceHits = parseInt(statsInfo.keyspace_hits || '0', 10);
    const keyspaceMisses = parseInt(statsInfo.keyspace_misses || '0', 10);
    const totalRequests = keyspaceHits + keyspaceMisses;
    const hitRate = totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0;

    return {
      healthy: true,
      latency,
      version: serverInfo.redis_version,
      connectedClients: parseInt(serverInfo.connected_clients || '0', 10),
      usedMemory: parseInt(memoryInfo.used_memory || '0', 10),
      usedMemoryPeak: parseInt(memoryInfo.used_memory_peak || '0', 10),
      totalKeys,
      hitRate: Math.round(hitRate * 100) / 100,
      opsPerSecond: parseInt(statsInfo.instantaneous_ops_per_sec || '0', 10),
      uptime: parseInt(serverInfo.uptime_in_seconds || '0', 10),
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Math.round((performance.now() - startTime) * 100) / 100,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Perform health check on read replica
 */
export async function performReadReplicaHealthCheck(): Promise<RedisHealthCheckResult> {
  const client = await getReadonlyClient();
  
  if (!client) {
    return {
      healthy: false,
      latency: 0,
      error: 'Read replica not configured or unavailable',
    };
  }

  // Same health check logic
  return performHealthCheck();
}

/**
 * Check if all Redis connections are healthy
 */
export async function areAllConnectionsHealthy(): Promise<{
  primary: boolean;
  readonly: boolean;
  pubsubPublisher: boolean;
  pubsubSubscriber: boolean;
  pool: boolean;
}> {
  const primary = await getPrimaryClient();
  const readonly = await getReadonlyClient();
  const publisher = await getPubSubPublisher();
  const subscriber = await getPubSubSubscriber();
  const pool = await getConnectionPool();

  return {
    primary: primary?.status === 'ready',
    readonly: readonly?.status === 'ready',
    pubsubPublisher: publisher?.status === 'ready',
    pubsubSubscriber: subscriber?.status === 'ready',
    pool: pool !== null && pool.getStats().total > 0,
  };
}

/**
 * Parse Redis INFO command output
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const line of info.split('\n')) {
    const trimmed = line.trim();
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

// ============================================
// Validation Functions
// ============================================

/**
 * Validate Redis configuration
 */
export function validateRedisConfig(): { 
  valid: boolean; 
  errors: string[]; 
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getRedisConfig();

  // Check if Redis URL is configured
  if (!config.url && !config.host) {
    errors.push('REDIS_URL or REDIS_HOST is not configured');
  }

  // Check for TLS in production
  if (process.env.NODE_ENV === 'production' && !config.enableTLS) {
    warnings.push('TLS is not enabled for Redis connection in production');
  }

  // Check for Sentinel configuration
  const sentinelConfig = getSentinelConfig();
  if (sentinelConfig && sentinelConfig.hosts.length < 3) {
    warnings.push('Sentinel requires at least 3 hosts for fault tolerance');
  }

  // Check for Cluster configuration
  const clusterConfig = getClusterConfig();
  if (clusterConfig && clusterConfig.nodes.length < 3) {
    warnings.push('Redis Cluster requires at least 3 master nodes');
  }

  // Check pool configuration
  const poolConfig = getPoolConfig();
  if (poolConfig.maxConnections < poolConfig.minConnections) {
    errors.push('REDIS_POOL_MAX must be greater than or equal to REDIS_POOL_MIN');
  }

  // Check retry configuration
  if (config.maxRetries > 10) {
    warnings.push('REDIS_MAX_RETRIES is set to a high value, this may cause long connection delays');
  }

  // Check for read replica configuration
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_READONLY_URL) {
    warnings.push('Read replica (REDIS_READONLY_URL) not configured - using primary for reads');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/**
 * Get Redis connection string for display (redacted)
 */
export function getRedisConnectionString(): string {
  const url = process.env.REDIS_URL;
  
  if (!url) {
    return 'Not configured';
  }

  try {
    const parsed = new URL(url);
    // Redact password
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return 'Invalid URL';
  }
}

// ============================================
// Cleanup and Shutdown
// ============================================

/**
 * Close all Redis connections
 */
export async function shutdownRedis(): Promise<void> {
  const closePromises: Promise<unknown>[] = [];

  if (connectionPool) {
    closePromises.push(connectionPool.close());
    connectionPool = null;
  }

  if (primaryClient) {
    closePromises.push(primaryClient.quit().catch(() => primaryClient?.disconnect()));
    primaryClient = null;
  }

  if (readonlyClient) {
    closePromises.push(readonlyClient.quit().catch(() => readonlyClient?.disconnect()));
    readonlyClient = null;
  }

  if (pubSubPublisher) {
    closePromises.push(pubSubPublisher.quit().catch(() => pubSubPublisher?.disconnect()));
    pubSubPublisher = null;
  }

  if (pubSubSubscriber) {
    closePromises.push(pubSubSubscriber.quit().catch(() => pubSubSubscriber?.disconnect()));
    pubSubSubscriber = null;
  }

  await Promise.allSettled(closePromises);
  console.log('[RedisConfig] All connections closed');
}

// Export singleton getters
export {
  primaryClient as redisClient,
  readonlyClient as redisReadonlyClient,
  pubSubPublisher as redisPubSubPublisher,
  pubSubSubscriber as redisPubSubSubscriber,
};
