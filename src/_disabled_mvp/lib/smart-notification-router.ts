/**
 * VALORHIVE Smart Notification Router (v3.51.0)
 * 
 * Intelligent notification delivery system that:
 * - Learns user preferences
 * - Calculates optimal send times
 * - Selects best channel (email/push/WhatsApp)
 * - Batches notifications for better UX
 */

import { db } from './db';
import { SportType } from '@prisma/client';
import { sendPushNotification } from './push-notifications';
import { sendEmail } from './email';

// ============================================
// TYPES
// ============================================

export interface NotificationPayload {
  userId: string;
  sport: SportType;
  type: string;
  title: string;
  message: string;
  data?: Record<string, string>;
  link?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  expiresAt?: Date;
}

export interface UserNotificationProfile {
  userId: string;
  sport: SportType;
  preferredChannel: 'EMAIL' | 'PUSH' | 'WHATSAPP';
  preferredTimeSlots: string[]; // ['09:00-12:00', '18:00-21:00']
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  emailOpenRate: number;
  pushOpenRate: number;
  whatsappOpenRate: number;
  lastEmailSent?: Date;
  lastPushSent?: Date;
  batchable: boolean;
}

export interface BatchedNotification {
  userId: string;
  sport: SportType;
  notifications: NotificationPayload[];
  scheduledFor: Date;
  channel: 'EMAIL' | 'PUSH' | 'WHATSAPP';
}

export interface SendResult {
  success: boolean;
  channel: string;
  sentAt: Date;
  error?: string;
}

// ============================================
// LEARNING & PROFILE
// ============================================

/**
 * Build or update user notification profile based on behavior
 */
export async function buildUserProfile(
  userId: string,
  sport: SportType
): Promise<UserNotificationProfile> {
  // Get user's notification history
  const notifications = await db.notification.findMany({
    where: {
      userId,
      sport,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    },
    select: {
      createdAt: true,
      readAt: true,
      isRead: true,
    },
  });

  // Get push notification settings
  const pushSettings = await db.pushNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } },
  });

  // Get email settings
  const emailSettings = await db.emailNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } },
  });

  // Calculate open rates
  const totalNotifications = notifications.length;
  const readNotifications = notifications.filter(n => n.isRead).length;
  const baseOpenRate = totalNotifications > 0 ? readNotifications / totalNotifications : 0.5;

  // Analyze when user typically reads notifications
  const readTimes = notifications
    .filter(n => n.readAt)
    .map(n => n.readAt!.getHours());

  const preferredHours = findMostFrequent(readTimes);
  const preferredTimeSlots = inferTimeSlots(preferredHours);

  // Determine preferred channel based on settings and behavior
  let preferredChannel: 'EMAIL' | 'PUSH' | 'WHATSAPP' = 'PUSH';
  
  if (pushSettings?.enabled && baseOpenRate > 0.5) {
    preferredChannel = 'PUSH';
  } else if (emailSettings?.marketing && baseOpenRate > 0.3) {
    preferredChannel = 'EMAIL';
  }

  return {
    userId,
    sport,
    preferredChannel,
    preferredTimeSlots,
    timezone: pushSettings?.quietHoursTimezone || 'Asia/Kolkata',
    quietHoursStart: pushSettings?.quietHoursStart ?? 22,
    quietHoursEnd: pushSettings?.quietHoursEnd ?? 7,
    emailOpenRate: baseOpenRate,
    pushOpenRate: baseOpenRate * 1.2, // Push typically has higher open rate
    whatsappOpenRate: baseOpenRate * 1.5, // WhatsApp highest
    lastEmailSent: undefined,
    lastPushSent: undefined,
    batchable: true,
  };
}

/**
 * Calculate optimal send time for a notification
 */
export async function calculateOptimalSendTime(
  profile: UserNotificationProfile,
  priority: NotificationPayload['priority']
): Promise<Date> {
  const now = new Date();

  // Urgent notifications send immediately
  if (priority === 'URGENT') {
    return now;
  }

  // Check if currently in quiet hours
  const userHour = parseInt(now.toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: profile.timezone,
  }));

  const inQuietHours = isInQuietHours(userHour, profile.quietHoursStart, profile.quietHoursEnd);

  if (!inQuietHours && priority === 'HIGH') {
    return now;
  }

  // Find next optimal time slot
  const nextSlot = findNextTimeSlot(now, profile.timezone, profile.preferredTimeSlots, profile.quietHoursStart);

  return nextSlot;
}

/**
 * Select the best channel for notification delivery
 */
export async function selectBestChannel(
  profile: UserNotificationProfile,
  priority: NotificationPayload['priority'],
  notificationType: string
): Promise<'EMAIL' | 'PUSH' | 'WHATSAPP'> {
  // Urgent always goes to push
  if (priority === 'URGENT') {
    return 'PUSH';
  }

  // Check channel-specific preferences
  const typePreferences: Record<string, ('EMAIL' | 'PUSH' | 'WHATSAPP')[]> = {
    'MATCH_RESULT': ['PUSH', 'EMAIL'],
    'TOURNAMENT_REGISTERED': ['EMAIL', 'PUSH'],
    'TOURNAMENT_CANCELLED': ['PUSH', 'EMAIL', 'WHATSAPP'],
    'POINTS_EARNED': ['PUSH'],
    'DISPUTE_UPDATE': ['EMAIL', 'PUSH'],
  };

  const preferredOrder = typePreferences[notificationType] || ['PUSH', 'EMAIL'];

  // Score each channel
  const scores: Record<string, number> = {
    EMAIL: profile.emailOpenRate,
    PUSH: profile.pushOpenRate,
    WHATSAPP: profile.whatsappOpenRate,
  };

  // Add bonus for user's preferred channel
  scores[profile.preferredChannel] += 0.2;

  // Find best available channel
  for (const channel of preferredOrder) {
    if (scores[channel] >= 0.3) {
      return channel;
    }
  }

  return profile.preferredChannel;
}

// ============================================
// SMART ROUTING
// ============================================

/**
 * Route notification through optimal channel at optimal time
 */
export async function routeNotification(
  payload: NotificationPayload
): Promise<{ queued: boolean; scheduledFor?: Date; channel?: string }> {
  try {
    // Build user profile
    const profile = await buildUserProfile(payload.userId, payload.sport);

    // Calculate optimal time
    const optimalTime = await calculateOptimalSendTime(profile, payload.priority);

    // Select best channel
    const channel = await selectBestChannel(profile, payload.priority, payload.type);

    // Check if should batch
    const shouldBatch = profile.batchable && 
      payload.priority === 'LOW' && 
      !isImmediateNotification(payload.type);

    if (shouldBatch) {
      // Queue for batch delivery
      await queueForBatch(payload, optimalTime, channel);
      return { queued: true, scheduledFor: optimalTime, channel };
    }

    // Check if scheduled for later
    const delayMs = optimalTime.getTime() - Date.now();
    if (delayMs > 60000) { // More than 1 minute delay
      await queueNotification(payload, optimalTime, channel);
      return { queued: true, scheduledFor: optimalTime, channel };
    }

    // Send immediately
    await sendNotificationNow(payload, channel);
    return { queued: false, scheduledFor: optimalTime, channel };
  } catch (error) {
    console.error('Error routing notification:', error);
    // Fallback to in-app only
    await db.notification.create({
      data: {
        userId: payload.userId,
        sport: payload.sport,
        type: 'TOURNAMENT_REGISTERED', // Reuse
        title: payload.title,
        message: payload.message,
        link: payload.link,
      },
    });
    return { queued: false };
  }
}

/**
 * Send notification immediately
 */
async function sendNotificationNow(
  payload: NotificationPayload,
  channel: 'EMAIL' | 'PUSH' | 'WHATSAPP'
): Promise<SendResult> {
  const sentAt = new Date();

  try {
    switch (channel) {
      case 'PUSH': {
        const result = await sendPushNotification(
          payload.userId,
          payload.title,
          payload.message,
          payload.data,
          { priority: payload.priority === 'HIGH' || payload.priority === 'URGENT' ? 'high' : 'normal' }
        );
        return { success: result.sentCount > 0, channel, sentAt };
      }

      case 'EMAIL': {
        const user = await db.user.findUnique({
          where: { id: payload.userId },
          select: { email: true, firstName: true },
        });

        if (!user?.email) {
          return { success: false, channel, sentAt, error: 'No email address' };
        }

        await sendEmail({
          to: user.email,
          subject: payload.title,
          html: `
            <h2>Hi ${user.firstName},</h2>
            <p>${payload.message}</p>
            ${payload.link ? `<a href="https://valorhive.com${payload.link}">View Details</a>` : ''}
          `,
        });
        return { success: true, channel, sentAt };
      }

      case 'WHATSAPP':
        // Would integrate with WhatsApp Business API
        return { success: false, channel, sentAt, error: 'WhatsApp not configured' };

      default:
        return { success: false, channel, sentAt, error: 'Unknown channel' };
    }
  } catch (error) {
    return { success: false, channel, sentAt, error: String(error) };
  }
}

/**
 * Queue notification for later delivery
 */
async function queueNotification(
  payload: NotificationPayload,
  scheduledFor: Date,
  channel: string
): Promise<void> {
  await db.scheduledNotification.create({
    data: {
      userId: payload.userId,
      sport: payload.sport,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data ? JSON.stringify(payload.data) : null,
      link: payload.link,
      channel,
      priority: payload.priority,
      scheduledFor,
      status: 'PENDING',
    },
  });
}

/**
 * Queue for batch delivery
 */
async function queueForBatch(
  payload: NotificationPayload,
  scheduledFor: Date,
  channel: string
): Promise<void> {
  await db.batchedNotification.create({
    data: {
      userId: payload.userId,
      sport: payload.sport,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data ? JSON.stringify(payload.data) : null,
      link: payload.link,
      channel,
      scheduledFor,
      status: 'PENDING',
    },
  });
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Process batched notifications
 * Groups multiple notifications for the same user
 */
export async function processBatchedNotifications(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const result = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    const now = new Date();

    // Find batched notifications ready to send
    const readyBatches = await db.batchedNotification.findMany({
      where: {
        scheduledFor: { lte: now },
        status: 'PENDING',
      },
      orderBy: { scheduledFor: 'asc' },
    });

    // Group by user
    const byUser = new Map<string, typeof readyBatches>();

    for (const batch of readyBatches) {
      const key = `${batch.userId}:${batch.sport}`;
      if (!byUser.has(key)) {
        byUser.set(key, []);
      }
      byUser.get(key)!.push(batch);
    }

    // Process each user's batch
    for (const [key, notifications] of byUser) {
      const [userId, sport] = key.split(':');

      try {
        // Combine into single digest
        const digest = createDigest(notifications);

        // Send digest
        const profile = await buildUserProfile(userId, sport as SportType);
        const channel = profile.preferredChannel;

        await sendNotificationNow({
          userId,
          sport: sport as SportType,
          type: 'DIGEST',
          title: digest.title,
          message: digest.summary,
          priority: 'NORMAL',
          link: '/notifications',
        }, channel);

        // Mark as sent
        await db.batchedNotification.updateMany({
          where: { id: { in: notifications.map(n => n.id) } },
          data: { status: 'SENT', sentAt: new Date() },
        });

        result.sent++;
      } catch (error) {
        result.errors.push(`Error processing batch for ${userId}: ${error}`);
      }

      result.processed++;
    }

    return result;
  } catch (error) {
    result.errors.push(`Batch processing error: ${error}`);
    return result;
  }
}

/**
 * Create a digest from multiple notifications
 */
function createDigest(
  notifications: { type: string; title: string; message: string }[]
): { title: string; summary: string; count: number } {
  const count = notifications.length;

  if (count === 1) {
    return {
      title: notifications[0].title,
      summary: notifications[0].message,
      count,
    };
  }

  // Group by type
  const byType = new Map<string, number>();
  for (const n of notifications) {
    byType.set(n.type, (byType.get(n.type) || 0) + 1);
  }

  const summaryParts: string[] = [];
  for (const [type, count] of byType) {
    summaryParts.push(`${count} ${type.toLowerCase().replace(/_/g, ' ')}`);
  }

  return {
    title: `📬 You have ${count} updates`,
    summary: summaryParts.join(', '),
    count,
  };
}

/**
 * Process scheduled notifications
 */
export async function processScheduledNotifications(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const result = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    const now = new Date();

    const due = await db.scheduledNotification.findMany({
      where: {
        scheduledFor: { lte: now },
        status: 'PENDING',
      },
    });

    for (const notification of due) {
      result.processed++;

      try {
        const sendResult = await sendNotificationNow(
          {
            userId: notification.userId,
            sport: notification.sport,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data ? JSON.parse(notification.data) : undefined,
            link: notification.link ?? undefined,
            priority: notification.priority as NotificationPayload['priority'],
          },
          notification.channel as 'EMAIL' | 'PUSH' | 'WHATSAPP'
        );

        if (sendResult.success) {
          await db.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
          result.sent++;
        } else {
          await db.scheduledNotification.update({
            where: { id: notification.id },
            data: { 
              status: 'FAILED', 
              error: sendResult.error,
              retryCount: { increment: 1 },
            },
          });
          result.errors.push(`Failed: ${sendResult.error}`);
        }
      } catch (error) {
        result.errors.push(`Error: ${error}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Processing error: ${error}`);
    return result;
  }
}

// ============================================
// HELPERS
// ============================================

function isInQuietHours(currentHour: number, start: number, end: number): boolean {
  if (start < end) {
    return currentHour >= start && currentHour < end;
  } else {
    return currentHour >= start || currentHour < end;
  }
}

function findMostFrequent(hours: number[]): number[] {
  const counts = new Map<number, number>();
  for (const h of hours) {
    counts.set(h, (counts.get(h) || 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 3).map(([h]) => h);
}

function inferTimeSlots(hours: number[]): string[] {
  const slots: string[] = [];

  if (hours.some(h => h >= 6 && h < 12)) {
    slots.push('06:00-12:00');
  }
  if (hours.some(h => h >= 12 && h < 18)) {
    slots.push('12:00-18:00');
  }
  if (hours.some(h => h >= 18 && h < 22)) {
    slots.push('18:00-22:00');
  }

  return slots.length > 0 ? slots : ['09:00-12:00', '18:00-21:00'];
}

function findNextTimeSlot(
  now: Date,
  timezone: string,
  preferredSlots: string[],
  quietHoursEnd: number
): Date {
  // Find next preferred time slot
  const currentHour = parseInt(now.toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }));

  // If before quiet hours end, schedule for after quiet hours
  if (currentHour < quietHoursEnd) {
    const result = new Date(now);
    result.setHours(quietHoursEnd, 0, 0, 0);
    return result;
  }

  // Try to find a preferred slot today
  for (const slot of preferredSlots) {
    const [start] = slot.split('-');
    const [startHour] = start.split(':').map(Number);

    if (startHour > currentHour) {
      const result = new Date(now);
      result.setHours(startHour, 0, 0, 0);
      return result;
    }
  }

  // Schedule for tomorrow morning
  const result = new Date(now);
  result.setDate(result.getDate() + 1);
  result.setHours(9, 0, 0, 0);
  return result;
}

function isImmediateNotification(type: string): boolean {
  const immediateTypes = [
    'MATCH_RESULT',
    'TOURNAMENT_CANCELLED',
    'DISPUTE_UPDATE',
    'REFUND_PROCESSED',
  ];
  return immediateTypes.includes(type);
}
