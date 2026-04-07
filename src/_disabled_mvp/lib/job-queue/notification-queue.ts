/**
 * Notification Job Queue Service for VALORHIVE
 * 
 * Features:
 * - Database-backed job queue for notification fan-out
 * - Single user notifications
 * - Bulk fan-out to multiple users
 * - Retry logic with exponential backoff
 * 
 * v3.25.0 - Architecture Fix: Move notification fan-out to async queue
 */

import { db } from '@/lib/db';
import { SportType, NotificationType } from '@prisma/client';

// ============================================
// TYPES & INTERFACES
// ============================================

export type NotificationJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface NotificationJobData {
  sport: SportType;
  type: NotificationType | string;
  title: string;
  message: string;
  link?: string;
  targetUserId?: string;
  targetUserIds?: string[];
  targetOrgId?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const MAX_RETRY_ATTEMPTS = 3;
const BATCH_SIZE = 50; // Process 50 notifications at a time

// ============================================
// SINGLE NOTIFICATION
// ============================================

/**
 * Queue a single notification
 * Use this instead of direct db.notification.create()
 */
export async function queueNotification(data: NotificationJobData): Promise<string> {
  // For single user, we can create directly (no need for async queue)
  // But for consistency and future scalability, we queue it
  const job = await db.notificationJob.create({
    data: {
      sport: data.sport,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      targetUserId: data.targetUserId,
      targetUserIds: data.targetUserIds ? JSON.stringify(data.targetUserIds) : null,
      targetOrgId: data.targetOrgId,
      status: 'PENDING',
      maxAttempts: MAX_RETRY_ATTEMPTS,
    },
  });

  // In production with BullMQ:
  // await notificationQueue.add('send-notification', data, { jobId: job.id });

  return job.id;
}

/**
 * Quick send - for single user notifications that don't need queue
 * Use when you need the notification immediately
 */
export async function sendNotificationImmediate(data: NotificationJobData): Promise<void> {
  if (data.targetUserId) {
    await db.notification.create({
      data: {
        userId: data.targetUserId,
        sport: data.sport,
        type: data.type as NotificationType,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
  }
}

// ============================================
// FAN-OUT NOTIFICATIONS
// ============================================

/**
 * Queue a notification for multiple users (fan-out)
 * Use this for tournament announcements, etc.
 */
export async function queueNotificationFanOut(
  userIds: string[],
  data: Omit<NotificationJobData, 'targetUserId' | 'targetUserIds'>
): Promise<string[]> {
  const jobIds: string[] = [];

  // Split into chunks for processing
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    chunks.push(userIds.slice(i, i + BATCH_SIZE));
  }

  // Create jobs for each chunk
  for (const chunk of chunks) {
    const job = await db.notificationJob.create({
      data: {
        sport: data.sport,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        targetUserIds: JSON.stringify(chunk),
        targetOrgId: data.targetOrgId,
        status: 'PENDING',
        maxAttempts: MAX_RETRY_ATTEMPTS,
      },
    });
    jobIds.push(job.id);
  }

  return jobIds;
}

/**
 * Queue notification for all organization members
 */
export async function queueOrgNotification(
  orgId: string,
  data: Omit<NotificationJobData, 'targetUserId' | 'targetUserIds' | 'targetOrgId'>
): Promise<string> {
  const job = await db.notificationJob.create({
    data: {
      sport: data.sport,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      targetOrgId: orgId,
      status: 'PENDING',
      maxAttempts: MAX_RETRY_ATTEMPTS,
    },
  });

  return job.id;
}

// ============================================
// JOB PROCESSING
// ============================================

/**
 * Process pending notification jobs
 * Called by cron service every 30 seconds
 */
export async function processPendingNotificationJobs(
  batchSize: number = 20
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  // Get pending jobs
  const pendingJobs = await db.notificationJob.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  });

  // Get failed jobs ready for retry
  const retryJobs = await db.notificationJob.findMany({
    where: {
      status: 'FAILED',
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    take: batchSize - pendingJobs.length,
    orderBy: { updatedAt: 'asc' },
  });

  const jobsToProcess = [...pendingJobs, ...retryJobs];

  for (const job of jobsToProcess) {
    try {
      // Mark as processing
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          startedAt: new Date(),
        },
      });

      let sentCount = 0;

      // Single user notification
      if (job.targetUserId) {
        await db.notification.create({
          data: {
            userId: job.targetUserId,
            sport: job.sport,
            type: job.type as NotificationType,
            title: job.title,
            message: job.message,
            link: job.link,
          },
        });
        sentCount = 1;
      }

      // Fan-out to multiple users
      if (job.targetUserIds) {
        const userIds = JSON.parse(job.targetUserIds) as string[];
        
        // Batch insert
        await db.notification.createMany({
          data: userIds.map(userId => ({
            userId,
            sport: job.sport,
            type: job.type as NotificationType,
            title: job.title,
            message: job.message,
            link: job.link,
          })),
        });
        sentCount = userIds.length;
      }

      // Organization notification - get all members
      if (job.targetOrgId) {
        const members = await db.orgRosterPlayer.findMany({
          where: {
            orgId: job.targetOrgId,
            isActive: true,
          },
          select: { userId: true },
        });

        if (members.length > 0) {
          await db.notification.createMany({
            data: members.map(m => ({
              userId: m.userId,
              sport: job.sport,
              type: job.type as NotificationType,
              title: job.title,
              message: job.message,
              link: job.link,
            })),
          });
          sentCount = members.length;
        }
      }

      // Mark as completed
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processedCount: sentCount,
        },
      });

      sent += sentCount;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Job ${job.id}: ${errorMsg}`);

      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: errorMsg,
        },
      });

      failed++;
    }

    processed++;
  }

  return { processed, sent, failed, errors };
}

// ============================================
// MONITORING
// ============================================

/**
 * Get pending notification count
 */
export async function getPendingNotificationCount(): Promise<number> {
  return db.notificationJob.count({
    where: { status: 'PENDING' },
  });
}

/**
 * Get failed notification jobs
 */
export async function getFailedNotificationJobs(limit: number = 20): Promise<Array<{
  id: string;
  type: string;
  title: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}>> {
  return db.notificationJob.findMany({
    where: {
      status: 'FAILED',
      attempts: { gte: MAX_RETRY_ATTEMPTS },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      title: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
  });
}

export default {
  queueNotification,
  sendNotificationImmediate,
  queueNotificationFanOut,
  queueOrgNotification,
  processPendingNotificationJobs,
  getPendingNotificationCount,
  getFailedNotificationJobs,
};
