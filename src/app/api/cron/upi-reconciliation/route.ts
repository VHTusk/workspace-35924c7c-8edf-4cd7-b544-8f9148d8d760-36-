/**
 * VALORHIVE - UPI Reconciliation Cron API (v3.6.1)
 * 
 * Cron endpoint for reconciling pending UPI payments.
 * Run every 30 minutes to check status of deferred UPI settlements.
 * 
 * Query params:
 * - type: 'pending' | 'timeout' | 'all' (default: 'pending')
 * 
 * Environment:
 * - CRON_SECRET: Secret token for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  reconcilePendingUPIPayments,
  handleTimedOutUPIPayments,
  getUPIReconciliationStats,
  handleDeferredUPISettlement,
} from '@/lib/payments/upi-reconciliation';
import { db } from '@/lib/db';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

// ============================================
// GET/POST - Process UPI reconciliation
// ============================================

export async function GET(request: NextRequest) {
  return processUPIReconciliation(request);
}

export async function POST(request: NextRequest) {
  return processUPIReconciliation(request);
}

async function processUPIReconciliation(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'pending';
  const paymentId = searchParams.get('paymentId');

  const results = {
    timestamp: new Date().toISOString(),
    type,
    pending: null as any,
    timeout: null as any,
    singlePayment: null as any,
    stats: null as any,
    errors: [] as string[],
  };

  // Process single payment if specified
  if (paymentId) {
    try {
      results.singlePayment = await handleDeferredUPISettlement(paymentId);
    } catch (error) {
      results.errors.push(`Single payment error: ${error}`);
    }
  }

  // Process pending UPI payments
  if (type === 'pending' || type === 'all') {
    try {
      results.pending = await reconcilePendingUPIPayments();
    } catch (error) {
      results.errors.push(`Pending reconciliation error: ${error}`);
    }
  }

  // Handle timed out payments
  if (type === 'timeout' || type === 'all') {
    try {
      results.timeout = await handleTimedOutUPIPayments();
    } catch (error) {
      results.errors.push(`Timeout handling error: ${error}`);
    }
  }

  // Get stats if requested
  if (searchParams.get('stats') === 'true') {
    try {
      results.stats = await getUPIReconciliationStats();
    } catch (error) {
      results.errors.push(`Stats error: ${error}`);
    }
  }

  // Log cron execution
  await logCronExecution(type, results);

  return NextResponse.json(results);
}

/**
 * Log cron execution for audit trail
 */
async function logCronExecution(type: string, results: any): Promise<void> {
  try {
    // Log to audit log for tracking
    await db.auditLog.create({
      data: {
        sport: 'CORNHOLE', // Default sport for system actions
        action: 'ADMIN_OVERRIDE',
        actorId: 'system',
        actorRole: 'ADMIN',
        targetType: 'UPI_RECONCILIATION',
        targetId: `cron_${Date.now()}`,
        metadata: JSON.stringify({
          type,
          pending: results.pending,
          timeout: results.timeout,
          errors: results.errors.length > 0 ? results.errors : undefined,
        }),
      },
    });
  } catch (error) {
    console.error('[UPI-Reconciliation] Failed to log cron execution:', error);
  }
}
