/**
 * Performance SLIs (Service Level Indicators) for VALORHIVE
 * 
 * This module provides comprehensive performance tracking including:
 * - API Latency Tracking (per endpoint)
 * - Error Rate Tracking (per endpoint)
 * - Database Query Performance
 * - Web Vitals Tracking (client-side)
 * - SLI/SLO Compliance Reporting
 */

// ============================================================================
// SLI/SLO Definitions
// ============================================================================

export const SLI_TARGETS = {
  // API Availability
  API_AVAILABILITY_TARGET: 99.9, // 99.9% uptime

  // API Latency (milliseconds)
  API_LATENCY_P50_TARGET: 100,
  API_LATENCY_P95_TARGET: 500,
  API_LATENCY_P99_TARGET: 1000,

  // Error Rate
  ERROR_RATE_TARGET: 0.1, // 0.1% (warning at 0.5%, critical at 1%)
  ERROR_RATE_WARNING: 0.5,
  ERROR_RATE_CRITICAL: 1.0,

  // Database Query Latency (milliseconds)
  DB_QUERY_P95_TARGET: 100,
  DB_SLOW_QUERY_THRESHOLD: 100,
  DB_CRITICAL_QUERY_THRESHOLD: 500,

  // Web Vitals (milliseconds or unitless)
  LCP_TARGET: 2500, // 2.5 seconds
  FID_TARGET: 100, // 100 milliseconds
  CLS_TARGET: 0.1, // unitless score
} as const;

// Critical endpoints with stricter SLOs
export const CRITICAL_ENDPOINTS = {
  '/api/auth/login': { p95Target: 200, p99Target: 400 },
  '/api/auth/register': { p95Target: 250, p99Target: 500 },
  '/api/payments/webhook': { p95Target: 500, p99Target: 1000 },
  '/api/tournaments/[id]/register': { p95Target: 300, p99Target: 600 },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ApiLatencyRecord {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
}

export interface ErrorRecord {
  endpoint: string;
  method: string;
  errorType: string;
  statusCode: number;
  timestamp: Date;
}

export interface DbQueryRecord {
  query: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}

export interface WebVitalRecord {
  metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
  value: number;
  pathname: string;
  timestamp: Date;
}

export interface EndpointLatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  errorCount: number;
  errorRate: number;
}

export interface EndpointErrorStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  errorTypes: Record<string, number>;
  statusCodes: Record<number, number>;
}

export interface DbQueryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgDuration: number;
  p95Duration: number;
  slowQueries: number;
  slowQueryRate: number;
}

export interface WebVitalsStats {
  LCP: { count: number; avg: number; p95: number; passRate: number };
  FID: { count: number; avg: number; p95: number; passRate: number };
  CLS: { count: number; avg: number; p95: number; passRate: number };
}

export interface SliReport {
  period: {
    start: Date;
    end: Date;
  };
  apiAvailability: {
    target: number;
    actual: number;
    compliant: boolean;
  };
  apiLatency: {
    target: number;
    p50: number;
    p95: number;
    p99: number;
    compliant: boolean;
    endpoints: Record<string, EndpointLatencyStats>;
  };
  errorRate: {
    target: number;
    actual: number;
    compliant: boolean;
    endpoints: Record<string, EndpointErrorStats>;
  };
  dbPerformance: {
    target: number;
    p95: number;
    slowQueryCount: number;
    compliant: boolean;
  };
  webVitals: WebVitalsStats;
  alerts: SliAlert[];
  generatedAt: Date;
}

export interface SliAlert {
  level: 'info' | 'warning' | 'critical';
  category: 'api' | 'database' | 'error' | 'webVitals';
  message: string;
  endpoint?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
}

export interface SloCompliance {
  overall: boolean;
  availability: { compliant: boolean; value: number; target: number };
  latency: { compliant: boolean; value: number; target: number };
  errorRate: { compliant: boolean; value: number; target: number };
  dbPerformance: { compliant: boolean; value: number; target: number };
  alerts: SliAlert[];
}

// ============================================================================
// In-Memory Metrics Store
// ============================================================================

interface MetricsStore {
  apiLatencies: ApiLatencyRecord[];
  errors: ErrorRecord[];
  dbQueries: DbQueryRecord[];
  webVitals: WebVitalRecord[];
  requestCounts: Map<string, number>;
  lastFlush: Date;
  flushIntervalMs: number;
}

const metricsStore: MetricsStore = {
  apiLatencies: [],
  errors: [],
  dbQueries: [],
  webVitals: [],
  requestCounts: new Map(),
  lastFlush: new Date(),
  flushIntervalMs: 60000, // 1 minute default
};

// Configuration
const MAX_RECORDS = 100000;
const MAX_LATENCY_RECORDS = 50000;
const MAX_ERROR_RECORDS = 20000;
const MAX_QUERY_RECORDS = 30000;
const MAX_WEB_VITAL_RECORDS = 10000;

// ============================================================================
// API Latency Tracking
// ============================================================================

/**
 * Record API latency for an endpoint
 * Tracks p50, p95, p99 latencies per endpoint
 */
export function recordApiLatency(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  const record: ApiLatencyRecord = {
    endpoint,
    method,
    duration,
    statusCode,
    timestamp: new Date(),
  };

  metricsStore.apiLatencies.push(record);

  // Track request count for availability calculation
  const key = `${method}:${endpoint}`;
  metricsStore.requestCounts.set(key, (metricsStore.requestCounts.get(key) || 0) + 1);

  // Trim if exceeds max records
  if (metricsStore.apiLatencies.length > MAX_LATENCY_RECORDS) {
    metricsStore.apiLatencies = metricsStore.apiLatencies.slice(-MAX_LATENCY_RECORDS);
  }

  // Check for latency threshold breach
  if (duration > SLI_TARGETS.API_LATENCY_P95_TARGET) {
    console.warn(`[SLI] High latency detected: ${endpoint} - ${duration}ms`);
  }
}

/**
 * Get latency statistics per endpoint
 */
export function getEndpointLatencyStats(endpoint?: string): Record<string, EndpointLatencyStats> {
  const stats: Record<string, EndpointLatencyStats> = {};
  
  // Group by endpoint
  const endpointGroups = new Map<string, ApiLatencyRecord[]>();
  
  for (const record of metricsStore.apiLatencies) {
    if (endpoint && record.endpoint !== endpoint) continue;
    
    const key = record.endpoint;
    if (!endpointGroups.has(key)) {
      endpointGroups.set(key, []);
    }
    endpointGroups.get(key)!.push(record);
  }

  // Calculate stats for each endpoint
  for (const [ep, records] of endpointGroups) {
    const durations = records.map(r => r.duration);
    const errors = records.filter(r => r.statusCode >= 400);

    stats[ep] = {
      count: records.length,
      p50: calculatePercentile(durations, 50),
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      errorCount: errors.length,
      errorRate: records.length > 0 ? (errors.length / records.length) * 100 : 0,
    };
  }

  return stats;
}

/**
 * Get overall API latency statistics
 */
export function getOverallApiLatencyStats(): {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
} {
  const durations = metricsStore.apiLatencies.map(r => r.duration);
  
  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
  }

  return {
    p50: calculatePercentile(durations, 50),
    p95: calculatePercentile(durations, 95),
    p99: calculatePercentile(durations, 99),
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    count: durations.length,
  };
}

// ============================================================================
// Error Rate Tracking
// ============================================================================

/**
 * Record an error for an endpoint
 */
export function recordError(
  endpoint: string,
  method: string,
  errorType: string,
  statusCode: number
): void {
  const record: ErrorRecord = {
    endpoint,
    method,
    errorType,
    statusCode,
    timestamp: new Date(),
  };

  metricsStore.errors.push(record);

  // Trim if exceeds max records
  if (metricsStore.errors.length > MAX_ERROR_RECORDS) {
    metricsStore.errors = metricsStore.errors.slice(-MAX_ERROR_RECORDS);
  }

  // Check error rate threshold
  const errorRate = getEndpointErrorRate(endpoint);
  if (errorRate > SLI_TARGETS.ERROR_RATE_CRITICAL) {
    console.error(`[SLI] Critical error rate for ${endpoint}: ${errorRate.toFixed(2)}%`);
  } else if (errorRate > SLI_TARGETS.ERROR_RATE_WARNING) {
    console.warn(`[SLI] Warning error rate for ${endpoint}: ${errorRate.toFixed(2)}%`);
  }
}

/**
 * Get error rate for a specific endpoint
 */
export function getEndpointErrorRate(endpoint: string): number {
  const endpointRecords = metricsStore.apiLatencies.filter(r => r.endpoint === endpoint);
  const endpointErrors = metricsStore.errors.filter(r => r.endpoint === endpoint);

  if (endpointRecords.length === 0) return 0;

  return (endpointErrors.length / endpointRecords.length) * 100;
}

/**
 * Get error statistics per endpoint
 */
export function getEndpointErrorStats(endpoint?: string): Record<string, EndpointErrorStats> {
  const stats: Record<string, EndpointErrorStats> = {};

  // Group errors by endpoint
  const errorGroups = new Map<string, ErrorRecord[]>();
  
  for (const error of metricsStore.errors) {
    if (endpoint && error.endpoint !== endpoint) continue;
    
    const key = error.endpoint;
    if (!errorGroups.has(key)) {
      errorGroups.set(key, []);
    }
    errorGroups.get(key)!.push(error);
  }

  // Calculate stats for each endpoint
  for (const [ep, errors] of errorGroups) {
    const totalRequests = metricsStore.apiLatencies.filter(r => r.endpoint === ep).length;
    
    // Count error types
    const errorTypes: Record<string, number> = {};
    const statusCodes: Record<number, number> = {};

    for (const error of errors) {
      errorTypes[error.errorType] = (errorTypes[error.errorType] || 0) + 1;
      statusCodes[error.statusCode] = (statusCodes[error.statusCode] || 0) + 1;
    }

    stats[ep] = {
      totalRequests,
      totalErrors: errors.length,
      errorRate: totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0,
      errorTypes,
      statusCodes,
    };
  }

  return stats;
}

/**
 * Get overall error rate
 */
export function getOverallErrorRate(): number {
  const totalRequests = metricsStore.apiLatencies.length;
  const totalErrors = metricsStore.errors.length;

  if (totalRequests === 0) return 0;

  return (totalErrors / totalRequests) * 100;
}

// ============================================================================
// Database Query Performance Tracking
// ============================================================================

/**
 * Record a database query execution
 */
export function recordDbQuery(query: string, duration: number, success: boolean): void {
  const record: DbQueryRecord = {
    query,
    duration,
    success,
    timestamp: new Date(),
  };

  metricsStore.dbQueries.push(record);

  // Trim if exceeds max records
  if (metricsStore.dbQueries.length > MAX_QUERY_RECORDS) {
    metricsStore.dbQueries = metricsStore.dbQueries.slice(-MAX_QUERY_RECORDS);
  }

  // Check for slow query
  if (duration > SLI_TARGETS.DB_SLOW_QUERY_THRESHOLD) {
    console.warn(`[SLI] Slow query detected (${duration}ms): ${query.substring(0, 100)}...`);
  }

  // Check for query failure
  if (!success) {
    console.error(`[SLI] Query failure: ${query.substring(0, 100)}...`);
  }
}

/**
 * Get database query statistics
 */
export function getDbQueryStats(): DbQueryStats {
  const queries = metricsStore.dbQueries;

  if (queries.length === 0) {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgDuration: 0,
      p95Duration: 0,
      slowQueries: 0,
      slowQueryRate: 0,
    };
  }

  const durations = queries.map(q => q.duration);
  const successful = queries.filter(q => q.success);
  const failed = queries.filter(q => !q.success);
  const slow = queries.filter(q => q.duration > SLI_TARGETS.DB_SLOW_QUERY_THRESHOLD);

  return {
    totalQueries: queries.length,
    successfulQueries: successful.length,
    failedQueries: failed.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95Duration: calculatePercentile(durations, 95),
    slowQueries: slow.length,
    slowQueryRate: (slow.length / queries.length) * 100,
  };
}

/**
 * Get slow queries (queries exceeding threshold)
 */
export function getSlowQueries(thresholdMs: number = SLI_TARGETS.DB_SLOW_QUERY_THRESHOLD): DbQueryRecord[] {
  return metricsStore.dbQueries.filter(q => q.duration > thresholdMs);
}

// ============================================================================
// Web Vitals Tracking (Client-Side)
// ============================================================================

/**
 * Record a Web Vital metric (typically called from client-side)
 */
export function recordWebVital(
  metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP',
  value: number,
  pathname: string
): void {
  const record: WebVitalRecord = {
    metric,
    value,
    pathname,
    timestamp: new Date(),
  };

  metricsStore.webVitals.push(record);

  // Trim if exceeds max records
  if (metricsStore.webVitals.length > MAX_WEB_VITAL_RECORDS) {
    metricsStore.webVitals = metricsStore.webVitals.slice(-MAX_WEB_VITAL_RECORDS);
  }

  // Check against targets
  const target = getWebVitalTarget(metric);
  if (target !== null && value > target) {
    console.warn(`[SLI] Web Vital ${metric} exceeded target: ${value} > ${target}`);
  }
}

/**
 * Get Web Vital target
 */
function getWebVitalTarget(metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP'): number | null {
  switch (metric) {
    case 'LCP':
      return SLI_TARGETS.LCP_TARGET;
    case 'FID':
      return SLI_TARGETS.FID_TARGET;
    case 'CLS':
      return SLI_TARGETS.CLS_TARGET;
    default:
      return null;
  }
}

/**
 * Get Web Vitals statistics
 */
export function getWebVitalsStats(): WebVitalsStats {
  const stats: WebVitalsStats = {
    LCP: { count: 0, avg: 0, p95: 0, passRate: 0 },
    FID: { count: 0, avg: 0, p95: 0, passRate: 0 },
    CLS: { count: 0, avg: 0, p95: 0, passRate: 0 },
  };

  for (const metric of ['LCP', 'FID', 'CLS'] as const) {
    const records = metricsStore.webVitals.filter(r => r.metric === metric);
    
    if (records.length > 0) {
      const values = records.map(r => r.value);
      const target = SLI_TARGETS[`${metric}_TARGET`] as number;
      const passing = records.filter(r => r.value <= target);

      stats[metric] = {
        count: records.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p95: calculatePercentile(values, 95),
        passRate: (passing.length / records.length) * 100,
      };
    }
  }

  return stats;
}

// ============================================================================
// SLI Reporting
// ============================================================================

/**
 * Get SLI compliance report for a time period
 */
export function getSliReport(periodMinutes: number = 60): SliReport {
  const now = new Date();
  const start = new Date(now.getTime() - periodMinutes * 60 * 1000);

  // Filter records by time period
  const periodLatencies = metricsStore.apiLatencies.filter(r => r.timestamp >= start);
  const periodErrors = metricsStore.errors.filter(r => r.timestamp >= start);
  const periodQueries = metricsStore.dbQueries.filter(q => q.timestamp >= start);

  // Calculate API availability
  const successfulRequests = periodLatencies.filter(r => r.statusCode < 500).length;
  const apiAvailability = periodLatencies.length > 0
    ? (successfulRequests / periodLatencies.length) * 100
    : 100;

  // Calculate overall latency stats
  const durations = periodLatencies.map(r => r.duration);
  const latencyStats = {
    p50: calculatePercentile(durations, 50),
    p95: calculatePercentile(durations, 95),
    p99: calculatePercentile(durations, 99),
  };

  // Calculate error rate
  const errorRate = periodLatencies.length > 0
    ? (periodErrors.length / periodLatencies.length) * 100
    : 0;

  // Calculate DB performance
  const queryDurations = periodQueries.map(q => q.duration);
  const dbP95 = calculatePercentile(queryDurations, 95);
  const slowQueries = periodQueries.filter(q => q.duration > SLI_TARGETS.DB_SLOW_QUERY_THRESHOLD).length;

  // Generate alerts
  const alerts: SliAlert[] = generateAlerts(
    apiAvailability,
    latencyStats.p95,
    errorRate,
    dbP95,
    getWebVitalsStats()
  );

  return {
    period: { start, end: now },
    apiAvailability: {
      target: SLI_TARGETS.API_AVAILABILITY_TARGET,
      actual: apiAvailability,
      compliant: apiAvailability >= SLI_TARGETS.API_AVAILABILITY_TARGET,
    },
    apiLatency: {
      target: SLI_TARGETS.API_LATENCY_P95_TARGET,
      p50: latencyStats.p50,
      p95: latencyStats.p95,
      p99: latencyStats.p99,
      compliant: latencyStats.p95 <= SLI_TARGETS.API_LATENCY_P95_TARGET,
      endpoints: getEndpointLatencyStats(),
    },
    errorRate: {
      target: SLI_TARGETS.ERROR_RATE_TARGET,
      actual: errorRate,
      compliant: errorRate <= SLI_TARGETS.ERROR_RATE_TARGET,
      endpoints: getEndpointErrorStats(),
    },
    dbPerformance: {
      target: SLI_TARGETS.DB_QUERY_P95_TARGET,
      p95: dbP95,
      slowQueryCount: slowQueries,
      compliant: dbP95 <= SLI_TARGETS.DB_QUERY_P95_TARGET,
    },
    webVitals: getWebVitalsStats(),
    alerts,
    generatedAt: now,
  };
}

/**
 * Check if SLOs are being met
 */
export function checkSloCompliance(): SloCompliance {
  const latencyStats = getOverallApiLatencyStats();
  const errorRate = getOverallErrorRate();
  const dbStats = getDbQueryStats();
  const webVitals = getWebVitalsStats();

  // Calculate availability
  const successfulRequests = metricsStore.apiLatencies.filter(r => r.statusCode < 500).length;
  const availability = metricsStore.apiLatencies.length > 0
    ? (successfulRequests / metricsStore.apiLatencies.length) * 100
    : 100;

  const alerts: SliAlert[] = [];

  // Check availability
  const availabilityCompliant = availability >= SLI_TARGETS.API_AVAILABILITY_TARGET;
  if (!availabilityCompliant) {
    alerts.push({
      level: availability < 99 ? 'critical' : 'warning',
      category: 'api',
      message: `API availability (${availability.toFixed(2)}%) below target (${SLI_TARGETS.API_AVAILABILITY_TARGET}%)`,
      value: availability,
      threshold: SLI_TARGETS.API_AVAILABILITY_TARGET,
      timestamp: new Date(),
    });
  }

  // Check latency
  const latencyCompliant = latencyStats.p95 <= SLI_TARGETS.API_LATENCY_P95_TARGET;
  if (!latencyCompliant) {
    alerts.push({
      level: latencyStats.p95 > SLI_TARGETS.API_LATENCY_P95_TARGET * 1.5 ? 'critical' : 'warning',
      category: 'api',
      message: `API p95 latency (${latencyStats.p95}ms) exceeds target (${SLI_TARGETS.API_LATENCY_P95_TARGET}ms)`,
      value: latencyStats.p95,
      threshold: SLI_TARGETS.API_LATENCY_P95_TARGET,
      timestamp: new Date(),
    });
  }

  // Check error rate
  const errorRateCompliant = errorRate <= SLI_TARGETS.ERROR_RATE_TARGET;
  if (!errorRateCompliant) {
    alerts.push({
      level: errorRate > SLI_TARGETS.ERROR_RATE_CRITICAL ? 'critical' : 'warning',
      category: 'error',
      message: `Error rate (${errorRate.toFixed(2)}%) exceeds target (${SLI_TARGETS.ERROR_RATE_TARGET}%)`,
      value: errorRate,
      threshold: SLI_TARGETS.ERROR_RATE_TARGET,
      timestamp: new Date(),
    });
  }

  // Check DB performance
  const dbCompliant = dbStats.p95Duration <= SLI_TARGETS.DB_QUERY_P95_TARGET;
  if (!dbCompliant) {
    alerts.push({
      level: dbStats.p95Duration > SLI_TARGETS.DB_QUERY_P95_TARGET * 2 ? 'critical' : 'warning',
      category: 'database',
      message: `DB p95 latency (${dbStats.p95Duration}ms) exceeds target (${SLI_TARGETS.DB_QUERY_P95_TARGET}ms)`,
      value: dbStats.p95Duration,
      threshold: SLI_TARGETS.DB_QUERY_P95_TARGET,
      timestamp: new Date(),
    });
  }

  // Check Web Vitals
  if (webVitals.LCP.passRate < 75) {
    alerts.push({
      level: 'warning',
      category: 'webVitals',
      message: `LCP pass rate (${webVitals.LCP.passRate.toFixed(1)}%) below 75%`,
      value: webVitals.LCP.passRate,
      threshold: 75,
      timestamp: new Date(),
    });
  }

  return {
    overall: availabilityCompliant && latencyCompliant && errorRateCompliant && dbCompliant,
    availability: { compliant: availabilityCompliant, value: availability, target: SLI_TARGETS.API_AVAILABILITY_TARGET },
    latency: { compliant: latencyCompliant, value: latencyStats.p95, target: SLI_TARGETS.API_LATENCY_P95_TARGET },
    errorRate: { compliant: errorRateCompliant, value: errorRate, target: SLI_TARGETS.ERROR_RATE_TARGET },
    dbPerformance: { compliant: dbCompliant, value: dbStats.p95Duration, target: SLI_TARGETS.DB_QUERY_P95_TARGET },
    alerts,
  };
}

/**
 * Generate alerts based on current metrics
 */
function generateAlerts(
  availability: number,
  latencyP95: number,
  errorRate: number,
  dbP95: number,
  webVitals: WebVitalsStats
): SliAlert[] {
  const alerts: SliAlert[] = [];
  const now = new Date();

  // Availability alerts
  if (availability < SLI_TARGETS.API_AVAILABILITY_TARGET) {
    alerts.push({
      level: availability < 99 ? 'critical' : 'warning',
      category: 'api',
      message: `API availability (${availability.toFixed(2)}%) below target (${SLI_TARGETS.API_AVAILABILITY_TARGET}%)`,
      value: availability,
      threshold: SLI_TARGETS.API_AVAILABILITY_TARGET,
      timestamp: now,
    });
  }

  // Latency alerts
  if (latencyP95 > SLI_TARGETS.API_LATENCY_P95_TARGET) {
    alerts.push({
      level: latencyP95 > SLI_TARGETS.API_LATENCY_P95_TARGET * 1.5 ? 'critical' : 'warning',
      category: 'api',
      message: `API p95 latency (${latencyP95}ms) exceeds target (${SLI_TARGETS.API_LATENCY_P95_TARGET}ms)`,
      value: latencyP95,
      threshold: SLI_TARGETS.API_LATENCY_P95_TARGET,
      timestamp: now,
    });
  }

  // Error rate alerts
  if (errorRate > SLI_TARGETS.ERROR_RATE_TARGET) {
    alerts.push({
      level: errorRate > SLI_TARGETS.ERROR_RATE_CRITICAL ? 'critical' : 'warning',
      category: 'error',
      message: `Error rate (${errorRate.toFixed(2)}%) exceeds target (${SLI_TARGETS.ERROR_RATE_TARGET}%)`,
      value: errorRate,
      threshold: SLI_TARGETS.ERROR_RATE_TARGET,
      timestamp: now,
    });
  }

  // DB alerts
  if (dbP95 > SLI_TARGETS.DB_QUERY_P95_TARGET) {
    alerts.push({
      level: dbP95 > SLI_TARGETS.DB_QUERY_P95_TARGET * 2 ? 'critical' : 'warning',
      category: 'database',
      message: `DB p95 latency (${dbP95}ms) exceeds target (${SLI_TARGETS.DB_QUERY_P95_TARGET}ms)`,
      value: dbP95,
      threshold: SLI_TARGETS.DB_QUERY_P95_TARGET,
      timestamp: now,
    });
  }

  // Web Vitals alerts
  if (webVitals.LCP.passRate < 75) {
    alerts.push({
      level: 'warning',
      category: 'webVitals',
      message: `LCP pass rate (${webVitals.LCP.passRate.toFixed(1)}%) below 75%`,
      value: webVitals.LCP.passRate,
      threshold: 75,
      timestamp: now,
    });
  }

  return alerts;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate percentile of a sorted array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Reset all metrics (for testing or scheduled reset)
 */
export function resetMetrics(): void {
  metricsStore.apiLatencies = [];
  metricsStore.errors = [];
  metricsStore.dbQueries = [];
  metricsStore.webVitals = [];
  metricsStore.requestCounts.clear();
  metricsStore.lastFlush = new Date();
}

/**
 * Flush metrics to persistent storage (stub for database integration)
 * Override this function to implement actual database persistence
 */
export async function flushMetrics(): Promise<void> {
  // In production, this would write to a database or external metrics service
  // For now, we just update the last flush time
  metricsStore.lastFlush = new Date();
  console.log(`[SLI] Metrics flush completed at ${metricsStore.lastFlush.toISOString()}`);
}

/**
 * Get metrics store stats (for monitoring)
 */
export function getMetricsStoreStats(): {
  latencyRecords: number;
  errorRecords: number;
  queryRecords: number;
  webVitalRecords: number;
  lastFlush: Date;
} {
  return {
    latencyRecords: metricsStore.apiLatencies.length,
    errorRecords: metricsStore.errors.length,
    queryRecords: metricsStore.dbQueries.length,
    webVitalRecords: metricsStore.webVitals.length,
    lastFlush: metricsStore.lastFlush,
  };
}

// ============================================================================
// Client-Side Web Vitals Reporting Helper
// ============================================================================

/**
 * Client-side Web Vitals tracking function
 * This should be called from a client component to report Web Vitals
 */
export function reportWebVitalToServer(metric: { name: string; value: number }, pathname: string): void {
  // Map metric names to our format
  const metricName = metric.name as 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
  
  // In production, this would send to an API endpoint
  // For now, we just call the record function directly
  recordWebVital(metricName, metric.value, pathname);
}

// ============================================================================
// Legacy Compatibility (for existing code)
// ============================================================================

/**
 * @deprecated Use recordApiLatency instead
 */
export function recordDbQueryTime(durationMs: number): void {
  recordDbQuery('unknown', durationMs, true);
}

/**
 * @deprecated Use recordError instead
 */
export function recordApiError(endpoint: string): void {
  recordError(endpoint, 'UNKNOWN', 'UNKNOWN_ERROR', 500);
}

/**
 * @deprecated Use recordApiLatency instead
 */
export function recordApiRequest(endpoint: string): void {
  // This is now handled in recordApiLatency
}

/**
 * @deprecated Use getSliReport instead
 */
export function getPerformanceReport(): ReturnType<typeof getSliReport> {
  return getSliReport(60);
}

/**
 * @deprecated Use checkSloCompliance instead
 */
export function checkSliHealth(): {
  healthy: boolean;
  apiLatency: { status: 'pass' | 'warn' | 'fail'; value: number; target: number };
  dbPerformance: { status: 'pass' | 'warn' | 'fail'; value: number; target: number };
  errorRate: { status: 'pass' | 'warn' | 'fail'; value: number; target: number };
} {
  const compliance = checkSloCompliance();

  return {
    healthy: compliance.overall,
    apiLatency: {
      status: compliance.latency.compliant ? 'pass' : 'warn',
      value: compliance.latency.value,
      target: compliance.latency.target,
    },
    dbPerformance: {
      status: compliance.dbPerformance.compliant ? 'pass' : 'warn',
      value: compliance.dbPerformance.value,
      target: compliance.dbPerformance.target,
    },
    errorRate: {
      status: compliance.errorRate.compliant ? 'pass' : 'warn',
      value: compliance.errorRate.value,
      target: compliance.errorRate.target,
    },
  };
}

// Export thresholds for backward compatibility
export const PERFORMANCE_THRESHOLDS = {
  API_P50_TARGET: SLI_TARGETS.API_LATENCY_P50_TARGET,
  API_P95_TARGET: SLI_TARGETS.API_LATENCY_P95_TARGET,
  API_P99_TARGET: SLI_TARGETS.API_LATENCY_P99_TARGET,
  DB_QUERY_TARGET: SLI_TARGETS.DB_QUERY_P95_TARGET,
  DB_SLOW_QUERY_THRESHOLD: SLI_TARGETS.DB_SLOW_QUERY_THRESHOLD,
  ERROR_RATE_TARGET: SLI_TARGETS.ERROR_RATE_TARGET,
  ERROR_RATE_WARNING: SLI_TARGETS.ERROR_RATE_WARNING,
  LCP_TARGET: SLI_TARGETS.LCP_TARGET,
  FID_TARGET: SLI_TARGETS.FID_TARGET,
  CLS_TARGET: SLI_TARGETS.CLS_TARGET,
  UPTIME_TARGET: SLI_TARGETS.API_AVAILABILITY_TARGET,
  CRITICAL_ENDPOINTS,
} as const;

// ============================================================================
// Prometheus Metrics Integration
// ============================================================================

/**
 * Export SLI metrics in Prometheus format
 * This integrates with the metrics collection utility
 */
export function exportSliPrometheusMetrics(): string {
  const lines: string[] = [];
  const compliance = checkSloCompliance();
  const latencyStats = getOverallApiLatencyStats();
  const errorRate = getOverallErrorRate();
  const dbStats = getDbQueryStats();
  const webVitals = getWebVitalsStats();

  // SLI Availability
  lines.push('# HELP valorhive_sli_availability_percent Current availability percentage');
  lines.push('# TYPE valorhive_sli_availability_percent gauge');
  lines.push(`valorhive_sli_availability_percent ${compliance.availability.value.toFixed(2)}`);

  lines.push('# HELP valorhive_sli_availability_target Target availability percentage');
  lines.push('# TYPE valorhive_sli_availability_target gauge');
  lines.push(`valorhive_sli_availability_target ${SLI_TARGETS.API_AVAILABILITY_TARGET}`);

  lines.push('# HELP valorhive_sli_availability_compliant Whether availability meets target');
  lines.push('# TYPE valorhive_sli_availability_compliant gauge');
  lines.push(`valorhive_sli_availability_compliant ${compliance.availability.compliant ? 1 : 0}`);

  // SLI Latency
  lines.push('# HELP valorhive_sli_latency_milliseconds API latency in milliseconds');
  lines.push('# TYPE valorhive_sli_latency_milliseconds gauge');
  lines.push(`valorhive_sli_latency_milliseconds{percentile="p50"} ${latencyStats.p50}`);
  lines.push(`valorhive_sli_latency_milliseconds{percentile="p95"} ${latencyStats.p95}`);
  lines.push(`valorhive_sli_latency_milliseconds{percentile="p99"} ${latencyStats.p99}`);
  lines.push(`valorhive_sli_latency_milliseconds{percentile="avg"} ${latencyStats.avg.toFixed(2)}`);

  lines.push('# HELP valorhive_sli_latency_target Target latency in milliseconds');
  lines.push('# TYPE valorhive_sli_latency_target gauge');
  lines.push(`valorhive_sli_latency_target{percentile="p50"} ${SLI_TARGETS.API_LATENCY_P50_TARGET}`);
  lines.push(`valorhive_sli_latency_target{percentile="p95"} ${SLI_TARGETS.API_LATENCY_P95_TARGET}`);
  lines.push(`valorhive_sli_latency_target{percentile="p99"} ${SLI_TARGETS.API_LATENCY_P99_TARGET}`);

  lines.push('# HELP valorhive_sli_latency_compliant Whether latency meets target');
  lines.push('# TYPE valorhive_sli_latency_compliant gauge');
  lines.push(`valorhive_sli_latency_compliant ${compliance.latency.compliant ? 1 : 0}`);

  // SLI Error Rate
  lines.push('# HELP valorhive_sli_error_rate_percent Current error rate percentage');
  lines.push('# TYPE valorhive_sli_error_rate_percent gauge');
  lines.push(`valorhive_sli_error_rate_percent ${errorRate.toFixed(3)}`);

  lines.push('# HELP valorhive_sli_error_rate_target Target error rate percentage');
  lines.push('# TYPE valorhive_sli_error_rate_target gauge');
  lines.push(`valorhive_sli_error_rate_target ${SLI_TARGETS.ERROR_RATE_TARGET}`);

  lines.push('# HELP valorhive_sli_error_rate_compliant Whether error rate meets target');
  lines.push('# TYPE valorhive_sli_error_rate_compliant gauge');
  lines.push(`valorhive_sli_error_rate_compliant ${compliance.errorRate.compliant ? 1 : 0}`);

  // SLI Database Performance
  lines.push('# HELP valorhive_sli_db_latency_milliseconds Database query latency in milliseconds');
  lines.push('# TYPE valorhive_sli_db_latency_milliseconds gauge');
  lines.push(`valorhive_sli_db_latency_milliseconds{percentile="p95"} ${dbStats.p95Duration}`);
  lines.push(`valorhive_sli_db_latency_milliseconds{percentile="avg"} ${dbStats.avgDuration.toFixed(2)}`);

  lines.push('# HELP valorhive_sli_db_slow_queries_count Number of slow queries');
  lines.push('# TYPE valorhive_sli_db_slow_queries_count gauge');
  lines.push(`valorhive_sli_db_slow_queries_count ${dbStats.slowQueries}`);

  lines.push('# HELP valorhive_sli_db_slow_queries_rate Slow query rate percentage');
  lines.push('# TYPE valorhive_sli_db_slow_queries_rate gauge');
  lines.push(`valorhive_sli_db_slow_queries_rate ${dbStats.slowQueryRate.toFixed(2)}`);

  lines.push('# HELP valorhive_sli_db_compliant Whether DB performance meets target');
  lines.push('# TYPE valorhive_sli_db_compliant gauge');
  lines.push(`valorhive_sli_db_compliant ${compliance.dbPerformance.compliant ? 1 : 0}`);

  // SLI Web Vitals
  lines.push('# HELP valorhive_sli_web_vitals Web vitals metrics');
  lines.push('# TYPE valorhive_sli_web_vitals gauge');
  lines.push(`valorhive_sli_web_vitals{metric="lcp",type="avg"} ${webVitals.LCP.avg.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="lcp",type="p95"} ${webVitals.LCP.p95.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="lcp",type="pass_rate"} ${webVitals.LCP.passRate.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="fid",type="avg"} ${webVitals.FID.avg.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="fid",type="p95"} ${webVitals.FID.p95.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="fid",type="pass_rate"} ${webVitals.FID.passRate.toFixed(2)}`);
  lines.push(`valorhive_sli_web_vitals{metric="cls",type="avg"} ${webVitals.CLS.avg.toFixed(4)}`);
  lines.push(`valorhive_sli_web_vitals{metric="cls",type="p95"} ${webVitals.CLS.p95.toFixed(4)}`);
  lines.push(`valorhive_sli_web_vitals{metric="cls",type="pass_rate"} ${webVitals.CLS.passRate.toFixed(2)}`);

  // SLO Compliance Summary
  lines.push('# HELP valorhive_slo_compliant Whether all SLOs are met');
  lines.push('# TYPE valorhive_slo_compliant gauge');
  lines.push(`valorhive_slo_compliant ${compliance.overall ? 1 : 0}`);

  lines.push('# HELP valorhive_slo_alerts_count Number of active SLO alerts');
  lines.push('# TYPE valorhive_slo_alerts_count gauge');
  lines.push(`valorhive_slo_alerts_count ${compliance.alerts.length}`);

  // Alert breakdown by severity
  const criticalAlerts = compliance.alerts.filter(a => a.level === 'critical').length;
  const warningAlerts = compliance.alerts.filter(a => a.level === 'warning').length;
  lines.push(`valorhive_slo_alerts_count{severity="critical"} ${criticalAlerts}`);
  lines.push(`valorhive_slo_alerts_count{severity="warning"} ${warningAlerts}`);

  // Metrics store stats
  const storeStats = getMetricsStoreStats();
  lines.push('# HELP valorhive_sli_records_count Number of records in SLI store');
  lines.push('# TYPE valorhive_sli_records_count gauge');
  lines.push(`valorhive_sli_records_count{type="latency"} ${storeStats.latencyRecords}`);
  lines.push(`valorhive_sli_records_count{type="error"} ${storeStats.errorRecords}`);
  lines.push(`valorhive_sli_records_count{type="query"} ${storeStats.queryRecords}`);
  lines.push(`valorhive_sli_records_count{type="web_vital"} ${storeStats.webVitalRecords}`);

  return lines.join('\n') + '\n';
}

/**
 * Get SLI metrics as a structured object
 * Useful for JSON APIs and programmatic access
 */
export function getSliMetricsObject(): {
  availability: { value: number; target: number; compliant: boolean };
  latency: { p50: number; p95: number; p99: number; avg: number; target: number; compliant: boolean };
  errorRate: { value: number; target: number; compliant: boolean };
  dbPerformance: { p95: number; avg: number; slowQueries: number; target: number; compliant: boolean };
  webVitals: WebVitalsStats;
  overall: { compliant: boolean; alertCount: number };
} {
  const compliance = checkSloCompliance();
  const latencyStats = getOverallApiLatencyStats();
  const dbStats = getDbQueryStats();
  const webVitals = getWebVitalsStats();
  const errorRate = getOverallErrorRate();

  return {
    availability: {
      value: compliance.availability.value,
      target: compliance.availability.target,
      compliant: compliance.availability.compliant,
    },
    latency: {
      p50: latencyStats.p50,
      p95: latencyStats.p95,
      p99: latencyStats.p99,
      avg: latencyStats.avg,
      target: SLI_TARGETS.API_LATENCY_P95_TARGET,
      compliant: compliance.latency.compliant,
    },
    errorRate: {
      value: errorRate,
      target: SLI_TARGETS.ERROR_RATE_TARGET,
      compliant: compliance.errorRate.compliant,
    },
    dbPerformance: {
      p95: dbStats.p95Duration,
      avg: dbStats.avgDuration,
      slowQueries: dbStats.slowQueries,
      target: SLI_TARGETS.DB_QUERY_P95_TARGET,
      compliant: compliance.dbPerformance.compliant,
    },
    webVitals,
    overall: {
      compliant: compliance.overall,
      alertCount: compliance.alerts.length,
    },
  };
}
