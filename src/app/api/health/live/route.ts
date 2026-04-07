/**
 * Liveness Probe Endpoint
 * 
 * Simple endpoint that returns 200 if the process is running.
 * Used by orchestrators (Kubernetes, Docker Swarm, etc.) to know 
 * if the container should be restarted.
 * 
 * No dependency checks - just confirms the process is alive.
 * 
 * GET /api/health/live
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
