/**
 * Job Queue Workers for VALORHIVE
 * 
 * Worker processes for handling background jobs:
 * - Email sending
 * - Notification processing
 * - Analytics computation
 * - Tournament scheduling
 * - Financial operations
 */

import { Worker, Job } from 'bullmq';
import { 
  notificationQueue, 
  emailQueue, 
  analyticsQueue, 
  scheduledQueue,
  financialQueue,
  getRedisConnection,
  type EmailJobData,
  type NotificationJobData,
  type AnalyticsJobData,
  type ReportJobData,
  type TournamentReminderJobData,
  type RefundJobData,
} from './job-queue';
import { db } from './db';
import { log } from './logger';
import { sendEmail as sendEmailViaService } from './email-service';

// ============================================
// Worker Configuration
// ============================================

const WORKER_CONFIG = {
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  limiter: {
    max: 100,
    duration: 1000, // 100 jobs per second
  },
};

// ============================================
// Email Worker
// ============================================

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, template, data, attachments } = job.data;

  log.info(`Processing email job ${job.id}`, {
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    template,
  });

  try {
    await sendEmailViaService({
      to,
      subject,
      template,
      data,
      attachments,
    });

    log.info(`Email sent successfully`, { jobId: job.id, to });
  } catch (error) {
    log.error(`Failed to send email`, { 
      jobId: job.id, 
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

const emailWorker = new Worker<EmailJobData>(
  'emails',
  processEmailJob,
  {
    connection: getRedisConnection(),
    ...WORKER_CONFIG,
  }
);

// ============================================
// Notification Worker
// ============================================

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, title, message, link, data } = job.data;

  log.info(`Processing notification job ${job.id}`, {
    userId,
    type,
    title,
  });

  try {
    // Create notification in database
    const notification = await db.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        link,
      },
    });

    // Could also send push notification here
    // await sendPushNotification(userId, title, message);

    log.info(`Notification created`, { 
      jobId: job.id, 
      notificationId: notification.id,
      userId,
    });
  } catch (error) {
    log.error(`Failed to process notification`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  processNotificationJob,
  {
    connection: getRedisConnection(),
    ...WORKER_CONFIG,
  }
);

// ============================================
// Analytics Worker
// ============================================

async function processAnalyticsJob(job: Job<AnalyticsJobData | ReportJobData>): Promise<void> {
  const jobData = job.data;

  if ('reportType' in jobData) {
    // Report generation job
    return processReportJob(job as Job<ReportJobData>);
  }

  const { sport, scope, period } = jobData as AnalyticsJobData;

  log.info(`Processing analytics job ${job.id}`, {
    sport,
    scope,
    period,
  });

  try {
    // Calculate analytics based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get stats
    const [matches, registrations, revenue] = await Promise.all([
      db.match.count({
        where: {
          sport: sport as any,
          createdAt: { gte: startDate },
        },
      }),
      db.tournamentRegistration.count({
        where: {
          createdAt: { gte: startDate },
          tournament: { sport: sport as any },
        },
      }),
      db.paymentLedger.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: 'PAID',
        },
        _sum: { amount: true },
      }),
    ]);

    // Store analytics snapshot
    await db.systemMetrics.create({
      data: {
        sport: sport as any,
        metricType: `${period.toUpperCase()}_ANALYTICS`,
        value: JSON.stringify({
          matches,
          registrations,
          revenue: revenue._sum.amount || 0,
          scope,
          period,
        }),
        recordedAt: now,
      },
    });

    log.info(`Analytics processed`, {
      jobId: job.id,
      matches,
      registrations,
      revenue: revenue._sum.amount,
    });
  } catch (error) {
    log.error(`Failed to process analytics`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function processReportJob(job: Job<ReportJobData>): Promise<void> {
  const { reportType, sport, dateRange, requesterId, format = 'json' } = job.data;

  log.info(`Processing report job ${job.id}`, {
    reportType,
    sport,
    requesterId,
  });

  try {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Generate report based on type
    let reportData: Record<string, unknown> = {};

    switch (reportType) {
      case 'tournament_summary':
        const tournaments = await db.tournament.findMany({
          where: {
            sport: sport as any,
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
          include: {
            _count: { select: { registrations: true, matches: true } },
          },
        });
        reportData = { tournaments };
        break;

      case 'player_stats':
        const players = await db.user.findMany({
          where: {
            sport: sport as any,
            updatedAt: { gte: startDate },
          },
          include: { rating: true },
        });
        reportData = { players };
        break;

      case 'financial':
        const payments = await db.paymentLedger.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        });
        reportData = { payments };
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    // Store report
    const report = await db.generatedReport.create({
      data: {
        type: reportType,
        sport: sport as any,
        requesterId,
        data: JSON.stringify(reportData),
        format,
        generatedAt: new Date(),
      },
    });

    // Notify requester
    await db.notification.create({
      data: {
        userId: requesterId,
        sport: sport as any,
        type: 'REPORT_READY',
        title: 'Report Ready',
        message: `Your ${reportType} report is ready`,
        link: `/reports/${report.id}`,
      },
    });

    log.info(`Report generated`, {
      jobId: job.id,
      reportId: report.id,
      reportType,
    });
  } catch (error) {
    log.error(`Failed to generate report`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

const analyticsWorker = new Worker<AnalyticsJobData | ReportJobData>(
  'analytics',
  processAnalyticsJob,
  {
    connection: getRedisConnection(),
    concurrency: 2, // Lower concurrency for heavy jobs
  }
);

// ============================================
// Scheduled Jobs Worker
// ============================================

async function processScheduledJob(job: Job<TournamentReminderJobData>): Promise<void> {
  const { tournamentId, userId, reminderType, scheduledFor } = job.data;

  log.info(`Processing scheduled job ${job.id}`, {
    tournamentId,
    userId,
    reminderType,
    scheduledFor,
  });

  try {
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      log.warn(`Tournament not found for reminder`, { tournamentId });
      return;
    }

    // Create notification
    let title = '';
    let message = '';
    let link = `/tournaments/${tournamentId}`;

    switch (reminderType) {
      case 'registration_closing':
        title = 'Registration Closing Soon';
        message = `Registration for ${tournament.name} closes soon. Don't miss out!`;
        break;
      case 'check_in':
        title = 'Time to Check In';
        message = `Please check in for ${tournament.name}`;
        break;
      case 'match_upcoming':
        title = 'Match Coming Up';
        message = `Your match at ${tournament.name} is coming up soon`;
        break;
      case 'tournament_starting':
        title = 'Tournament Starting';
        message = `${tournament.name} is about to begin!`;
        break;
    }

    await db.notification.create({
      data: {
        userId,
        sport: tournament.sport,
        type: 'TOURNAMENT_REMINDER',
        title,
        message,
        link,
      },
    });

    log.info(`Reminder sent`, { jobId: job.id, userId, reminderType });
  } catch (error) {
    log.error(`Failed to process reminder`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

const scheduledWorker = new Worker<TournamentReminderJobData>(
  'scheduled',
  processScheduledJob,
  {
    connection: getRedisConnection(),
    ...WORKER_CONFIG,
  }
);

// ============================================
// Financial Worker
// ============================================

async function processFinancialJob(job: Job<RefundJobData>): Promise<void> {
  const { paymentId, amount, reason, userId } = job.data;

  log.info(`Processing financial job ${job.id}`, {
    paymentId,
    amount,
    userId,
  });

  try {
    // Get payment record
    const payment = await db.paymentLedger.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Process refund via payment gateway
    // This would integrate with Razorpay or similar
    // const refundResult = await processRazorpayRefund(payment.gatewayId, amount);

    // Update payment record
    await db.paymentLedger.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundAmount: amount,
        refundReason: reason,
      },
    });

    // Create notification for user
    await db.notification.create({
      data: {
        userId,
        sport: payment.sport,
        type: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `Your refund of ₹${(amount / 100).toFixed(2)} has been processed.`,
      },
    });

    log.info(`Refund processed`, { jobId: job.id, paymentId, amount });
  } catch (error) {
    log.error(`Failed to process refund`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

const financialWorker = new Worker<RefundJobData>(
  'financial',
  processFinancialJob,
  {
    connection: getRedisConnection(),
    concurrency: 2, // Lower concurrency for financial operations
  }
);

// ============================================
// Worker Event Handlers
// ============================================

const setupWorkerEvents = (worker: Worker, name: string) => {
  worker.on('completed', (job: Job) => {
    log.info(`[${name}] Job completed`, { jobId: job.id });
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    log.error(`[${name}] Job failed`, {
      jobId: job?.id,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (error: Error) => {
    log.error(`[${name}] Worker error`, { error: error.message });
  });

  worker.on('stalled', (jobId: string) => {
    log.warn(`[${name}] Job stalled`, { jobId });
  });
};

setupWorkerEvents(emailWorker, 'email');
setupWorkerEvents(notificationWorker, 'notification');
setupWorkerEvents(analyticsWorker, 'analytics');
setupWorkerEvents(scheduledWorker, 'scheduled');
setupWorkerEvents(financialWorker, 'financial');

// ============================================
// Export workers for management
// ============================================

export const workers = {
  email: emailWorker,
  notification: notificationWorker,
  analytics: analyticsWorker,
  scheduled: scheduledWorker,
  financial: financialWorker,
};

/**
 * Start all workers
 */
export async function startWorkers(): Promise<void> {
  log.info('Starting all job queue workers');
  // Workers are already started when created
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  log.info('Stopping all job queue workers');
  
  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
    analyticsWorker.close(),
    scheduledWorker.close(),
    financialWorker.close(),
  ]);
  
  log.info('All workers stopped');
}

/**
 * Get worker statistics
 */
export async function getWorkerStats(): Promise<Record<string, { isRunning: boolean; name: string }>> {
  return {
    email: { isRunning: emailWorker.isRunning(), name: 'email' },
    notification: { isRunning: notificationWorker.isRunning(), name: 'notification' },
    analytics: { isRunning: analyticsWorker.isRunning(), name: 'analytics' },
    scheduled: { isRunning: scheduledWorker.isRunning(), name: 'scheduled' },
    financial: { isRunning: financialWorker.isRunning(), name: 'financial' },
  };
}
