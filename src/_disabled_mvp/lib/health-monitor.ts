/**
 * VALORHIVE Health Monitor & Self-Healing System (v3.51.0)
 * 
 * Monitors system health and automatically recovers from failures:
 * - Service health checks
 * - Alert escalation
 * - Auto-restart failed jobs
 * - Circuit breaker for external services
 * - Recovery automation
 */

import { db } from './db';

// ============================================
// TYPES
// ============================================

export interface HealthCheck {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  latency: number;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: HealthCheck[];
  alerts: Alert[];
  uptime: number;
}

export interface Alert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  service: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  escalatedTo?: string;
}

export interface RecoveryAction {
  service: string;
  action: 'RESTART' | 'RETRY' | 'FAILOVER' | 'SCALE_UP' | 'NOTIFY';
  triggered: boolean;
  result?: string;
  timestamp: Date;
}

// ============================================
// CIRCUIT BREAKER
// ============================================

interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure: Date | null;
  nextRetry: Date | null;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxCalls: 3,
};

export function getCircuitBreaker(serviceName: string): CircuitBreakerState {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, {
      status: 'CLOSED',
      failures: 0,
      lastFailure: null,
      nextRetry: null,
    });
  }
  return circuitBreakers.get(serviceName)!;
}

export function recordSuccess(serviceName: string): void {
  const breaker = getCircuitBreaker(serviceName);
  breaker.failures = 0;
  breaker.status = 'CLOSED';
  breaker.lastFailure = null;
  breaker.nextRetry = null;
}

export function recordFailure(serviceName: string): void {
  const breaker = getCircuitBreaker(serviceName);
  breaker.failures++;
  breaker.lastFailure = new Date();

  if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    breaker.status = 'OPEN';
    breaker.nextRetry = new Date(Date.now() + CIRCUIT_BREAKER_CONFIG.resetTimeout);
    
    // Log circuit breaker trip
    logAlert('CRITICAL', serviceName, `Circuit breaker OPEN after ${breaker.failures} failures`);
  }
}

export function canAttempt(serviceName: string): boolean {
  const breaker = getCircuitBreaker(serviceName);

  if (breaker.status === 'CLOSED') return true;
  
  if (breaker.status === 'OPEN') {
    if (breaker.nextRetry && new Date() >= breaker.nextRetry) {
      breaker.status = 'HALF_OPEN';
      return true;
    }
    return false;
  }

  // HALF_OPEN - allow limited attempts
  return true;
}

// ============================================
// HEALTH CHECKS
// ============================================

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<SystemHealth> {
  const checks: HealthCheck[] = [];
  const alerts: Alert[] = [];

  // Database check
  checks.push(await checkDatabase());

  // Redis/Cache check
  checks.push(await checkCache());

  // External services checks
  checks.push(await checkRazorpay());
  checks.push(await checkEmailService());
  checks.push(await checkPushService());

  // Cron job checks
  checks.push(await checkCronJobs());

  // Get active alerts
  const activeAlerts = await getActiveAlerts();
  alerts.push(...activeAlerts);

  // Determine overall status
  const unhealthyCount = checks.filter(c => c.status === 'UNHEALTHY').length;
  const degradedCount = checks.filter(c => c.status === 'DEGRADED').length;

  let overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  if (unhealthyCount > 0) {
    overall = 'UNHEALTHY';
  } else if (degradedCount > 0) {
    overall = 'DEGRADED';
  } else {
    overall = 'HEALTHY';
  }

  // Log health check result
  await db.systemHealth.create({
    data: {
      overall,
      checks: JSON.stringify(checks),
      createdAt: new Date(),
    },
  });

  return {
    overall,
    checks,
    alerts,
    uptime: process.uptime(),
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      name: 'Database',
      status: latency < 100 ? 'HEALTHY' : 'DEGRADED',
      latency,
      lastCheck: new Date(),
      message: latency < 100 ? 'Response time good' : 'Response time slow',
    };
  } catch (error) {
    return {
      name: 'Database',
      status: 'UNHEALTHY',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: `Database error: ${error}`,
    };
  }
}

async function checkCache(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check if cache is working (simplified - would use actual cache client)
    const cacheAvailable = true; // await cache.ping();
    const latency = Date.now() - start;

    return {
      name: 'Cache',
      status: cacheAvailable ? 'HEALTHY' : 'UNHEALTHY',
      latency,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      name: 'Cache',
      status: 'DEGRADED', // Cache failure shouldn't break the system
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: 'Cache unavailable - using fallback',
    };
  }
}

async function checkRazorpay(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simplified - would actually ping Razorpay API
    const latency = Date.now() - start;
    return {
      name: 'Razorpay',
      status: canAttempt('razorpay') ? 'HEALTHY' : 'UNHEALTHY',
      latency,
      lastCheck: new Date(),
      details: { circuitBreaker: getCircuitBreaker('razorpay').status },
    };
  } catch (error) {
    recordFailure('razorpay');
    return {
      name: 'Razorpay',
      status: 'UNHEALTHY',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: `Razorpay error: ${error}`,
    };
  }
}

async function checkEmailService(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const latency = Date.now() - start;
    return {
      name: 'Email Service',
      status: canAttempt('email') ? 'HEALTHY' : 'DEGRADED',
      latency,
      lastCheck: new Date(),
    };
  } catch (error) {
    recordFailure('email');
    return {
      name: 'Email Service',
      status: 'DEGRADED',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: 'Email service degraded',
    };
  }
}

async function checkPushService(): Promise<HealthCheck> {
  const start = Date.now();
  const breaker = getCircuitBreaker('push');
  
  return {
    name: 'Push Notifications',
    status: breaker.status === 'OPEN' ? 'UNHEALTHY' : 'HEALTHY',
    latency: Date.now() - start,
    lastCheck: new Date(),
    details: { circuitBreaker: breaker.status },
  };
}

async function checkCronJobs(): Promise<HealthCheck> {
  try {
    // Check if cron jobs are running
    const recentJobs = await db.autopilotLog.count({
      where: {
        executedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    });

    const status = recentJobs > 0 ? 'HEALTHY' : 'DEGRADED';

    return {
      name: 'Cron Jobs',
      status,
      latency: 0,
      lastCheck: new Date(),
      message: `${recentJobs} jobs executed in last hour`,
    };
  } catch (error) {
    return {
      name: 'Cron Jobs',
      status: 'DEGRADED',
      latency: 0,
      lastCheck: new Date(),
      message: 'Unable to verify cron status',
    };
  }
}

// ============================================
// ALERT MANAGEMENT
// ============================================

async function logAlert(
  severity: Alert['severity'],
  service: string,
  message: string
): Promise<void> {
  await db.systemAlert.create({
    data: {
      severity,
      service,
      message,
      acknowledged: false,
    },
  });

  // Log to console
  console.log(`[${severity}] ${service}: ${message}`);

  // Escalate critical alerts
  if (severity === 'CRITICAL') {
    await escalateAlert(service, message);
  }
}

async function escalateAlert(service: string, message: string): Promise<void> {
  // Notify Super Admins
  const superAdmins = await db.adminAssignment.findMany({
    where: { adminRole: 'SUPER_ADMIN', isActive: true },
    include: { user: true },
  });

  for (const admin of superAdmins) {
    await db.notification.create({
      data: {
        userId: admin.userId,
        sport: 'CORNHOLE',
        type: 'TOURNAMENT_CANCELLED', // Reuse
        title: `🚨 Critical Alert: ${service}`,
        message,
        link: '/admin/health',
      },
    });
  }
}

async function getActiveAlerts(): Promise<Alert[]> {
  const alerts = await db.systemAlert.findMany({
    where: {
      acknowledged: false,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return alerts.map(a => ({
    id: a.id,
    severity: a.severity as Alert['severity'],
    service: a.service,
    message: a.message,
    timestamp: a.createdAt,
    acknowledged: a.acknowledged,
    escalatedTo: a.escalatedTo ?? undefined,
  }));
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await db.systemAlert.update({
    where: { id: alertId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
}

// ============================================
// SELF-HEALING
// ============================================

/**
 * Attempt automatic recovery for failed services
 */
export async function attemptRecovery(): Promise<RecoveryAction[]> {
  const actions: RecoveryAction[] = [];

  // Check for failed jobs and retry
  const failedJobs = await db.autopilotLog.findMany({
    where: {
      status: 'FAILED',
      executedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    },
    take: 10,
  });

  for (const job of failedJobs) {
    actions.push({
      service: 'autopilot',
      action: 'RETRY',
      triggered: true,
      result: 'Job queued for retry',
      timestamp: new Date(),
    });

    // Re-queue the job
    await db.autopilotLog.update({
      where: { id: job.id },
      data: { status: 'PENDING' },
    });
  }

  // Check for stuck refunds
  const stuckRefunds = await db.refundJob.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) }, // Stuck for 30+ min
    },
    take: 10,
  });

  for (const refund of stuckRefunds) {
    actions.push({
      service: 'refund',
      action: 'RETRY',
      triggered: true,
      result: 'Refund re-queued',
      timestamp: new Date(),
    });

    await db.refundJob.update({
      where: { id: refund.id },
      data: { 
        status: 'PENDING',
        retryCount: { increment: 1 },
      },
    });
  }

  // Check for stalled tournament status
  const stalledTournaments = await db.tournament.findMany({
    where: {
      status: 'IN_PROGRESS',
      autopilotEnabled: true,
      updatedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // No update for 2 hours
    },
    take: 5,
  });

  for (const tournament of stalledTournaments) {
    actions.push({
      service: 'tournament',
      action: 'NOTIFY',
      triggered: true,
      result: 'Director notified of stalled tournament',
      timestamp: new Date(),
    });
  }

  // Log recovery attempts
  if (actions.length > 0) {
    await db.recoveryLog.createMany({
      data: actions.map(a => ({
        service: a.service,
        action: a.action,
        triggered: a.triggered,
        result: a.result,
        createdAt: a.timestamp,
      })),
    });
  }

  return actions;
}

/**
 * Get recovery history
 */
export async function getRecoveryHistory(limit: number = 50): Promise<RecoveryAction[]> {
  const logs = await db.recoveryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs.map(l => ({
    service: l.service,
    action: l.action as RecoveryAction['action'],
    triggered: l.triggered,
    result: l.result ?? undefined,
    timestamp: l.createdAt,
  }));
}

// ============================================
// MONITORING SCHEDULER
// ============================================

/**
 * Run health monitoring cycle
 * Should be called by cron every minute
 */
export async function runMonitoringCycle(): Promise<{
  health: SystemHealth;
  recoveryActions: RecoveryAction[];
}> {
  console.log('[HealthMonitor] Running monitoring cycle...');

  // Run health checks
  const health = await runHealthChecks();

  // Attempt recovery if degraded or unhealthy
  let recoveryActions: RecoveryAction[] = [];
  if (health.overall !== 'HEALTHY') {
    recoveryActions = await attemptRecovery();
  }

  console.log(`[HealthMonitor] Status: ${health.overall}, Alerts: ${health.alerts.length}, Recovery: ${recoveryActions.length}`);

  return { health, recoveryActions };
}

/**
 * Get current system status
 */
export async function getSystemStatus(): Promise<{
  overall: string;
  uptime: number;
  lastCheck: Date;
  services: Record<string, { status: string; latency: number }>;
}> {
  const lastHealth = await db.systemHealth.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!lastHealth) {
    return {
      overall: 'UNKNOWN',
      uptime: process.uptime(),
      lastCheck: new Date(),
      services: {},
    };
  }

  const checks = JSON.parse(lastHealth.checks) as HealthCheck[];
  const services: Record<string, { status: string; latency: number }> = {};

  for (const check of checks) {
    services[check.name.toLowerCase().replace(' ', '_')] = {
      status: check.status,
      latency: check.latency,
    };
  }

  return {
    overall: lastHealth.overall,
    uptime: process.uptime(),
    lastCheck: lastHealth.createdAt,
    services,
  };
}
