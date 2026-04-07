/**
 * Prometheus Metrics Endpoint
 * 
 * GET /api/metrics - Returns Prometheus-compatible metrics
 * 
 * @module app/api/metrics/route
 */

import { NextResponse } from 'next/server';
import { metrics, getPrometheusMetrics } from '@/lib/metrics';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

// ============================================
// Collect System Metrics
// ============================================

async function collectSystemMetrics() {
  try {
    // Active users (logged in within last 15 minutes)
    const activeUsers = await db.user.count({
      where: {
        isActive: true,
        sessions: {
          some: {
            lastActivityAt: {
              gte: new Date(Date.now() - 15 * 60 * 1000),
            },
          },
        },
      },
    });
    metrics.setGauge('active_users_total', {}, activeUsers);
    
    // Active tournaments
    const activeTournaments = await db.tournament.count({
      where: {
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] },
      },
    });
    metrics.setGauge('tournaments_active_total', {}, activeTournaments);
    
    // Pending matches
    const pendingMatches = await db.match.count({
      where: {
        tournament: { status: 'IN_PROGRESS' },
        scoreA: null,
        scoreB: null,
      },
    });
    metrics.setGauge('matches_pending_total', {}, pendingMatches);
    
    // Cache stats
    const cacheStats = cache.getCacheStats?.() || { keys: 0, memoryUsed: 0 };
    metrics.setGauge('cache_size_bytes', {}, cacheStats.memoryUsed || 0);
    
  } catch (error) {
    console.error('[Metrics] Failed to collect system metrics:', error);
  }
}

// ============================================
// GET Handler
// ============================================

export async function GET() {
  try {
    // Collect fresh metrics
    await collectSystemMetrics();
    
    // Return Prometheus format
    const prometheusMetrics = getPrometheusMetrics();
    
    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Metrics] Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
