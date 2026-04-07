/**
 * Monitoring Configuration for VALORHIVE
 * 
 * This file defines alert thresholds and monitoring rules for production.
 * Used by monitoring systems (Sentry, custom metrics, etc.)
 */

export const MONITORING_CONFIG = {
  // Alert thresholds
  alerts: {
    // Payment failures
    paymentFailures: {
      threshold: 5, // failures
      windowMinutes: 1, // per minute
      severity: 'critical' as const,
      notifyChannels: ['email', 'slack', 'sms'],
    },
    
    // API latency
    apiLatency: {
      thresholdMs: 1000, // 1 second
      percentile: 95, // p95
      severity: 'warning' as const,
      notifyChannels: ['email', 'slack'],
    },
    
    // Database CPU
    databaseCpu: {
      thresholdPercent: 80,
      severity: 'warning' as const,
      notifyChannels: ['email', 'slack'],
    },
    
    // Database connections
    databaseConnections: {
      thresholdPercent: 80, // of max connections
      severity: 'warning' as const,
      notifyChannels: ['email'],
    },
    
    // WebSocket disconnections
    websocketDisconnections: {
      threshold: 100, // disconnections
      windowMinutes: 5,
      severity: 'warning' as const,
      notifyChannels: ['email', 'slack'],
    },
    
    // Error rate
    errorRate: {
      thresholdPercent: 5, // 5% error rate
      windowMinutes: 5,
      severity: 'critical' as const,
      notifyChannels: ['email', 'slack', 'sms'],
    },
  },

  // SLA thresholds for Enterprise tier
  sla: {
    uptime: {
      target: 99.9, // 99.9% monthly uptime
      measurementPeriod: 'monthly' as const,
    },
    responseTime: {
      p50: 100, // ms
      p95: 200, // ms
      p99: 500, // ms
    },
    supportResponse: {
      p0: 15, // minutes - critical
      p1: 60, // minutes - high
      p2: 240, // minutes - medium (4 hours)
      p3: 1440, // minutes - low (24 hours)
    },
  },

  // Service credits calculation
  serviceCredits: {
    tiers: [
      { minUptime: 99.0, maxUptime: 99.9, creditPercent: 5 },
      { minUptime: 98.0, maxUptime: 99.0, creditPercent: 10 },
      { minUptime: 95.0, maxUptime: 98.0, creditPercent: 25 },
      { minUptime: 0, maxUptime: 95.0, creditPercent: 50 },
    ],
  },

  // Health check endpoints
  healthChecks: {
    endpoints: [
      { path: '/api/health', intervalMs: 30000, timeout: 5000 },
      { path: '/api/health/database', intervalMs: 60000, timeout: 10000 },
      { path: '/api/health/redis', intervalMs: 60000, timeout: 5000 },
    ],
  },

  // Metric collection
  metrics: {
    // API response times
    apiResponseTime: {
      buckets: [50, 100, 200, 500, 1000, 2000, 5000], // ms
    },
    // Tournament operations
    tournamentOps: {
      bracketGeneration: true,
      matchScoring: true,
      checkInRate: true,
    },
    // Payment metrics
    payments: {
      successRate: true,
      averageAmount: true,
      failureReasons: true,
    },
  },
};

// Alert evaluation functions
export function evaluateServiceCredit(monthlyUptime: number): number {
  for (const tier of MONITORING_CONFIG.serviceCredits.tiers) {
    if (monthlyUptime >= tier.minUptime && monthlyUptime < tier.maxUptime) {
      return tier.creditPercent;
    }
  }
  return 0;
}

export function calculateMonthlyUptime(
  totalMinutes: number,
  downtimeMinutes: number
): number {
  return ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;
}

// Severity levels
export type AlertSeverity = 'critical' | 'warning' | 'info';

// Alert interface
export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Notification channels
export type NotificationChannel = 'email' | 'slack' | 'sms' | 'webhook';

export default MONITORING_CONFIG;
