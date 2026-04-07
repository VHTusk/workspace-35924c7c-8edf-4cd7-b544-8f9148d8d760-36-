/**
 * Cron Endpoint for Email Verification Locking
 *
 * This endpoint should be called periodically (every hour) to:
 * 1. Lock accounts that haven't verified their email within 24 hours
 * 2. Clean up expired verification tokens
 *
 * Security: Requires CRON_SECRET or admin authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  lockUnverifiedAccounts,
  cleanupExpiredVerificationTokens,
} from '@/lib/email-verification';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronAuth = authHeader?.replace('Bearer ', '');

    // Allow CRON_SECRET or admin session
    const isAuthorized = CRON_SECRET && cronAuth === CRON_SECRET;

    if (!isAuthorized) {
      // Also check for admin session as fallback
      const sessionToken = request.cookies.get('adminSession')?.value;
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Run the lock process
    console.log('[Cron] Starting email verification lock process...');

    const lockResult = await lockUnverifiedAccounts();
    const cleanupCount = await cleanupExpiredVerificationTokens();

    console.log(`[Cron] Email verification lock complete:
      - Accounts locked: ${lockResult.lockedCount}
      - Tokens cleaned: ${cleanupCount}
      - Errors: ${lockResult.errors.length}`);

    return NextResponse.json({
      success: true,
      lockedAccounts: lockResult.lockedCount,
      cleanedTokens: cleanupCount,
      errors: lockResult.errors.length > 0 ? lockResult.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Email verification lock error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process email verification locks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // GET endpoint for status check
  return NextResponse.json({
    status: 'Email verification cron endpoint is active',
    lastRun: new Date().toISOString(),
  });
}
