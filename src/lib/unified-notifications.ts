/**
 * Unified Notification Dispatcher
 * Sends notifications across multiple channels: Email, Push, WhatsApp
 * 
 * v3.43.0 - Single interface for all notification channels
 */

import { db } from '@/lib/db';
import { sendEmail } from './email';
import { sendPushNotification } from './push-notifications';
import { NotificationType } from '@prisma/client';
import { buildAppUrl } from './app-url';

// Notification channels
export type NotificationChannel = 'email' | 'push' | 'whatsapp' | 'in_app';

// Template types for different notifications
export type NotificationTemplate =
  | 'MATCH_REMINDER'
  | 'MATCH_RESULT'
  | 'TOURNAMENT_REMINDER'
  | 'TOURNAMENT_ANNOUNCEMENT'
  | 'TOURNAMENT_PAUSED'
  | 'TOURNAMENT_RESUMED'
  | 'TOURNAMENT_COMPLETED'
  | 'WAITLIST_PROMOTED'
  | 'CHECK_IN_REMINDER'
  | 'SCHEDULE_CHANGE'
  | 'PRIZE_PAYOUT'
  | 'POINTS_EARNED'
  | 'BADGE_EARNED'
  | 'RANK_CHANGE';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  actionUrl?: string;
}

export interface DispatchParams {
  userId: string;
  channels: NotificationChannel[];
  template: NotificationTemplate;
  payload: NotificationPayload;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

// Template content builders
const TEMPLATES: Record<NotificationTemplate, (data: Record<string, any>) => NotificationPayload> = {
  MATCH_REMINDER: (data) => ({
    title: `⏰ Match in ${data.hoursUntil || 'soon'}!`,
    body: `vs ${data.opponentName} at ${data.court || 'TBD'}. ${data.tournamentName}`,
    data: { matchId: data.matchId, tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}/match/${data.matchId}`,
  }),
  MATCH_RESULT: (data) => ({
    title: data.won ? '🎉 Victory!' : 'Match Result',
    body: data.won
      ? `You defeated ${data.opponentName}! +${data.pointsEarned} points`
      : `You lost to ${data.opponentName}. Better luck next time!`,
    data: { matchId: data.matchId, tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  TOURNAMENT_REMINDER: (data) => ({
    title: `🏆 ${data.tournamentName}`,
    body: data.hoursUntil
      ? `Starts in ${data.hoursUntil} hours at ${data.venue || data.location}`
      : `Registration closes soon! ${data.spotsLeft} spots left.`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  TOURNAMENT_ANNOUNCEMENT: (data) => ({
    title: `📢 ${data.tournamentName}`,
    body: data.message,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  TOURNAMENT_PAUSED: (data) => ({
    title: '⏸️ Tournament Paused',
    body: `${data.tournamentName}: ${data.reason}. ${data.message || ''}`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  TOURNAMENT_RESUMED: (data) => ({
    title: '▶️ Tournament Resumed',
    body: `${data.tournamentName} is back in progress!`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  TOURNAMENT_COMPLETED: (data) => ({
    title: data.won ? '🏆 Champion!' : `Tournament Complete`,
    body: data.won
      ? `Congratulations! You won ${data.tournamentName}!`
      : `${data.tournamentName} has ended. You placed #${data.placement}.`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  WAITLIST_PROMOTED: (data) => ({
    title: '🎫 You\'re In!',
    body: `You've been promoted from waitlist for ${data.tournamentName}! Register now.`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  CHECK_IN_REMINDER: (data) => ({
    title: '📍 Check-in Required',
    body: `Please check in for ${data.tournamentName} at ${data.venue || 'the venue'}`,
    data: { tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  SCHEDULE_CHANGE: (data) => ({
    title: '📅 Schedule Updated',
    body: `Your match vs ${data.opponentName} is now at ${data.newTime}`,
    data: { matchId: data.matchId, tournamentId: data.tournamentId },
    actionUrl: `/${data.sport?.toLowerCase()}/tournaments/${data.tournamentId}`,
  }),
  PRIZE_PAYOUT: (data) => ({
    title: '💰 Prize Payout',
    body: `₹${data.amount} for ${data.tournamentName} has been processed!`,
    data: { tournamentId: data.tournamentId },
  }),
  POINTS_EARNED: (data) => ({
    title: '⭐ Points Earned!',
    body: `+${data.points} points: ${data.reason}`,
    data: {},
  }),
  BADGE_EARNED: (data) => ({
    title: '🏅 Badge Earned!',
    body: `You earned the "${data.badgeName}" badge!`,
    data: { badgeId: data.badgeId },
  }),
  RANK_CHANGE: (data) => ({
    title: data.improved ? '📈 Rank Up!' : 'Rank Update',
    body: data.improved
      ? `You're now #${data.newRank} in ${data.leaderboard}!`
      : `Your rank changed to #${data.newRank}`,
    data: {},
  }),
};

/**
 * Dispatch notification across multiple channels
 */
export async function dispatchNotification(params: DispatchParams): Promise<{
  success: boolean;
  results: Record<NotificationChannel, { success: boolean; error?: string }>;
}> {
  const { userId, channels, template, payload, priority = 'normal' } = params;

  // Get user with notification preferences
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      emailNotificationSettings: true,
      pushNotificationSettings: true,
    },
  });

  if (!user) {
    return {
      success: false,
      results: {
        email: { success: false, error: 'User not found' },
        push: { success: false, error: 'User not found' },
        whatsapp: { success: false, error: 'User not found' },
        in_app: { success: false, error: 'User not found' },
      },
    };
  }

  const results: Record<NotificationChannel, { success: boolean; error?: string }> = {
    email: { success: false },
    push: { success: false },
    whatsapp: { success: false },
    in_app: { success: false },
  };

  // Process each channel
  for (const channel of channels) {
    try {
      switch (channel) {
        case 'email':
          if (user.email && shouldSendEmail(user, template)) {
            await sendEmail({
              to: user.email,
              subject: payload.title,
              html: buildEmailHtml(template, payload, user),
            });
            results.email = { success: true };
          } else {
            results.email = { success: false, error: 'Email disabled or no address' };
          }
          break;

        case 'push':
          if (shouldSendPush(user, template)) {
            const pushResult = await sendPushNotification(
              userId,
              payload.title,
              payload.body,
              payload.data,
              { priority: priority === 'high' ? 'high' : 'normal' }
            );
            results.push = { success: pushResult.success };
          } else {
            results.push = { success: false, error: 'Push disabled' };
          }
          break;

        case 'whatsapp':
          // WhatsApp implementation - for now, log for later
          if (user.phone && shouldSendWhatsApp(user, template)) {
            // TODO: Integrate with WhatsApp provider
            console.log(`[WhatsApp] Would send to ${user.phone}: ${payload.title} - ${payload.body}`);
            results.whatsapp = { success: true };
          } else {
            results.whatsapp = { success: false, error: 'WhatsApp disabled or no phone' };
          }
          break;

        case 'in_app':
          // Create in-app notification
          await db.notification.create({
            data: {
              userId,
              sport: user.sport,
              type: mapTemplateToNotificationType(template),
              title: payload.title,
              message: payload.body,
              link: payload.actionUrl,
            },
          });
          results.in_app = { success: true };
          break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results[channel] = { success: false, error: errorMsg };
      console.error(`[Notification] Error on ${channel}:`, error);
    }
  }

  // Consider success if at least one channel succeeded
  const anySuccess = Object.values(results).some(r => r.success);

  return { success: anySuccess, results };
}

/**
 * Dispatch to multiple users
 */
export async function dispatchBulkNotification(
  userIds: string[],
  params: Omit<DispatchParams, 'userId'>
): Promise<{ successCount: number; failureCount: number }> {
  let successCount = 0;
  let failureCount = 0;

  for (const userId of userIds) {
    const result = await dispatchNotification({ ...params, userId });
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return { successCount, failureCount };
}

// Helper functions
function shouldSendEmail(user: any, template: NotificationTemplate): boolean {
  const settings = user.emailNotificationSettings;
  if (!settings) return true; // Default to enabled

  const templateToSetting: Partial<Record<NotificationTemplate, string>> = {
    MATCH_RESULT: 'matchResults',
    TOURNAMENT_REMINDER: 'tournamentUpdates',
    TOURNAMENT_COMPLETED: 'tournamentUpdates',
    POINTS_EARNED: 'milestones',
    BADGE_EARNED: 'milestones',
    RANK_CHANGE: 'rankChanges',
  };

  const setting = templateToSetting[template];
  return setting ? settings[setting] ?? true : true;
}

function shouldSendPush(user: any, template: NotificationTemplate): boolean {
  const settings = user.pushNotificationSettings;
  if (!settings) return true;

  const templateToSetting: Partial<Record<NotificationTemplate, string>> = {
    MATCH_RESULT: 'matchResults',
    TOURNAMENT_REMINDER: 'tournamentUpdates',
    TOURNAMENT_COMPLETED: 'tournamentUpdates',
    POINTS_EARNED: 'milestones',
    BADGE_EARNED: 'milestones',
    RANK_CHANGE: 'rankChanges',
  };

  const setting = templateToSetting[template];
  return setting ? settings[setting] ?? true : true;
}

function shouldSendWhatsApp(user: any, template: NotificationTemplate): boolean {
  // WhatsApp for critical/urgent notifications only
  const urgentTemplates: NotificationTemplate[] = [
    'MATCH_REMINDER',
    'WAITLIST_PROMOTED',
    'CHECK_IN_REMINDER',
    'TOURNAMENT_PAUSED',
    'TOURNAMENT_RESUMED',
    'SCHEDULE_CHANGE',
  ];

  return urgentTemplates.includes(template);
}

function buildEmailHtml(template: NotificationTemplate, payload: NotificationPayload, user: any): string {
  const actionUrl = payload.actionUrl ? buildAppUrl(payload.actionUrl) : null;
  const preferencesUrl = buildAppUrl('/settings/notifications');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${payload.title}</h2>
      <p style="color: #4a4a4a; font-size: 16px;">${payload.body}</p>
      ${actionUrl ? `
        <a href="${actionUrl}" 
           style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Details
        </a>
      ` : ''}
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="color: #888; font-size: 12px;">
        You're receiving this because you're registered on VALORHIVE.
        <br />
        <a href="${preferencesUrl}">Manage notification preferences</a>
      </p>
    </div>
  `;
}

function mapTemplateToNotificationType(template: NotificationTemplate): NotificationType {
  const mapping: Record<NotificationTemplate, NotificationType> = {
    MATCH_REMINDER: NotificationType.TOURNAMENT_REMINDER,
    MATCH_RESULT: NotificationType.MATCH_RESULT,
    TOURNAMENT_REMINDER: NotificationType.TOURNAMENT_REMINDER,
    TOURNAMENT_ANNOUNCEMENT: NotificationType.TOURNAMENT_REGISTERED,
    TOURNAMENT_PAUSED: NotificationType.TOURNAMENT_REGISTERED,
    TOURNAMENT_RESUMED: NotificationType.TOURNAMENT_REGISTERED,
    TOURNAMENT_COMPLETED: NotificationType.TOURNAMENT_REGISTERED,
    WAITLIST_PROMOTED: NotificationType.WAITLIST_PROMOTED,
    CHECK_IN_REMINDER: NotificationType.TOURNAMENT_REMINDER,
    SCHEDULE_CHANGE: NotificationType.TOURNAMENT_REMINDER,
    PRIZE_PAYOUT: NotificationType.POINTS_EARNED,
    POINTS_EARNED: NotificationType.POINTS_EARNED,
    BADGE_EARNED: NotificationType.MILESTONE,
    RANK_CHANGE: NotificationType.RANK_CHANGE,
  };

  return mapping[template] || NotificationType.TOURNAMENT_REGISTERED;
}

// Export template builder for direct use
export function buildNotificationPayload(
  template: NotificationTemplate,
  data: Record<string, any>
): NotificationPayload {
  const builder = TEMPLATES[template];
  return builder ? builder(data) : { title: 'Notification', body: 'You have a new notification.' };
}
