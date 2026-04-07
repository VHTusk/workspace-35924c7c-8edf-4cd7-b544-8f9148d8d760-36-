/**
 * VALORHIVE Event Integration
 * 
 * Integration layer connecting existing services to the event bus.
 * This module provides drop-in replacements for direct service calls
 * that instead emit events for async processing.
 * 
 * Benefits:
 * - Decouples services
 * - Prevents cascading failures
 * - Enables horizontal scaling
 * - Faster API responses
 * 
 * @module event-integration
 */

import { publishEvent, EventBuilders, DomainEventType, EventMetadata } from './event-bus';
import { SportType } from '@prisma/client';
import { createLogger } from './logger';

const logger = createLogger('EventIntegration');

// ============================================
// Match Events
// ============================================

export interface MatchCompletedEventData {
  matchId: string;
  tournamentId: string;
  winnerId: string;
  loserId: string;
  score: { winner: number; loser: number };
  sport: SportType;
  pointsAwarded?: number;
  eloChange?: number;
}

/**
 * Emit match completed event
 * 
 * This replaces direct calls to:
 * - updateLeaderboard()
 * - sendNotifications()
 * - updatePlayerStats()
 * - updateAnalytics()
 */
export async function emitMatchCompleted(
  data: MatchCompletedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting MATCH_COMPLETED event: ${data.matchId}`);

  await publishEvent(
    'MATCH_COMPLETED',
    data.matchId,
    'Match',
    {
      matchId: data.matchId,
      tournamentId: data.tournamentId,
      winnerId: data.winnerId,
      loserId: data.loserId,
      score: data.score,
      pointsAwarded: data.pointsAwarded,
      eloChange: data.eloChange,
    },
    {
      sport: data.sport,
      userId: data.winnerId,
      severity: 'high',
      ...metadata,
    }
  );
}

// ============================================
// Tournament Events
// ============================================

export interface TournamentCreatedEventData {
  tournamentId: string;
  name: string;
  sport: SportType;
  orgId?: string;
  city?: string;
  state?: string;
  startDate: Date;
}

/**
 * Emit tournament created event
 */
export async function emitTournamentCreated(
  data: TournamentCreatedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting TOURNAMENT_CREATED event: ${data.tournamentId}`);

  await publishEvent(
    'TOURNAMENT_CREATED',
    data.tournamentId,
    'Tournament',
    {
      tournamentId: data.tournamentId,
      name: data.name,
      orgId: data.orgId,
      city: data.city,
      state: data.state,
      startDate: data.startDate.toISOString(),
    },
    {
      sport: data.sport,
      orgId: data.orgId,
      ...metadata,
    }
  );
}

export interface TournamentCompletedEventData {
  tournamentId: string;
  sport: SportType;
  winnerId: string;
  runnerUpId?: string;
  totalMatches: number;
  totalPlayers: number;
}

/**
 * Emit tournament completed event
 */
export async function emitTournamentCompleted(
  data: TournamentCompletedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting TOURNAMENT_COMPLETED event: ${data.tournamentId}`);

  await publishEvent(
    'TOURNAMENT_COMPLETED',
    data.tournamentId,
    'Tournament',
    {
      tournamentId: data.tournamentId,
      winnerId: data.winnerId,
      runnerUpId: data.runnerUpId,
      totalMatches: data.totalMatches,
      totalPlayers: data.totalPlayers,
    },
    {
      sport: data.sport,
      userId: data.winnerId,
      severity: 'high',
      ...metadata,
    }
  );
}

// ============================================
// Player Events
// ============================================

export interface PlayerRegisteredEventData {
  tournamentId: string;
  playerId: string;
  sport: SportType;
  registrationType: 'INDIVIDUAL' | 'TEAM';
  teamId?: string;
}

/**
 * Emit player registered event
 */
export async function emitPlayerRegistered(
  data: PlayerRegisteredEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting PLAYER_REGISTERED_TOURNAMENT event: ${data.tournamentId}`);

  await publishEvent(
    'PLAYER_REGISTERED_TOURNAMENT',
    `${data.tournamentId}-${data.playerId}`,
    'TournamentRegistration',
    {
      tournamentId: data.tournamentId,
      playerId: data.playerId,
      registrationType: data.registrationType,
      teamId: data.teamId,
    },
    {
      sport: data.sport,
      userId: data.playerId,
      ...metadata,
    }
  );
}

export interface PlayerRatingChangedEventData {
  playerId: string;
  oldRating: number;
  newRating: number;
  oldPoints: number;
  newPoints: number;
  reason: 'MATCH_WIN' | 'MATCH_LOSS' | 'TOURNAMENT_WIN' | 'ADMIN_ADJUSTMENT';
  matchId?: string;
  tournamentId?: string;
  sport: SportType;
}

/**
 * Emit player rating changed event
 */
export async function emitPlayerRatingChanged(
  data: PlayerRatingChangedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting PLAYER_RATING_CHANGED event for player: ${data.playerId}`);

  await publishEvent(
    'PLAYER_RATING_CHANGED',
    data.playerId,
    'PlayerRating',
    {
      playerId: data.playerId,
      oldRating: data.oldRating,
      newRating: data.newRating,
      oldPoints: data.oldPoints,
      newPoints: data.newPoints,
      reason: data.reason,
      matchId: data.matchId,
      tournamentId: data.tournamentId,
    },
    {
      sport: data.sport,
      userId: data.playerId,
      severity: 'high',
      ...metadata,
    }
  );
}

// ============================================
// Payment Events
// ============================================

export interface PaymentConfirmedEventData {
  paymentId: string;
  orderId: string;
  playerId: string;
  amount: number;
  currency: string;
  sport: SportType;
  paymentFor: 'TOURNAMENT' | 'SUBSCRIPTION' | 'OTHER';
  referenceId?: string;
}

/**
 * Emit payment confirmed event
 */
export async function emitPaymentConfirmed(
  data: PaymentConfirmedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting PAYMENT_CONFIRMED event: ${data.paymentId}`);

  await publishEvent(
    'PAYMENT_CONFIRMED',
    data.paymentId,
    'Payment',
    {
      paymentId: data.paymentId,
      orderId: data.orderId,
      playerId: data.playerId,
      amount: data.amount,
      currency: data.currency,
      paymentFor: data.paymentFor,
      referenceId: data.referenceId,
    },
    {
      sport: data.sport,
      userId: data.playerId,
      ...metadata,
    }
  );
}

export interface RefundProcessedEventData {
  refundId: string;
  playerId: string;
  amount: number;
  reason: string;
  sport: SportType;
  tournamentId?: string;
}

/**
 * Emit refund processed event
 */
export async function emitRefundProcessed(
  data: RefundProcessedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting REFUND_PROCESSED event: ${data.refundId}`);

  await publishEvent(
    'REFUND_PROCESSED',
    data.refundId,
    'Refund',
    {
      refundId: data.refundId,
      playerId: data.playerId,
      amount: data.amount,
      reason: data.reason,
      tournamentId: data.tournamentId,
    },
    {
      sport: data.sport,
      userId: data.playerId,
      ...metadata,
    }
  );
}

// ============================================
// User Events
// ============================================

export interface UserRegisteredEventData {
  userId: string;
  email: string;
  phone?: string;
  sport: SportType;
  registrationMethod: 'EMAIL' | 'PHONE' | 'GOOGLE';
}

/**
 * Emit user registered event
 */
export async function emitUserRegistered(
  data: UserRegisteredEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting USER_REGISTERED event: ${data.userId}`);

  await publishEvent(
    'USER_REGISTERED',
    data.userId,
    'User',
    {
      userId: data.userId,
      email: data.email,
      phone: data.phone,
      registrationMethod: data.registrationMethod,
    },
    {
      sport: data.sport,
      userId: data.userId,
      ...metadata,
    }
  );
}

export interface PlayerProfileUpdatedEventData {
  userId: string;
  sport: SportType;
  updatedFields: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

/**
 * Emit player profile updated event
 */
export async function emitPlayerProfileUpdated(
  data: PlayerProfileUpdatedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting PLAYER_PROFILE_UPDATED event: ${data.userId}`);

  await publishEvent(
    'PLAYER_PROFILE_UPDATED',
    data.userId,
    'Player',
    {
      userId: data.userId,
      updatedFields: data.updatedFields,
      previousValues: data.previousValues,
      newValues: data.newValues,
    },
    {
      sport: data.sport,
      userId: data.userId,
      ...metadata,
    }
  );
}

// ============================================
// Dispute Events
// ============================================

export interface DisputeRaisedEventData {
  disputeId: string;
  matchId: string;
  raisedBy: string;
  reason: string;
  sport: SportType;
  tournamentId?: string;
}

/**
 * Emit dispute raised event
 */
export async function emitDisputeRaised(
  data: DisputeRaisedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting DISPUTE_RAISED event: ${data.disputeId}`);

  await publishEvent(
    'DISPUTE_RAISED',
    data.disputeId,
    'Dispute',
    {
      disputeId: data.disputeId,
      matchId: data.matchId,
      raisedBy: data.raisedBy,
      reason: data.reason,
      tournamentId: data.tournamentId,
    },
    {
      sport: data.sport,
      userId: data.raisedBy,
      severity: 'high',
      ...metadata,
    }
  );
}

export interface DisputeResolvedEventData {
  disputeId: string;
  matchId: string;
  resolvedBy: string;
  resolution: string;
  sport: SportType;
  winnerId?: string;
}

/**
 * Emit dispute resolved event
 */
export async function emitDisputeResolved(
  data: DisputeResolvedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting DISPUTE_RESOLVED event: ${data.disputeId}`);

  await publishEvent(
    'DISPUTE_RESOLVED',
    data.disputeId,
    'Dispute',
    {
      disputeId: data.disputeId,
      matchId: data.matchId,
      resolvedBy: data.resolvedBy,
      resolution: data.resolution,
      winnerId: data.winnerId,
    },
    {
      sport: data.sport,
      severity: 'high',
      ...metadata,
    }
  );
}

// ============================================
// Badge/Achievement Events
// ============================================

export interface BadgeAwardedEventData {
  playerId: string;
  badgeId: string;
  badgeName: string;
  badgeType: string;
  sport: SportType;
  reason: string;
}

/**
 * Emit badge awarded event
 */
export async function emitBadgeAwarded(
  data: BadgeAwardedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting BADGE_AWARDED event: ${data.badgeId}`);

  await publishEvent(
    'BADGE_AWARDED',
    data.badgeId,
    'Badge',
    {
      playerId: data.playerId,
      badgeId: data.badgeId,
      badgeName: data.badgeName,
      badgeType: data.badgeType,
      reason: data.reason,
    },
    {
      sport: data.sport,
      userId: data.playerId,
      ...metadata,
    }
  );
}

// ============================================
// Waitlist Events
// ============================================

export interface WaitlistPromotedEventData {
  tournamentId: string;
  playerId: string;
  sport: SportType;
  position: number;
  promotedAt: Date;
}

/**
 * Emit waitlist promoted event
 */
export async function emitWaitlistPromoted(
  data: WaitlistPromotedEventData,
  metadata?: Partial<EventMetadata>
): Promise<void> {
  logger.info(`Emitting WAITLIST_PROMOTED event: ${data.tournamentId}`);

  await publishEvent(
    'WAITLIST_PROMOTED',
    `${data.tournamentId}-${data.playerId}`,
    'WaitlistPromotion',
    {
      tournamentId: data.tournamentId,
      playerId: data.playerId,
      position: data.position,
      promotedAt: data.promotedAt.toISOString(),
    },
    {
      sport: data.sport,
      userId: data.playerId,
      ...metadata,
    }
  );
}

// ============================================
// Event Emitters Index
// ============================================

export const EventEmitters = {
  // Match
  matchCompleted: emitMatchCompleted,
  
  // Tournament
  tournamentCreated: emitTournamentCreated,
  tournamentCompleted: emitTournamentCompleted,
  
  // Player
  playerRegistered: emitPlayerRegistered,
  playerRatingChanged: emitPlayerRatingChanged,
  playerProfileUpdated: emitPlayerProfileUpdated,
  
  // Payment
  paymentConfirmed: emitPaymentConfirmed,
  refundProcessed: emitRefundProcessed,
  
  // User
  userRegistered: emitUserRegistered,
  
  // Dispute
  disputeRaised: emitDisputeRaised,
  disputeResolved: emitDisputeResolved,
  
  // Badge
  badgeAwarded: emitBadgeAwarded,
  
  // Waitlist
  waitlistPromoted: emitWaitlistPromoted,
};
