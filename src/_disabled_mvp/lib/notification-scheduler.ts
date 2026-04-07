/**
 * Notification Scheduler for VALORHIVE
 * 
 * Handles scheduling and processing of notifications:
 * - Match reminders (24hr, 2hr before)
 * - Tournament reminders
 * - Subscription expiry warnings
 * - Scheduled digest emails
 */

import { db } from '@/lib/db';
import { SportType, TournamentStatus } from '@prisma/client';
import { 
  generateMatchReminderEmail,
  generateTournamentConfirmationEmail,
} from './email-templates';
import { sendEmail } from './email';

// ============================================
// Types
// ============================================

export interface ScheduledNotification {
  id: string;
  type: 'MATCH_REMINDER' | 'TOURNAMENT_REMINDER' | 'SUBSCRIPTION_EXPIRY' | 'DIGEST';
  scheduledFor: Date;
  recipientId: string;
  recipientType: 'USER' | 'ORG';
  sport: SportType;
  data: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface MatchReminderConfig {
  matchId: string;
  times: number[]; // Hours before match (e.g., [24, 2])
}

export interface TournamentReminderConfig {
  tournamentId: string;
  reminderTypes: ('REGISTRATION_CLOSING' | 'STARTING_SOON' | 'CHECK_IN')[];
}

// In-memory store for scheduled notifications (use Redis in production)
const scheduledNotifications = new Map<string, ScheduledNotification>();

// ============================================
// Match Reminder Scheduling
// ============================================

/**
 * Schedule reminder emails for a specific match
 * @param matchId The bracket match ID
 * @param times Array of hours before match to send reminders (e.g., [24, 2])
 */
export async function scheduleMatchReminders(
  matchId: string,
  times: number[]
): Promise<{ success: boolean; scheduledIds: string[]; error?: string }> {
  try {
    // Get match details with players
    const match = await db.bracketMatch.findUnique({
      where: { id: matchId },
      include: {
        bracket: {
          include: {
            tournament: {
              include: {
                venue: true,
              },
            },
          },
        },
        player1: true,
        player2: true,
      },
    });

    if (!match) {
      return { success: false, scheduledIds: [], error: 'Match not found' };
    }

    if (!match.scheduledTime) {
      return { success: false, scheduledIds: [], error: 'Match has no scheduled time' };
    }

    if (!match.player1 || !match.player2) {
      return { success: false, scheduledIds: [], error: 'Match missing players' };
    }

    const scheduledIds: string[] = [];
    const tournament = match.bracket.tournament;

    // Schedule reminders for both players
    const players = [
      { player: match.player1, opponent: match.player2 },
      { player: match.player2, opponent: match.player1 },
    ];

    for (const { player, opponent } of players) {
      for (const hoursBefore of times) {
        const scheduledFor = new Date(match.scheduledTime.getTime() - hoursBefore * 60 * 60 * 1000);
        
        // Don't schedule if time has passed
        if (scheduledFor <= new Date()) {
          continue;
        }

        const notificationId = `${matchId}-${player.id}-${hoursBefore}h`;
        
        const notification: ScheduledNotification = {
          id: notificationId,
          type: 'MATCH_REMINDER',
          scheduledFor,
          recipientId: player.id,
          recipientType: 'USER',
          sport: tournament.sport,
          data: {
            matchId,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentDate: match.scheduledTime.toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            tournamentTime: match.scheduledTime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            venue: tournament.venue?.name || tournament.location || 'TBD',
            hoursUntilStart: hoursBefore,
            opponentName: `${opponent.firstName} ${opponent.lastName}`,
            playerSeed: match.player1Seed,
            opponentSeed: match.player2Seed,
            court: match.court,
            checkInRequired: tournament.checkInRequired || false,
          },
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        scheduledNotifications.set(notificationId, notification);
        scheduledIds.push(notificationId);
      }
    }

    console.log(`[NotificationScheduler] Scheduled ${scheduledIds.length} match reminders for match ${matchId}`);
    
    return { success: true, scheduledIds };
  } catch (error) {
    console.error('[NotificationScheduler] Error scheduling match reminders:', error);
    return { 
      success: false, 
      scheduledIds: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================
// Tournament Reminder Scheduling
// ============================================

/**
 * Schedule reminder notifications for a tournament
 * @param tournamentId The tournament ID
 */
export async function scheduleTournamentReminders(
  tournamentId: string
): Promise<{ success: boolean; scheduledIds: string[]; error?: string }> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        venue: true,
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!tournament) {
      return { success: false, scheduledIds: [], error: 'Tournament not found' };
    }

    const scheduledIds: string[] = [];
    const startTime = tournament.startDate;

    // Schedule 24-hour and 2-hour reminders for all registered players
    const reminderTimes = [24, 2];

    for (const registration of tournament.registrations) {
      if (!registration.user) continue;

      for (const hoursBefore of reminderTimes) {
        const scheduledFor = new Date(startTime.getTime() - hoursBefore * 60 * 60 * 1000);
        
        // Don't schedule if time has passed
        if (scheduledFor <= new Date()) {
          continue;
        }

        const notificationId = `tournament-${tournamentId}-${registration.userId}-${hoursBefore}h`;
        
        const notification: ScheduledNotification = {
          id: notificationId,
          type: 'TOURNAMENT_REMINDER',
          scheduledFor,
          recipientId: registration.userId,
          recipientType: 'USER',
          sport: tournament.sport,
          data: {
            tournamentId,
            tournamentName: tournament.name,
            tournamentDate: startTime.toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            tournamentTime: startTime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            venue: tournament.venue?.name || tournament.location || 'TBD',
            hoursUntilStart: hoursBefore,
            checkInRequired: tournament.checkInRequired || false,
            checkInDeadline: tournament.checkInDeadline?.toISOString(),
          },
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        scheduledNotifications.set(notificationId, notification);
        scheduledIds.push(notificationId);
      }
    }

    console.log(`[NotificationScheduler] Scheduled ${scheduledIds.length} tournament reminders for tournament ${tournamentId}`);
    
    return { success: true, scheduledIds };
  } catch (error) {
    console.error('[NotificationScheduler] Error scheduling tournament reminders:', error);
    return { 
      success: false, 
      scheduledIds: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================
// Process Scheduled Notifications
// ============================================

/**
 * Process all due notifications
 * Should be called by a cron job every minute
 */
export async function processScheduledNotifications(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; status: string; error?: string }>;
}> {
  const now = new Date();
  const results: Array<{ id: string; status: string; error?: string }> = [];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  // Find all pending notifications that are due
  for (const [id, notification] of scheduledNotifications) {
    if (notification.status !== 'PENDING') continue;
    if (notification.scheduledFor > now) continue;

    processed++;

    try {
      const result = await sendNotification(notification);
      
      if (result.success) {
        notification.status = 'SENT';
        sent++;
        results.push({ id, status: 'SENT' });
      } else {
        notification.status = 'FAILED';
        notification.error = result.error;
        failed++;
        results.push({ id, status: 'FAILED', error: result.error });
      }

      notification.lastAttemptAt = now;
      notification.attempts++;
    } catch (error) {
      notification.status = 'FAILED';
      notification.error = error instanceof Error ? error.message : 'Unknown error';
      notification.lastAttemptAt = now;
      notification.attempts++;
      failed++;
      results.push({ 
        id, 
        status: 'FAILED', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Clean up sent notifications older than 24 hours
  const cleanupThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const [id, notification] of scheduledNotifications) {
    if (notification.status === 'SENT' && notification.lastAttemptAt && notification.lastAttemptAt < cleanupThreshold) {
      scheduledNotifications.delete(id);
    }
  }

  console.log(`[NotificationScheduler] Processed ${processed} notifications: ${sent} sent, ${failed} failed`);

  return { processed, sent, failed, results };
}

/**
 * Send a notification to the recipient
 */
async function sendNotification(
  notification: ScheduledNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get recipient details
    const recipient = notification.recipientType === 'USER'
      ? await db.user.findUnique({
          where: { id: notification.recipientId },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : await db.organization.findUnique({
          where: { id: notification.recipientId },
          select: { id: true, email: true, name: true },
        });

    if (!recipient || !recipient.email) {
      return { success: false, error: 'Recipient not found or no email' };
    }

    const recipientName = 'firstName' in recipient 
      ? `${recipient.firstName} ${recipient.lastName || ''}`.trim()
      : recipient.name;

    // Get notification preferences
    const emailSettings = await db.emailNotificationSetting.findFirst({
      where: {
        userId: notification.recipientId,
        sport: notification.sport,
      },
    });

    // Check if quiet hours are active
    if (emailSettings?.quietHoursStart !== null && emailSettings?.quietHoursEnd !== null) {
      const now = new Date();
      const currentHour = now.getHours();
      if (currentHour >= (emailSettings.quietHoursStart || 0) && currentHour < (emailSettings.quietHoursEnd || 24)) {
        // Reschedule for after quiet hours
        return { success: false, error: 'Quiet hours active - will retry' };
      }
    }

    // Generate email content based on notification type
    let emailSubject = '';
    let emailHtml = '';

    switch (notification.type) {
      case 'MATCH_REMINDER': {
        const data = notification.data;
        const hoursUntilStart = data.hoursUntilStart as number;
        
        emailSubject = hoursUntilStart <= 2 
          ? `⚡ URGENT: Match starting in ${hoursUntilStart} hours!`
          : `📅 Match reminder: ${data.tournamentName}`;
        
        emailHtml = generateMatchReminderEmail({
          recipientName,
          sport: notification.sport,
          tournamentName: data.tournamentName as string,
          tournamentId: data.tournamentId as string,
          hoursUntilStart,
          tournamentDate: data.tournamentDate as string,
          tournamentTime: data.tournamentTime as string,
          venue: data.venue as string,
          opponentName: data.opponentName as string,
          checkInRequired: data.checkInRequired as boolean,
          tournamentUrl: `https://valorhive.com/${notification.sport.toLowerCase()}/tournaments/${data.tournamentId}`,
          unsubscribeUrl: 'https://valorhive.com/unsubscribe',
          preferencesUrl: 'https://valorhive.com/settings/notifications',
          privacyUrl: 'https://valorhive.com/privacy',
        });
        break;
      }

      case 'TOURNAMENT_REMINDER': {
        const data = notification.data;
        const hoursUntilStart = data.hoursUntilStart as number;
        
        emailSubject = hoursUntilStart <= 2 
          ? `⚡ URGENT: Tournament starting in ${hoursUntilStart} hours!`
          : `📅 Tournament reminder: ${data.tournamentName}`;
        
        emailHtml = generateMatchReminderEmail({
          recipientName,
          sport: notification.sport,
          tournamentName: data.tournamentName as string,
          tournamentId: data.tournamentId as string,
          hoursUntilStart,
          tournamentDate: data.tournamentDate as string,
          tournamentTime: data.tournamentTime as string,
          venue: data.venue as string,
          checkInRequired: data.checkInRequired as boolean,
          tournamentUrl: `https://valorhive.com/${notification.sport.toLowerCase()}/tournaments/${data.tournamentId}`,
          unsubscribeUrl: 'https://valorhive.com/unsubscribe',
          preferencesUrl: 'https://valorhive.com/settings/notifications',
          privacyUrl: 'https://valorhive.com/privacy',
        });
        break;
      }

      default:
        return { success: false, error: 'Unknown notification type' };
    }

    // Send the email
    await sendEmail({
      to: recipient.email,
      subject: emailSubject,
      html: emailHtml,
    });

    // Create in-app notification
    await db.notification.create({
      data: {
        userId: notification.recipientId,
        sport: notification.sport,
        type: 'TOURNAMENT_REGISTERED', // Use existing type
        title: notification.type === 'MATCH_REMINDER' ? 'Match Reminder' : 'Tournament Reminder',
        message: `Your ${notification.type === 'MATCH_REMINDER' ? 'match' : 'tournament'} is coming up soon!`,
        link: notification.data.tournamentId as string 
          ? `/${notification.sport.toLowerCase()}/tournaments/${notification.data.tournamentId}`
          : undefined,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[NotificationScheduler] Error sending notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================
// Subscription Expiry Scheduling
// ============================================

/**
 * Schedule subscription expiry warnings
 */
export async function scheduleSubscriptionExpiryWarnings(): Promise<{
  scheduled: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let scheduled = 0;

  try {
    // Find subscriptions expiring in 7, 3, and 1 days
    const warningDays = [7, 3, 1];

    for (const days of warningDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      // Find expiring player subscriptions
      const expiringPlayers = await db.playerSubscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: targetDate,
            lte: endDate,
          },
        },
        include: {
          user: true,
        },
      });

      for (const sub of expiringPlayers) {
        if (!sub.user?.email) continue;

        const notificationId = `sub-expiry-${sub.id}-${days}d`;
        
        const notification: ScheduledNotification = {
          id: notificationId,
          type: 'SUBSCRIPTION_EXPIRY',
          scheduledFor: new Date(),
          recipientId: sub.userId,
          recipientType: 'USER',
          sport: sub.sport,
          data: {
            subscriptionId: sub.id,
            daysRemaining: days,
            expiryDate: sub.endDate,
            planType: sub.planTier,
          },
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        scheduledNotifications.set(notificationId, notification);
        scheduled++;
      }

      // Find expiring org subscriptions
      const expiringOrgs = await db.orgSubscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: targetDate,
            lte: endDate,
          },
        },
        include: {
          org: true,
        },
      });

      for (const sub of expiringOrgs) {
        if (!sub.org?.email) continue;

        const notificationId = `org-sub-expiry-${sub.id}-${days}d`;
        
        const notification: ScheduledNotification = {
          id: notificationId,
          type: 'SUBSCRIPTION_EXPIRY',
          scheduledFor: new Date(),
          recipientId: sub.orgId,
          recipientType: 'ORG',
          sport: sub.sport,
          data: {
            subscriptionId: sub.id,
            daysRemaining: days,
            expiryDate: sub.endDate,
            planType: sub.planTier,
          },
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        scheduledNotifications.set(notificationId, notification);
        scheduled++;
      }
    }

    console.log(`[NotificationScheduler] Scheduled ${scheduled} subscription expiry warnings`);
    return { scheduled, errors };
  } catch (error) {
    console.error('[NotificationScheduler] Error scheduling subscription warnings:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { scheduled, errors };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Cancel scheduled notifications for a match
 */
export function cancelMatchReminders(matchId: string): number {
  let cancelled = 0;
  for (const [id, notification] of scheduledNotifications) {
    if (notification.type === 'MATCH_REMINDER' && notification.data.matchId === matchId) {
      notification.status = 'CANCELLED';
      scheduledNotifications.delete(id);
      cancelled++;
    }
  }
  return cancelled;
}

/**
 * Cancel scheduled notifications for a tournament
 */
export function cancelTournamentReminders(tournamentId: string): number {
  let cancelled = 0;
  for (const [id, notification] of scheduledNotifications) {
    if (notification.data.tournamentId === tournamentId) {
      notification.status = 'CANCELLED';
      scheduledNotifications.delete(id);
      cancelled++;
    }
  }
  return cancelled;
}

/**
 * Get pending notification count
 */
export function getPendingNotificationCount(): number {
  let count = 0;
  for (const notification of scheduledNotifications.values()) {
    if (notification.status === 'PENDING') count++;
  }
  return count;
}

/**
 * Get all scheduled notifications (for debugging)
 */
export function getScheduledNotifications(): ScheduledNotification[] {
  return Array.from(scheduledNotifications.values());
}

/**
 * Initialize scheduler with existing tournament reminders
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[NotificationScheduler] Initializing...');
  
  try {
    // Schedule reminders for all in-progress and upcoming tournaments
    const tournaments = await db.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.IN_PROGRESS],
        },
        startDate: {
          gte: new Date(),
        },
      },
      select: { id: true },
    });

    for (const tournament of tournaments) {
      await scheduleTournamentReminders(tournament.id);
    }

    // Schedule subscription expiry warnings
    await scheduleSubscriptionExpiryWarnings();

    console.log(`[NotificationScheduler] Initialized with ${getPendingNotificationCount()} pending notifications`);
  } catch (error) {
    console.error('[NotificationScheduler] Error initializing:', error);
  }
}

// Export for cron job usage
export default {
  scheduleMatchReminders,
  scheduleTournamentReminders,
  processScheduledNotifications,
  scheduleSubscriptionExpiryWarnings,
  cancelMatchReminders,
  cancelTournamentReminders,
  getPendingNotificationCount,
  getScheduledNotifications,
  initializeScheduler,
};
