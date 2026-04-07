/**
 * Tournament Autopilot Cron Endpoint (v3.45.0)
 * 
 * Processes automated tournament tasks:
 * - Registration auto-close
 * - Auto-bracket generation
 * - Auto-start tournament
 * - Auto-advance winner
 * - Waitlist auto-promotion
 * - Match reminders
 * 
 * Should be called every minute by cron service.
 * Requires authorization via CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAutopilotProcessors } from '@/lib/tournament-autopilot';

// Authorization check
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  // FIX: CRITICAL - In production, CRON_SECRET MUST be configured
  // If not configured, reject all requests to prevent unauthorized access
  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Autopilot] CRON_SECRET not configured in production - rejecting request');
      return false;
    }
    // Only allow in development without secret
    console.warn('[Autopilot] CRON_SECRET not configured in development - allowing request');
    return true;
  }

  // FIX: Use constant-time comparison to prevent timing attacks
  // Check for Bearer prefix or direct secret
  const providedSecret = cronSecret?.startsWith('Bearer ') 
    ? cronSecret.slice(7) 
    : cronSecret;
  
  if (!providedSecret) {
    return false;
  }

  // Simple constant-time comparison
  if (providedSecret.length !== expectedSecret.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    result |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  
  return result === 0;
}

export async function GET(request: NextRequest) {
  // Authorization check
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[Autopilot] Starting autopilot processors...');

    const results = await runAutopilotProcessors();

    const duration = Date.now() - startTime;

    // Summary
    const summary = {
      registrationAutoClosed: results.registrationAutoClose.filter((r) => r.success).length,
      bracketsGenerated: results.autoBracketGeneration.filter((r) => r.success).length,
      tournamentsStarted: results.autoStartTournament.filter((r) => r.success).length,
      winnersAdvanced: results.autoAdvanceWinner.filter((r) => r.success).length,
      waitlistPromotions: results.waitlistAutoPromotion.filter((r) => r.success).length,
      matchRemindersSent: results.matchReminders.processed,
      errors: [
        ...results.registrationAutoClose.filter((r) => !r.success),
        ...results.autoBracketGeneration.filter((r) => !r.success),
        ...results.autoStartTournament.filter((r) => !r.success),
        ...results.autoAdvanceWinner.filter((r) => !r.success),
        ...results.waitlistAutoPromotion.filter((r) => !r.success),
        ...results.matchReminders.errors,
      ],
    };

    console.log(`[Autopilot] Completed in ${duration}ms:`, summary);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      summary,
      details: results,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Autopilot] Error running autopilot processors:', error);

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
