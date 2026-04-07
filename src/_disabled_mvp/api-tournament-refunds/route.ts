/**
 * VALORHIVE - Tournament Refunds API (v3.49.0)
 * 
 * Endpoints for managing tournament refunds.
 * Part of the Financial Safety Layer.
 * 
 * IDEMPOTENCY PROTECTION (v3.50.0):
 * All mutating operations are protected against duplicate requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RefundEngineService } from '@/lib/refund-engine';
import { CancellationHandlerService } from '@/lib/cancellation-handler';
import { FinanceSnapshotService } from '@/lib/finance-snapshot';
import { CancellationReason } from '@prisma/client';
import { 
  hashRequestBody, 
  checkIdempotencyKey, 
  storeIdempotencyKey,
  generateIdempotencyKey,
  type IdempotencyCheckResult 
} from '@/lib/idempotency';
import { log } from '@/lib/logger';

// ============================================
// GET - Get refund status and jobs
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
        refundPolicy: true,
        refundJobs: {
          include: {
            registration: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true }
                }
              }
            }
          }
        },
        cancellationLog: true,
        financeSnapshot: true
      }
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get policy
    const policy = await RefundEngineService.getPolicy(tournamentId);

    // Calculate summary
    const jobs = tournament.refundJobs;
    const summary = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'PENDING').length,
      initiated: jobs.filter(j => j.status === 'INITIATED' || j.status === 'PROCESSING').length,
      completed: jobs.filter(j => j.status === 'COMPLETED').length,
      failed: jobs.filter(j => j.status === 'FAILED').length,
      manualReview: jobs.filter(j => j.status === 'MANUAL_REVIEW').length,
      totalAmount: jobs.reduce((sum, j) => sum + j.originalAmount, 0),
      totalRefunded: jobs
        .filter(j => j.status === 'COMPLETED')
        .reduce((sum, j) => sum + j.netRefund, 0)
    };

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status
      },
      policy: {
        mode: policy.refundMode,
        autoEnabled: policy.refundMode === 'AUTO',
        beforeRegDeadline: policy.beforeRegDeadline,
        afterRegBeforeStart: policy.afterRegBeforeStart,
        afterStartPartial: policy.afterStartPartial
      },
      summary,
      jobs: jobs.map(j => ({
        id: j.id,
        status: j.status,
        player: j.registration?.user ? {
          id: j.registration.user.id,
          name: `${j.registration.user.firstName} ${j.registration.user.lastName}`,
          email: j.registration.user.email
        } : null,
        originalAmount: j.originalAmount,
        refundAmount: j.refundAmount,
        netRefund: j.netRefund,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        retryCount: j.retryCount
      })),
      cancellation: tournament.cancellationLog ? {
        reason: tournament.cancellationLog.reason,
        cancelledAt: tournament.cancellationLog.cancelledAt,
        playersNotified: tournament.cancellationLog.playersNotified
      } : null,
      financeSnapshot: tournament.financeSnapshot ? {
        grossCollections: tournament.financeSnapshot.grossCollections,
        totalRefundAmount: tournament.financeSnapshot.totalRefundAmount,
        reconciliationStatus: tournament.financeSnapshot.reconciliationStatus
      } : null
    });

  } catch (error) {
    console.error('Error getting refund status:', error);
    return NextResponse.json(
      { error: 'Failed to get refund status' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Refund actions (with IDEMPOTENCY PROTECTION)
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();

    const { action, data } = body;

    // Generate idempotency key for mutating operations
    // Uses client-provided key or generates one from operation details
    let idempotencyKey = request.headers.get('x-idempotency-key');
    
    if (!idempotencyKey) {
      // Generate key based on action type and relevant parameters
      switch (action) {
        case 'cancel_tournament':
          idempotencyKey = generateIdempotencyKey(
            data.cancelledById || 'system',
            'REFUND',
            { tournamentId, action, reason: data.reason }
          );
          break;
        case 'approve_refund':
          idempotencyKey = generateIdempotencyKey(
            data.approvedById || 'system',
            'REFUND',
            { jobId: data.jobId, action: 'approve' }
          );
          break;
        default:
          // For non-critical operations, no idempotency key needed
          break;
      }
    }

    // Check idempotency for critical operations
    if (idempotencyKey && (action === 'cancel_tournament' || action === 'approve_refund')) {
      const requestBodyHash = hashRequestBody(body);
      
      const idempotencyCheck: IdempotencyCheckResult = await checkIdempotencyKey(
        idempotencyKey,
        requestBodyHash
      );
      
      if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
        log.info('Idempotent refund request detected - returning cached response', { 
          tournamentId,
          action,
          idempotencyKey 
        });
        return NextResponse.json(idempotencyCheck.previousResponse.body, {
          status: idempotencyCheck.previousResponse.status,
          headers: {
            'X-Idempotent-Replayed': 'true',
          },
        });
      }
      
      // Store the key and hash for use in handlers
      (body as Record<string, unknown>)._idempotencyKey = idempotencyKey;
      (body as Record<string, unknown>)._requestBodyHash = requestBodyHash;
    }

    switch (action) {
      case 'cancel_tournament':
        return await handleCancelTournament(tournamentId, data, body._idempotencyKey as string | undefined, body._requestBodyHash as string | undefined);
      
      case 'set_policy':
        return await handleSetPolicy(tournamentId, data);
      
      case 'approve_refund':
        return await handleApproveRefund(data, body._idempotencyKey as string | undefined, body._requestBodyHash as string | undefined);
      
      case 'trigger_refunds':
        return await handleTriggerRefunds(tournamentId, data);
      
      case 'create_snapshot':
        return await handleCreateSnapshot(tournamentId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing refund request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleCancelTournament(
  tournamentId: string, 
  data: any,
  idempotencyKey?: string,
  requestBodyHash?: string
) {
  const result = await CancellationHandlerService.cancel(
    tournamentId,
    data.reason as CancellationReason,
    data.cancelledById,
    {
      notes: data.notes,
      skipRefunds: data.skipRefunds,
      notifyPlayers: data.notifyPlayers
    }
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.errors.join(', ') },
      { status: 400 }
    );
  }

  const responsePayload = {
    success: true,
    cancellationId: result.cancellationId,
    refundsInitiated: result.refundsInitiated,
    refundsPending: result.refundsPending
  };

  // Store idempotency key with the successful response
  if (idempotencyKey && requestBodyHash) {
    await storeIdempotencyKey(
      idempotencyKey,
      'REFUND',
      result.cancellationId || tournamentId,
      requestBodyHash,
      responsePayload
    );
  }

  return NextResponse.json(responsePayload);
}

async function handleSetPolicy(tournamentId: string, data: any) {
  const result = await RefundEngineService.setPolicy(
    data.tournamentId || tournamentId,
    {
      refundMode: data.refundMode,
      beforeRegDeadline: data.beforeRegDeadline,
      afterRegBeforeStart: data.afterRegBeforeStart,
      afterStartPartial: data.afterStartPartial,
      afterStartComplete: data.afterStartComplete,
      platformFeePercent: data.platformFeePercent,
      processingFeeFixed: data.processingFeeFixed,
      partialRefundHours: data.partialRefundHours
    },
    data.actorId
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    policyId: result.policyId
  });
}

async function handleApproveRefund(
  data: any,
  idempotencyKey?: string,
  requestBodyHash?: string
) {
  const result = await RefundEngineService.approve(
    data.jobId,
    data.approvedById,
    data.notes
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  const responsePayload = {
    success: true,
    jobId: result.jobId,
    status: result.status
  };

  // Store idempotency key with the successful response
  if (idempotencyKey && requestBodyHash) {
    await storeIdempotencyKey(
      idempotencyKey,
      'REFUND',
      result.jobId || data.jobId,
      requestBodyHash,
      responsePayload
    );
  }

  return NextResponse.json(responsePayload);
}

async function handleTriggerRefunds(tournamentId: string, data: any) {
  const result = await RefundEngineService.processTournament(
    tournamentId,
    data.reason as CancellationReason,
    data.initiatedById
  );

  return NextResponse.json({
    success: result.success,
    totalJobs: result.totalJobs,
    autoQueued: result.autoQueued,
    pendingApproval: result.pendingApproval,
    errors: result.errors
  });
}

async function handleCreateSnapshot(tournamentId: string) {
  const result = await FinanceSnapshotService.create(tournamentId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    snapshotId: result.snapshotId
  });
}
