import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Readiness probe - returns 200 if ready, 503 if not
// Used by Kubernetes to determine if the pod can receive traffic
export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    // All checks passed
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
