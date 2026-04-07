/**
 * VALORHIVE Event Workers
 * 
 * Domain-specific workers that subscribe to events and process them.
 * Each worker is responsible for a specific bounded context.
 * 
 * Workers:
 * - LeaderboardWorker: Updates leaderboards on match/rating events
 * - NotificationWorker: Sends notifications on various events
 * - AnalyticsWorker: Updates analytics and projections
 * - ActivityFeedWorker: Creates activity feed entries
 * - PlayerStatsWorker: Updates player statistics
 * 
 * @module event-workers
 */

import { 
  EventBus, 
  DomainEvent, 
  DomainEventType, 
  STREAM_NAMES, 
  subscribeToEvents,
  EventMetadata 
} from './event-bus';
import { db } from './db';
import { SportType } from '@prisma/client';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';
import { computeLeaderboard, onMatchCompleted, onTournamentCompleted, onPlayerRatingChange } from './leaderboard-engine';
import { sendPushNotification } from './push-notifications';
import { sendTemplatedWhatsApp, WhatsAppTemplates } from './whatsapp';
import { emailService } from './email-service';
import { createNotification } from './notifications';
import { recordMetric } from './metrics';

const logger = createLogger('EventWorkers');

// ============================================
// Leaderboard Worker
// ============================================

const LEADERBOARD_EVENTS: DomainEventType[] = [
  'MATCH_COMPLETED',
  'PLAYER_RATING_CHANGED',
  'TOURNAMENT_COMPLETED',
  'LEADERBOARD_UPDATE_REQUESTED',
];

export async function createLeaderboardWorker(): Promise<void> {
  await subscribeToEvents({
    streamName: STREAM_NAMES.LEADERBOARD,
    consumerGroup: 'leaderboard-workers',
    consumerName: `leaderboard-${process.pid}`,
    eventTypes: LEADERBOARD_EVENTS,
    handler: handleLeaderboardEvent,
  });
}

async function handleLeaderboardEvent(event: DomainEvent): Promise<void> {
  const startTime = Date.now();
  logger.info(`Processing leaderboard event: ${event.eventType}`);

  try {
    switch (event.eventType) {
      case 'MATCH_COMPLETED':
        await onMatchCompleted(
          event.aggregateId,
          event.payload.sport as SportType,
          [event.payload.winnerId, event.payload.loserId],
          event.payload.tournamentId
        );
        break;

      case 'PLAYER_RATING_CHANGED':
        await onPlayerRatingChange(
          event.payload.playerId,
          event.payload.sport as SportType
        );
        break;

      case 'TOURNAMENT_COMPLETED':
        await onTournamentCompleted(
          event.aggregateId,
          event.payload.sport as SportType
        );
        break;

      case 'LEADERBOARD_UPDATE_REQUESTED':
        await computeLeaderboard({
          sport: event.payload.sport as SportType,
          type: event.payload.type,
          scopeValue: event.payload.scopeValue,
        });
        break;
    }

    recordMetric('event.leaderboard.processed', 1, { event_type: event.eventType });
    recordMetric('event.leaderboard.latency', Date.now() - startTime);
  } catch (error) {
    logger.error(`Leaderboard event failed: ${event.eventType}`, error);
    throw error;
  }
}

// ============================================
// Notification Worker
// ============================================

const NOTIFICATION_EVENTS: DomainEventType[] = [
  'MATCH_COMPLETED',
  'TOURNAMENT_CREATED',
  'TOURNAMENT_REGISTRATION_OPENED',
  'PLAYER_REGISTERED_TOURNAMENT',
  'WAITLIST_PROMOTED',
  'PAYMENT_CONFIRMED',
  'REFUND_PROCESSED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'BADGE_AWARDED',
  'MILESTONE_REACHED',
  'USER_REGISTERED',
];

export async function createNotificationWorker(): Promise<void> {
  await subscribeToEvents({
    streamName: STREAM_NAMES.ALL,
    consumerGroup: 'notification-workers',
    consumerName: `notification-${process.pid}`,
    eventTypes: NOTIFICATION_EVENTS,
    handler: handleNotificationEvent,
  });
}

async function handleNotificationEvent(event: DomainEvent): Promise<void> {
  const startTime = Date.now();
  logger.info(`Processing notification event: ${event.eventType}`);

  try {
    switch (event.eventType) {
      case 'MATCH_COMPLETED':
        await sendMatchResultNotifications(event);
        break;

      case 'TOURNAMENT_CREATED':
      case 'TOURNAMENT_REGISTRATION_OPENED':
        await sendTournamentAnnouncement(event);
        break;

      case 'PLAYER_REGISTERED_TOURNAMENT':
        await sendRegistrationConfirmation(event);
        break;

      case 'WAITLIST_PROMOTED':
        await sendWaitlistPromotionNotification(event);
        break;

      case 'PAYMENT_CONFIRMED':
        await sendPaymentConfirmation(event);
        break;

      case 'BADGE_AWARDED':
        await sendBadgeNotification(event);
        break;

      case 'MILESTONE_REACHED':
        await sendMilestoneNotification(event);
        break;

      case 'USER_REGISTERED':
        await sendWelcomeNotification(event);
        break;
    }

    recordMetric('event.notification.processed', 1, { event_type: event.eventType });
    recordMetric('event.notification.latency', Date.now() - startTime);
  } catch (error) {
    logger.error(`Notification event failed: ${event.eventType}`, error);
    throw error;
  }
}

async function sendMatchResultNotifications(event: DomainEvent): Promise<void> {
  const { winnerId, loserId, score, sport } = event.payload;

  // Winner notification
  await createNotification({
    userId: winnerId as string,
    sport: sport as SportType,
    type: 'MATCH_RESULT',
    title: '🎉 Victory!',
    message: `You won ${score.winner}-${score.loser}`,
    link: `/matches/${event.aggregateId}`,
  });

  await sendPushNotification(
    winnerId as string,
    '🎉 Victory!',
    `You won your match ${score.winner}-${score.loser}`,
    { matchId: event.aggregateId }
  );

  // Loser notification
  await createNotification({
    userId: loserId as string,
    sport: sport as SportType,
    type: 'MATCH_RESULT',
    title: 'Match Result',
    message: `You lost ${score.loser}-${score.winner}`,
    link: `/matches/${event.aggregateId}`,
  });
}

async function sendTournamentAnnouncement(event: DomainEvent): Promise<void> {
  // Get interested players in the region
  const tournament = await db.tournament.findUnique({
    where: { id: event.aggregateId },
    select: { name: true, city: true, state: true, sport: true },
  });

  if (!tournament) return;

  // Notify followers of the organizer (if applicable)
  // For now, this is a placeholder for the notification logic
  logger.info(`Tournament announcement: ${tournament.name}`);
}

async function sendRegistrationConfirmation(event: DomainEvent): Promise<void> {
  const { tournamentId, playerId } = event.payload;

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId as string },
    select: { name: true, startDate: true, venueGoogleMapsUrl: true },
  });

  const player = await db.user.findUnique({
    where: { id: playerId as string },
    select: { firstName: true, email: true, phone: true },
  });

  if (!tournament || !player) return;

  // In-app notification
  await createNotification({
    userId: playerId as string,
    sport: event.metadata.sport as SportType,
    type: 'TOURNAMENT_REGISTERED',
    title: 'Registration Confirmed',
    message: `You're registered for ${tournament.name}`,
    link: `/tournaments/${tournamentId}`,
  });

  // Email notification
  if (player.email) {
    await emailService.sendTournamentReminder(
      { email: player.email, name: player.firstName },
      {
        userId: playerId as string,
        sport: event.metadata.sport as SportType,
        recipientName: player.firstName,
        tournamentName: tournament.name,
        tournamentDate: tournament.startDate.toISOString(),
        venue: tournament.venueGoogleMapsUrl || 'TBD',
        matchTime: '',
        opponentName: '',
        hoursUntilStart: 24,
        tournamentUrl: `/tournaments/${tournamentId}`,
      }
    ).catch(err => logger.warn('Failed to send registration email:', err));
  }
}

async function sendWaitlistPromotionNotification(event: DomainEvent): Promise<void> {
  const { tournamentId, playerId } = event.payload;

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId as string },
    select: { name: true },
  });

  if (!tournament) return;

  await createNotification({
    userId: playerId as string,
    sport: event.metadata.sport as SportType,
    type: 'WAITLIST_PROMOTED',
    title: '🎉 You\'re In!',
    message: `You've been promoted from the waitlist for ${tournament.name}`,
    link: `/tournaments/${tournamentId}`,
  });

  await sendPushNotification(
    playerId as string,
    '🎉 You\'re In!',
    `Waitlist promotion confirmed for ${tournament.name}`,
    { tournamentId }
  );
}

async function sendPaymentConfirmation(event: DomainEvent): Promise<void> {
  const { playerId, amount } = event.payload;

  await createNotification({
    userId: playerId as string,
    sport: event.metadata.sport as SportType,
    type: 'POINTS_EARNED',
    title: 'Payment Confirmed',
    message: `Your payment of ₹${amount} has been confirmed`,
    link: '/settings/payments',
  });
}

async function sendBadgeNotification(event: DomainEvent): Promise<void> {
  const { playerId, badgeName } = event.payload;

  await createNotification({
    userId: playerId as string,
    sport: event.metadata.sport as SportType,
    type: 'MILESTONE',
    title: '🏆 Badge Earned!',
    message: `You earned the ${badgeName} badge`,
    link: '/profile/achievements',
  });

  await sendPushNotification(
    playerId as string,
    '🏆 Badge Earned!',
    `Congratulations! You earned the ${badgeName} badge`,
    { badgeName }
  );
}

async function sendMilestoneNotification(event: DomainEvent): Promise<void> {
  const { playerId, milestone } = event.payload;

  await createNotification({
    userId: playerId as string,
    sport: event.metadata.sport as SportType,
    type: 'MILESTONE',
    title: '🎯 Milestone Reached!',
    message: milestone as string,
    link: '/profile',
  });
}

async function sendWelcomeNotification(event: DomainEvent): Promise<void> {
  const { userId } = event.payload;

  await createNotification({
    userId: userId as string,
    sport: event.metadata.sport as SportType,
    type: 'TOURNAMENT_REGISTERED',
    title: 'Welcome to VALORHIVE!',
    message: 'Complete your profile to start competing',
    link: '/profile',
  });
}

// ============================================
// Analytics Worker
// ============================================

const ANALYTICS_EVENTS: DomainEventType[] = [
  'USER_REGISTERED',
  'PLAYER_REGISTERED_TOURNAMENT',
  'TOURNAMENT_CREATED',
  'MATCH_COMPLETED',
  'PAYMENT_CONFIRMED',
  'REFUND_PROCESSED',
];

export async function createAnalyticsWorker(): Promise<void> {
  await subscribeToEvents({
    streamName: STREAM_NAMES.ALL,
    consumerGroup: 'analytics-workers',
    consumerName: `analytics-${process.pid}`,
    eventTypes: ANALYTICS_EVENTS,
    handler: handleAnalyticsEvent,
  });
}

async function handleAnalyticsEvent(event: DomainEvent): Promise<void> {
  const startTime = Date.now();
  logger.info(`Processing analytics event: ${event.eventType}`);

  try {
    // Update projections
    await updateProjection(event);

    // Record metrics
    recordMetric(`event.analytics.${event.eventType.toLowerCase()}`, 1);
    recordMetric('event.analytics.latency', Date.now() - startTime);
  } catch (error) {
    logger.error(`Analytics event failed: ${event.eventType}`, error);
    throw error;
  }
}

async function updateProjection(event: DomainEvent): Promise<void> {
  switch (event.eventType) {
    case 'USER_REGISTERED':
      // Update user count projection
      await db.systemHealth.create({
        data: {
          component: 'user_projection',
          status: 'HEALTHY',
          message: `User registered: ${event.aggregateId}`,
          metrics: JSON.stringify({ type: 'user_registered' }),
        },
      });
      break;

    case 'MATCH_COMPLETED':
      // Update player stats projection
      const { winnerId, loserId, sport } = event.payload;
      
      // Update winner stats
      await db.playerSkillMetrics.upsert({
        where: { userId: winnerId as string },
        update: {
          totalWins: { increment: 1 },
          currentStreak: { increment: 1 },
          lastMatchAt: new Date(),
        },
        create: {
          userId: winnerId as string,
          totalWins: 1,
          currentStreak: 1,
          bestStreak: 1,
          lastMatchAt: new Date(),
        },
      }).catch(() => {});

      // Update loser stats
      await db.playerSkillMetrics.upsert({
        where: { userId: loserId as string },
        update: {
          totalLosses: { increment: 1 },
          currentStreak: 0,
          lastMatchAt: new Date(),
        },
        create: {
          userId: loserId as string,
          totalLosses: 1,
          currentStreak: 0,
          lastMatchAt: new Date(),
        },
      }).catch(() => {});
      break;

    case 'PAYMENT_CONFIRMED':
      // Update revenue projection
      await recordMetric('revenue.total', (event.payload.amount as number) / 100);
      break;
  }
}

// ============================================
// Activity Feed Worker
// ============================================

const ACTIVITY_EVENTS: DomainEventType[] = [
  'MATCH_COMPLETED',
  'TOURNAMENT_COMPLETED',
  'BADGE_AWARDED',
  'MILESTONE_REACHED',
  'PLAYER_REGISTERED_TOURNAMENT',
];

export async function createActivityFeedWorker(): Promise<void> {
  await subscribeToEvents({
    streamName: STREAM_NAMES.ACTIVITY,
    consumerGroup: 'activity-workers',
    consumerName: `activity-${process.pid}`,
    eventTypes: ACTIVITY_EVENTS,
    handler: handleActivityEvent,
  });
}

async function handleActivityEvent(event: DomainEvent): Promise<void> {
  const startTime = Date.now();
  logger.info(`Processing activity event: ${event.eventType}`);

  try {
    let userId: string | undefined;
    let type: string;
    let title: string;
    let description: string;

    switch (event.eventType) {
      case 'MATCH_COMPLETED':
        userId = event.payload.winnerId as string;
        type = 'MATCH_WIN';
        title = 'Match Victory';
        description = `Won a match ${event.payload.score.winner}-${event.payload.score.loser}`;
        break;

      case 'TOURNAMENT_COMPLETED':
        userId = event.payload.winnerId as string;
        type = 'TOURNAMENT_WIN';
        title = 'Tournament Champion!';
        description = 'Won the tournament';
        break;

      case 'BADGE_AWARDED':
        userId = event.payload.playerId as string;
        type = 'BADGE';
        title = 'Badge Earned';
        description = `Earned the ${event.payload.badgeName} badge`;
        break;

      case 'MILESTONE_REACHED':
        userId = event.payload.playerId as string;
        type = 'MILESTONE';
        title = 'Milestone Reached';
        description = event.payload.milestone as string;
        break;

      default:
        return;
    }

    if (userId) {
      await db.playerActivityFeedItem.create({
        data: {
          userId,
          type: type as any,
          title,
          description,
          metadata: JSON.stringify(event.payload),
          createdAt: new Date(),
        },
      });
    }

    recordMetric('event.activity.processed', 1);
    recordMetric('event.activity.latency', Date.now() - startTime);
  } catch (error) {
    logger.error(`Activity event failed: ${event.eventType}`, error);
    throw error;
  }
}

// ============================================
// Initialize All Workers
// ============================================

export async function initializeEventWorkers(): Promise<void> {
  logger.info('Initializing event workers...');

  await Promise.all([
    createLeaderboardWorker(),
    createNotificationWorker(),
    createAnalyticsWorker(),
    createActivityFeedWorker(),
  ]);

  logger.info('All event workers initialized');
}

// ============================================
// Worker Management
// ============================================

let workersRunning = false;

export async function startEventWorkers(): Promise<void> {
  if (workersRunning) {
    logger.warn('Event workers already running');
    return;
  }

  const eventBus = new EventBus();
  await eventBus.initialize();
  await initializeEventWorkers();
  await eventBus.startConsuming();

  workersRunning = true;
  logger.info('Event workers started');
}

export async function stopEventWorkers(): Promise<void> {
  if (!workersRunning) return;

  const eventBus = new EventBus();
  await eventBus.stop();

  workersRunning = false;
  logger.info('Event workers stopped');
}
