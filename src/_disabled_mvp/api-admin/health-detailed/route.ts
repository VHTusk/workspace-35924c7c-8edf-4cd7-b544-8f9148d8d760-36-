/**
 * VALORHIVE Detailed Health Dashboard API
 *
 * Comprehensive system health monitoring endpoint for admin dashboard.
 * Provides detailed health status for all system components.
 *
 * Features:
 * - System health (CPU, memory, uptime)
 * - Database health (connections, query stats)
 * - Redis/Cache health
 * - External services health (Razorpay, Email, SMS)
 * - Rate limit status
 * - SLI/SLO compliance summary
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCacheStats, CacheStats } from '@/lib/cache';
import { 
  checkSloCompliance, 
  getSliReport, 
  getMetricsStoreStats 
} from '@/lib/performance-slis';
import { getCloudWatchStatus } from '@/lib/cloudwatch-metrics';
import { getMetricsSummary } from '@/lib/metrics';

// ============================================
// Types
// ============================================

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    usagePercent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  nodeVersion: string;
  platform: string;
}

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  connectionCount: number;
  queryStats: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
  lastCheck: Date;
  error?: string;
}

interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  type: 'redis' | 'memory';
  connected: boolean;
  stats: CacheStats;
  lastCheck: Date;
  error?: string;
}

interface ExternalServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
}

interface RateLimitStatus {
  totalRequests: number;
  blockedRequests: number;
  activeLimiters: number;
  topLimitedPaths: Array<{
    path: string;
    count: number;
  }>;
}

interface DetailedHealthReport {
  timestamp: Date;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  system: SystemHealth;
  database: DatabaseHealth;
  cache: CacheHealth;
  externalServices: ExternalServiceHealth[];
  rateLimits: RateLimitStatus;
  sli: {
    overall: boolean;
    availability: { compliant: boolean; value: number; target: number };
    latency: { compliant: boolean; value: number; target: number };
    errorRate: { compliant: boolean; value: number; target: number };
    dbPerformance: { compliant: boolean; value: number; target: number };
  };
  metrics: {
    storeStats: ReturnType<typeof getMetricsStoreStats>;
    summary: ReturnType<typeof getMetricsSummary>;
    cloudWatch: ReturnType<typeof getCloudWatchStatus>;
  };
}

// ============================================
// Health Check Functions
// ============================================

/**
 * Get system health metrics
 */
function getSystemHealth(): SystemHealth {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const usagePercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (usagePercent > 90) {
    status = 'unhealthy';
  } else if (usagePercent > 75) {
    status = 'degraded';
  }

  return {
    status,
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      usagePercent: Math.round(usagePercent * 100) / 100,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Get database health
 */
async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  
  try {
    // Run a simple query to check database connectivity
    await db.$queryRaw`SELECT 1 as health_check`;
    
    const latency = Date.now() - start;

    // Get query stats from performance SLIs
    const metricsStats = getMetricsStoreStats();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (latency > 500) {
      status = 'unhealthy';
    } else if (latency > 100) {
      status = 'degraded';
    }

    return {
      status,
      latency,
      connectionCount: 1, // Prisma doesn't expose exact pool stats
      queryStats: {
        total: metricsStats.queryRecords,
        successful: metricsStats.queryRecords, // Approximate
        failed: 0,
        avgDuration: 0,
      },
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      connectionCount: 0,
      queryStats: {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
      },
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Get cache/Redis health
 */
async function getCacheHealth(): Promise<CacheHealth> {
  const start = Date.now();

  try {
    const stats = await getCacheStats();
    const latency = Date.now() - start;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (stats.hitRate < 50) {
      status = 'degraded';
    }

    return {
      status,
      type: stats.type,
      connected: true,
      stats,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      type: 'memory',
      connected: false,
      stats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        type: 'memory',
      },
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown cache error',
    };
  }
}

/**
 * Get external services health
 */
async function getExternalServicesHealth(): Promise<ExternalServiceHealth[]> {
  const services: ExternalServiceHealth[] = [];

  // Razorpay health
  services.push({
    name: 'Razorpay',
    status: process.env.RAZORPAY_KEY_ID ? 'healthy' : 'degraded',
    latency: 0,
    lastCheck: new Date(),
    message: process.env.RAZORPAY_KEY_ID 
      ? 'Configured' 
      : 'Not configured',
    details: {
      configured: !!process.env.RAZORPAY_KEY_ID,
    },
  });

  // Email service health
  const emailProvider = process.env.EMAIL_PROVIDER || 'none';
  services.push({
    name: 'Email Service',
    status: emailProvider !== 'none' ? 'healthy' : 'degraded',
    latency: 0,
    lastCheck: new Date(),
    message: `Provider: ${emailProvider}`,
    details: {
      provider: emailProvider,
      configured: emailProvider !== 'none',
    },
  });

  // SMS service health
  const smsProvider = process.env.SMS_PROVIDER || 'none';
  services.push({
    name: 'SMS Service',
    status: smsProvider !== 'none' ? 'healthy' : 'degraded',
    latency: 0,
    lastCheck: new Date(),
    message: `Provider: ${smsProvider}`,
    details: {
      provider: smsProvider,
      configured: smsProvider !== 'none',
    },
  });

  // AWS S3 health
  services.push({
    name: 'AWS S3',
    status: process.env.AWS_S3_BUCKET ? 'healthy' : 'degraded',
    latency: 0,
    lastCheck: new Date(),
    message: process.env.AWS_S3_BUCKET 
      ? `Bucket: ${process.env.AWS_S3_BUCKET}` 
      : 'Not configured',
    details: {
      bucket: process.env.AWS_S3_BUCKET || 'none',
      region: process.env.AWS_REGION || 'ap-south-1',
    },
  });

  // Sentry health
  services.push({
    name: 'Sentry',
    status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'healthy' : 'degraded',
    latency: 0,
    lastCheck: new Date(),
    message: process.env.NEXT_PUBLIC_SENTRY_DSN 
      ? 'Configured' 
      : 'Not configured',
    details: {
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    },
  });

  return services;
}

/**
 * Get rate limit status
 */
async function getRateLimitStatus(): Promise<RateLimitStatus> {
  // This is a simplified version - in production you'd track this in Redis
  return {
    totalRequests: 0,
    blockedRequests: 0,
    activeLimiters: 0,
    topLimitedPaths: [],
  };
}

// ============================================
// Main Handler
// ============================================

export async function GET(): Promise<NextResponse<DetailedHealthReport>> {
  try {
    // Collect all health data in parallel
    const [
      databaseHealth,
      cacheHealth,
      externalServices,
      rateLimits,
    ] = await Promise.all([
      getDatabaseHealth(),
      getCacheHealth(),
      getExternalServicesHealth(),
      getRateLimitStatus(),
    ]);

    // Get system health (synchronous)
    const systemHealth = getSystemHealth();

    // Get SLI compliance
    const sliCompliance = checkSloCompliance();

    // Determine overall status
    const allStatuses = [
      systemHealth.status,
      databaseHealth.status,
      cacheHealth.status,
      ...externalServices.map(s => s.status),
    ];

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (allStatuses.includes('unhealthy')) {
      overall = 'unhealthy';
    } else if (allStatuses.includes('degraded')) {
      overall = 'degraded';
    }

    // Build response
    const report: DetailedHealthReport = {
      timestamp: new Date(),
      overall,
      system: systemHealth,
      database: databaseHealth,
      cache: cacheHealth,
      externalServices,
      rateLimits,
      sli: {
        overall: sliCompliance.overall,
        availability: sliCompliance.availability,
        latency: sliCompliance.latency,
        errorRate: sliCompliance.errorRate,
        dbPerformance: sliCompliance.dbPerformance,
      },
      metrics: {
        storeStats: getMetricsStoreStats(),
        summary: getMetricsSummary(),
        cloudWatch: getCloudWatchStatus(),
      },
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('[HealthDetailed] Error generating health report:', error);

    // Return minimal error response
    return NextResponse.json(
      {
        timestamp: new Date(),
        overall: 'unhealthy' as const,
        system: getSystemHealth(),
        database: {
          status: 'unhealthy' as const,
          latency: 0,
          connectionCount: 0,
          queryStats: { total: 0, successful: 0, failed: 0, avgDuration: 0 },
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        cache: {
          status: 'unhealthy' as const,
          type: 'memory' as const,
          connected: false,
          stats: { hits: 0, misses: 0, hitRate: 0, type: 'memory' as const },
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        externalServices: [],
        rateLimits: {
          totalRequests: 0,
          blockedRequests: 0,
          activeLimiters: 0,
          topLimitedPaths: [],
        },
        sli: {
          overall: false,
          availability: { compliant: false, value: 0, target: 99.9 },
          latency: { compliant: false, value: 0, target: 500 },
          errorRate: { compliant: false, value: 100, target: 0.1 },
          dbPerformance: { compliant: false, value: 0, target: 100 },
        },
        metrics: {
          storeStats: getMetricsStoreStats(),
          summary: getMetricsSummary(),
          cloudWatch: getCloudWatchStatus(),
        },
      } satisfies DetailedHealthReport,
      { status: 500 }
    );
  }
}

// ============================================
// Health Summary Endpoint
// ============================================

/**
 * Quick health check for load balancers
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    // Quick database check
    await db.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
