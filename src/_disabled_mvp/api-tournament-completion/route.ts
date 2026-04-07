/**
 * VALORHIVE - Tournament Completion API (v3.48.0)
 * 
 * Endpoints for tournament completion, finalization, and disputes.
 * Part of the Completion & Trust Layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CompletionChainService } from '@/lib/completion-chain';
import { ResultFinalizationService } from '@/lib/result-finalization';
import { TournamentSnapshotService } from '@/lib/tournament-snapshot';
import { RecognitionTriggerService } from '@/lib/recognition-trigger';
import { TournamentRecapService } from '@/lib/tournament-recap-service';

// ============================================
// GET - Get completion status
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        snapshot: true,
        finalizationWindow: true,
        recap: true,
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get completion detection
    const detection = await CompletionChainService.detectCompletion(tournamentId);

    // Get finalization status
    const finalization = await ResultFinalizationService.getStatus(tournamentId);

    // Get disputes if any
    const disputes = await ResultFinalizationService.getDisputes(tournamentId, {
      includeResolved: true
    });

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        format: tournament.format,
        bracketFormat: tournament.bracketFormat,
        scope: tournament.scope
      },
      completion: {
        isComplete: detection.isComplete,
        winner: detection.winner,
        pendingMatches: detection.pendingMatches,
        completedMatches: detection.completedMatches,
        totalMatches: detection.totalMatches,
        message: detection.message
      },
      finalization: {
        exists: finalization.exists,
        status: finalization.status,
        window: finalization.window,
        timeRemaining: finalization.timeRemaining
      },
      snapshot: tournament.snapshot ? {
        exists: true,
        capturedAt: tournament.snapshot.capturedAt,
        locked: !!tournament.snapshot.lockedAt
      } : { exists: false },
      recap: tournament.recap ? {
        exists: true,
        title: tournament.recap.title,
        highlights: JSON.parse(tournament.recap.highlights || '[]')
      } : { exists: false },
      results: tournament.results.map(r => ({
        rank: r.rank,
        playerId: r.userId,
        playerName: `${r.user.firstName} ${r.user.lastName}`,
        bonusPoints: r.bonusPoints
      })),
      disputes: disputes.length
    });

  } catch (error) {
    console.error('Error getting completion status:', error);
    return NextResponse.json(
      { error: 'Failed to get completion status' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Complete tournament
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();

    const { action, data } = body;

    switch (action) {
      case 'complete':
        return await handleComplete(tournamentId, data);
      
      case 'start_finalization':
        return await handleStartFinalization(tournamentId, data);
      
      case 'raise_dispute':
        return await handleRaiseDispute(tournamentId, data);
      
      case 'resolve_dispute':
        return await handleResolveDispute(tournamentId, data);
      
      case 'lock_results':
        return await handleLockResults(tournamentId, data);
      
      case 'unlock_results':
        return await handleUnlockResults(tournamentId, data);
      
      case 'force_complete':
        return await handleForceComplete(tournamentId, data);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing completion request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleComplete(tournamentId: string, data: any) {
  // Step 1: Complete the tournament
  const result = await CompletionChainService.complete(tournamentId, {
    confirmedById: data.actorId,
    confirmedByRole: data.actorRole
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to complete tournament' },
      { status: 400 }
    );
  }

  // Step 2: Create snapshot
  await TournamentSnapshotService.create(tournamentId);

  // Step 3: Start finalization window
  await ResultFinalizationService.startWindow(tournamentId, {
    startedById: data.actorId
  });

  return NextResponse.json({
    success: true,
    message: 'Tournament completed successfully',
    result
  });
}

async function handleStartFinalization(tournamentId: string, data: any) {
  const result = await ResultFinalizationService.startWindow(tournamentId, {
    customDurationHours: data.customDurationHours,
    startedById: data.actorId
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    windowId: result.windowId,
    status: result.status,
    windowEndsAt: result.windowEndsAt
  });
}

async function handleRaiseDispute(tournamentId: string, data: any) {
  const result = await ResultFinalizationService.raiseDispute(
    tournamentId,
    data.raisedById,
    {
      disputedEntityId: data.disputedEntityId,
      disputeType: data.disputeType,
      reason: data.reason,
      evidence: data.evidence,
      blocksFinalization: data.blocksFinalization
    }
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    disputeId: result.disputeId,
    status: result.status
  });
}

async function handleResolveDispute(tournamentId: string, data: any) {
  const result = await ResultFinalizationService.resolveDispute(
    data.disputeId,
    data.resolvedById,
    data.resolution,
    {
      blocksFinalization: data.blocksFinalization
    }
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    disputeId: result.disputeId,
    status: result.status
  });
}

async function handleLockResults(tournamentId: string, data: any) {
  const result = await ResultFinalizationService.lockResults(
    tournamentId,
    data.actorId,
    data.reason
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  // Trigger recognition after locking
  await RecognitionTriggerService.trigger(tournamentId);

  // Generate recap
  await TournamentRecapService.generate(tournamentId);

  return NextResponse.json({
    success: true,
    lockedAt: result.lockedAt,
    message: result.message
  });
}

async function handleUnlockResults(tournamentId: string, data: any) {
  const result = await ResultFinalizationService.unlockResults(
    tournamentId,
    data.actorId,
    data.reason,
    data.expiresAt ? new Date(data.expiresAt) : undefined
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message
  });
}

async function handleForceComplete(tournamentId: string, data: any) {
  const result = await CompletionChainService.forceComplete(
    tournamentId,
    data.actorId,
    data.actorRole,
    {
      winnerId: data.winnerId,
      winnerTeamId: data.winnerTeamId,
      reason: data.reason
    }
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  // Create snapshot
  await TournamentSnapshotService.create(tournamentId);

  return NextResponse.json({
    success: true,
    result
  });
}
