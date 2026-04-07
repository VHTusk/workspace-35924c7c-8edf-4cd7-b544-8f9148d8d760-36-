/**
 * VALORHIVE Notification Throttle Service
 * 
 * Implements rate limiting and throttling for notifications:
 * - Rate limiting per channel (email, push, whatsapp, in-app)
 * - Daily limits per user
 * - Priority queuing (urgent vs normal)
 * - Backoff on provider errors
 * 
 * Rate Limits:
 * - Email: 50/hour per user, 10000/hour global
 * - Push: 100/hour per user, 50000/hour global
 * - WhatsApp: 20/hour per user, 1000/hour global (expensive)
 * - In-app: 200/hour per user, unlimited global
 * 
 * Daily Limits:
 * - Email: 100/day per user
 * - Push: 200/day per user
 * - WhatsApp: 30/day per user
 * - In-app: 500/day per user
 */

import IORedis from 'ioredis';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';
import type { NotificationChannel, NotificationPriority } from './notification-fanout';

const logger = createLogger('NotificationThrottle');

// ============================================
// Types and Interfaces
// ============================================

export interface RateLimitConfig {
  maxPerHour: number;
  maxPerDay: number;
  globalMaxPerHour: number;
  windowMs: number;
}

export interface ThrottleResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

export interface BackoffState {
  channel: NotificationChannel;
  errorCount: number;
  lastErrorAt: Date;
  backoffUntil: Date;
  lastError?: string;
}

export interface ThrottleMetrics {
  rateLimitHits: number;
  dailyLimitHits: number;
  backoffEvents: number;
  queueDepth: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
}

export interface PriorityQueueEntry {
  id: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  userId: string;
  timestamp: Date;
  data: unknown;
}

// ============================================
// Default Configuration
// ============================================

const CHANNEL_CONFIGS: Record<NotificationChannel, RateLimitConfig> = {
  email: {
    maxPerHour: 50,
    maxPerDay: 100,
    globalMaxPerHour: 10000,
    windowMs: 3600000, // 1 hour
  },
  push: {
    maxPerHour: 100,
    maxPerDay: 200,
    globalMaxPerHour: 50000,
    windowMs: 3600000,
  },
  whatsapp: {
    maxPerHour: 20,
    maxPerDay: 30,
    globalMaxPerHour: 1000,
    windowMs: 3600000,
  },
  'in-app': {
    maxPerHour: 200,
    maxPerDay: 500,
    globalMaxPerHour: 100000,
    windowMs: 3600000,
  },
};

const BACKOFF_CONFIG = {
  initialDelayMs: 60000,     // 1 minute
  maxDelayMs: 3600000,       // 1 hour
  multiplier: 2,             // Exponential
  errorThreshold: 3,         // Errors before backoff starts
};

// ============================================
// Notification Throttle Class
// ============================================

export class NotificationThrottle {
  private redis: IORedis | null = null;
  private backoffStates: Map<NotificationChannel, BackoffState> = new Map();
  private priorityQueues: Map<NotificationPriority, PriorityQueueEntry[]> = new Map();
  private rateLimitHits: number = 0;
  private dailyLimitHits: number = 0;
  private backoffEvents: number = 0;

  /**
   * Initialize the throttle service
   */
  async initialize(): Promise<void> {
    try {
      this.redis = await getPrimaryClient();
      logger.info('Notification throttle initialized');
    } catch (error) {
      logger.error('Failed to initialize notification throttle:', error);
      throw error;
    }
  }

  /**
   * Check if a notification should be allowed through rate limiting
   */
  async checkRateLimit(
    userId: string,
    channel: NotificationChannel
  ): Promise<ThrottleResult> {
    if (!this.redis) {
      // If Redis not available, allow by default
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 3600000),
      };
    }

    const config = CHANNEL_CONFIGS[channel];
    const now = Date.now();
    const hourKey = `throttle:${channel}:${userId}:hour:${Math.floor(now / config.windowMs)}`;
    const dayKey = `throttle:${channel}:${userId}:day:${new Date().toISOString().split('T')[0]}`;
    const globalKey = `throttle:${channel}:global:${Math.floor(now / config.windowMs)}`;

    try {
      // Check if channel is in backoff
      const backoffState = this.backoffStates.get(channel);
      if (backoffState && backoffState.backoffUntil > new Date()) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: backoffState.backoffUntil,
          reason: `Channel in backoff due to provider errors`,
        };
      }

      // Get current counts
      const [hourCount, dayCount, globalCount] = await Promise.all([
        this.redis.get(hourKey),
        this.redis.get(dayKey),
        this.redis.get(globalKey),
      ]);

      const currentHour = parseInt(hourCount || '0', 10);
      const currentDay = parseInt(dayCount || '0', 10);
      const currentGlobal = parseInt(globalCount || '0', 10);

      // Check limits
      if (currentHour >= config.maxPerHour) {
        this.rateLimitHits++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Math.ceil(now / config.windowMs) * config.windowMs),
          reason: `Hourly limit exceeded (${currentHour}/${config.maxPerHour})`,
        };
      }

      if (currentDay >= config.maxPerDay) {
        this.dailyLimitHits++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(new Date().setHours(24, 0, 0, 0)),
          reason: `Daily limit exceeded (${currentDay}/${config.maxPerDay})`,
        };
      }

      if (currentGlobal >= config.globalMaxPerHour) {
        this.rateLimitHits++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Math.ceil(now / config.windowMs) * config.windowMs),
          reason: `Global limit exceeded`,
        };
      }

      // Increment counters
      const pipeline = this.redis.pipeline();
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, 3600);
      pipeline.incr(dayKey);
      pipeline.expire(dayKey, 86400);
      pipeline.incr(globalKey);
      pipeline.expire(globalKey, 3600);
      await pipeline.exec();

      const remaining = Math.min(
        config.maxPerHour - currentHour - 1,
        config.maxPerDay - currentDay - 1
      );

      return {
        allowed: true,
        remaining,
        resetAt: new Date(Math.ceil(now / config.windowMs) * config.windowMs),
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Allow on error to avoid blocking notifications
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 3600000),
      };
    }
  }

  /**
   * Add a notification to the priority queue
   */
  async enqueueWithPriority(entry: PriorityQueueEntry): Promise<void> {
    const priority = entry.priority;
    
    if (!this.priorityQueues.has(priority)) {
      this.priorityQueues.set(priority, []);
    }

    this.priorityQueues.get(priority)!.push(entry);
  }

  /**
   * Dequeue notifications by priority
   */
  async dequeueByPriority(
    limit: number = 100
  ): Promise<PriorityQueueEntry[]> {
    const result: PriorityQueueEntry[] = [];
    const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority);
      if (!queue || queue.length === 0) continue;

      const needed = limit - result.length;
      if (needed <= 0) break;

      const entries = queue.splice(0, needed);
      result.push(...entries);
    }

    return result;
  }

  /**
   * Get priority queue depth
   */
  getQueueDepth(): Record<NotificationPriority, number> {
    return {
      urgent: this.priorityQueues.get('urgent')?.length || 0,
      high: this.priorityQueues.get('high')?.length || 0,
      normal: this.priorityQueues.get('normal')?.length || 0,
      low: this.priorityQueues.get('low')?.length || 0,
    };
  }

  /**
   * Record a provider error and update backoff state
   */
  recordProviderError(channel: NotificationChannel, error: string): void {
    const currentState = this.backoffStates.get(channel);
    const now = new Date();

    if (!currentState) {
      this.backoffStates.set(channel, {
        channel,
        errorCount: 1,
        lastErrorAt: now,
        backoffUntil: now, // No backoff yet
        lastError: error,
      });
      return;
    }

    const newErrorCount = currentState.errorCount + 1;
    let backoffUntil = currentState.backoffUntil;

    // Start backoff after threshold
    if (newErrorCount >= BACKOFF_CONFIG.errorThreshold) {
      this.backoffEvents++;
      
      // Calculate exponential backoff
      const backoffLevel = newErrorCount - BACKOFF_CONFIG.errorThreshold;
      const delayMs = Math.min(
        BACKOFF_CONFIG.initialDelayMs * Math.pow(BACKOFF_CONFIG.multiplier, backoffLevel),
        BACKOFF_CONFIG.maxDelayMs
      );
      
      backoffUntil = new Date(now.getTime() + delayMs);
      
      logger.warn(`Channel ${channel} entering backoff until ${backoffUntil.toISOString()} due to ${newErrorCount} errors`);
    }

    this.backoffStates.set(channel, {
      channel,
      errorCount: newErrorCount,
      lastErrorAt: now,
      backoffUntil,
      lastError: error,
    });
  }

  /**
   * Record a successful delivery (resets backoff)
   */
  recordSuccess(channel: NotificationChannel): void {
    const currentState = this.backoffStates.get(channel);
    
    if (currentState && currentState.errorCount > 0) {
      // Reset error count on success
      this.backoffStates.set(channel, {
        ...currentState,
        errorCount: 0,
        backoffUntil: new Date(), // Clear backoff
      });
    }
  }

  /**
   * Get backoff state for a channel
   */
  getBackoffState(channel: NotificationChannel): BackoffState | undefined {
    return this.backoffStates.get(channel);
  }

  /**
   * Get all backoff states
   */
  getAllBackoffStates(): BackoffState[] {
    return Array.from(this.backoffStates.values());
  }

  /**
   * Clear backoff for a channel (admin override)
   */
  clearBackoff(channel: NotificationChannel): void {
    const currentState = this.backoffStates.get(channel);
    if (currentState) {
      this.backoffStates.set(channel, {
        ...currentState,
        errorCount: 0,
        backoffUntil: new Date(),
      });
    }
  }

  /**
   * Check if a channel is in backoff
   */
  isInBackoff(channel: NotificationChannel): boolean {
    const state = this.backoffStates.get(channel);
    if (!state) return false;
    return state.backoffUntil > new Date();
  }

  /**
   * Get time remaining in backoff
   */
  getBackoffRemaining(channel: NotificationChannel): number {
    const state = this.backoffStates.get(channel);
    if (!state) return 0;
    
    const remaining = state.backoffUntil.getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get throttle metrics
   */
  getMetrics(): ThrottleMetrics {
    return {
      rateLimitHits: this.rateLimitHits,
      dailyLimitHits: this.dailyLimitHits,
      backoffEvents: this.backoffEvents,
      queueDepth: this.getQueueDepth(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.rateLimitHits = 0;
    this.dailyLimitHits = 0;
    this.backoffEvents = 0;
  }

  /**
   * Get usage stats for a user
   */
  async getUserUsage(
    userId: string,
    channel: NotificationChannel
  ): Promise<{
    hourCount: number;
    dayCount: number;
    hourLimit: number;
    dayLimit: number;
  }> {
    if (!this.redis) {
      return {
        hourCount: 0,
        dayCount: 0,
        hourLimit: CHANNEL_CONFIGS[channel].maxPerHour,
        dayLimit: CHANNEL_CONFIGS[channel].maxPerDay,
      };
    }

    const config = CHANNEL_CONFIGS[channel];
    const now = Date.now();
    const hourKey = `throttle:${channel}:${userId}:hour:${Math.floor(now / config.windowMs)}`;
    const dayKey = `throttle:${channel}:${userId}:day:${new Date().toISOString().split('T')[0]}`;

    const [hourCount, dayCount] = await Promise.all([
      this.redis.get(hourKey),
      this.redis.get(dayKey),
    ]);

    return {
      hourCount: parseInt(hourCount || '0', 10),
      dayCount: parseInt(dayCount || '0', 10),
      hourLimit: config.maxPerHour,
      dayLimit: config.maxPerDay,
    };
  }

  /**
   * Check and throttle a notification
   */
  async throttleNotification(
    userId: string,
    channel: NotificationChannel,
    priority: NotificationPriority,
    data: unknown
  ): Promise<{
    allowed: boolean;
    queued: boolean;
    reason?: string;
  }> {
    // Check rate limit
    const rateLimitResult = await this.checkRateLimit(userId, channel);
    
    if (rateLimitResult.allowed) {
      return { allowed: true, queued: false };
    }

    // If not allowed, queue based on priority
    // Urgent notifications bypass queue and force send
    if (priority === 'urgent') {
      return {
        allowed: true,
        queued: false,
        reason: 'Urgent notification bypassing rate limit',
      };
    }

    // Queue the notification
    await this.enqueueWithPriority({
      id: `${channel}-${userId}-${Date.now()}`,
      priority,
      channel,
      userId,
      timestamp: new Date(),
      data,
    });

    return {
      allowed: false,
      queued: true,
      reason: rateLimitResult.reason,
    };
  }

  /**
   * Process queued notifications that are now allowed
   */
  async processQueuedNotifications(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const result = { processed: 0, sent: 0, failed: 0 };

    // Get all queued notifications by priority
    const entries = await this.dequeueByPriority(100);
    result.processed = entries.length;

    for (const entry of entries) {
      const rateLimitResult = await this.checkRateLimit(entry.userId, entry.channel);
      
      if (rateLimitResult.allowed) {
        // The notification can be sent - return it for processing
        result.sent++;
        // Note: Actual sending would be handled by the fanout service
      } else {
        // Re-queue if still rate limited
        await this.enqueueWithPriority(entry);
        result.failed++;
      }
    }

    return result;
  }
}

// ============================================
// Singleton Instance
// ============================================

let throttleInstance: NotificationThrottle | null = null;

/**
 * Get the notification throttle instance
 */
export function getNotificationThrottle(): NotificationThrottle {
  if (!throttleInstance) {
    throttleInstance = new NotificationThrottle();
  }
  return throttleInstance;
}

/**
 * Initialize the notification throttle
 */
export async function initializeNotificationThrottle(): Promise<void> {
  const throttle = getNotificationThrottle();
  await throttle.initialize();
}

/**
 * Check rate limit for a user and channel
 */
export async function checkNotificationRateLimit(
  userId: string,
  channel: NotificationChannel
): Promise<ThrottleResult> {
  const throttle = getNotificationThrottle();
  return throttle.checkRateLimit(userId, channel);
}

/**
 * Record a provider error
 */
export function recordNotificationProviderError(
  channel: NotificationChannel,
  error: string
): void {
  const throttle = getNotificationThrottle();
  throttle.recordProviderError(channel, error);
}

/**
 * Record a successful delivery
 */
export function recordNotificationSuccess(channel: NotificationChannel): void {
  const throttle = getNotificationThrottle();
  throttle.recordSuccess(channel);
}

/**
 * Get throttle metrics
 */
export function getThrottleMetrics(): ThrottleMetrics {
  const throttle = getNotificationThrottle();
  return throttle.getMetrics();
}

/**
 * Get user notification usage
 */
export async function getUserNotificationUsage(
  userId: string,
  channel: NotificationChannel
): Promise<{
  hourCount: number;
  dayCount: number;
  hourLimit: number;
  dayLimit: number;
}> {
  const throttle = getNotificationThrottle();
  return throttle.getUserUsage(userId, channel);
}

// ============================================
// Express Middleware Helper
// ============================================

/**
 * Create rate limiting middleware for notification endpoints
 */
export function createNotificationRateLimitMiddleware(
  channel: NotificationChannel,
  getUserId: (req: unknown) => string | null
) {
  return async (req: unknown, res: unknown, next: () => void) => {
    const userId = getUserId(req);
    
    if (!userId) {
      return next();
    }

    const result = await checkNotificationRateLimit(userId, channel);
    
    if (!result.allowed) {
      const response = res as { status: (code: number) => { json: (data: unknown) => void } };
      return response.status(429).json({
        error: 'Rate limit exceeded',
        reason: result.reason,
        resetAt: result.resetAt,
      });
    }

    next();
  };
}
