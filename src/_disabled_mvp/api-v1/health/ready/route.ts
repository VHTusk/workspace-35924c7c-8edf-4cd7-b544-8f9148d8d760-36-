/**
 * API v1 Readiness Check Endpoint
 * For Kubernetes/container orchestration readiness probes
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isShuttingDown } from '@/lib/shutdown';
import { API_VERSIONS, addVersionHeaders } from '@/lib/api-versioning';

export async function GET() {
  // Check if server is shutting down
  if (isShuttingDown()) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Server is shutting down',
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

  try {
    // Quick database ping
    await db.$queryRaw`SELECT 1`;

    const response = NextResponse.json({
      success: true,
      data: {
        ready: true,
        timestamp: new Date().toISOString(),
      },
      meta: {
        version: API_VERSIONS.CURRENT,
        timestamp: new Date().toISOString(),
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Database not ready',
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
