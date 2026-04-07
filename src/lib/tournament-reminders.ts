// VALORHIVE Tournament Reminder Sequence
// Pre-tournament reminder system (48hr, 24hr, 2hr before tournament)

import { db } from './db';
import { emailService, NotificationService } from './email-service';
import { SportType, TournamentStatus } from '@prisma/client';

// Reminder configuration
const REMINDER_INTERVALS = [
  { hoursBefore: 48, label: '48-hour reminder' },
  { hoursBefore: 24, label: '24-hour reminder' },
  { hoursBefore: 2, label: '2-hour reminder' },
];

// Reminder tracking is now stored in database via TournamentReminder model
// This persists across server restarts and supports horizontal scaling

// ============================================
// REMINDER SEQUENCE FUNCTIONS
// ============================================

/**
 * Get the reminder key for tracking
 */
const getReminderKey = (tournamentId: string, userId: string, hoursBefore: number): string => {
  return `${tournamentId}:${userId}:${hoursBefore}hr`;
};

/**
 * Check if a reminder has already been sent (database-backed)
 */
const hasReminderBeenSent = async (tournamentId: string, userId: string, hoursBefore: number): Promise<boolean> => {
  const reminder = await db.tournamentReminder.findUnique({
    where: {
      tournamentId_userId_hoursBefore: {
        tournamentId,
        userId,
        hoursBefore,
      },
    },
  });
  return reminder?.sentAt !== null;
};

/**
 * Mark a reminder as sent (database-backed)
 */
const markReminderSent = async (tournamentId: string, userId: string, hoursBefore: number): Promise<void> => {
  await db.tournamentReminder.upsert({
    where: {
      tournamentId_userId_hoursBefore: {
        tournamentId,
        userId,
        hoursBefore,
      },
    },
    create: {
      tournamentId,
      userId,
      hoursBefore,
      sentAt: new Date(),
    },
    update: {
      sentAt: new Date(),
    },
  });
};

/**
 * Clear reminder tracking for completed/cancelled tournaments (database-backed)
 */
export const clearTournamentReminders = async (tournamentId: string): Promise<void> => {
  await db.tournamentReminder.deleteMany({
    where: { tournamentId },
  });
};

/**
 * Calculate hours until tournament start
 */
const getHoursUntilStart = (startDate: Date): number => {
  const now = new Date();
  const diffMs = startDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
};

/**
 * Get tournament details with registered players
 */
const getTournamentWithPlayers = async (tournamentId: string) => {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      bracket: {
        include: {
          matches: {
            where: { status: 'PENDING' },
            orderBy: { matchNumber: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  return tournament;
};

/**
 * Get player's first match details
 */
const getPlayerFirstMatch = async (tournamentId: string, userId: string) => {
  const bracket = await db.bracket.findFirst({
    where: { tournamentId },
    include: {
      matches: {
        where: {
          OR: [
            { playerAId: userId },
            { playerBId: userId },
          ],
          status: 'PENDING',
        },
        orderBy: { matchNumber: 'asc' },
        take: 1,
      },
    },
  });

  const firstMatch = bracket?.matches[0];
  
  if (!firstMatch) return null;

  const opponentId = firstMatch.playerAId === userId ? firstMatch.playerBId : firstMatch.playerAId;
  
  let opponent = null;
  if (opponentId) {
    opponent = await db.user.findUnique({
      where: { id: opponentId },
      select: { firstName: true, lastName: true },
    });
  }

  return {
    matchTime: firstMatch.scheduledAt?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    court: firstMatch.courtAssignment,
    opponentName: opponent ? `${opponent.firstName} ${opponent.lastName}` : undefined,
  };
};

/**
 * Get user notification preferences
 */
const getUserNotificationPreferences = async (userId: string, sport: SportType) => {
  const emailSettings = await db.emailNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } },
  });

  const whatsappSettings = await db.whatsAppNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } },
  });

  return {
    emailEnabled: emailSettings?.tournamentUpdates ?? true,
    whatsappEnabled: whatsappSettings?.tournamentUpdates ?? true,
    whatsappVerified: whatsappSettings?.verified ?? false,
  };
};

/**
 * Check if current time is within quiet hours for a user
 */
const isWithinQuietHours = (settings: { quietHoursStart?: number | null; quietHoursEnd?: number | null; quietHoursTimezone?: string | null } | null): boolean => {
  if (!settings?.quietHoursStart || !settings?.quietHoursEnd) return false;
  
  const now = new Date();
  // Use user's timezone (default Asia/Kolkata)
  const timezone = settings.quietHoursTimezone || 'Asia/Kolkata';
  const localHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
  
  if (settings.quietHoursStart < settings.quietHoursEnd) {
    // Quiet hours don't span midnight (e.g., 22:00 - 06:00)
    return localHour >= settings.quietHoursStart && localHour < settings.quietHoursEnd;
  } else {
    // Quiet hours span midnight
    return localHour >= settings.quietHoursStart || localHour < settings.quietHoursEnd;
  }
};

// ============================================
// MAIN REMINDER PROCESSING FUNCTIONS
// ============================================

/**
 * Process reminders for a single tournament
 */
export const processTournamentReminders = async (tournamentId: string): Promise<{
  tournamentId: string;
  remindersSent: number;
  errors: string[];
}> => {
  const result = {
    tournamentId,
    remindersSent: 0,
    errors: [] as string[],
  };

  try {
    const tournament = await getTournamentWithPlayers(tournamentId);
    
    if (!tournament) {
      result.errors.push('Tournament not found');
      return result;
    }

    if (tournament.status !== TournamentStatus.BRACKET_GENERATED && tournament.status !== TournamentStatus.IN_PROGRESS) {
      return result; // No reminders for tournaments not ready
    }

    const hoursUntilStart = getHoursUntilStart(tournament.startDate);
    
    // Determine which reminder type to send
    let reminderToSend: typeof REMINDER_INTERVALS[0] | undefined;
    
    for (const interval of REMINDER_INTERVALS) {
      if (hoursUntilStart <= interval.hoursBefore && hoursUntilStart > (REMINDER_INTERVALS[REMINDER_INTERVALS.indexOf(interval) + 1]?.hoursBefore || 0)) {
        reminderToSend = interval;
        break;
      }
    }

    if (!reminderToSend) {
      return result; // No reminder needed at this time
    }

    const notificationService = new NotificationService();

    // Process each registered player
    for (const registration of tournament.registrations) {
      const user = registration.user;
      
      // Skip if this reminder was already sent
      if (await hasReminderBeenSent(tournamentId, user.id, reminderToSend.hoursBefore)) {
        continue;
      }

      try {
        const preferences = await getUserNotificationPreferences(user.id, tournament.sport);
        
        // Skip if both notifications disabled
        if (!preferences.emailEnabled && !preferences.whatsappEnabled) {
          continue;
        }

        // Get first match details
        const firstMatch = await getPlayerFirstMatch(tournamentId, user.id);

        // Format dates
        const tournamentDate = tournament.startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        
        const tournamentTime = tournament.startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const checkinDeadline = tournament.startDate ? 
          new Date(tournament.startDate.getTime() - 30 * 60 * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }) : undefined;

        // Send reminder
        const reminderResult = await notificationService.sendTournamentReminder(
          user,
          {
            sport: tournament.sport,
            tournamentName: tournament.name,
            tournamentDate,
            tournamentTime,
            venue: tournament.location,
            hoursUntilStart: reminderToSend.hoursBefore,
            checkinRequired: true, // Always require check-in
            checkinDeadline,
            tournamentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com'}/${tournament.sport.toLowerCase()}/tournaments/${tournamentId}`,
            opponentName: firstMatch?.opponentName,
            matchTime: firstMatch?.matchTime,
            court: firstMatch?.court || undefined,
          },
          preferences
        );

        if (reminderResult.emailSent || reminderResult.whatsappSent) {
          await markReminderSent(tournamentId, user.id, reminderToSend.hoursBefore);
          result.remindersSent++;
        }
      } catch (error) {
        result.errors.push(`Failed to send to user ${user.id}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Processing error: ${error}`);
  }

  return result;
};

/**
 * Process all active tournaments for reminders
 */
export const processAllTournamentReminders = async (): Promise<{
  tournamentsProcessed: number;
  totalRemindersSent: number;
  errors: string[];
}> => {
  const result = {
    tournamentsProcessed: 0,
    totalRemindersSent: 0,
    errors: [] as string[],
  };

  try {
    // Get all tournaments starting within the next 48 hours
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcomingTournaments = await db.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.BRACKET_GENERATED, TournamentStatus.IN_PROGRESS],
        },
        startDate: {
          gte: now,
          lte: fortyEightHoursFromNow,
        },
      },
      select: { id: true },
    });

    console.log(`📧 Processing reminders for ${upcomingTournaments.length} upcoming tournaments`);

    for (const tournament of upcomingTournaments) {
      const tournamentResult = await processTournamentReminders(tournament.id);
      result.tournamentsProcessed++;
      result.totalRemindersSent += tournamentResult.remindersSent;
      result.errors.push(...tournamentResult.errors);
    }

    // Clean up old reminder tracking (for completed tournaments)
    const completedTournaments = await db.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED],
        },
      },
      select: { id: true },
    });

    for (const tournament of completedTournaments) {
      await clearTournamentReminders(tournament.id);
    }
  } catch (error) {
    result.errors.push(`Batch processing error: ${error}`);
  }

  return result;
};

// ============================================
// EXPORTS
// ============================================

export const reminderIntervals = REMINDER_INTERVALS;
