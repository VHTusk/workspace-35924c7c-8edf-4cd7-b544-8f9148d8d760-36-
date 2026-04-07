/**
 * Redis Health Check Endpoint
 * 
 * Provides detailed Redis health information for:
 * - Monitoring dashboards
 * - Alerting systems
 * - Load balancer health checks
 * 
 * Query params:
 * - detailed: If 'true', returns full health details
 * - latency: If 'true', measures latency over 10 samples
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import {
  checkRedisPing,
  getRedisHealth,
  measureRedisLatency,
  getRedisMemoryInfo,
  formatBytes,
  formatUptime,
} from '@/lib/redis-health';

// Singleton Redis client for health checks
let healthCheckClient: Awaited<ReturnType<typeof createClient>> | null = null;

async function getHealthCheckClient() {
  if (healthCheckClient?.isOpen) {
    return healthCheckClient;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    healthCheckClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false, // Don't auto-reconnect for health checks
      },
    });

    healthCheckClient.on('error', (err) => {
      console.error('[Redis Health] Client error:', err.message);
    });

    await healthCheckClient.connect();
    return healthCheckClient;
  } catch (error) {
    console.error('[Redis Health] Connection failed:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';
  const measureLatency = searchParams.get('latency') === 'true';

  // Check if Redis is configured
  if (!process.env.REDIS_URL) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'REDIS_URL not configured',
      timestamp: new Date().toISOString(),
    }, { status: 200 }); // 200 because not having Redis is not an error
  }

  try {
    const client = await getHealthCheckClient();

    if (!client) {
      return NextResponse.json({
        status: 'unavailable',
        healthy: false,
        message: 'Failed to connect to Redis',
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }

    // Get basic health status
    const health = await getRedisHealth(client as any);

    // Build response
    const response: Record<string, unknown> = {
      status: health.healthy ? 'healthy' : 'unhealthy',
      healthy: health.healthy,
      connected: health.connected,
      latency: health.latency,
      timestamp: health.timestamp,
    };

    // Add error if present
    if (health.error) {
      response.error = health.error;
    }

    // Add detailed information if requested
    if (detailed && health.details) {
      response.details = {
        version: health.details.version,
        mode: health.details.mode,
        role: health.details.role,
        uptime: formatUptime(health.details.uptime),
        uptimeSeconds: health.details.uptime,
        clients: {
          connected: health.details.connectedClients,
          blocked: health.details.blockedClients,
        },
        memory: {
          used: formatBytes(health.details.usedMemory),
          usedBytes: health.details.usedMemory,
          peak: formatBytes(health.details.usedMemoryPeak),
          peakBytes: health.details.usedMemoryPeak,
          percentage: Math.round(health.details.usedMemoryPercentage * 100) / 100,
        },
        keys: {
          total: health.details.totalKeys,
        },
        performance: {
          opsPerSecond: health.details.opsPerSecond,
          hitRate: Math.round(health.details.hitRate * 100) / 100,
          keyspaceHits: health.details.keyspaceHits,
          keyspaceMisses: health.details.keyspaceMisses,
        },
        persistence: {
          lastSave: new Date(health.details.lastSaveTime * 1000).toISOString(),
          changesSinceLastSave: health.details.changesSinceLastSave,
        },
      };
    }

    // Measure detailed latency if requested
    if (measureLatency) {
      try {
        const latencyResult = await measureRedisLatency(client as any, 10);
        response.latencyDetails = {
          min: latencyResult.min,
          max: latencyResult.max,
          avg: latencyResult.avg,
          samples: latencyResult.samples.length,
        };
      } catch (error) {
        response.latencyError = 'Failed to measure latency';
      }
    }

    // Get memory info
    if (detailed) {
      try {
        const memoryInfo = await getRedisMemoryInfo(client as any);
        response.memoryInfo = {
          used: formatBytes(memoryInfo.usedMemory),
          peak: formatBytes(memoryInfo.usedMemoryPeak),
          rss: formatBytes(memoryInfo.usedMemoryRss),
          fragmentationRatio: memoryInfo.memoryFragmentationRatio,
          maxMemory: memoryInfo.maxMemory ? formatBytes(memoryInfo.maxMemory) : 'unlimited',
          maxMemoryPolicy: memoryInfo.maxMemoryPolicy,
        };
      } catch (error) {
        response.memoryInfoError = 'Failed to get memory info';
      }
    }

    // Set appropriate status code
    const statusCode = health.healthy ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error('[Redis Health] Check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
