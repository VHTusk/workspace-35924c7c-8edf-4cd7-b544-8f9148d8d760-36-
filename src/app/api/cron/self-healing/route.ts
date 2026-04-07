/**
 * Self-Healing Cron Endpoint (v3.51.0)
 * 
 * Runs automated data integrity checks and repairs.
 * Called by the cron service on a schedule.
 * 
 * Schedule: Every 6 hours
 * Tasks:
 * - Orphaned records detection and cleanup
 * - Incomplete transaction recovery
 * - Missing notification detection and remediation
 * - Bracket integrity verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  runSelfHealingCycle, 
  runHealthChecks,
  detectAndHealIssues,
  type HealthCheck,
  type HealingAction 
} from '@/lib/self-healing';
import { db } from '@/lib/db';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

interface SelfHealingResult {
  success: boolean;
  timestamp: string;
  healthChecks: HealthCheck[];
  healingActions: HealingAction[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    issuesFixed: number;
    errors: string[];
  };
  healingLogId?: string;
}

/**
 * POST /api/cron/self-healing
 * Run self-healing cycle
 * 
 * Query params:
 * - task: 'all' | 'checks' | 'heal' (default: 'all')
 * - dryRun: 'true' | 'false' (default: 'false')
 */
export async function POST(request: NextRequest): Promise<NextResponse<SelfHealingResult | { error: string }>> {
  const startTime = Date.now();
  
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (providedSecret !== CRON_SECRET) {
      // Also check for Vercel Cron header
      const isVercelCron = request.headers.get('x-vercel-cron') === 'true';
      if (!isVercelCron && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    const { searchParams } = new URL(request.url);
    const task = searchParams.get('task') || 'all';
    const dryRun = searchParams.get('dryRun') === 'true';
    
    console.log(`[SelfHealingCron] Starting task: ${task}, dryRun: ${dryRun}`);
    
    let healthChecks: HealthCheck[] = [];
    let healingActions: HealingAction[] = [];
    let summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      issuesFixed: 0,
      errors: [] as string[],
    };
    
    // Run tasks based on request
    if (task === 'checks' || task === 'all') {
      healthChecks = await runHealthChecks();
      summary.healthy = healthChecks.filter(c => c.status === 'HEALTHY').length;
      summary.degraded = healthChecks.filter(c => c.status === 'DEGRADED').length;
      summary.unhealthy = healthChecks.filter(c => c.status === 'UNHEALTHY').length;
    }
    
    if ((task === 'heal' || task === 'all') && !dryRun) {
      // Only run healing if there are issues or if explicitly requested
      const needsHealing = task === 'heal' || healthChecks.some(c => c.status !== 'HEALTHY');
      
      if (needsHealing) {
        healingActions = await detectAndHealIssues();
        summary.issuesFixed = healingActions.reduce(
          (sum, a) => (a.details?.fixed as number ?? 0) + sum, 
          0
        );
        summary.errors = healingActions
          .filter(a => a.details?.errors)
          .flatMap(a => Array.isArray(a.details?.errors) 
            ? a.details?.errors as string[] 
            : []
          );
      }
    }
    
    // Log to database
    let healingLogId: string | undefined;
    
    try {
      const log = await db.healingLog.create({
        data: {
          checkName: task.toUpperCase(),
          issuesFound: summary.degraded + summary.unhealthy,
          issuesFixed: summary.issuesFixed,
          details: JSON.stringify({
            healthChecks: healthChecks.map(c => ({
              name: c.name,
              status: c.status,
              message: c.message,
            })),
            healingActions: healingActions.map(a => ({
              type: a.type,
              success: a.success,
              details: a.details,
            })),
            dryRun,
            duration: Date.now() - startTime,
          }),
          dryRun,
        },
      });
      healingLogId = log.id;
    } catch (logError) {
      // Don't fail the whole request if logging fails
      console.error('[SelfHealingCron] Failed to create healing log:', logError);
    }
    
    const result: SelfHealingResult = {
      success: true,
      timestamp: new Date().toISOString(),
      healthChecks,
      healingActions,
      summary,
      healingLogId,
    };
    
    console.log(`[SelfHealingCron] Completed in ${Date.now() - startTime}ms`, {
      healthy: summary.healthy,
      degraded: summary.degraded,
      unhealthy: summary.unhealthy,
      issuesFixed: summary.issuesFixed,
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[SelfHealingCron] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        healthChecks: [],
        healingActions: [],
        summary: {
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          issuesFixed: 0,
          errors: [String(error)],
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/self-healing
 * Get self-healing status and recent logs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authorization (allow both cron and admin access)
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    const isVercelCron = request.headers.get('x-vercel-cron') === 'true';
    const isAuthorized = providedSecret === CRON_SECRET || isVercelCron;
    
    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get recent healing logs
    const recentLogs = await db.healingLog.findMany({
      orderBy: { ranAt: 'desc' },
      take: 10,
    });
    
    // Run quick health check
    const healthChecks = await runHealthChecks();
    
    return NextResponse.json({
      status: 'active',
      lastRun: recentLogs.length > 0 ? recentLogs[0].ranAt : null,
      healthChecks: healthChecks.map(c => ({
        name: c.name,
        status: c.status,
        message: c.message,
      })),
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        checkName: log.checkName,
        issuesFound: log.issuesFound,
        issuesFixed: log.issuesFixed,
        ranAt: log.ranAt,
        dryRun: log.dryRun,
      })),
    });
    
  } catch (error) {
    console.error('[SelfHealingCron] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get self-healing status' },
      { status: 500 }
    );
  }
}
