/**
 * API v1 Health Check Endpoint
 * Returns system health status with version headers
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getHealthStatus } from '@/lib/shutdown';
import { API_VERSIONS, addVersionHeaders } from '@/lib/api-versioning';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;
    
    const healthStatus = getHealthStatus();
    const responseTime = Date.now() - startTime;
    
    const response = NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        version: API_VERSIONS.CURRENT,
        uptime: process.uptime ? Math.floor(process.uptime()) : null,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks: {
          database: 'connected',
          shutdown: healthStatus.shuttingDown ? 'shutting_down' : 'normal',
        },
        metrics: {
          activeConnections: healthStatus.activeConnections,
          inFlightRequests: healthStatus.inFlightRequests,
        },
      },
      meta: {
        version: API_VERSIONS.CURRENT,
        timestamp: new Date().toISOString(),
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Health check failed:', error);
    
    const response = NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        data: {
          status: 'unhealthy',
          version: API_VERSIONS.CURRENT,
          timestamp: new Date().toISOString(),
          checks: {
            database: 'disconnected',
          },
        },
        meta: {
          version: API_VERSIONS.CURRENT,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 503 }
    );

    addVersionHeaders(response);
    return response;
  }
}
