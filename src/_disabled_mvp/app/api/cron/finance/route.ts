/**
 * VALORHIVE - Financial Cron API (v3.49.0)
 * 
 * Cron endpoints for financial operations:
 * - Refund processing
 * - Payment recovery
 * - Reconciliation
 * - Snapshot creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { RefundEngineService } from '@/lib/refund-engine';
import { FinanceSnapshotService } from '@/lib/finance-snapshot';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

// ============================================
// GET/POST - Process financial jobs
// ============================================

export async function GET(request: NextRequest) {
  return processFinancialJobs(request);
}

export async function POST(request: NextRequest) {
  return processFinancialJobs(request);
}

async function processFinancialJobs(request: NextRequest) {
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
  const jobType = searchParams.get('type') || 'all';

  const results = {
    timestamp: new Date().toISOString(),
    refunds: null as any,
    reconciliation: null as any,
    errors: [] as string[]
  };

  // Process refunds
  if (jobType === 'all' || jobType === 'refunds') {
    try {
      results.refunds = await RefundEngineService.processPending();
    } catch (error) {
      results.errors.push(`Refund processing failed: ${error}`);
    }
  }

  // Run daily reconciliation (only run once per day)
  if (jobType === 'reconciliation') {
    try {
      results.reconciliation = await FinanceSnapshotService.runDailyReconciliation('SYSTEM');
    } catch (error) {
      results.errors.push(`Reconciliation failed: ${error}`);
    }
  }

  return NextResponse.json(results);
}
