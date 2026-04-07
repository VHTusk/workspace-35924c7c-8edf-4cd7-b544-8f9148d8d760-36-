/**
 * Dependency Health Endpoint (Detailed)
 * 
 * Provides detailed health status of all dependencies:
 * - Database (PostgreSQL/SQLite)
 * - Redis (cache, sessions, rate limiting)
 * - Queue system (BullMQ job queues)
 * - S3 storage (backups, media uploads)
 * 
 * Includes latency for each check and detailed status
 * for monitoring dashboards.
 * 
 * GET /api/health/deps
 */

import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';
import { getPrimaryClient, performHealthCheck as performRedisHealthCheck, isRedisConfigured } from '@/lib/redis-config';
import { checkRedisPing, getRedisHealth, isRedisHealthyForProduction } from '@/lib/redis-health';
import { getQueueManager, type QueueStats } from '@/lib/job-queue';
import { isS3Configured } from '@/lib/backup-s3';

// ============================================
// Types
// ============================================

interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface DependencyHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    queue: HealthCheckResult;
    s3: HealthCheckResult;
  };
  timestamp: string;
  version: string;
  uptime: number;
}

// ============================================
// Timeout Helper
// ============================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  name: string
): Promise<{ success: boolean; result?: T; error?: string }> {
  return Promise.race([
    promise.then(result => ({ success: true, result })),
    new Promise<{ success: boolean; error: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: `${name} check timed out after ${timeoutMs}ms` }), timeoutMs)
    ),
  ]);
}

// ============================================
// Health Check Functions
// ============================================

async function checkDatabaseDependency(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const result = await withTimeout(checkDatabaseHealth(), 2000, 'Database');
    
    return {
      healthy: result.success && result.result?.healthy === true,
      latency: Date.now() - start,
      error: result.error || result.result?.error,
      details: result.result ? {
        latencyMs: result.result.latency,
      } : undefined,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedisDependency(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  // If Redis is not configured, return healthy (optional dependency)
  if (!isRedisConfigured()) {
    return {
      healthy: true,
      latency: 0,
      details: {
        configured: false,
        message: 'Redis not configured',
      },
    };
  }
  
  try {
    const client = await getPrimaryClient();
    
    if (!client) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: 'Redis client not available',
        details: { configured: true },
      };
    }
    
    // Run ping check
    const pingResult = await withTimeout(checkRedisPing(client), 2000, 'Redis ping');
    
    if (!pingResult.success || !pingResult.result?.success) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: pingResult.error || pingResult.result?.error,
        details: { configured: true },
      };
    }
    
    // Get detailed health
    const healthResult = await withTimeout(getRedisHealth(client), 2000, 'Redis health');
    
    const latency = Date.now() - start;
    const isHealthy = healthResult.success && 
      healthResult.result?.healthy === true &&
      isRedisHealthyForProduction(healthResult.result);
    
    return {
      healthy: isHealthy,
      latency,
      details: {
        configured: true,
        latencyMs: pingResult.result?.latency,
        version: healthResult.result?.details?.version,
        connectedClients: healthResult.result?.details?.connectedClients,
        usedMemory: healthResult.result?.details?.usedMemory,
        hitRate: healthResult.result?.details?.hitRate,
        opsPerSecond: healthResult.result?.details?.opsPerSecond,
        uptime: healthResult.result?.details?.uptime,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { configured: true },
    };
  }
}

async function checkQueueDependency(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  // If Redis is not configured, queues won't work
  if (!isRedisConfigured()) {
    return {
      healthy: true,
      latency: 0,
      details: {
        configured: false,
        message: 'Queue system requires Redis',
      },
    };
  }
  
  try {
    const queueManager = getQueueManager();
    
    // Try to get queue stats with timeout
    const statsResult = await withTimeout(
      queueManager.getAllQueueStats(),
      3000,
      'Queue stats'
    );
    
    if (!statsResult.success) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: statsResult.error,
        details: { configured: true },
      };
    }
    
    const stats = statsResult.result || [];
    const failedCount = stats.reduce((sum, s) => sum + s.failed, 0);
    const waitingCount = stats.reduce((sum, s) => sum + s.waiting, 0);
    
    // Consider degraded if too many failed jobs
    const isHealthy = failedCount < 100;
    const isDegraded = failedCount >= 100 && failedCount < 500;
    
    return {
      healthy: isHealthy,
      latency: Date.now() - start,
      details: {
        configured: true,
        queues: stats.length,
        totalWaiting: waitingCount,
        totalFailed: failedCount,
        status: isDegraded ? 'degraded' : 'healthy',
        queueDetails: stats.map(s => ({
          name: s.name,
          waiting: s.waiting,
          active: s.active,
          failed: s.failed,
          delayed: s.delayed,
        })),
      },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { configured: true },
    };
  }
}

async function checkS3Dependency(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  // Check if S3 is configured
  if (!isS3Configured()) {
    return {
      healthy: true,
      latency: 0,
      details: {
        configured: false,
        message: 'S3 backup not configured',
      },
    };
  }
  
  try {
    // Import S3 client
    const { getS3Client, getS3Config } = await import('@/lib/backup-s3');
    const client = getS3Client();
    const config = getS3Config();
    
    // Use HeadBucket to check if bucket exists and is accessible
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    
    const result = await withTimeout(
      client.send(new HeadBucketCommand({ Bucket: config.bucket })),
      3000,
      'S3 bucket check'
    );
    
    const latency = Date.now() - start;
    
    return {
      healthy: result.success,
      latency,
      error: result.error,
      details: {
        configured: true,
        bucket: config.bucket,
        region: config.region,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { configured: true },
    };
  }
}

// ============================================
// Main Endpoint Handler
// ============================================

export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Run all checks in parallel for efficiency
  const [database, redis, queue, s3] = await Promise.all([
    checkDatabaseDependency(),
    checkRedisDependency(),
    checkQueueDependency(),
    checkS3Dependency(),
  ]);
  
  const checks = { database, redis, queue, s3 };
  
  // Determine overall status
  const criticalChecks = [database, redis];
  const optionalChecks = [queue, s3];
  
  const criticalUnhealthy = criticalChecks.some(c => !c.healthy);
  const optionalUnhealthy = optionalChecks.some(c => !c.healthy && c.details?.configured === true);
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  
  if (criticalUnhealthy) {
    status = 'unhealthy';
  } else if (optionalUnhealthy) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }
  
  const response: DependencyHealthResponse = {
    status,
    checks,
    timestamp,
    version: '3.6.0',
    uptime: Math.floor(process.uptime()),
  };
  
  const httpStatus = status === 'unhealthy' ? 503 : 200;
  
  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
