/**
 * Venue Flow Cron Endpoint (v3.47.0)
 * 
 * Processes automated venue flow tasks:
 * - No-show detection
 * - Dynamic scheduling
 * - Health monitoring
 * 
 * Should be called every minute by cron service.
 * Requires authorization via CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runVenueFlowProcessors } from '@/lib/venue-flow';

// Authorization check
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  // Skip auth in development if no secret configured
  if (process.env.NODE_ENV === 'development' && !expectedSecret) {
    return true;
  }

  if (!expectedSecret) {
    console.warn('CRON_SECRET not configured - venue-flow endpoint is unprotected');
    return true;
  }

  return cronSecret === `Bearer ${expectedSecret}` || cronSecret === expectedSecret;
}

export async function GET(request: NextRequest) {
  // Authorization check
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[VenueFlow] Starting venue flow processors...');

    const results = await runVenueFlowProcessors();

    const duration = Date.now() - startTime;

    // Summary
    const summary = {
      noShowsDetected: results.noShowDetection.noShows.length,
      matchesAssigned: results.scheduling.assigned,
      matchesQueued: results.scheduling.queued,
      tournamentsChecked: results.health.tournamentsChecked,
      healthAlertsCreated: results.health.alertsCreated,
      errors: [
        ...results.noShowDetection.message ? [results.noShowDetection.message] : [],
        ...results.scheduling.errors,
      ],
    };

    console.log(`[VenueFlow] Completed in ${duration}ms:`, summary);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      summary,
      details: results,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[VenueFlow] Error running venue flow processors:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
