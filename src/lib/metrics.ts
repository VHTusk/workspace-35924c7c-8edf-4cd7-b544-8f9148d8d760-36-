/**
 * Prometheus Metrics for VALORHIVE
 * 
 * Provides production-grade metrics instrumentation:
 * - HTTP request metrics
 * - Database query performance
 * - Redis cache hit rates
 * - Job queue statistics
 * - Custom business metrics
 * 
 * Exposes metrics at /api/metrics endpoint
 */

import client, { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';

// ============================================
// Registry Setup
// ============================================

const register = new Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// ============================================
// HTTP Metrics
// ============================================

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestsInProgress = new Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  labelNames: ['method', 'route'],
  registers: [register],
});

// ============================================
// Database Metrics
// ============================================

const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model'],
  registers: [register],
});

const dbQueryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'model', 'error_type'],
  registers: [register],
});

// ============================================
// Cache Metrics
// ============================================

const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

const cacheLatency = new Summary({
  name: 'cache_latency_seconds',
  help: 'Cache operation latency in seconds',
  labelNames: ['operation', 'cache_type'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

const cacheKeys = new Gauge({
  name: 'cache_keys_total',
  help: 'Total number of keys in cache',
  labelNames: ['cache_type'],
  registers: [register],
});

const cacheMemoryUsage = new Gauge({
  name: 'cache_memory_bytes',
  help: 'Memory usage of cache in bytes',
  labelNames: ['cache_type'],
  registers: [register],
});

// ============================================
// Job Queue Metrics
// ============================================

const jobsTotal = new Counter({
  name: 'jobs_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const jobsDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [register],
});

const jobsInQueue = new Gauge({
  name: 'jobs_in_queue',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue', 'state'],
  registers: [register],
});

const jobsRetries = new Counter({
  name: 'job_retries_total',
  help: 'Total number of job retries',
  labelNames: ['queue', 'job_type'],
  registers: [register],
});

// ============================================
// Business Metrics
// ============================================

const tournamentsActive = new Gauge({
  name: 'tournaments_active',
  help: 'Number of active tournaments',
  labelNames: ['sport', 'status'],
  registers: [register],
});

const registrationsTotal = new Counter({
  name: 'registrations_total',
  help: 'Total number of tournament registrations',
  labelNames: ['sport', 'tournament_id'],
  registers: [register],
});

const matchesCompleted = new Counter({
  name: 'matches_completed_total',
  help: 'Total number of completed matches',
  labelNames: ['sport', 'tournament_id'],
  registers: [register],
});

const usersTotal = new Gauge({
  name: 'users_total',
  help: 'Total number of users',
  labelNames: ['sport', 'tier'],
  registers: [register],
});

const sessionsActive = new Gauge({
  name: 'sessions_active',
  help: 'Number of active sessions',
  labelNames: ['account_type'],
  registers: [register],
});

const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

const paymentsTotal = new Counter({
  name: 'payments_total',
  help: 'Total payment amount',
  labelNames: ['status', 'sport'],
  registers: [register],
});

const refundTotal = new Counter({
  name: 'refunds_total',
  help: 'Total refund amount',
  labelNames: ['status', 'sport'],
  registers: [register],
});

// ============================================
// Error Metrics
// ============================================

const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'severity'],
  registers: [register],
});

const apiErrorsTotal = new Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'status_code', 'error_type'],
  registers: [register],
});

// ============================================
// Middleware Helper
// ============================================

/**
 * Track HTTP request metrics
 */
export function trackHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const durationSeconds = durationMs / 1000;
  
  httpRequestDuration.observe(
    { method, route: normalizeRoute(route), status_code: statusCode.toString() },
    durationSeconds
  );
  
  httpRequestTotal.inc({
    method,
    route: normalizeRoute(route),
    status_code: statusCode.toString(),
  });
}

/**
 * Start tracking an in-progress request
 */
export function startHttpRequest(method: string, route: string): () => void {
  const normalizedRoute = normalizeRoute(route);
  httpRequestsInProgress.inc({ method, route: normalizedRoute });
  
  return () => {
    httpRequestsInProgress.dec({ method, route: normalizedRoute });
  };
}

/**
 * Normalize route to avoid high cardinality
 */
function normalizeRoute(route: string): string {
  // Replace UUIDs and IDs with placeholders
  return route
    .replace(/\/[a-f0-9-]{36}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/cuid_[a-z0-9]+/gi, '/:id');
}

// ============================================
// Database Tracking Helpers
// ============================================

/**
 * Track database query
 */
export function trackDbQuery(
  operation: string,
  model: string,
  durationMs: number
): void {
  const durationSeconds = durationMs / 1000;
  
  dbQueryDuration.observe({ operation, model }, durationSeconds);
  dbQueryTotal.inc({ operation, model });
}

/**
 * Track database error
 */
export function trackDbError(
  operation: string,
  model: string,
  errorType: string
): void {
  dbQueryErrors.inc({ operation, model, error_type: errorType });
}

/**
 * Set active database connections
 */
export function setDbConnections(count: number): void {
  dbConnectionsActive.set(count);
}

// ============================================
// Cache Tracking Helpers
// ============================================

/**
 * Track cache hit
 */
export function trackCacheHit(cacheType: string): void {
  cacheHits.inc({ cache_type: cacheType });
}

/**
 * Track cache miss
 */
export function trackCacheMiss(cacheType: string): void {
  cacheMisses.inc({ cache_type: cacheType });
}

/**
 * Track cache operation latency
 */
export function trackCacheLatency(
  operation: 'get' | 'set' | 'delete',
  cacheType: string,
  durationMs: number
): void {
  cacheLatency.observe(
    { operation, cache_type: cacheType },
    durationMs / 1000
  );
}

/**
 * Update cache statistics
 */
export function updateCacheStats(
  cacheType: string,
  keyCount: number,
  memoryBytes: number
): void {
  cacheKeys.set({ cache_type: cacheType }, keyCount);
  cacheMemoryUsage.set({ cache_type: cacheType }, memoryBytes);
}

// ============================================
// Job Queue Tracking Helpers
// ============================================

/**
 * Track job completion
 */
export function trackJobComplete(
  queue: string,
  jobType: string,
  durationMs: number
): void {
  jobsTotal.inc({ queue, status: 'completed' });
  jobsDuration.observe({ queue, job_type: jobType }, durationMs / 1000);
}

/**
 * Track job failure
 */
export function trackJobFailure(queue: string, jobType: string): void {
  jobsTotal.inc({ queue, status: 'failed' });
}

/**
 * Track job retry
 */
export function trackJobRetry(queue: string, jobType: string): void {
  jobsRetries.inc({ queue, job_type: jobType });
}

/**
 * Update queue statistics
 */
export function updateQueueStats(
  queue: string,
  waiting: number,
  active: number,
  delayed: number
): void {
  jobsInQueue.set({ queue, state: 'waiting' }, waiting);
  jobsInQueue.set({ queue, state: 'active' }, active);
  jobsInQueue.set({ queue, state: 'delayed' }, delayed);
}

// ============================================
// Business Metrics Helpers
// ============================================

/**
 * Update tournament counts
 */
export function updateTournamentCounts(
  sport: string,
  status: string,
  count: number
): void {
  tournamentsActive.set({ sport, status }, count);
}

/**
 * Track registration
 */
export function trackRegistration(sport: string, tournamentId: string): void {
  registrationsTotal.inc({ sport, tournament_id: tournamentId });
}

/**
 * Track match completion
 */
export function trackMatchCompletion(sport: string, tournamentId: string): void {
  matchesCompleted.inc({ sport, tournament_id: tournamentId });
}

/**
 * Update user counts
 */
export function updateUserCounts(sport: string, tier: string, count: number): void {
  usersTotal.set({ sport, tier }, count);
}

/**
 * Update session counts
 */
export function updateSessionCounts(
  playerCount: number,
  orgCount: number
): void {
  sessionsActive.set({ account_type: 'player' }, playerCount);
  sessionsActive.set({ account_type: 'org' }, orgCount);
}

/**
 * Update WebSocket connections
 */
export function updateWebSocketConnections(count: number): void {
  websocketConnections.set(count);
}

/**
 * Track payment
 */
export function trackPayment(
  sport: string,
  status: 'initiated' | 'completed' | 'failed',
  amount: number
): void {
  paymentsTotal.inc({ sport, status }, amount);
}

/**
 * Track refund
 */
export function trackRefund(
  sport: string,
  status: 'initiated' | 'completed' | 'failed',
  amount: number
): void {
  refundTotal.inc({ sport, status }, amount);
}

// ============================================
// Error Tracking Helpers
// ============================================

/**
 * Track error
 */
export function trackError(
  type: string,
  code: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): void {
  errorsTotal.inc({ type, code, severity });
}

/**
 * Track API error
 */
export function trackApiError(
  endpoint: string,
  statusCode: number,
  errorType: string
): void {
  apiErrorsTotal.inc({
    endpoint: normalizeRoute(endpoint),
    status_code: statusCode.toString(),
    error_type: errorType,
  });
}

// ============================================
// Export Metrics
// ============================================

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON (for APIs)
 */
export async function getJsonMetrics(): Promise<
  Array<{
    name: string;
    value: number;
    labels: Record<string, string | number>;
  }>
> {
  const metricsJson = await register.getMetricsAsJSON();

  return metricsJson.flatMap((metric) =>
    metric.values.map((value) => ({
      name: metric.name,
      value: value.value,
      labels: value.labels as Record<string, string | number>,
    }))
  );
}

/**
 * Get metrics summary (for health checks)
 */
export async function getMetricsSummary(): Promise<{
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: string;
}> {
  return {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get Prometheus metrics (alias for backward compatibility)
 */
export const getPrometheusMetrics = getMetrics;

/**
 * Get metrics registry
 */
export function getRegistry(): Registry {
  return register;
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  register.clear();
}

// ============================================
// Export metrics instances for advanced usage
// ============================================

export const metrics = {
  http: {
    requestDuration: httpRequestDuration,
    requestTotal: httpRequestTotal,
    requestsInProgress: httpRequestsInProgress,
  },
  db: {
    queryDuration: dbQueryDuration,
    connectionsActive: dbConnectionsActive,
    queryTotal: dbQueryTotal,
    queryErrors: dbQueryErrors,
  },
  cache: {
    hits: cacheHits,
    misses: cacheMisses,
    latency: cacheLatency,
    keys: cacheKeys,
    memoryUsage: cacheMemoryUsage,
  },
  jobs: {
    total: jobsTotal,
    duration: jobsDuration,
    inQueue: jobsInQueue,
    retries: jobsRetries,
  },
  business: {
    tournamentsActive,
    registrationsTotal,
    matchesCompleted,
    usersTotal,
    sessionsActive,
    websocketConnections,
    paymentsTotal,
    refundTotal,
  },
  errors: {
    total: errorsTotal,
    apiTotal: apiErrorsTotal,
  },
};
