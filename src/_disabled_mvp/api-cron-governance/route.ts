/**
 * VALORHIVE Governance Cron API (v3.50.0)
 * 
 * Scheduled tasks for governance automation:
 * - Inactivity detection (daily)
 * - Load metric updates (hourly)
 * - Auto-escalation processing (every 5 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectInactiveAdmins } from '@/lib/inactive-admin-detector';
import { getRegionLoadMetrics } from '@/lib/region-load-balancer';
import { processAutoEscalations } from '@/lib/admin-escalation';
import { SportType } from '@prisma/client';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

// ============================================
// POST - Execute scheduled tasks
// ============================================

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const task = searchParams.get('task');

  try {
    switch (task) {
      case 'detect-inactivity': {
        console.log('[CRON] Running inactivity detection...');
        const result = await detectInactiveAdmins();
        console.log(`[CRON] Inactivity detection complete: ${result.processed} processed, ${result.warnings} warnings, ${result.flagged} flagged, ${result.escalated} escalated, ${result.disabled} disabled`);
        return NextResponse.json({
          success: true,
          task: 'detect-inactivity',
          ...result,
          executedAt: new Date().toISOString(),
        });
      }

      case 'update-load-metrics': {
        console.log('[CRON] Updating load metrics...');
        
        // Update metrics for both sports
        const cornholeMetrics = await getRegionLoadMetrics(SportType.CORNHOLE);
        const dartsMetrics = await getRegionLoadMetrics(SportType.DARTS);

        console.log(`[CRON] Load metrics updated: ${cornholeMetrics.length} cornhole admins, ${dartsMetrics.length} darts admins`);

        return NextResponse.json({
          success: true,
          task: 'update-load-metrics',
          cornholeAdmins: cornholeMetrics.length,
          dartsAdmins: dartsMetrics.length,
          executedAt: new Date().toISOString(),
        });
      }

      case 'process-escalations': {
        console.log('[CRON] Processing auto-escalations...');
        const result = await processAutoEscalations();
        console.log(`[CRON] Auto-escalations complete: ${result.processed} processed`);

        return NextResponse.json({
          success: true,
          task: 'process-escalations',
          ...result,
          executedAt: new Date().toISOString(),
        });
      }

      case 'all': {
        console.log('[CRON] Running all governance tasks...');

        const inactivityResult = await detectInactiveAdmins();
        const escalationResult = await processAutoEscalations();

        // Update load metrics for both sports
        await getRegionLoadMetrics(SportType.CORNHOLE);
        await getRegionLoadMetrics(SportType.DARTS);

        console.log('[CRON] All governance tasks completed');

        return NextResponse.json({
          success: true,
          task: 'all',
          results: {
            inactivity: {
              processed: inactivityResult.processed,
              warnings: inactivityResult.warnings,
              flagged: inactivityResult.flagged,
              escalated: inactivityResult.escalated,
              disabled: inactivityResult.disabled,
            },
            escalations: {
              processed: escalationResult.processed,
              escalations: escalationResult.escalations.length,
            },
          },
          errors: [...inactivityResult.errors, ...escalationResult.errors],
          executedAt: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid task. Available: detect-inactivity, update-load-metrics, process-escalations, all',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[CRON] Governance task error:', error);
    return NextResponse.json({
      success: false,
      message: 'Task execution failed',
      error: String(error),
    }, { status: 500 });
  }
}

// ============================================
// GET - Health check
// ============================================

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'governance-cron',
    tasks: ['detect-inactivity', 'update-load-metrics', 'process-escalations', 'all'],
    status: 'healthy',
  });
}
