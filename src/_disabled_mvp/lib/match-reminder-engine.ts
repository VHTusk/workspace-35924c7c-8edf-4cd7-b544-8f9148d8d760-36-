/**
 * VALORHIVE Match Reminder Engine (v3.51.0)
 * 
 * Unified match reminder system that sends notifications via:
 * - Email
 * - Push (FCM)
 * - WhatsApp
 * - In-app notifications
 * 
 * Reminders are scheduled at: 2 hours, 30 minutes, 5 minutes before match
 */

import { db } from './db';
import { SportType } from '@prisma/client';
import { sendPushNotification } from './push-notifications';
import { sendEmail } from './email';
import { generateMatchReminderEmail } from './email-templates';
import { sendTemplatedWhatsApp, WhatsAppTemplates } from './whatsapp';

// ============================================
// TYPES
// ============================================

export interface MatchReminderPayload {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  sport: SportType;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  opponentName: string;
  scheduledTime: Date;
  venue: string;
  court?: string;
  minutesBefore: number;
}

export interface ReminderResult {
  success: boolean;
  emailSent: boolean;
  pushSent: boolean;
  whatsappSent: boolean;
  inAppCreated: boolean;
  error?: string;
}

export interface BatchReminderResult {
  processed: number;
  sent: number;
  failed: number;
  byChannel: {
    email: number;
    push: number;
    whatsapp: number;
    inApp: number;
  };
  errors: string[];
}

// ============================================
// REMINDER CONFIGURATION
// ============================================

const REMINDER_INTERVALS_MINUTES = [120, 30, 5]; // 2 hours, 30 min, 5 min

// ============================================
// MAIN REMINDER FUNCTIONS
// ============================================

/**
 * Process match reminders for all upcoming matches
 * Called by cron job every minute
 */
export async function processMatchReminders(): Promise<BatchReminderResult> {
  const result: BatchReminderResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    byChannel: { email: 0, push: 0, whatsapp: 0, inApp: 0 },
    errors: [],
  };

  try {
    const now = new Date();

    // Find all matches scheduled within the next 2 hours
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const upcomingMatches = await db.match.findMany({
      where: {
        scheduledTime: {
          gte: now,
          lte: twoHoursFromNow,
        },
        tournament: {
          status: { in: ['BRACKET_GENERATED', 'IN_PROGRESS'] },
        },
      },
      include: {
        tournament: true,
        playerA: true,
        playerB: true,
        matchReminders: true,
      },
    });

    for (const match of upcomingMatches) {
      if (!match.scheduledTime) continue;

      const minutesUntilMatch = Math.floor(
        (match.scheduledTime.getTime() - now.getTime()) / (1000 * 60)
      );

      // Check each reminder interval
      for (const minutesBefore of REMINDER_INTERVALS_MINUTES) {
        // Check if we're within the reminder window (±2 minutes tolerance)
        if (Math.abs(minutesUntilMatch - minutesBefore) <= 2) {
          // Process for player A
          if (match.playerA) {
            const alreadySent = match.matchReminders.some(
              (r) => r.userId === match.playerAId && r.minutesBefore === minutesBefore
            );

            if (!alreadySent) {
              const reminderResult = await sendMatchReminder({
                matchId: match.id,
                tournamentId: match.tournamentId!,
                tournamentName: match.tournament?.name || 'Tournament',
                sport: match.sport,
                userId: match.playerA.id,
                userName: `${match.playerA.firstName} ${match.playerA.lastName}`,
                userEmail: match.playerA.email || undefined,
                userPhone: match.playerA.phone || undefined,
                opponentName: match.playerB
                  ? `${match.playerB.firstName} ${match.playerB.lastName}`
                  : 'TBD',
                scheduledTime: match.scheduledTime,
                venue: match.tournament?.location || 'TBD',
                court: match.courtName || undefined,
                minutesBefore,
              });

              result.processed++;
              if (reminderResult.success) {
                result.sent++;
                if (reminderResult.emailSent) result.byChannel.email++;
                if (reminderResult.pushSent) result.byChannel.push++;
                if (reminderResult.whatsappSent) result.byChannel.whatsapp++;
                if (reminderResult.inAppCreated) result.byChannel.inApp++;

                // Log the reminder
                await db.matchReminder.create({
                  data: {
                    matchId: match.id,
                    userId: match.playerA.id,
                    minutesBefore,
                    sentAt: new Date(),
                  },
                });
              } else {
                result.failed++;
                result.errors.push(`Failed for ${match.playerA.id}: ${reminderResult.error}`);
              }
            }
          }

          // Process for player B
          if (match.playerB) {
            const alreadySent = match.matchReminders.some(
              (r) => r.userId === match.playerBId && r.minutesBefore === minutesBefore
            );

            if (!alreadySent) {
              const reminderResult = await sendMatchReminder({
                matchId: match.id,
                tournamentId: match.tournamentId!,
                tournamentName: match.tournament?.name || 'Tournament',
                sport: match.sport,
                userId: match.playerB.id,
                userName: `${match.playerB.firstName} ${match.playerB.lastName}`,
                userEmail: match.playerB.email || undefined,
                userPhone: match.playerB.phone || undefined,
                opponentName: match.playerA
                  ? `${match.playerA.firstName} ${match.playerA.lastName}`
                  : 'TBD',
                scheduledTime: match.scheduledTime,
                venue: match.tournament?.location || 'TBD',
                court: match.courtName || undefined,
                minutesBefore,
              });

              result.processed++;
              if (reminderResult.success) {
                result.sent++;
                if (reminderResult.emailSent) result.byChannel.email++;
                if (reminderResult.pushSent) result.byChannel.push++;
                if (reminderResult.whatsappSent) result.byChannel.whatsapp++;
                if (reminderResult.inAppCreated) result.byChannel.inApp++;

                // Log the reminder
                await db.matchReminder.create({
                  data: {
                    matchId: match.id,
                    userId: match.playerB.id,
                    minutesBefore,
                    sentAt: new Date(),
                  },
                });
              } else {
                result.failed++;
                result.errors.push(`Failed for ${match.playerB.id}: ${reminderResult.error}`);
              }
            }
          }
        }
      }
    }

    console.log(`[MatchReminders] Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`);
    return result;
  } catch (error) {
    result.errors.push(`Batch error: ${error}`);
    return result;
  }
}

/**
 * Send a match reminder through all enabled channels
 */
export async function sendMatchReminder(payload: MatchReminderPayload): Promise<ReminderResult> {
  const result: ReminderResult = {
    success: false,
    emailSent: false,
    pushSent: false,
    whatsappSent: false,
    inAppCreated: false,
  };

  try {
    // Get user notification preferences
    const pushSettings = await db.pushNotificationSetting.findUnique({
      where: { userId_sport: { userId: payload.userId, sport: payload.sport } },
    });

    const emailSettings = await db.emailNotificationSetting.findUnique({
      where: { userId_sport: { userId: payload.userId, sport: payload.sport } },
    });

    // Format time string
    const timeString = formatTimeRemaining(payload.minutesBefore);

    // 1. Send Push Notification (if enabled)
    if (pushSettings?.matchReminders ?? true) {
      try {
        const pushResult = await sendPushNotification(
          payload.userId,
          `⚔️ Match in ${timeString}!`,
          `vs ${payload.opponentName} at ${payload.venue}${payload.court ? ` (Court: ${payload.court})` : ''}`,
          {
            type: 'MATCH_REMINDER',
            matchId: payload.matchId,
            tournamentId: payload.tournamentId,
            minutesBefore: payload.minutesBefore.toString(),
          },
          { priority: 'high', contentAvailable: true }
        );
        result.pushSent = pushResult.sentCount > 0;
      } catch (error) {
        console.error('Push notification error:', error);
      }
    }

    // 2. Send Email (if enabled and email exists)
    if ((emailSettings?.matchReminders ?? true) && payload.userEmail) {
      try {
        const emailHtml = generateMatchReminderEmail({
          recipientName: payload.userName,
          sport: payload.sport,
          tournamentName: payload.tournamentName,
          tournamentId: payload.tournamentId,
          hoursUntilStart: payload.minutesBefore / 60,
          tournamentDate: payload.scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          tournamentTime: payload.scheduledTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          venue: payload.venue,
          opponentName: payload.opponentName,
          court: payload.court,
          checkInRequired: true,
          tournamentUrl: `https://valorhive.com/${payload.sport.toLowerCase()}/tournaments/${payload.tournamentId}`,
          unsubscribeUrl: 'https://valorhive.com/unsubscribe',
          preferencesUrl: 'https://valorhive.com/settings/notifications',
          privacyUrl: 'https://valorhive.com/privacy',
        });

        await sendEmail({
          to: payload.userEmail,
          subject: `⚔️ Match Reminder: vs ${payload.opponentName} in ${timeString}`,
          html: emailHtml,
        });
        result.emailSent = true;
      } catch (error) {
        console.error('Email notification error:', error);
      }
    }

    // 3. Create In-App Notification
    try {
      await db.notification.create({
        data: {
          userId: payload.userId,
          sport: payload.sport,
          type: 'MATCH_RESULT',
          title: `Match in ${timeString}`,
          message: `Your match vs ${payload.opponentName} starts ${payload.minutesBefore < 60 ? 'soon' : `in ${timeString}`} at ${payload.venue}`,
          link: `/${payload.sport.toLowerCase()}/tournaments/${payload.tournamentId}`,
        },
      });
      result.inAppCreated = true;
    } catch (error) {
      console.error('In-app notification error:', error);
    }

    // 4. WhatsApp - Send via WhatsApp Business API
    if (payload.userPhone) {
      try {
        // Get WhatsApp notification settings for the user
        const whatsappSettings = await db.whatsAppNotificationSetting.findUnique({
          where: { userId_sport: { userId: payload.userId, sport: payload.sport } },
        });

        // Check if WhatsApp notifications are enabled (default to true for match reminders)
        const whatsappEnabled = whatsappSettings?.matchReminders ?? true;

        if (whatsappEnabled) {
          // Determine which template to use based on time remaining
          const template = payload.minutesBefore <= 5 
            ? WhatsAppTemplates.MATCH_STARTING 
            : WhatsAppTemplates.MATCH_REMINDER;

          // Format match time for display
          const matchTimeStr = payload.scheduledTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          // Generate check-in code (could be from match or tournament settings)
          const checkInCode = payload.matchId.substring(0, 6).toUpperCase();

          const whatsappResult = await sendTemplatedWhatsApp(
            payload.userPhone,
            template,
            {
              playerName: payload.userName,
              tournamentName: payload.tournamentName,
              opponentName: payload.opponentName,
              matchTime: matchTimeStr,
              venue: payload.venue,
              courtName: payload.court,
              checkInCode: checkInCode,
              sport: payload.sport,
            }
          );

          result.whatsappSent = whatsappResult.success;

          if (!whatsappResult.success) {
            console.error('WhatsApp notification error:', whatsappResult.error);
          }
        }
      } catch (error) {
        console.error('WhatsApp notification error:', error);
        // Don't fail the entire reminder if WhatsApp fails
        // Rate limiting and other issues should not block other channels
      }
    }

    // Mark success if at least one channel succeeded
    result.success = result.emailSent || result.pushSent || result.whatsappSent || result.inAppCreated;

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Send immediate match alert (for when match is about to start)
 */
export async function sendImmediateMatchAlert(
  userId: string,
  matchDetails: {
    opponentName: string;
    venue: string;
    court?: string;
    tournamentId: string;
    sport: SportType;
  }
): Promise<void> {
  // High-priority push notification
  await sendPushNotification(
    userId,
    '🔔 Your match is starting NOW!',
    `vs ${matchDetails.opponentName} at ${matchDetails.venue}${matchDetails.court ? ` (Court: ${matchDetails.court})` : ''}`,
    {
      type: 'MATCH_STARTING',
      tournamentId: matchDetails.tournamentId,
    },
    { priority: 'high', contentAvailable: true }
  );
}

// ============================================
// HELPERS
// ============================================

function formatTimeRemaining(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
}

/**
 * Schedule reminders for a specific match
 */
export async function scheduleRemindersForMatch(
  matchId: string,
  scheduledTime: Date
): Promise<{ scheduled: number }> {
  // This would integrate with a job scheduler (e.g., Bull, Agenda)
  // For now, reminders are processed by the cron job
  return { scheduled: REMINDER_INTERVALS_MINUTES.length * 2 }; // 2 players
}

/**
 * Clean up old match reminders
 */
export async function cleanupOldMatchReminders(): Promise<{ deleted: number }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db.matchReminder.deleteMany({
    where: {
      sentAt: { lt: oneDayAgo },
    },
  });

  return { deleted: result.count };
}

/**
 * Get reminder statistics
 */
export async function getReminderStats(): Promise<{
  pendingReminders: number;
  sentToday: number;
  sentThisWeek: number;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [pending, sentToday, sentThisWeek] = await Promise.all([
    db.matchReminder.count({
      where: { sentAt: null },
    }),
    db.matchReminder.count({
      where: { sentAt: { gte: todayStart } },
    }),
    db.matchReminder.count({
      where: { sentAt: { gte: weekStart } },
    }),
  ]);

  return { pendingReminders: pending, sentToday, sentThisWeek };
}
