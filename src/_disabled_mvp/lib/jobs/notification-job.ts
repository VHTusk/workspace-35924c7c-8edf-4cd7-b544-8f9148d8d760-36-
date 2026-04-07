/**
 * Notification Job Handler for VALORHIVE
 * 
 * Handles push notification-related background jobs:
 * - Send in-app notifications
 * - Send push notifications (FCM/APNs)
 * - Send SMS notifications
 * - Multi-channel notification delivery
 * - Notification batching
 * 
 * @version v3.83.0
 */

import { Job } from 'bullmq';
import { db } from '../db';
import { log } from '../logger';
import type { NotificationJobData, JobResult } from '../job-queue';

// ============================================
// Types and Interfaces
// ============================================

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

interface NotificationResult {
  inApp: boolean;
  push?: boolean;
  sms?: boolean;
  email?: boolean;
  errors: string[];
}

// ============================================
// Notification Channels
// ============================================

/**
 * Create in-app notification
 */
async function createInAppNotification(
  userId: string,
  data: NotificationJobData
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type: data.notificationType as any,
        title: data.title,
        message: data.message,
        link: data.link,
        sport: data.data?.sport as any || 'CORNHOLE',
      },
    });
    
    return {
      success: true,
      notificationId: notification.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notification via FCM
 */
async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import push notification service
    const { sendPushNotification: sendPush } = await import('../push-notifications');
    
    // Get user's push tokens
    const pushTokens = await db.pushDevice.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
        platform: true,
      },
    });
    
    if (pushTokens.length === 0) {
      return { success: false, error: 'No active push tokens' };
    }
    
    // Send to all devices
    const results = await Promise.allSettled(
      pushTokens.map(async (device) => {
        await sendPush(userId, payload);
      })
    );
    
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
      success: failed === 0,
      error: failed > 0 ? `${failed} devices failed` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(
  userId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    
    if (!user?.phone) {
      return { success: false, error: 'No phone number' };
    }
    
    // Import SMS service
    const { smsService } = await import('../sms-service');
    
    await smsService.send({
      to: user.phone,
      message,
    });
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Notification Job Handlers
// ============================================

/**
 * Handle send notification job
 */
export async function handleSendNotification(
  job: Job<NotificationJobData>
): Promise<JobResult> {
  const startTime = Date.now();
  const { userId, notificationType, title, message, link, data, channels } = job.data;
  
  log.info(`[NotificationJob] Processing notification job ${job.id}`, {
    userId,
    type: notificationType,
    channels: channels || ['in_app'],
  });
  
  const result: NotificationResult = {
    inApp: false,
    errors: [],
  };
  
  const targetChannels = channels || ['in_app'];
  
  try {
    // Always create in-app notification first
    if (targetChannels.includes('in_app')) {
      const inAppResult = await createInAppNotification(userId, job.data);
      result.inApp = inAppResult.success;
      if (!inAppResult.success && inAppResult.error) {
        result.errors.push(`in_app: ${inAppResult.error}`);
      }
    }
    
    // Send push notification
    if (targetChannels.includes('push')) {
      const pushResult = await sendPushNotification(userId, {
        title,
        body: message,
        data: {
          ...data,
          link,
          type: notificationType,
        },
      });
      result.push = pushResult.success;
      if (!pushResult.success && pushResult.error) {
        result.errors.push(`push: ${pushResult.error}`);
      }
    }
    
    // Send SMS
    if (targetChannels.includes('sms')) {
      const smsResult = await sendSMSNotification(userId, `${title}: ${message}`);
      result.sms = smsResult.success;
      if (!smsResult.success && smsResult.error) {
        result.errors.push(`sms: ${smsResult.error}`);
      }
    }
    
    // Send email notification
    if (targetChannels.includes('email')) {
      const { addEmailJob } = await import('../job-queue');
      await addEmailJob({
        to: '', // Will be fetched from user
        subject: title,
        template: 'notification',
        data: {
          message,
          link,
          ...data,
        },
      });
      result.email = true;
    }
    
    // Determine overall success
    const hasSuccess = result.inApp || result.push || result.sms || result.email;
    
    if (!hasSuccess) {
      throw new Error(`All notification channels failed: ${result.errors.join(', ')}`);
    }
    
    return {
      success: true,
      data: {
        channels: {
          inApp: result.inApp,
          push: result.push,
          sms: result.sms,
          email: result.email,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    log.error(`[NotificationJob] Failed to send notification for job ${job.id}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        channels: {
          inApp: result.inApp,
          push: result.push,
          sms: result.sms,
          email: result.email,
        },
        errors: result.errors,
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle tournament reminder notification
 */
export async function handleTournamentReminderNotification(
  userId: string,
  tournamentId: string,
  reminderType: 'registration_closing' | 'check_in' | 'match_upcoming' | 'tournament_starting',
  scheduledFor: Date
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    // Get user and tournament details
    const [user, tournament] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, notificationPref: true },
      }),
      db.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true, startDate: true, location: true },
      }),
    ]);
    
    if (!user || !tournament) {
      throw new Error('User or tournament not found');
    }
    
    const messages: Record<string, { title: string; body: string }> = {
      registration_closing: {
        title: 'Registration Closing Soon',
        body: `Registration for ${tournament.name} closes soon. Don't miss out!`,
      },
      check_in: {
        title: 'Check-in Required',
        body: `Please check in for ${tournament.name} at ${tournament.location}`,
      },
      match_upcoming: {
        title: 'Match Starting Soon',
        body: `Your match at ${tournament.name} starts soon. Be ready!`,
      },
      tournament_starting: {
        title: 'Tournament Starting',
        body: `${tournament.name} is starting now. Good luck!`,
      },
    };
    
    const { title, body } = messages[reminderType] || {
      title: 'Tournament Update',
      body: `Update regarding ${tournament.name}`,
    };
    
    // Create notification job
    const { addNotificationJob } = await import('../job-queue');
    await addNotificationJob({
      userId: user.id,
      notificationType: 'TOURNAMENT_REMINDER',
      title,
      message: body,
      link: `/tournaments/${tournamentId}`,
      channels: ['in_app', 'push'],
      data: {
        tournamentId,
        reminderType,
      },
    });
    
    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle match result notification
 */
export async function handleMatchResultNotification(
  winnerId: string,
  loserId: string,
  matchId: string,
  tournamentId: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const [match, tournament] = await Promise.all([
      db.match.findUnique({
        where: { id: matchId },
        select: { scoreA: true, scoreB: true },
      }),
      db.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true },
      }),
    ]);
    
    if (!match || !tournament) {
      throw new Error('Match or tournament not found');
    }
    
    const { addNotificationJob } = await import('../job-queue');
    
    // Notify winner
    await addNotificationJob({
      userId: winnerId,
      notificationType: 'MATCH_RESULT',
      title: 'Victory! 🏆',
      message: `You won your match at ${tournament.name}! Score: ${match.scoreA}-${match.scoreB}`,
      link: `/matches/${matchId}`,
      channels: ['in_app', 'push'],
    });
    
    // Notify loser
    await addNotificationJob({
      userId: loserId,
      notificationType: 'MATCH_RESULT',
      title: 'Match Completed',
      message: `Your match at ${tournament.name} has ended. Score: ${match.scoreA}-${match.scoreB}`,
      link: `/matches/${matchId}`,
      channels: ['in_app'],
    });
    
    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle points earned notification
 */
export async function handlePointsEarnedNotification(
  userId: string,
  points: number,
  reason: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const { addNotificationJob } = await import('../job-queue');
    
    await addNotificationJob({
      userId,
      notificationType: 'POINTS_EARNED',
      title: 'Points Earned! ⭐',
      message: `You earned ${points} points for ${reason}`,
      channels: ['in_app'],
      data: { points, reason },
    });
    
    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle waitlist promotion notification
 */
export async function handleWaitlistPromotionNotification(
  userId: string,
  tournamentId: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true },
    });
    
    if (!tournament) {
      throw new Error('Tournament not found');
    }
    
    const { addNotificationJob } = await import('../job-queue');
    
    await addNotificationJob({
      userId,
      notificationType: 'WAITLIST_PROMOTED',
      title: 'You\'re In! 🎉',
      message: `You've been promoted from the waitlist for ${tournament.name}!`,
      link: `/tournaments/${tournamentId}`,
      channels: ['in_app', 'push', 'sms'],
      data: { tournamentId },
    });
    
    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle batch notifications (for multiple users)
 */
export async function handleBatchNotification(
  userIds: string[],
  notification: Omit<NotificationJobData, 'userId' | 'type' | 'createdAt'>
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const { addBulkJobs } = await import('../job-queue');
    
    const jobs = userIds.map(userId => ({
      data: {
        type: 'notification' as const,
        userId,
        notificationType: notification.notificationType,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        data: notification.data,
        channels: notification.channels,
        createdAt: Date.now(),
      },
    }));
    
    await addBulkJobs('notification', jobs);
    
    return {
      success: true,
      data: { sent: userIds.length },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Export Default Handler
// ============================================

export default handleSendNotification;
