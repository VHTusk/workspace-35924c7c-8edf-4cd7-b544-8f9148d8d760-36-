/**
 * Webhook Stats API
 * Returns statistics about webhook processing
 */

import { NextResponse } from 'next/server';
import { getWebhookStats, getDeadLetterQueue } from '@/lib/webhook-retry';
import { addVersionHeaders } from '@/lib/api-versioning';

export async function GET() {
  try {
    const stats = await getWebhookStats();
    const deadLetter = await getDeadLetterQueue(10);

    const response = NextResponse.json({
      success: true,
      data: {
        stats,
        deadLetterQueue: deadLetter.map(event => ({
          id: event.id,
          provider: event.provider,
          eventType: event.eventType,
          attemptCount: event.attemptCount,
          lastError: event.lastError,
          createdAt: event.createdAt,
        })),
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to get webhook stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get webhook stats' },
      { status: 500 }
    );
  }
}
