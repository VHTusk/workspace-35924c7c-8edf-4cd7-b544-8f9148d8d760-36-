/**
 * VALORHIVE Notification Fanout Service
 * 
 * Implements notification batching and fanout to prevent notification storms:
 * - NotificationBatch for grouping notifications
 * - FanoutQueue for distributing to channel workers
 * - DeduplicationKey generator: userId + eventId + type
 * - Batch window: 30 seconds (configurable)
 * - Max batch size: 100 notifications
 * 
 * Channel Workers:
 * - Email worker (existing SendGrid integration)
 * - Push worker (existing FCM integration)
 * - WhatsApp worker (existing integration)
 * - In-app notification worker
 * 
 * Batching Rules:
 * - Tournament reminder: batch all players in single job
 * - Match result: individual (high priority)
 * - Daily digest: batch all non-urgent
 * - Admin broadcast: dedicated queue
 */

import { Queue, Worker, Job } from 'bullmq';
import { db } from './db';
import { SportType } from '@prisma/client';
import { getPrimaryClient } from './redis-config';
import { sendPushNotification, sendBulkPushNotifications } from './push-notifications';
import { sendTemplatedWhatsApp, WhatsAppTemplates } from './whatsapp';
import { createNotification } from './notifications';
import { emailService } from './email-service';
import { createLogger } from './logger';

const logger = createLogger('NotificationFanout');

// ============================================
// Types and Interfaces
// ============================================

export type NotificationChannel = 'email' | 'push' | 'whatsapp' | 'in-app';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';
export type NotificationBatchType = 'tournament_reminder' | 'match_result' | 'daily_digest' | 'admin_broadcast' | 'tournament_update' | 'player_notification';

export interface FanoutNotification {
  id: string;
  userId: string;
  sport: SportType;
  type: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  eventId?: string;
  data?: Record<string, unknown>;
  link?: string;
  createdAt: Date;
}

export interface NotificationBatchConfig {
  batchWindowMs: number;        // Time window for batching (default: 30 seconds)
  maxBatchSize: number;         // Max notifications per batch (default: 100)
  enableDeduplication: boolean; // Prevent duplicate notifications
  dedupWindowHours: number;     // Dedup window (default: 24 hours)
}

export interface ChannelWorkerResult {
  channel: NotificationChannel;
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
  duration: number;
}

export interface FanoutMetrics {
  queueDepth: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  deliverySuccessRate: number;
  providerErrors: Record<NotificationChannel, number>;
  lastProcessedAt?: Date;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_BATCH_CONFIG: NotificationBatchConfig = {
  batchWindowMs: parseInt(process.env.NOTIFICATION_BATCH_WINDOW_MS || '30000', 10), // 30 seconds
  maxBatchSize: parseInt(process.env.NOTIFICATION_MAX_BATCH_SIZE || '100', 10),
  enableDeduplication: process.env.NOTIFICATION_DEDUP_ENABLED !== 'false',
  dedupWindowHours: parseInt(process.env.NOTIFICATION_DEDUP_WINDOW_HOURS || '24', 10),
};

const PRIORITY_VALUES: Record<NotificationPriority, number> = {
  urgent: 1,
  high: 10,
  normal: 50,
  low: 100,
};

// ============================================
// Deduplication Key Generator
// ============================================

/**
 * Generate a deduplication key for a notification
 * Format: userId:eventId:type
 */
export function generateDedupKey(notification: FanoutNotification): string {
  const parts = [
    notification.userId,
    notification.eventId || 'no-event',
    notification.type,
  ];
  return parts.join(':');
}

/**
 * Generate a batch key for grouping notifications
 */
export function generateBatchKey(
  type: NotificationBatchType,
  sport: SportType,
  eventId?: string
): string {
  return `batch:${type}:${sport}:${eventId || 'general'}`;
}

// ============================================
// Notification Batch Class
// ============================================

export class NotificationBatch {
  private notifications: FanoutNotification[] = [];
  private config: NotificationBatchConfig;
  private batchKey: string;
  private createdAt: Date;
  private flushTimer?: NodeJS.Timeout;
  private onFlush: (batch: NotificationBatch) => Promise<void>;

  constructor(
    batchKey: string,
    config: NotificationBatchConfig,
    onFlush: (batch: NotificationBatch) => Promise<void>
  ) {
    this.batchKey = batchKey;
    this.config = config;
    this.createdAt = new Date();
    this.onFlush = onFlush;
  }

  /**
   * Add a notification to the batch
   */
  add(notification: FanoutNotification): boolean {
    if (this.notifications.length >= this.config.maxBatchSize) {
      return false;
    }

    this.notifications.push(notification);

    // Start flush timer on first notification
    if (this.notifications.length === 1) {
      this.startFlushTimer();
    }

    // Flush immediately if batch is full
    if (this.notifications.length >= this.config.maxBatchSize) {
      this.flush();
    }

    return true;
  }

  /**
   * Get all notifications in the batch
   */
  getNotifications(): FanoutNotification[] {
    return [...this.notifications];
  }

  /**
   * Get batch size
   */
  size(): number {
    return this.notifications.length;
  }

  /**
   * Get batch key
   */
  getKey(): string {
    return this.batchKey;
  }

  /**
   * Get batch age in milliseconds
   */
  age(): number {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.batchWindowMs);
  }

  /**
   * Flush the batch
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.notifications.length === 0) {
      return;
    }

    await this.onFlush(this);
    this.notifications = [];
    this.createdAt = new Date();
  }

  /**
   * Check if batch is ready to flush
   */
  isReadyToFlush(): boolean {
    return (
      this.notifications.length >= this.config.maxBatchSize ||
      this.age() >= this.config.batchWindowMs
    );
  }
}

// ============================================
// Fanout Queue Class
// ============================================

export class FanoutQueue {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private batches: Map<string, NotificationBatch> = new Map();
  private config: NotificationBatchConfig;
  private initialized = false;
  private connection: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
  };

  constructor(config: NotificationBatchConfig = DEFAULT_BATCH_CONFIG) {
    this.config = config;
    
    // Parse Redis connection from environment
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const parsed = new URL(redisUrl);
      this.connection = {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10),
        password: parsed.password || undefined,
        maxRetriesPerRequest: null,
      };
    } else {
      this.connection = {
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
      };
    }
  }

  /**
   * Initialize the fanout queue
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create BullMQ queue
      this.queue = new Queue('notification-fanout', {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      // Create worker
      this.worker = new Worker(
        'notification-fanout',
        this.processJob.bind(this),
        {
          connection: this.connection,
          concurrency: 10,
          limiter: {
            max: 100,
            duration: 1000,
          },
        }
      );

      this.worker.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed`);
      });

      this.worker.on('failed', (job, error) => {
        logger.error(`Job ${job?.id} failed:`, error);
      });

      this.initialized = true;
      logger.info('Fanout queue initialized');
    } catch (error) {
      logger.error('Failed to initialize fanout queue:', error);
      throw error;
    }
  }

  /**
   * Queue a notification for fanout
   */
  async queueNotification(notification: FanoutNotification): Promise<{ queued: boolean; batchKey?: string }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Determine batching strategy based on notification type
    const batchType = this.getBatchType(notification.type, notification.priority);
    const batchKey = generateBatchKey(batchType, notification.sport, notification.eventId);

    // Urgent notifications skip batching
    if (notification.priority === 'urgent') {
      await this.addJob(notification, batchKey);
      return { queued: true, batchKey };
    }

    // Match results are always individual (high priority)
    if (batchType === 'match_result') {
      await this.addJob(notification, batchKey);
      return { queued: true, batchKey };
    }

    // Get or create batch
    let batch = this.batches.get(batchKey);
    if (!batch) {
      batch = new NotificationBatch(batchKey, this.config, this.flushBatch.bind(this));
      this.batches.set(batchKey, batch);
    }

    // Add to batch
    const added = batch.add(notification);
    
    if (!added) {
      // Batch is full, flush and create new one
      await batch.flush();
      batch = new NotificationBatch(batchKey, this.config, this.flushBatch.bind(this));
      this.batches.set(batchKey, batch);
      batch.add(notification);
    }

    return { queued: true, batchKey };
  }

  /**
   * Queue multiple notifications (bulk operation)
   */
  async queueNotifications(notifications: FanoutNotification[]): Promise<{
    queued: number;
    failed: number;
  }> {
    let queued = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        await this.queueNotification(notification);
        queued++;
      } catch (error) {
        logger.error('Failed to queue notification:', error);
        failed++;
      }
    }

    return { queued, failed };
  }

  /**
   * Get batch type from notification type and priority
   */
  private getBatchType(type: string, priority: NotificationPriority): NotificationBatchType {
    // Tournament reminders batch all players
    if (type.includes('TOURNAMENT') && type.includes('REMINDER')) {
      return 'tournament_reminder';
    }

    // Match results are always individual
    if (type === 'MATCH_RESULT') {
      return 'match_result';
    }

    // Admin broadcasts have dedicated queue
    if (type === 'ADMIN_BROADCAST') {
      return 'admin_broadcast';
    }

    // Tournament updates
    if (type.includes('TOURNAMENT')) {
      return 'tournament_update';
    }

    // Daily digest for low priority
    if (priority === 'low') {
      return 'daily_digest';
    }

    // Default to player notification
    return 'player_notification';
  }

  /**
   * Add a job to the BullMQ queue
   */
  private async addJob(notification: FanoutNotification, batchKey: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.add('fanout', {
      notifications: [notification],
      batchKey,
      createdAt: new Date().toISOString(),
    }, {
      priority: PRIORITY_VALUES[notification.priority],
    });
  }

  /**
   * Flush a batch to the queue
   */
  private async flushBatch(batch: NotificationBatch): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const notifications = batch.getNotifications();
    if (notifications.length === 0) {
      return;
    }

    // Use highest priority in batch
    const highestPriority = notifications.reduce((highest, n) => {
      return PRIORITY_VALUES[n.priority] < PRIORITY_VALUES[highest] ? n.priority : highest;
    }, 'normal' as NotificationPriority);

    await this.queue.add('fanout', {
      notifications,
      batchKey: batch.getKey(),
      createdAt: new Date().toISOString(),
    }, {
      priority: PRIORITY_VALUES[highestPriority],
    });

    // Remove batch from tracking
    this.batches.delete(batch.getKey());
  }

  /**
   * Process a fanout job
   */
  private async processJob(job: Job): Promise<ChannelWorkerResult[]> {
    const { notifications, batchKey } = job.data;
    const results: ChannelWorkerResult[] = [];

    logger.info(`Processing ${notifications.length} notifications for batch: ${batchKey}`);

    // Group notifications by channel
    const byChannel = new Map<NotificationChannel, FanoutNotification[]>();
    for (const notification of notifications) {
      for (const channel of notification.channels) {
        if (!byChannel.has(channel)) {
          byChannel.set(channel, []);
        }
        byChannel.get(channel)!.push(notification);
      }
    }

    // Process each channel
    for (const [channel, channelNotifications] of byChannel) {
      const startTime = Date.now();
      
      try {
        const result = await this.processChannel(channel, channelNotifications);
        results.push({
          channel,
          success: result.success,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          error: result.error,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          channel,
          success: false,
          sentCount: 0,
          failedCount: channelNotifications.length,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Process notifications for a specific channel
   */
  private async processChannel(
    channel: NotificationChannel,
    notifications: FanoutNotification[]
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; error?: string }> {
    switch (channel) {
      case 'push':
        return this.processPushChannel(notifications);
      case 'email':
        return this.processEmailChannel(notifications);
      case 'whatsapp':
        return this.processWhatsAppChannel(notifications);
      case 'in-app':
        return this.processInAppChannel(notifications);
      default:
        return { success: false, sentCount: 0, failedCount: notifications.length, error: 'Unknown channel' };
    }
  }

  /**
   * Process push notifications
   */
  private async processPushChannel(notifications: FanoutNotification[]): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    error?: string;
  }> {
    let sentCount = 0;
    let failedCount = 0;

    // Group by user for bulk sending
    const userNotifications = new Map<string, FanoutNotification[]>();
    for (const n of notifications) {
      if (!userNotifications.has(n.userId)) {
        userNotifications.set(n.userId, []);
      }
      userNotifications.get(n.userId)!.push(n);
    }

    for (const [userId, userNotifs] of userNotifications) {
      // Send the most recent/important notification for the user
      const notification = userNotifs[0];
      
      try {
        const result = await sendPushNotification(
          userId,
          notification.title,
          notification.message,
          notification.data as Record<string, string>,
          {
            priority: notification.priority === 'urgent' || notification.priority === 'high' ? 'high' : 'normal',
            bypassQuietHours: notification.priority === 'urgent',
          }
        );

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        logger.error('Failed to send push notification:', error);
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * Process email notifications
   */
  private async processEmailChannel(notifications: FanoutNotification[]): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    error?: string;
  }> {
    let sentCount = 0;
    let failedCount = 0;

    // Get user emails
    const userIds = [...new Set(notifications.map(n => n.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    for (const notification of notifications) {
      const user = userMap.get(notification.userId);
      if (!user?.email) {
        failedCount++;
        continue;
      }

      try {
        await emailService.sendTournamentReminder(
          { email: user.email, name: `${user.firstName} ${user.lastName}` },
          {
            userId: user.id,
            sport: notification.sport,
            recipientName: `${user.firstName} ${user.lastName}`,
            tournamentName: notification.data?.tournamentName as string || notification.title,
            tournamentDate: notification.data?.tournamentDate as string || new Date().toISOString(),
            venue: notification.data?.venue as string || '',
            matchTime: notification.data?.matchTime as string || '',
            opponentName: notification.data?.opponentName as string || '',
            hoursUntilStart: (notification.data?.hoursUntilStart as number) || 1,
            tournamentUrl: notification.link || '',
          }
        );
        sentCount++;
      } catch (error) {
        logger.error('Failed to send email:', error);
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * Process WhatsApp notifications
   */
  private async processWhatsAppChannel(notifications: FanoutNotification[]): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    error?: string;
  }> {
    let sentCount = 0;
    let failedCount = 0;

    // Get user phones
    const userIds = [...new Set(notifications.map(n => n.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, phone: true, firstName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    for (const notification of notifications) {
      const user = userMap.get(notification.userId);
      if (!user?.phone) {
        failedCount++;
        continue;
      }

      try {
        const template = this.getWhatsAppTemplate(notification.type);
        await sendTemplatedWhatsApp(user.phone, template, {
          playerName: user.firstName,
          sport: notification.sport,
          ...notification.data,
        });
        sentCount++;
      } catch (error) {
        logger.error('Failed to send WhatsApp:', error);
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * Process in-app notifications
   */
  private async processInAppChannel(notifications: FanoutNotification[]): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    error?: string;
  }> {
    let sentCount = 0;
    let failedCount = 0;

    for (const notification of notifications) {
      try {
        await createNotification({
          userId: notification.userId,
          sport: notification.sport,
          type: notification.type as any,
          title: notification.title,
          message: notification.message,
          link: notification.link,
        });
        sentCount++;
      } catch (error) {
        logger.error('Failed to create in-app notification:', error);
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * Get WhatsApp template for notification type
   */
  private getWhatsAppTemplate(type: string): string {
    const templateMap: Record<string, string> = {
      'MATCH_RESULT': WhatsAppTemplates.MATCH_RESULT,
      'TOURNAMENT_REMINDER': WhatsAppTemplates.TOURNAMENT_REMINDER,
      'WAITLIST_PROMOTED': WhatsAppTemplates.WAITLIST_PROMOTED,
    };
    return templateMap[type] || WhatsAppTemplates.TOURNAMENT_REMINDER;
  }

  /**
   * Get fanout queue metrics
   */
  async getMetrics(): Promise<FanoutMetrics> {
    if (!this.queue) {
      return {
        queueDepth: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        deliverySuccessRate: 0,
        providerErrors: { email: 0, push: 0, whatsapp: 0, 'in-app': 0 },
      };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    const total = completed + failed;
    const successRate = total > 0 ? completed / total : 0;

    return {
      queueDepth: waiting,
      activeJobs: active,
      completedJobs: completed,
      failedJobs: failed,
      deliverySuccessRate: successRate,
      providerErrors: { email: 0, push: 0, whatsapp: 0, 'in-app': 0 },
    };
  }

  /**
   * Flush all pending batches
   */
  async flushAllBatches(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    for (const batch of this.batches.values()) {
      flushPromises.push(batch.flush());
    }

    await Promise.allSettled(flushPromises);
  }

  /**
   * Close the fanout queue
   */
  async close(): Promise<void> {
    // Flush all pending batches
    await this.flushAllBatches();

    // Close worker and queue
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }

    this.initialized = false;
    logger.info('Fanout queue closed');
  }
}

// ============================================
// Singleton Instance
// ============================================

let fanoutQueue: FanoutQueue | null = null;

/**
 * Get the fanout queue instance
 */
export function getFanoutQueue(): FanoutQueue {
  if (!fanoutQueue) {
    fanoutQueue = new FanoutQueue();
  }
  return fanoutQueue;
}

/**
 * Initialize the fanout queue
 */
export async function initializeFanoutQueue(): Promise<void> {
  const queue = getFanoutQueue();
  await queue.initialize();
}

/**
 * Queue a notification for fanout
 */
export async function queueNotification(
  notification: FanoutNotification
): Promise<{ queued: boolean; batchKey?: string }> {
  const queue = getFanoutQueue();
  
  if (!queue['initialized']) {
    await queue.initialize();
  }

  return queue.queueNotification(notification);
}

/**
 * Queue multiple notifications
 */
export async function queueNotifications(
  notifications: FanoutNotification[]
): Promise<{ queued: number; failed: number }> {
  const queue = getFanoutQueue();
  
  if (!queue['initialized']) {
    await queue.initialize();
  }

  return queue.queueNotifications(notifications);
}

/**
 * Get fanout queue metrics
 */
export async function getFanoutMetrics(): Promise<FanoutMetrics> {
  const queue = getFanoutQueue();
  return queue.getMetrics();
}

// ============================================
// Batch Rule Helpers
// ============================================

/**
 * Create tournament reminder notifications for all players
 */
export async function createTournamentReminderBatch(
  tournamentId: string,
  sport: SportType,
  players: Array<{ id: string; email?: string; phone?: string }>,
  tournamentData: {
    name: string;
    startTime: Date;
    venue: string;
    hoursUntilStart: number;
    tournamentUrl: string;
  }
): Promise<{ queued: number; failed: number }> {
  const notifications: FanoutNotification[] = players.map((player) => ({
    id: `${tournamentId}-${player.id}`,
    userId: player.id,
    sport,
    type: 'TOURNAMENT_REMINDER',
    title: `Tournament Reminder: ${tournamentData.name}`,
    message: `${tournamentData.name} starts in ${tournamentData.hoursUntilStart} hours at ${tournamentData.venue}`,
    channels: ([
      player.email && 'email',
      player.phone && 'whatsapp',
      'push',
      'in-app',
    ] as NotificationChannel[]).filter(Boolean),
    priority: 'high' as NotificationPriority,
    eventId: tournamentId,
    data: {
      tournamentName: tournamentData.name,
      tournamentDate: tournamentData.startTime.toISOString(),
      venue: tournamentData.venue,
      hoursUntilStart: tournamentData.hoursUntilStart,
      tournamentUrl: tournamentData.tournamentUrl,
    },
    link: tournamentData.tournamentUrl,
    createdAt: new Date(),
  }));

  return queueNotifications(notifications);
}

/**
 * Create match result notification (individual, high priority)
 */
export async function createMatchResultNotification(
  userId: string,
  sport: SportType,
  matchData: {
    matchId: string;
    tournamentId: string;
    opponentName: string;
    score: string;
    won: boolean;
    pointsEarned?: number;
    eloChange?: number;
    matchUrl: string;
  }
): Promise<{ queued: boolean; batchKey?: string }> {
  const notification: FanoutNotification = {
    id: `${matchData.matchId}-${userId}`,
    userId,
    sport,
    type: 'MATCH_RESULT',
    title: matchData.won ? '🎉 Victory!' : 'Match Result',
    message: matchData.won
      ? `You defeated ${matchData.opponentName} ${matchData.score}`
      : `You lost to ${matchData.opponentName} ${matchData.score}`,
    channels: ['push', 'in-app'],
    priority: 'high',
    eventId: matchData.matchId,
    data: {
      opponentName: matchData.opponentName,
      score: matchData.score,
      won: matchData.won,
      pointsEarned: matchData.pointsEarned,
      eloChange: matchData.eloChange,
      matchUrl: matchData.matchUrl,
    },
    link: matchData.matchUrl,
    createdAt: new Date(),
  };

  return queueNotification(notification);
}

/**
 * Create admin broadcast notification
 */
export async function createAdminBroadcast(
  userIds: string[],
  sport: SportType,
  broadcastData: {
    title: string;
    message: string;
    link?: string;
    channels: NotificationChannel[];
  }
): Promise<{ queued: number; failed: number }> {
  const notifications: FanoutNotification[] = userIds.map((userId, index) => ({
    id: `broadcast-${Date.now()}-${index}`,
    userId,
    sport,
    type: 'ADMIN_BROADCAST',
    title: broadcastData.title,
    message: broadcastData.message,
    channels: broadcastData.channels,
    priority: 'normal' as NotificationPriority,
    eventId: `broadcast-${Date.now()}`,
    data: { broadcast: true },
    link: broadcastData.link,
    createdAt: new Date(),
  }));

  return queueNotifications(notifications);
}
