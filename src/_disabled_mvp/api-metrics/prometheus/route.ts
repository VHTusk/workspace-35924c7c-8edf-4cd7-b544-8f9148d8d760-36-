/**
 * Prometheus Metrics Endpoint
 * 
 * GET /api/metrics/prometheus - Returns Prometheus-compatible metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';
import { getAllQueueStats } from '@/lib/job-queue';
import { getCacheStats } from '@/lib/cache';

// Basic auth for metrics endpoint
const METRICS_USERNAME = process.env.METRICS_USERNAME || 'metrics';
const METRICS_PASSWORD = process.env.METRICS_PASSWORD || '';

function checkAuth(request: NextRequest): boolean {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  return username === METRICS_USERNAME && password === METRICS_PASSWORD;
}

export async function GET(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Metrics"',
      },
    });
  }

  try {
    // Update cache metrics
    const cacheStats = await getCacheStats();
    
    // Update job queue metrics
    const queueStats = await getAllQueueStats();
    for (const stats of queueStats) {
      // These would update the Prometheus gauges
      // stats contains: name, waiting, active, completed, failed, delayed, paused
    }

    // Get Prometheus metrics
    const metrics = await getMetrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
