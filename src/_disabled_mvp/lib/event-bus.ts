/**
 * VALORHIVE Domain Event Bus
 * 
 * Implements event-driven architecture using Redis Streams for:
 * - Decoupled service communication
 * - Fault isolation
 * - Horizontal scaling
 * - Event replay capability
 * - Faster API responses
 * 
 * Architecture:
 * Event Publisher → Redis Stream → Consumer Groups → Workers
 * 
 * @module event-bus
 */

import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';
import { randomUUID } from 'crypto';

const logger = createLogger('EventBus');

// ============================================
// Types and Interfaces
// ============================================

export type DomainEventType = 
  // User events
  | 'USER_REGISTERED'
  | 'USER_VERIFIED'
  | 'PLAYER_PROFILE_UPDATED'
  | 'PLAYER_RATING_CHANGED'
  // Tournament events
  | 'TOURNAMENT_CREATED'
  | 'TOURNAMENT_PUBLISHED'
  | 'TOURNAMENT_REGISTRATION_OPENED'
  | 'TOURNAMENT_REGISTRATION_CLOSED'
  | 'TOURNAMENT_STARTED'
  | 'TOURNAMENT_COMPLETED'
  | 'TOURNAMENT_CANCELLED'
  // Registration events
  | 'PLAYER_REGISTERED_TOURNAMENT'
  | 'PLAYER_WITHDREW_TOURNAMENT'
  | 'WAITLIST_PROMOTED'
  // Match events
  | 'MATCH_SCHEDULED'
  | 'MATCH_STARTED'
  | 'MATCH_COMPLETED'
  | 'MATCH_RESULT_DISPUTED'
  // Payment events
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED'
  // Dispute events
  | 'DISPUTE_RAISED'
  | 'DISPUTE_RESOLVED'
  // Organization events
  | 'ORG_CREATED'
  | 'ORG_VERIFIED'
  | 'PLAYER_ADDED_TO_ROSTER'
  // Leaderboard events
  | 'LEADERBOARD_UPDATE_REQUESTED'
  | 'LEADERBOARD_SNAPSHOT_CREATED'
  // Activity events
  | 'ACTIVITY_FEED_ENTRY_CREATED'
  // Badge/Achievement events
  | 'BADGE_AWARDED'
  | 'MILESTONE_REACHED';

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: DomainEventType;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  metadata: EventMetadata;
  timestamp: Date;
}

export interface EventMetadata {
  sourceService: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  orgId?: string;
  sport?: string;
  ip?: string;
  userAgent?: string;
  version: number;
  severity: EventSeverity;
  retryCount?: number;
}

export interface EventSubscription {
  streamName: string;
  consumerGroup: string;
  consumerName: string;
  eventTypes: DomainEventType[];
  handler: EventHandler;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventBusConfig {
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  blockMs: number;
  deadLetterEnabled: boolean;
}

export interface EventPublisherResult {
  eventId: string;
  streamId: string;
  published: boolean;
}

export interface ConsumerMetrics {
  streamName: string;
  consumerGroup: string;
  pending: number;
  processed: number;
  failed: number;
  lastProcessedAt?: Date;
}

// ============================================
// Constants
// ============================================

const STREAM_PREFIX = 'events:';
const CONSUMER_GROUP_PREFIX = 'cg:';
const DEAD_LETTER_STREAM = 'events:dead-letter';

const DEFAULT_CONFIG: EventBusConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  batchSize: 10,
  blockMs: 5000,
  deadLetterEnabled: true,
};

// Stream names by domain
export const STREAM_NAMES = {
  USERS: `${STREAM_PREFIX}users`,
  PLAYERS: `${STREAM_PREFIX}players`,
  TOURNAMENTS: `${STREAM_PREFIX}tournaments`,
  MATCHES: `${STREAM_PREFIX}matches`,
  PAYMENTS: `${STREAM_PREFIX}payments`,
  DISPUTES: `${STREAM_PREFIX}disputes`,
  ORGANIZATIONS: `${STREAM_PREFIX}organizations`,
  LEADERBOARD: `${STREAM_PREFIX}leaderboard`,
  ACTIVITY: `${STREAM_PREFIX}activity`,
  ALL: `${STREAM_PREFIX}all`,
} as const;

type EventBusRedisClient = Awaited<ReturnType<typeof getPrimaryClient>>;
type StreamEntries = [string, string[]][];
type StreamMessages = [string, StreamEntries][];

// ============================================
// Event Bus Class
// ============================================

export class EventBus {
  private redis: EventBusRedisClient = null;
  private config: EventBusConfig;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private running: boolean = false;
  private consumers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    this.redis = await getPrimaryClient();
    
    if (!this.redis) {
      logger.warn('Redis not available, event bus will not be initialized');
      return;
    }

    // Ensure dead letter stream exists
    if (this.config.deadLetterEnabled) {
      try {
        await this.redis!.xgroup('CREATE', DEAD_LETTER_STREAM, 'dlq-workers', '0', 'MKSTREAM');
      } catch (error: any) {
        if (!error.message?.includes('BUSYGROUP')) {
          logger.error('Failed to create dead letter consumer group', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.info('Event bus initialized');
  }

  /**
   * Publish a domain event
   */
  async publish<T = Record<string, unknown>>(
    eventType: DomainEventType,
    aggregateId: string,
    aggregateType: string,
    payload: T,
    metadata: Partial<EventMetadata> = {}
  ): Promise<EventPublisherResult> {
    if (!this.redis) {
      await this.initialize();
      if (!this.redis) {
        return { eventId: '', streamId: '', published: false };
      }
    }

    const event: DomainEvent<T> = {
      eventId: randomUUID(),
      eventType,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        sourceService: metadata.sourceService || 'api',
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        userId: metadata.userId,
        orgId: metadata.orgId,
        sport: metadata.sport,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        version: 1,
        severity: metadata.severity || 'medium',
        retryCount: 0,
      },
      timestamp: new Date(),
    };

    // Determine which stream(s) to publish to
    const streams = this.getStreamsForEvent(eventType);
    const eventData = this.serializeEvent(event);

    let streamId = '';

    try {
      // Publish to domain-specific stream
      for (const stream of streams) {
        streamId = (await this.redis!.xadd(stream, '*', ...eventData)) || '';
      }

      // Also publish to 'all' stream for cross-domain subscribers
      await this.redis!.xadd(STREAM_NAMES.ALL, '*', ...eventData);

      logger.debug(`Published event ${eventType} with ID ${event.eventId}`);

      return {
        eventId: event.eventId,
        streamId,
        published: true,
      };
    } catch (error) {
      logger.error(`Failed to publish event ${eventType}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        eventId: event.eventId,
        streamId: '',
        published: false,
      };
    }
  }

  /**
   * Subscribe to events
   */
  async subscribe(subscription: EventSubscription): Promise<void> {
    if (!this.redis) {
      await this.initialize();
      if (!this.redis) {
        logger.warn('Cannot subscribe: Redis not available');
        return;
      }
    }

    const { streamName, consumerGroup, consumerName, eventTypes, handler } = subscription;

    // Create consumer group if it doesn't exist
    try {
      await this.redis!.xgroup('CREATE', streamName, consumerGroup, '0', 'MKSTREAM');
    } catch (error: any) {
      if (!error.message?.includes('BUSYGROUP')) {
          logger.error(`Failed to create consumer group ${consumerGroup}`, {
            error: error instanceof Error ? error.message : String(error),
          });
      }
    }

    // Store subscription
    this.subscriptions.set(`${streamName}:${consumerGroup}:${consumerName}`, subscription);

    logger.info(`Subscribed to ${streamName} as ${consumerGroup}/${consumerName} for events: ${eventTypes.join(', ')}`);
  }

  /**
   * Start consuming events
   */
  async startConsuming(): Promise<void> {
    if (this.running) {
      logger.warn('Event bus is already running');
      return;
    }

    this.running = true;

    for (const [key, subscription] of this.subscriptions) {
      const { streamName, consumerGroup, consumerName } = subscription;
      
      // Start consumer loop
      const consumerLoop = async () => {
        while (this.running) {
          try {
            await this.processBatch(subscription);
          } catch (error) {
            logger.error(`Consumer error for ${key}`, {
              error: error instanceof Error ? error.message : String(error),
            });
            await this.sleep(this.config.retryDelayMs);
          }
        }
      };

      consumerLoop();
    }

    logger.info(`Event bus started with ${this.subscriptions.size} consumers`);
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.running = false;
    
    for (const [key, timeout] of this.consumers) {
      clearTimeout(timeout);
    }
    this.consumers.clear();

    logger.info('Event bus stopped');
  }

  /**
   * Process a batch of events
   */
  private async processBatch(subscription: EventSubscription): Promise<void> {
    const { streamName, consumerGroup, consumerName, eventTypes, handler } = subscription;

    // Read pending messages first (for recovery)
    const pending = await this.redis!.xreadgroup(
      'GROUP', consumerGroup, consumerName,
      'COUNT', this.config.batchSize,
      'BLOCK', this.config.blockMs,
      'STREAMS', streamName, '0'
    ) as StreamMessages | null;

    if (pending && pending.length > 0) {
      await this.handleMessages(pending, subscription);
    }

    // Read new messages
    const messages = await this.redis!.xreadgroup(
      'GROUP', consumerGroup, consumerName,
      'COUNT', this.config.batchSize,
      'BLOCK', this.config.blockMs,
      'NOACK',
      'STREAMS', streamName, '>'
    ) as StreamMessages | null;

    if (messages && messages.length > 0) {
      await this.handleMessages(messages, subscription);
    }
  }

  /**
   * Handle messages from stream
   */
  private async handleMessages(
    messages: StreamMessages,
    subscription: EventSubscription
  ): Promise<void> {
    const { streamName, consumerGroup, eventTypes, handler } = subscription;

    for (const [stream, entries] of messages) {
      for (const [messageId, fields] of entries) {
        try {
          const event = this.deserializeEvent(fields);
          
          // Filter by event type
          if (eventTypes.length > 0 && !eventTypes.includes(event.eventType)) {
            await this.redis!.xack(streamName, consumerGroup, messageId);
            continue;
          }

          // Process event
          await handler(event);

          // Acknowledge
          await this.redis!.xack(streamName, consumerGroup, messageId);

          logger.debug(`Processed event ${event.eventType} (${messageId})`);
        } catch (error) {
              logger.error(`Failed to process message ${messageId}`, {
                error: error instanceof Error ? error.message : String(error),
              });
          
          // Send to dead letter queue
          if (this.config.deadLetterEnabled) {
            await this.sendToDeadLetter(streamName, messageId, fields, error);
          }

          // Acknowledge to prevent reprocessing
          await this.redis!.xack(streamName, consumerGroup, messageId);
        }
      }
    }
  }

  /**
   * Send event to dead letter queue
   */
  private async sendToDeadLetter(
    streamName: string,
    messageId: string,
    fields: string[],
    error: unknown
  ): Promise<void> {
    const dlqData = [
      'original_stream', streamName,
      'original_message_id', messageId,
      'error', error instanceof Error ? error.message : String(error),
      'failed_at', new Date().toISOString(),
      ...fields,
    ];

    await this.redis!.xadd(DEAD_LETTER_STREAM, '*', ...dlqData);
    logger.warn(`Sent message ${messageId} to dead letter queue`);
  }

  /**
   * Get consumer metrics
   */
  async getMetrics(streamName: string, consumerGroup: string): Promise<ConsumerMetrics> {
    if (!this.redis) {
      return {
        streamName,
        consumerGroup,
        pending: 0,
        processed: 0,
        failed: 0,
      };
    }

    try {
      const info = await this.redis!.xinfo('GROUPS', streamName);
      const group = info.find((g: any) => g.name === consumerGroup);

      return {
        streamName,
        consumerGroup,
        pending: group?.pending || 0,
        processed: group?.processed || 0,
        failed: 0, // Would need to track separately
        lastProcessedAt: group?.lastDeliveredId ? new Date() : undefined,
      };
    } catch {
      return {
        streamName,
        consumerGroup,
        pending: 0,
        processed: 0,
        failed: 0,
      };
    }
  }

  /**
   * Replay events from a specific point
   */
  async replayEvents(
    streamName: string,
    fromId: string = '0',
    eventTypes: DomainEventType[] = [],
    handler: EventHandler
  ): Promise<{ processed: number; errors: number }> {
    if (!this.redis) {
      await this.initialize();
      if (!this.redis) {
        return { processed: 0, errors: 0 };
      }
    }

    let processed = 0;
    let errors = 0;
    let currentId = fromId;

    while (true) {
      const messages = await this.redis!.xrange(streamName, currentId, '+', this.config.batchSize);

      if (!messages || messages.length === 0) {
        break;
      }

      for (const [messageId, fields] of messages) {
        try {
          const event = this.deserializeEvent(fields);

          // Filter by event type
          if (eventTypes.length > 0 && !eventTypes.includes(event.eventType)) {
            continue;
          }

          await handler(event);
          processed++;
          currentId = messageId;
        } catch (error) {
          logger.error(`Replay error for ${messageId}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          errors++;
        }
      }

      // Move to next batch
      currentId = messages[messages.length - 1][0];
    }

    logger.info(`Replay complete: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Get streams for event type
   */
  private getStreamsForEvent(eventType: DomainEventType): string[] {
    if (eventType.startsWith('USER_') || eventType.startsWith('PLAYER_')) {
      return [STREAM_NAMES.USERS, STREAM_NAMES.PLAYERS];
    }
    if (eventType.startsWith('TOURNAMENT_') || eventType.startsWith('WAITLIST_')) {
      return [STREAM_NAMES.TOURNAMENTS];
    }
    if (eventType.startsWith('MATCH_')) {
      return [STREAM_NAMES.MATCHES];
    }
    if (eventType.startsWith('PAYMENT_') || eventType.startsWith('REFUND_')) {
      return [STREAM_NAMES.PAYMENTS];
    }
    if (eventType.startsWith('DISPUTE_')) {
      return [STREAM_NAMES.DISPUTES];
    }
    if (eventType.startsWith('ORG_')) {
      return [STREAM_NAMES.ORGANIZATIONS];
    }
    if (eventType.startsWith('LEADERBOARD_')) {
      return [STREAM_NAMES.LEADERBOARD];
    }
    if (eventType.startsWith('ACTIVITY_') || eventType.startsWith('BADGE_') || eventType.startsWith('MILESTONE_')) {
      return [STREAM_NAMES.ACTIVITY];
    }
    return [STREAM_NAMES.ALL];
  }

  /**
   * Serialize event for Redis
   */
  private serializeEvent<T = Record<string, unknown>>(event: DomainEvent<T>): string[] {
    return [
      'eventId', event.eventId,
      'eventType', event.eventType,
      'aggregateId', event.aggregateId,
      'aggregateType', event.aggregateType,
      'payload', JSON.stringify(event.payload),
      'sourceService', event.metadata.sourceService,
      'correlationId', event.metadata.correlationId || '',
      'causationId', event.metadata.causationId || '',
      'userId', event.metadata.userId || '',
      'orgId', event.metadata.orgId || '',
      'sport', event.metadata.sport || '',
      'ip', event.metadata.ip || '',
      'userAgent', event.metadata.userAgent || '',
      'version', String(event.metadata.version),
      'severity', event.metadata.severity,
      'retryCount', String(event.metadata.retryCount || 0),
      'timestamp', event.timestamp.toISOString(),
    ];
  }

  /**
   * Deserialize event from Redis
   */
  private deserializeEvent(fields: string[]): DomainEvent {
    const getField = (name: string): string => {
      const index = fields.indexOf(name);
      return index !== -1 ? fields[index + 1] : '';
    };

    return {
      eventId: getField('eventId'),
      eventType: getField('eventType') as DomainEventType,
      aggregateId: getField('aggregateId'),
      aggregateType: getField('aggregateType'),
      payload: JSON.parse(getField('payload') || '{}'),
      metadata: {
        sourceService: getField('sourceService'),
        correlationId: getField('correlationId') || undefined,
        causationId: getField('causationId') || undefined,
        userId: getField('userId') || undefined,
        orgId: getField('orgId') || undefined,
        sport: getField('sport') || undefined,
        ip: getField('ip') || undefined,
        userAgent: getField('userAgent') || undefined,
        version: parseInt(getField('version') || '1', 10),
        severity: getField('severity') as EventSeverity || 'medium',
        retryCount: parseInt(getField('retryCount') || '0', 10),
      },
      timestamp: new Date(getField('timestamp')),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Singleton Instance
// ============================================

let eventBus: EventBus | null = null;

/**
 * Get the event bus instance
 */
export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBus();
  }
  return eventBus;
}

/**
 * Initialize the event bus
 */
export async function initializeEventBus(): Promise<void> {
  const bus = getEventBus();
  await bus.initialize();
}

/**
 * Publish a domain event
 */
export async function publishEvent<T = Record<string, unknown>>(
  eventType: DomainEventType,
  aggregateId: string,
  aggregateType: string,
  payload: T,
  metadata: Partial<EventMetadata> = {}
): Promise<EventPublisherResult> {
  const bus = getEventBus();
  return bus.publish(eventType, aggregateId, aggregateType, payload, metadata);
}

/**
 * Subscribe to events
 */
export async function subscribeToEvents(subscription: EventSubscription): Promise<void> {
  const bus = getEventBus();
  return bus.subscribe(subscription);
}

/**
 * Start event bus consumers
 */
export async function startEventBus(): Promise<void> {
  const bus = getEventBus();
  return bus.startConsuming();
}

/**
 * Stop event bus
 */
export async function stopEventBus(): Promise<void> {
  if (eventBus) {
    return eventBus.stop();
  }
}

// ============================================
// Event Builders
// ============================================

export const EventBuilders = {
  matchCompleted: (
    matchId: string,
    tournamentId: string,
    winnerId: string,
    loserId: string,
    score: { winner: number; loser: number },
    sport: string
  ): { eventType: DomainEventType; aggregateId: string; aggregateType: string; payload: any; metadata: Partial<EventMetadata> } => ({
    eventType: 'MATCH_COMPLETED',
    aggregateId: matchId,
    aggregateType: 'Match',
    payload: { matchId, tournamentId, winnerId, loserId, score },
    metadata: { sport, severity: 'high' },
  }),

  tournamentCreated: (
    tournamentId: string,
    name: string,
    sport: string,
    orgId?: string
  ) => ({
    eventType: 'TOURNAMENT_CREATED' as DomainEventType,
    aggregateId: tournamentId,
    aggregateType: 'Tournament',
    payload: { tournamentId, name },
    metadata: { sport, orgId },
  }),

  playerRegistered: (
    tournamentId: string,
    playerId: string,
    sport: string
  ) => ({
    eventType: 'PLAYER_REGISTERED_TOURNAMENT' as DomainEventType,
    aggregateId: tournamentId,
    aggregateType: 'TournamentRegistration',
    payload: { tournamentId, playerId },
    metadata: { sport, userId: playerId },
  }),

  paymentConfirmed: (
    paymentId: string,
    orderId: string,
    amount: number,
    playerId: string,
    sport: string
  ) => ({
    eventType: 'PAYMENT_CONFIRMED' as DomainEventType,
    aggregateId: paymentId,
    aggregateType: 'Payment',
    payload: { paymentId, orderId, amount, playerId },
    metadata: { sport, userId: playerId },
  }),

  userRegistered: (
    userId: string,
    email: string,
    sport: string
  ) => ({
    eventType: 'USER_REGISTERED' as DomainEventType,
    aggregateId: userId,
    aggregateType: 'User',
    payload: { userId, email },
    metadata: { sport, userId },
  }),

  playerRatingChanged: (
    playerId: string,
    oldRating: number,
    newRating: number,
    reason: string,
    sport: string
  ) => ({
    eventType: 'PLAYER_RATING_CHANGED' as DomainEventType,
    aggregateId: playerId,
    aggregateType: 'PlayerRating',
    payload: { playerId, oldRating, newRating, reason },
    metadata: { sport, userId: playerId, severity: 'high' },
  }),

  tournamentCompleted: (
    tournamentId: string,
    winnerId: string,
    sport: string
  ) => ({
    eventType: 'TOURNAMENT_COMPLETED' as DomainEventType,
    aggregateId: tournamentId,
    aggregateType: 'Tournament',
    payload: { tournamentId, winnerId },
    metadata: { sport, severity: 'high' },
  }),

  disputeRaised: (
    disputeId: string,
    matchId: string,
    raisedBy: string,
    sport: string
  ) => ({
    eventType: 'DISPUTE_RAISED' as DomainEventType,
    aggregateId: disputeId,
    aggregateType: 'Dispute',
    payload: { disputeId, matchId, raisedBy },
    metadata: { sport, userId: raisedBy, severity: 'high' },
  }),
};
