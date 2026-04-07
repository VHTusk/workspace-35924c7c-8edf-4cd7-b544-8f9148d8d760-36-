/**
 * VALORHIVE Cron Service
 * 
 * Scheduled jobs for automated maintenance and optimization tasks.
 * All jobs call the main application's HTTP API endpoints.
 * 
 * Jobs:
 * 1. Daily Cleanup (2:00 AM IST) - Sessions, notifications, webhook events
 * 2. Weekly Cleanup (Sunday 3:00 AM IST) - Tournament archival, user anonymization
 * 3. Performance SLI Aggregation (every 5 minutes) - SLO compliance monitoring
 * 4. Cache Warming (every 10 minutes) - Pre-populate frequently accessed data
 * 5. ELO Job Queue (every minute) - Process ELO calculations
 * 6. Recurring Tournaments (hourly) - Auto-create from templates
 * 
 * HTTP Cron Jobs (call Next.js API routes):
 * 7. Autopilot (every 5 minutes) - Tournament autopilot processing
 * 8. Completion (every 5 minutes) - Tournament completion tasks
 * 9. Governance (every 30 minutes) - Governance automation
 * 10. Venue Flow (every 2 minutes) - Venue flow automation
 * 11. Finance (every 10 minutes) - Refund processing, payment recovery
 * 12. Automation (every 15 minutes) - System automation tasks
 * 13. Backup (daily 2:30 AM IST) - Database backup
 * 14. No-Show Forfeit (every 5 minutes) - Auto-forfeit no-show players
 * 
 * Timezone: IST (Asia/Kolkata) - UTC+5:30
 */

import cron from 'node-cron';
import { createLogger, getRequiredEnv, sleep } from '@valorhive/shared';
import type { CronJobStatus, CronJobResult, CronJobType } from '@valorhive/contracts';

// ============================================
// Configuration
// ============================================

const logger = createLogger({ service: 'cron' });

const TIMEZONE = 'Asia/Kolkata';
const DRY_RUN = process.env.DRY_RUN === 'true';
const CRON_PORT = process.env.CRON_PORT || 3004;
const INTERNAL_BASE_URL = process.env.INTERNAL_BASE_URL || 'http://app:3000';

// CRON_SECRET is REQUIRED
const CRON_SECRET = getRequiredEnv('CRON_SECRET');

// ============================================
// Job Status Tracking
// ============================================

const jobStatuses = new Map<string, CronJobStatus>();

function initializeJobStatus(name: CronJobType): CronJobStatus {
  const status: CronJobStatus = {
    name,
    lastRun: null,
    nextRun: null,
    status: 'idle',
    lastError: null,
    lastDuration: null,
    runCount: 0,
    successCount: 0,
    failureCount: 0,
  };
  jobStatuses.set(name, status);
  return status;
}

function updateJobStart(name: CronJobType): CronJobStatus {
  const status = jobStatuses.get(name) || initializeJobStatus(name);
  status.status = 'running';
  status.lastRun = new Date();
  status.runCount++;
  return status;
}

function updateJobSuccess(name: CronJobType, duration: number): void {
  const status = jobStatuses.get(name);
  if (status) {
    status.status = 'success';
    status.lastDuration = duration;
    status.lastError = null;
    status.successCount++;
  }
}

function updateJobFailure(name: CronJobType, error: string, duration: number): void {
  const status = jobStatuses.get(name);
  if (status) {
    status.status = 'failed';
    status.lastDuration = duration;
    status.lastError = error;
    status.failureCount++;
  }
}

// ============================================
// HTTP Cron Job Helpers
// ============================================

async function fetchCronEndpoint(
  endpoint: string,
  task?: string
): Promise<{ success: boolean; data?: unknown; error?: string; duration: number }> {
  const startTime = Date.now();
  
  try {
    const url = `${INTERNAL_BASE_URL}${endpoint}?XTransformPort=3000${task ? `&task=${task}` : ''}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration,
      };
    }
    
    const data = await response.json();
    return { success: true, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
  }
}

// ============================================
// Job Handlers
// ============================================

/**
 * Daily Cleanup Job
 * Runs at 2:00 AM IST
 */
async function runDailyCleanupJob(): Promise<void> {
  const jobName: CronJobType = 'daily-cleanup';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/cleanup', 'daily');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Daily cleanup completed in ${result.duration}ms`);
      logger.info(`Results: ${JSON.stringify(data, null, 2)}`);
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Weekly Cleanup Job
 * Runs Sunday at 3:00 AM IST
 */
async function runWeeklyCleanupJob(): Promise<void> {
  const jobName: CronJobType = 'weekly-cleanup';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/cleanup', 'weekly');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Weekly cleanup completed in ${result.duration}ms`);
      logger.info(`Results: ${JSON.stringify(data, null, 2)}`);
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * SLI Aggregation Job
 * Runs every 5 minutes
 */
async function runSliAggregationJob(): Promise<void> {
  const jobName: CronJobType = 'sli-aggregation';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/metrics', 'aggregate');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`SLI aggregation completed in ${result.duration}ms`);
      
      if (data?.alerts?.length > 0) {
        logger.warn(`Alerts generated: ${data.alerts.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Cache Warming Job
 * Runs every 10 minutes
 */
async function runCacheWarmingJob(): Promise<void> {
  const jobName: CronJobType = 'cache-warming';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/cache', 'warm');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Cache warming completed in ${result.duration}ms`);
      logger.info(`Warmed: ${data?.warmed || 0} entries`);
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * ELO Job Queue Processing
 * Runs every minute
 */
async function runEloJobQueueJob(): Promise<void> {
  const jobName: CronJobType = 'elo-job-queue';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/elo', 'process');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`ELO job queue completed in ${result.duration}ms`);
      logger.info(`Recovered: ${data?.recovered || 0}, Processed: ${data?.processed || 0}`);
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Recurring Tournament Auto-Creation Job
 * Runs every hour
 */
async function runRecurringTournamentJob(): Promise<void> {
  const jobName: CronJobType = 'recurring-tournaments';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/tournaments', 'recurring');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Recurring tournaments completed in ${result.duration}ms`);
      logger.info(`Created: ${data?.created || 0}, Failed: ${data?.failed || 0}`);
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Tournament Autopilot Job
 * Runs every 5 minutes
 */
async function runAutopilotJob(): Promise<void> {
  const jobName: CronJobType = 'autopilot';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/autopilot');
    
    if (result.success) {
      const summary = (result.data as any)?.summary;
      logger.info(`Autopilot completed in ${result.duration}ms:`);
      logger.info(`  Registration auto-closed: ${summary?.registrationAutoClosed || 0}`);
      logger.info(`  Brackets generated: ${summary?.bracketsGenerated || 0}`);
      logger.info(`  Tournaments started: ${summary?.tournamentsStarted || 0}`);
      logger.info(`  Winners advanced: ${summary?.winnersAdvanced || 0}`);
      logger.info(`  Waitlist promotions: ${summary?.waitlistPromotions || 0}`);
      logger.info(`  Match reminders sent: ${summary?.matchRemindersSent || 0}`);
      
      if (summary?.errors?.length > 0) {
        logger.warn(`  Errors: ${summary.errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Tournament Completion Job
 * Runs every 5 minutes
 */
async function runCompletionJob(): Promise<void> {
  const jobName: CronJobType = 'completion';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/completion');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Completion completed in ${result.duration}ms:`);
      logger.info(`  Tournaments completed: ${data?.autoCompletion?.completed || 0}`);
      logger.info(`  Finalization windows processed: ${data?.finalizationWindows?.processed || 0}`);
      logger.info(`  Windows locked: ${data?.finalizationWindows?.locked || 0}`);
      
      if (data?.errors?.length > 0) {
        logger.warn(`  Errors: ${data.errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Governance Job
 * Runs every 30 minutes
 */
async function runGovernanceJob(): Promise<void> {
  const jobName: CronJobType = 'governance';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/governance', 'all');
    
    if (result.success) {
      const results = (result.data as any)?.results;
      logger.info(`Governance completed in ${result.duration}ms:`);
      
      if (results?.inactivity) {
        logger.info(`  Inactivity: ${results.inactivity.processed} processed, ${results.inactivity.flagged} flagged, ${results.inactivity.escalated} escalated`);
      }
      if (results?.escalations) {
        logger.info(`  Escalations: ${results.escalations.processed} processed`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Venue Flow Job
 * Runs every 2 minutes
 */
async function runVenueFlowJob(): Promise<void> {
  const jobName: CronJobType = 'venue-flow';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/venue-flow');
    
    if (result.success) {
      const summary = (result.data as any)?.summary;
      logger.info(`Venue Flow completed in ${result.duration}ms:`);
      logger.info(`  No-shows detected: ${summary?.noShowsDetected || 0}`);
      logger.info(`  Matches assigned: ${summary?.matchesAssigned || 0}`);
      logger.info(`  Matches queued: ${summary?.matchesQueued || 0}`);
      logger.info(`  Tournaments checked: ${summary?.tournamentsChecked || 0}`);
      logger.info(`  Health alerts: ${summary?.healthAlertsCreated || 0}`);
      
      if (summary?.errors?.length > 0) {
        logger.warn(`  Errors: ${summary.errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Finance Job
 * Runs every 10 minutes
 */
async function runFinanceJob(): Promise<void> {
  const jobName: CronJobType = 'finance';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/finance', 'all');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`Finance completed in ${result.duration}ms:`);
      
      if (data?.refunds) {
        logger.info(`  Refunds processed: ${data.refunds.processed || 0}, failed: ${data.refunds.failed || 0}`);
      }
      if (data?.recovery) {
        logger.info(`  Recovery attempts: ${data.recovery.attempted || 0}, recovered: ${data.recovery.recovered || 0}`);
      }
      
      if (data?.errors?.length > 0) {
        logger.warn(`  Errors: ${data.errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * Database Backup Job
 * Runs daily at 2:30 AM IST
 */
async function runBackupJob(): Promise<void> {
  const jobName: CronJobType = 'backup';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/backup', 'backup');
    
    if (result.success) {
      const backup = (result.data as any)?.backup;
      logger.info(`Database Backup completed in ${result.duration}ms:`);
      logger.info(`  Backup ID: ${backup?.id || 'N/A'}`);
      logger.info(`  Type: ${backup?.type || 'N/A'}`);
      logger.info(`  Size: ${backup?.size ? Math.round(backup.size / 1024) + ' KB' : 'N/A'}`);
      logger.info(`  Encrypted: ${backup?.encrypted || false}`);
      
      if ((result.data as any)?.error) {
        logger.warn(`  Error: ${(result.data as any).error}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * System Automation Job
 * Runs every 15 minutes
 */
async function runAutomationJob(): Promise<void> {
  const jobName: CronJobType = 'automation';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/automation', 'all');
    
    if (result.success) {
      const results = (result.data as any)?.results;
      logger.info(`Automation completed in ${result.duration}ms:`);
      
      if (results?.matchReminders) {
        logger.info(`  Match reminders: ${results.matchReminders.processed || 0} processed`);
      }
      if (results?.health) {
        logger.info(`  Health: ${results.health.overall || 'unknown'}, ${results.health.alerts || 0} alerts`);
      }
      if (results?.scheduledNotifications) {
        logger.info(`  Scheduled notifications: ${results.scheduledNotifications.processed || 0} processed`);
      }
      if (results?.batchedNotifications) {
        logger.info(`  Batched notifications: ${results.batchedNotifications.processed || 0} processed`);
      }
      
      const errors = (result.data as any)?.errors;
      if (errors?.length > 0) {
        logger.warn(`  Errors: ${errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

/**
 * No-Show Auto-Forfeit Job
 * Runs every 5 minutes
 */
async function runNoShowForfeitJob(): Promise<void> {
  const jobName: CronJobType = 'noshow-forfeit';
  const startTime = Date.now();
  logger.info(`Starting ${jobName} at ${new Date().toISOString()}`);
  
  updateJobStart(jobName);
  
  try {
    const result = await fetchCronEndpoint('/api/cron/noshow', 'forfeit');
    
    if (result.success) {
      const data = result.data as any;
      logger.info(`No-show forfeit completed in ${result.duration}ms:`);
      logger.info(`  Double forfeits: ${data?.doubleForfeits || 0}`);
      logger.info(`  Walkovers: ${data?.walkovers || 0}`);
      
      if (data?.errors?.length > 0) {
        logger.warn(`  Errors: ${data.errors.length}`);
      }
      
      updateJobSuccess(jobName, Date.now() - startTime);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateJobFailure(jobName, errorMsg, duration);
    logger.error(`${jobName} failed after ${duration}ms: ${errorMsg}`);
  }
}

// ============================================
// HTTP Status Server
// ============================================

import http from 'http';

const statusServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      jobs: Object.fromEntries(jobStatuses),
    }));
    return;
  }
  
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jobs: Object.fromEntries(jobStatuses),
      uptime: process.uptime(),
    }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// Schedule Jobs
// ============================================

function scheduleJobs() {
  // Daily cleanup - 2:00 AM IST
  cron.schedule('0 2 * * *', runDailyCleanupJob, { timezone: TIMEZONE });
  
  // Weekly cleanup - Sunday 3:00 AM IST
  cron.schedule('0 3 * * 0', runWeeklyCleanupJob, { timezone: TIMEZONE });
  
  // SLI aggregation - every 5 minutes
  cron.schedule('*/5 * * * *', runSliAggregationJob, { timezone: TIMEZONE });
  
  // Cache warming - every 10 minutes
  cron.schedule('*/10 * * * *', runCacheWarmingJob, { timezone: TIMEZONE });
  
  // ELO job queue - every minute
  cron.schedule('* * * * *', runEloJobQueueJob, { timezone: TIMEZONE });
  
  // Recurring tournaments - every hour
  cron.schedule('0 * * * *', runRecurringTournamentJob, { timezone: TIMEZONE });
  
  // Autopilot - every 5 minutes
  cron.schedule('*/5 * * * *', runAutopilotJob, { timezone: TIMEZONE });
  
  // Completion - every 5 minutes
  cron.schedule('*/5 * * * *', runCompletionJob, { timezone: TIMEZONE });
  
  // Governance - every 30 minutes
  cron.schedule('*/30 * * * *', runGovernanceJob, { timezone: TIMEZONE });
  
  // Venue flow - every 2 minutes
  cron.schedule('*/2 * * * *', runVenueFlowJob, { timezone: TIMEZONE });
  
  // Finance - every 10 minutes
  cron.schedule('*/10 * * * *', runFinanceJob, { timezone: TIMEZONE });
  
  // Backup - daily at 2:30 AM IST
  cron.schedule('30 2 * * *', runBackupJob, { timezone: TIMEZONE });
  
  // Automation - every 15 minutes
  cron.schedule('*/15 * * * *', runAutomationJob, { timezone: TIMEZONE });
  
  // No-show forfeit - every 5 minutes
  cron.schedule('*/5 * * * *', runNoShowForfeitJob, { timezone: TIMEZONE });
  
  logger.info('All cron jobs scheduled');
}

// ============================================
// Startup
// ============================================

statusServer.listen(CRON_PORT, () => {
  logger.info(`VALORHIVE Cron Service running on port ${CRON_PORT}`);
  logger.info(`Timezone: ${TIMEZONE}`);
  logger.info(`Health endpoint: http://localhost:${CRON_PORT}/health`);
  
  scheduleJobs();
  
  logger.info('Cron service started successfully');
});

// Stats logging
setInterval(() => {
  const runningJobs = Array.from(jobStatuses.values()).filter(j => j.status === 'running').length;
  const successRate = jobStatuses.size > 0 
    ? Math.round((Array.from(jobStatuses.values()).reduce((acc, j) => acc + j.successCount, 0) / 
                  Array.from(jobStatuses.values()).reduce((acc, j) => acc + j.runCount, 0)) * 100) || 0
    : 0;
  
  logger.info(`Stats: ${jobStatuses.size} jobs tracked, ${runningJobs} running, ${successRate}% success rate`);
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  statusServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  statusServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
