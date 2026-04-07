/**
 * VALORHIVE Manual Cron Fallback Endpoints
 * 
 * Manual fallback endpoints for critical cron jobs in case of failures.
 * These endpoints require ADMIN authentication and are rate-limited.
 * 
 * Use cases:
 * - Cron service is down or unreachable
 * - Job queue is stuck with stale jobs
 * - Need to manually trigger maintenance tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role, SportType, AuditAction } from '@prisma/client';
import { runJobQueueMaintenance, getJobStats as getEloJobStats } from '@/lib/elo-job-queue';
import { getWebhookStats, processRetries } from '@/lib/webhook-retry';
import { 
  runDailyCleanup, 
  runWeeklyCleanup, 
  getRetentionStats 
} from '@/lib/data-retention';

// GET - Get cron job status
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user } = auth;

    if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get all job stats
    const [eloStats, webhookStats, retentionStats] = await Promise.all([
      getEloJobStats(),
      getWebhookStats(),
      getRetentionStats(),
    ]);

    return NextResponse.json({
      eloJobs: eloStats,
      webhooks: webhookStats,
      retention: retentionStats,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting cron status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Execute manual fallback
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user } = auth;

    // Only ADMIN can trigger manual fallbacks
    if (user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: 'Only ADMIN can trigger manual fallbacks' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, sport, dryRun = false } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required. Available: elo_jobs, webhooks, daily_cleanup, weekly_cleanup, all' },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {
      action,
      triggeredBy: user.id,
      triggeredAt: new Date().toISOString(),
      dryRun,
    };

    switch (action) {
      case 'elo_jobs':
        // Process ELO job queue
        results.eloJobs = await runJobQueueMaintenance();
        break;

      case 'webhooks':
        // Process pending webhook retries
        results.webhooks = await processRetries(async (event) => {
          // Log that we're processing this webhook manually
          console.log(`[ManualFallback] Processing webhook ${event.id}`);
          // The actual processing would be handled by the webhook handler
        });
        break;

      case 'daily_cleanup':
        // Run daily cleanup tasks
        results.cleanup = await runDailyCleanup(dryRun);
        break;

      case 'weekly_cleanup':
        // Run weekly cleanup tasks
        results.cleanup = await runWeeklyCleanup(dryRun);
        break;

      case 'all':
        // Run all maintenance tasks
        const [eloResult, webhookResult, cleanupResult] = await Promise.all([
          runJobQueueMaintenance(),
          processRetries(async () => {}),
          runDailyCleanup(dryRun),
        ]);
        
        results.eloJobs = eloResult;
        results.webhooks = webhookResult;
        results.cleanup = cleanupResult;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Available: elo_jobs, webhooks, daily_cleanup, weekly_cleanup, all` },
          { status: 400 }
        );
    }

    // Log the manual trigger
    await db.auditLog.create({
      data: {
        sport: (sport as SportType) || SportType.CORNHOLE,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'CronJob',
        targetId: action,
        reason: 'Manual fallback triggered',
        metadata: JSON.stringify(results),
      },
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error executing manual fallback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
