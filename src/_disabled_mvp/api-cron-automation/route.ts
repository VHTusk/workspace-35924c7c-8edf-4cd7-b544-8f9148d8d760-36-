/**
 * VALORHIVE Unified Automation Cron API (v3.51.0)
 * 
 * Comprehensive cron endpoint that processes all automation:
 * 
 * Phase 5 - Match Reminders:
 * - Match reminder processing (push notifications)
 * - Reminder cleanup
 * 
 * Phase 8 - Retention & Intelligence:
 * - Player re-engagement
 * - Feedback collection
 * - Health monitoring
 * - Self-healing
 * - Smart notification routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { processMatchReminders, cleanupOldMatchReminders } from '@/lib/match-reminder-engine';
import { processInactivePlayers, getReengagementStats } from '@/lib/player-reengagement';
import { processExpiredFeedbackRequests, generateNPSSurvey } from '@/lib/feedback-collector';
import { runMonitoringCycle, getSystemStatus } from '@/lib/health-monitor';
import { processScheduledNotifications, processBatchedNotifications } from '@/lib/smart-notification-router';
import { processAutoEscalations } from '@/lib/admin-escalation';
import { processAllTournamentReminders } from '@/lib/tournament-reminders';
import { SportType } from '@prisma/client';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

// ============================================
// MAIN CRON HANDLER
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
      case 'match-reminders':
        return await handleMatchReminders();

      case 'reengagement':
        return await handleReengagement();

      case 'feedback':
        return await handleFeedback();

      case 'health-monitor':
        return await handleHealthMonitor();

      case 'notifications':
        return await handleNotifications();

      case 'all':
        return await handleAll();

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid task. Available: match-reminders, reengagement, feedback, health-monitor, notifications, all',
          status: getTaskStatus(),
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[AutomationCron] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

// ============================================
// TASK HANDLERS
// ============================================

async function handleMatchReminders() {
  console.log('[Cron] Processing match reminders...');

  const reminderResult = await processMatchReminders();
  const cleanupResult = await cleanupOldMatchReminders();

  return NextResponse.json({
    success: true,
    task: 'match-reminders',
    reminders: reminderResult,
    cleanup: cleanupResult,
    executedAt: new Date().toISOString(),
  });
}

async function handleReengagement() {
  console.log('[Cron] Processing player re-engagement...');

  const cornholeResult = await processInactivePlayers(SportType.CORNHOLE);
  const dartsResult = await processInactivePlayers(SportType.DARTS);

  const [cornholeStats, dartsStats] = await Promise.all([
    getReengagementStats(SportType.CORNHOLE),
    getReengagementStats(SportType.DARTS),
  ]);

  return NextResponse.json({
    success: true,
    task: 'reengagement',
    cornhole: { result: cornholeResult, stats: cornholeStats },
    darts: { result: dartsResult, stats: dartsStats },
    executedAt: new Date().toISOString(),
  });
}

async function handleFeedback() {
  console.log('[Cron] Processing feedback collection...');

  const expiredResult = await processExpiredFeedbackRequests();

  // Generate NPS surveys weekly (only on Sundays)
  const today = new Date().getDay();
  let npsResult = { created: 0 };

  if (today === 0) { // Sunday
    npsResult = await generateNPSSurvey(SportType.CORNHOLE, 50);
  }

  return NextResponse.json({
    success: true,
    task: 'feedback',
    expired: expiredResult,
    nps: npsResult,
    executedAt: new Date().toISOString(),
  });
}

async function handleHealthMonitor() {
  console.log('[Cron] Running health monitoring...');

  const result = await runMonitoringCycle();

  return NextResponse.json({
    success: true,
    task: 'health-monitor',
    health: {
      overall: result.health.overall,
      checks: result.health.checks.length,
      alerts: result.health.alerts.length,
    },
    recoveryActions: result.recoveryActions.length,
    executedAt: new Date().toISOString(),
  });
}

async function handleNotifications() {
  console.log('[Cron] Processing smart notifications...');

  const scheduledResult = await processScheduledNotifications();
  const batchedResult = await processBatchedNotifications();

  return NextResponse.json({
    success: true,
    task: 'notifications',
    scheduled: scheduledResult,
    batched: batchedResult,
    executedAt: new Date().toISOString(),
  });
}

async function handleAll() {
  console.log('[Cron] Running all automation tasks...');

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Match Reminders
  try {
    results.matchReminders = await processMatchReminders();
  } catch (error) {
    errors.push(`Match reminders: ${error}`);
  }

  // 2. Player Re-engagement (weekly task)
  const today = new Date().getDay();
  if (today === 0) { // Sunday
    try {
      results.reengagementCornhole = await processInactivePlayers(SportType.CORNHOLE);
      results.reengagementDarts = await processInactivePlayers(SportType.DARTS);
    } catch (error) {
      errors.push(`Re-engagement: ${error}`);
    }
  }

  // 3. Feedback
  try {
    results.feedback = await processExpiredFeedbackRequests();
  } catch (error) {
    errors.push(`Feedback: ${error}`);
  }

  // 4. Health Monitor
  try {
    const healthResult = await runMonitoringCycle();
    results.health = {
      overall: healthResult.health.overall,
      alerts: healthResult.health.alerts.length,
      recovery: healthResult.recoveryActions.length,
    };
  } catch (error) {
    errors.push(`Health monitor: ${error}`);
  }

  // 5. Smart Notifications
  try {
    results.scheduledNotifications = await processScheduledNotifications();
    results.batchedNotifications = await processBatchedNotifications();
  } catch (error) {
    errors.push(`Notifications: ${error}`);
  }

  // 6. Escalations
  try {
    results.escalations = await processAutoEscalations();
  } catch (error) {
    errors.push(`Escalations: ${error}`);
  }

  // 7. Tournament Reminders
  try {
    results.tournamentReminders = await processAllTournamentReminders();
  } catch (error) {
    errors.push(`Tournament reminders: ${error}`);
  }

  console.log('[Cron] All automation tasks completed');

  return NextResponse.json({
    success: true,
    task: 'all',
    results,
    errors,
    executedAt: new Date().toISOString(),
  });
}

// ============================================
// HELPERS
// ============================================

function getTaskStatus() {
  return {
    'match-reminders': 'Process match reminder notifications (every minute)',
    'reengagement': 'Process player re-engagement (weekly)',
    'feedback': 'Process feedback requests (daily)',
    'health-monitor': 'Run health monitoring (every minute)',
    'notifications': 'Process smart notification queue (every minute)',
    'all': 'Run all automation tasks',
  };
}

// ============================================
// GET - Health Check
// ============================================

export async function GET() {
  const status = await getSystemStatus();

  return NextResponse.json({
    success: true,
    service: 'automation-cron',
    tasks: getTaskStatus(),
    systemStatus: status,
    recommendedSchedule: {
      'match-reminders': '*/1 * * * *',      // Every minute
      'reengagement': '0 9 * * 0',           // Sunday 9 AM
      'feedback': '0 */6 * * *',             // Every 6 hours
      'health-monitor': '*/1 * * * *',       // Every minute
      'notifications': '*/1 * * * *',        // Every minute
      'all': '*/5 * * * *',                  // Every 5 minutes (comprehensive)
    },
  });
}
