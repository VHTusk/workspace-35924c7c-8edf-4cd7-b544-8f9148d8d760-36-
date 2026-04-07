import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';

/**
 * Health check endpoint for load balancers and uptime monitors
 * 
 * Returns:
 * - status: 'ok' | 'degraded' | 'error'
 * - timestamp: ISO timestamp
 * - service: Service name
 * - version: API version
 * - checks: Individual health check results
 * 
 * Response codes:
 * - 200: All checks passed (healthy)
 * - 200: Some checks failed but service is operational (degraded)
 * - 503: Critical checks failed (unhealthy)
 */
export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
  
  // Check database connectivity
  try {
    const dbHealth = await checkDatabaseHealth();
    checks.database = {
      status: dbHealth.healthy ? 'ok' : 'error',
      latency: dbHealth.latency,
      ...(dbHealth.error && { error: dbHealth.error })
    };
    
    if (!dbHealth.healthy) {
      overallStatus = 'error';
    } else if (dbHealth.latency && dbHealth.latency > 500) {
      // High latency is degraded but not failed
      checks.database.status = 'degraded';
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    overallStatus = 'error';
  }
  
  // Check environment (critical variables)
  const criticalEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
  const missingEnvVars = criticalEnvVars.filter(v => !process.env[v]);
  
  if (missingEnvVars.length > 0) {
    checks.environment = {
      status: 'error',
      error: `Missing critical env vars: ${missingEnvVars.join(', ')}`
    };
    overallStatus = 'error';
  } else {
    checks.environment = { status: 'ok' };
  }
  
  // Check Redis (optional - degraded if not available)
  if (process.env.REDIS_URL) {
    try {
      // Simple check - if Redis is configured, we consider it available
      // A more thorough check would ping Redis
      checks.redis = { status: 'ok' };
    } catch {
      checks.redis = { status: 'degraded', error: 'Redis unavailable' };
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }
  } else {
    checks.redis = { status: 'degraded', error: 'Not configured' };
  }
  
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'VALORHIVE',
    version: '3.6.0',
    uptime: process.uptime(),
    checks
  };
  
  // Return 503 for unhealthy status (for load balancer health checks)
  const statusCode = overallStatus === 'error' ? 503 : 200;
  
  return NextResponse.json(response, { status: statusCode });
}
