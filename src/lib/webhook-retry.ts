/**
 * Webhook Retry System for VALORHIVE
 * 
 * Features:
 * - Idempotency keys to prevent duplicate processing
 * - Automatic retry with exponential backoff
 * - Dead letter queue for failed webhooks
 * - Database-backed persistence for reliability
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WebhookEventStatus } from '@prisma/client';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  backoffMultiplier: 2,
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.maxDelayMs,
    RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
  );
  // Add jitter (0-25% of delay)
  const jitter = delay * 0.25 * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Generate idempotency key for a webhook
 */
export function generateIdempotencyKey(
  provider: string,
  eventId: string,
  eventType: string
): string {
  return `${provider}:${eventType}:${eventId}`;
}

/**
 * Check if webhook has already been processed
 */
export async function checkIdempotency(
  provider: string,
  eventId: string,
  eventType: string
): Promise<{ exists: boolean; event?: { status: WebhookEventStatus; id: string } }> {
  const idempotencyKey = generateIdempotencyKey(provider, eventId, eventType);
  
  const event = await db.webhookEvent.findUnique({
    where: { idempotencyKey },
    select: { status: true, id: true },
  });

  if (event) {
    return { exists: true, event };
  }

  return { exists: false };
}

/**
 * Store webhook event for processing
 */
export async function storeWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
  payload: string,
  signature: string
): Promise<{ id: string; idempotencyKey: string }> {
  const idempotencyKey = generateIdempotencyKey(provider, eventId, eventType);
  const now = new Date();

  const event = await db.webhookEvent.create({
    data: {
      provider,
      eventType,
      eventId,
      idempotencyKey,
      payload,
      signature,
      status: WebhookEventStatus.PENDING,
      attemptCount: 0,
      nextRetryAt: now,
    },
    select: { id: true, idempotencyKey: true },
  });

  return event;
}

/**
 * Update webhook event status
 */
export async function updateWebhookEvent(
  id: string,
  updates: {
    status?: WebhookEventStatus;
    attemptCount?: number;
    nextRetryAt?: Date | null;
    lastError?: string | null;
    processedAt?: Date | null;
  }
): Promise<void> {
  await db.webhookEvent.update({
    where: { id },
    data: updates,
  });
}

/**
 * Get webhook event by ID
 */
export async function getWebhookEvent(id: string) {
  return db.webhookEvent.findUnique({
    where: { id },
  });
}

/**
 * Process webhook with retry logic
 */
export async function processWebhookWithRetry(
  eventId: string,
  idempotencyKey: string,
  processor: () => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const event = await db.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return { success: false, error: 'Event not found' };
  }

  // Check if already processed
  if (event.status === WebhookEventStatus.COMPLETED) {
    return { success: true };
  }

  // Check if max retries exceeded
  if (event.attemptCount >= RETRY_CONFIG.maxRetries) {
    await updateWebhookEvent(eventId, {
      status: WebhookEventStatus.DEAD_LETTER,
      lastError: 'Max retries exceeded',
    });
    return { success: false, error: 'Max retries exceeded' };
  }

  // Update status to processing
  await updateWebhookEvent(eventId, {
    status: WebhookEventStatus.PROCESSING,
    attemptCount: event.attemptCount + 1,
  });

  try {
    // Execute the processor
    await processor();

    // Mark as completed
    await updateWebhookEvent(eventId, {
      status: WebhookEventStatus.COMPLETED,
      processedAt: new Date(),
      nextRetryAt: null,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Calculate next retry time
    const nextDelay = calculateDelay(event.attemptCount);
    const nextRetryAt = new Date(Date.now() + nextDelay);

    // Update for retry
    await updateWebhookEvent(eventId, {
      status: WebhookEventStatus.RETRYING,
      lastError: errorMessage,
      nextRetryAt,
    });

    console.error(`Webhook processing failed (attempt ${event.attemptCount + 1}):`, errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Get pending webhooks for retry
 */
export async function getPendingRetries(limit: number = 100): Promise<{
  id: string;
  idempotencyKey: string;
  provider: string;
  eventType: string;
  payload: string;
  attemptCount: number;
}[]> {
  const now = new Date();
  
  return db.webhookEvent.findMany({
    where: {
      status: { in: [WebhookEventStatus.PENDING, WebhookEventStatus.RETRYING] },
      nextRetryAt: { lte: now },
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      idempotencyKey: true,
      provider: true,
      eventType: true,
      payload: true,
      attemptCount: true,
    },
  });
}

/**
 * Get dead letter queue items
 */
export async function getDeadLetterQueue(limit: number = 100) {
  return db.webhookEvent.findMany({
    where: {
      status: WebhookEventStatus.DEAD_LETTER,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Retry a dead letter item manually
 */
export async function retryDeadLetterItem(eventId: string): Promise<void> {
  await db.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: WebhookEventStatus.PENDING,
      attemptCount: 0,
      nextRetryAt: new Date(),
      lastError: null,
    },
  });
}

/**
 * Process pending retries (called by cron job or worker)
 */
export async function processRetries(
  processor: (event: { id: string; idempotencyKey: string; payload: string }) => Promise<void>
): Promise<{ processed: number; failed: number }> {
  const pending = await getPendingRetries();
  let processed = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      await processor(event);
      processed++;
    } catch (error) {
      console.error(`Failed to process webhook ${event.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Webhook processor wrapper with idempotency
 */
export function createIdempotentWebhookHandler(
  provider: string,
  processEvent: (payload: any) => Promise<void>,
  verifySignature: (payload: string, signature: string) => boolean
) {
  return async (request: NextRequest) => {
    try {
      const body = await request.text();
      const signature = request.headers.get(`x-${provider}-signature`) || '';

      // Verify signature
      if (!verifySignature(body, signature)) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }

      const payload = JSON.parse(body);
      const eventId = payload.event_id || payload.payload?.payment?.entity?.id || Date.now().toString();
      const eventType = payload.event;

      // Check idempotency
      const { exists, event: existingEvent } = await checkIdempotency(
        provider,
        eventId,
        eventType
      );

      if (exists) {
        // Return cached result if already processed
        if (existingEvent?.status === WebhookEventStatus.COMPLETED) {
          return NextResponse.json({ received: true, cached: true });
        }

        // If still processing, acknowledge but don't reprocess
        if (existingEvent?.status === WebhookEventStatus.PROCESSING) {
          return NextResponse.json({ received: true, processing: true });
        }
      }

      // Store event for idempotency
      const event = await storeWebhookEvent(
        provider,
        eventId,
        eventType,
        body,
        signature
      );

      // Process with retry
      const result = await processWebhookWithRetry(
        event.id,
        event.idempotencyKey,
        () => processEvent(payload)
      );

      if (result.success) {
        return NextResponse.json({ received: true });
      } else {
        // Acknowledge receipt even if processing failed (will retry)
        return NextResponse.json({ received: true, retrying: true });
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Get webhook event statistics
 */
export async function getWebhookStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  retrying: number;
  deadLetter: number;
}> {
  const stats = await db.webhookEvent.groupBy({
    by: ['status'],
    _count: true,
  });

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    retrying: 0,
    deadLetter: 0,
  };

  for (const stat of stats) {
    switch (stat.status) {
      case WebhookEventStatus.PENDING:
        result.pending = stat._count;
        break;
      case WebhookEventStatus.PROCESSING:
        result.processing = stat._count;
        break;
      case WebhookEventStatus.COMPLETED:
        result.completed = stat._count;
        break;
      case WebhookEventStatus.RETRYING:
        result.retrying = stat._count;
        break;
      case WebhookEventStatus.DEAD_LETTER:
        result.deadLetter = stat._count;
        break;
    }
  }

  return result;
}

/**
 * Clean up old completed webhook events (run periodically)
 */
export async function cleanupOldWebhookEvents(daysOld: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await db.webhookEvent.deleteMany({
    where: {
      status: WebhookEventStatus.COMPLETED,
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}
