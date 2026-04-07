/**
 * VALORHIVE - Completion Cron API (v3.48.0)
 * 
 * Cron endpoint for processing tournament completion tasks:
 * - Auto-complete tournaments when all matches finished
 * - Process finalization windows
 * - Lock expired windows
 * - Trigger recognition awards
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompletionChainService } from '@/lib/completion-chain';
import { ResultFinalizationService } from '@/lib/result-finalization';
import { TournamentSnapshotService } from '@/lib/tournament-snapshot';

// CRON_SECRET is REQUIRED - no fallback for production security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRON_SECRET environment variable is not set!');
}

// ============================================
// GET/POST - Process completion tasks
// ============================================

export async function GET(request: NextRequest) {
  return processCompletionTasks(request);
}

export async function POST(request: NextRequest) {
  return processCompletionTasks(request);
}

async function processCompletionTasks(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const results = {
    timestamp: new Date().toISOString(),
    autoCompletion: null as any,
    finalizationWindows: null as any,
    errors: [] as string[]
  };

  try {
    // 1. Auto-complete tournaments
    console.log('[Completion Cron] Checking for tournaments to auto-complete...');
    results.autoCompletion = await CompletionChainService.autoComplete();
    
    // For each completed tournament, create snapshot and start finalization
    for (const detail of results.autoCompletion.details) {
      if (detail.success) {
        try {
          await TournamentSnapshotService.create(detail.tournamentId);
          await ResultFinalizationService.startWindow(detail.tournamentId);
        } catch (e) {
          results.errors.push(`Failed to process ${detail.tournamentId}: ${e}`);
        }
      }
    }

  } catch (error) {
    console.error('[Completion Cron] Auto-completion error:', error);
    results.errors.push(`Auto-completion failed: ${error}`);
  }

  try {
    // 2. Process finalization windows
    console.log('[Completion Cron] Processing finalization windows...');
    results.finalizationWindows = await ResultFinalizationService.processWindows();
    
  } catch (error) {
    console.error('[Completion Cron] Finalization processing error:', error);
    results.errors.push(`Finalization processing failed: ${error}`);
  }

  console.log('[Completion Cron] Completed:', {
    completed: results.autoCompletion?.completed || 0,
    windowsProcessed: results.finalizationWindows?.processed || 0,
    errors: results.errors.length
  });

  return NextResponse.json(results);
}
