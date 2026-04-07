/**
 * Database Transaction Utilities
 * 
 * Provides transaction wrappers for complex database operations
 * ensuring atomicity and consistency across multiple operations.
 */

import { Prisma, TournamentStatus, MatchVerificationStatus, PaymentLedgerStatus } from '@prisma/client'
import { db } from './db'

// ============================================
// Types
// ============================================

export interface MatchResultInput {
  matchId: string
  tournamentId: string
  playerAId: string
  playerBId: string
  scoreA: number
  scoreB: number
  winnerId: string | null
  outcome?: string
  outcomeReason?: string
  pointsA: number
  pointsB: number
  tournamentScope: string
  eloChangeA: number
  eloChangeB: number
  submittedById?: string
  sport: 'CORNHOLE' | 'DARTS'
}

export interface RefundInput {
  paymentLedgerId: string
  userId?: string
  orgId?: string
  tournamentId?: string
  refundAmount: number
  reason: string
  sport: 'CORNHOLE' | 'DARTS'
}

export interface TournamentStateTransitionInput {
  tournamentId: string
  fromState: TournamentStatus
  toState: TournamentStatus
  changedById: string
  reason?: string
  metadata?: Record<string, unknown>
  sport: 'CORNHOLE' | 'DARTS'
}

export interface TransactionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errorType?: 'VALIDATION_ERROR' | 'STATE_ERROR' | 'DATABASE_ERROR' | 'UNKNOWN_ERROR'
}

// ============================================
// Transaction Helper
// ============================================

/**
 * Wraps a callback in a Prisma transaction with error handling
 * 
 * @param callback - The callback to execute within the transaction
 * @param options - Transaction options (timeout, maxWait)
 * @returns The result of the callback or an error
 */
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    timeout?: number
    maxWait?: number
  }
): Promise<TransactionResult<T>> {
  try {
    const result = await db.$transaction(
      async (tx) => {
        return await callback(tx)
      },
      {
        timeout: options?.timeout ?? 10000, // 10 seconds default
        maxWait: options?.maxWait ?? 5000, // 5 seconds default max wait
      }
    )
    
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[Transaction] Error:', error)
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Transaction failed due to Prisma error
      return {
        success: false,
        error: error.message,
        errorType: 'DATABASE_ERROR',
      }
    }
    
    if (error instanceof Error) {
      // Check for custom errors thrown in the transaction
      if (error.message.includes('Invalid state')) {
        return {
          success: false,
          error: error.message,
          errorType: 'STATE_ERROR',
        }
      }
      if (error.message.includes('Validation failed')) {
        return {
          success: false,
          error: error.message,
          errorType: 'VALIDATION_ERROR',
        }
      }
      
      return {
        success: false,
        error: error.message,
        errorType: 'UNKNOWN_ERROR',
      }
    }
    
    return {
      success: false,
      error: 'Unknown error occurred during transaction',
      errorType: 'UNKNOWN_ERROR',
    }
  }
}

// ============================================
// Match Result Transaction
// ============================================

/**
 * Executes a match result transaction that:
 * 1. Updates the match with scores and outcome
 * 2. Updates player ELO ratings
 * 3. Updates player visible points
 * 4. Updates tournament statistics (if applicable)
 * 
 * @param input - Match result input data
 * @returns Transaction result with updated match data
 */
export async function executeMatchResultTransaction(
  input: MatchResultInput
): Promise<TransactionResult<{
  matchId: string
  playerA: { newElo: number; newPoints: number }
  playerB: { newElo: number; newPoints: number }
}>> {
  return withTransaction(async (tx) => {
    // 1. Verify match exists and is in correct state
    const match = await tx.match.findUnique({
      where: { id: input.matchId },
      include: {
        playerA: { select: { id: true, hiddenElo: true, visiblePoints: true } },
        playerB: { select: { id: true, hiddenElo: true, visiblePoints: true } },
      },
    })
    
    if (!match) {
      throw new Error('Match not found')
    }
    
    if (match.verificationStatus === MatchVerificationStatus.VERIFIED) {
      throw new Error('Invalid state: Match already verified')
    }
    
    // 2. Update the match record
    await tx.match.update({
      where: { id: input.matchId },
      data: {
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        winnerId: input.winnerId,
        outcome: input.outcome as never,
        outcomeReason: input.outcomeReason,
        pointsA: input.pointsA,
        pointsB: input.pointsB,
        tournamentScope: input.tournamentScope as never,
        eloChangeA: input.eloChangeA,
        eloChangeB: input.eloChangeB,
        verificationStatus: MatchVerificationStatus.VERIFIED,
        submittedById: input.submittedById,
        updatedAt: new Date(),
      },
    })
    
    // 3. Update player A ELO and points
    const playerANewElo = Math.round((match.playerA?.hiddenElo ?? 1500) + input.eloChangeA)
    const playerANewPoints = (match.playerA?.visiblePoints ?? 0) + input.pointsA
    
    await tx.user.update({
      where: { id: input.playerAId },
      data: {
        hiddenElo: playerANewElo,
        visiblePoints: playerANewPoints,
      },
    })
    
    // 4. Update player B ELO and points
    const playerBNewElo = Math.round((match.playerB?.hiddenElo ?? 1500) + input.eloChangeB)
    const playerBNewPoints = (match.playerB?.visiblePoints ?? 0) + input.pointsB
    
    await tx.user.update({
      where: { id: input.playerBId },
      data: {
        hiddenElo: playerBNewElo,
        visiblePoints: playerBNewPoints,
      },
    })
    
    // 5. Update player rating stats (if exists)
    if (input.winnerId) {
      // Winner gets a win, loser gets a loss
      await tx.playerRating.updateMany({
        where: { userId: input.winnerId },
        data: {
          wins: { increment: 1 },
          matchesPlayed: { increment: 1 },
          highestElo: input.winnerId === input.playerAId 
            ? Math.max(playerANewElo, match.playerA?.hiddenElo ?? 0)
            : Math.max(playerBNewElo, match.playerB?.hiddenElo ?? 0),
        },
      })
      
      const loserId = input.winnerId === input.playerAId ? input.playerBId : input.playerAId
      await tx.playerRating.updateMany({
        where: { userId: loserId },
        data: {
          losses: { increment: 1 },
          matchesPlayed: { increment: 1 },
        },
      })
    }
    
    // 6. Log to audit
    await tx.auditLog.create({
      data: {
        sport: input.sport as never,
        action: 'MATCH_RESULT_ENTERED' as never,
        actorId: input.submittedById ?? 'system',
        actorRole: 'ADMIN' as never,
        targetType: 'MATCH',
        targetId: input.matchId,
        tournamentId: input.tournamentId,
        metadata: JSON.stringify({
          scoreA: input.scoreA,
          scoreB: input.scoreB,
          winnerId: input.winnerId,
          eloChangeA: input.eloChangeA,
          eloChangeB: input.eloChangeB,
          pointsA: input.pointsA,
          pointsB: input.pointsB,
        }),
      },
    })
    
    return {
      matchId: input.matchId,
      playerA: { newElo: playerANewElo, newPoints: playerANewPoints },
      playerB: { newElo: playerBNewElo, newPoints: playerBNewPoints },
    }
  })
}

// ============================================
// Refund Transaction
// ============================================

/**
 * Executes a refund transaction that:
 * 1. Updates payment ledger status
 * 2. Creates refund record (if applicable)
 * 3. Updates registration status (if applicable)
 * 4. Logs the refund action
 * 
 * @param input - Refund input data
 * @returns Transaction result with refund details
 */
export async function executeRefundTransaction(
  input: RefundInput
): Promise<TransactionResult<{
  paymentLedgerId: string
  refundAmount: number
  status: string
}>> {
  return withTransaction(async (tx) => {
    // 1. Verify payment ledger exists
    const paymentLedger = await tx.paymentLedger.findUnique({
      where: { id: input.paymentLedgerId },
    })
    
    if (!paymentLedger) {
      throw new Error('Payment ledger record not found')
    }
    
    if (paymentLedger.status === PaymentLedgerStatus.REFUNDED) {
      throw new Error('Invalid state: Payment already refunded')
    }
    
    if (paymentLedger.status !== PaymentLedgerStatus.PAID) {
      throw new Error(`Invalid state: Cannot refund payment with status ${paymentLedger.status}`)
    }
    
    // 2. Update payment ledger status to REFUNDED
    await tx.paymentLedger.update({
      where: { id: input.paymentLedgerId },
      data: {
        status: PaymentLedgerStatus.REFUNDED,
        description: `Refunded: ${input.reason}`,
        updatedAt: new Date(),
      },
    })
    
    // 3. If this is a tournament registration, update registration status
    if (input.tournamentId && input.userId) {
      await tx.tournamentRegistration.updateMany({
        where: {
          tournamentId: input.tournamentId,
          userId: input.userId,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
        data: {
          status: 'CANCELLED' as never,
          cancelledAt: new Date(),
          refundId: input.paymentLedgerId,
          refundAmount: input.refundAmount,
        },
      })
    }
    
    // 4. If this is an org registration, update that too
    if (input.tournamentId && input.orgId) {
      await tx.orgTournamentRegistration.updateMany({
        where: {
          tournamentId: input.tournamentId,
          orgId: input.orgId,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
        data: {
          status: 'CANCELLED' as never,
          cancelledAt: new Date(),
        },
      })
    }
    
    // 5. Log to audit
    await tx.auditLog.create({
      data: {
        sport: input.sport as never,
        action: 'ADMIN_OVERRIDE' as never, // Using ADMIN_OVERRIDE for refunds
        actorId: 'system',
        actorRole: 'ADMIN' as never,
        targetType: 'PAYMENT',
        targetId: input.paymentLedgerId,
        tournamentId: input.tournamentId,
        reason: input.reason,
        metadata: JSON.stringify({
          refundAmount: input.refundAmount,
          userId: input.userId,
          orgId: input.orgId,
          originalAmount: paymentLedger.amount,
        }),
      },
    })
    
    return {
      paymentLedgerId: input.paymentLedgerId,
      refundAmount: input.refundAmount,
      status: 'REFUNDED',
    }
  })
}

// ============================================
// Tournament State Transition Transaction
// ============================================

/**
 * Executes a tournament state transition that:
 * 1. Verifies the current state matches expected fromState
 * 2. Updates tournament status
 * 3. Creates state history log entry
 * 4. Triggers any side effects (notifications, etc.)
 * 
 * @param input - State transition input data
 * @returns Transaction result with transition details
 */
export async function executeTournamentStateTransition(
  input: TournamentStateTransitionInput
): Promise<TransactionResult<{
  tournamentId: string
  fromState: TournamentStatus
  toState: TournamentStatus
  transitionedAt: Date
}>> {
  return withTransaction(async (tx) => {
    // 1. Get current tournament state
    const tournament = await tx.tournament.findUnique({
      where: { id: input.tournamentId },
      select: { id: true, status: true, name: true },
    })
    
    if (!tournament) {
      throw new Error('Tournament not found')
    }
    
    // 2. Verify current state matches expected
    if (tournament.status !== input.fromState) {
      throw new Error(
        `Invalid state: Expected ${input.fromState}, found ${tournament.status}`
      )
    }
    
    // 3. Validate state transition is allowed
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      DRAFT: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED],
      REGISTRATION_OPEN: [TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.CANCELLED],
      REGISTRATION_CLOSED: [TournamentStatus.BRACKET_GENERATED, TournamentStatus.CANCELLED],
      BRACKET_GENERATED: [TournamentStatus.IN_PROGRESS, TournamentStatus.CANCELLED],
      IN_PROGRESS: [TournamentStatus.PAUSED, TournamentStatus.COMPLETED, TournamentStatus.CANCELLED],
      PAUSED: [TournamentStatus.IN_PROGRESS, TournamentStatus.CANCELLED],
      COMPLETED: [], // Terminal state
      CANCELLED: [], // Terminal state
    }
    
    if (!validTransitions[input.fromState]?.includes(input.toState)) {
      throw new Error(
        `Validation failed: Invalid transition from ${input.fromState} to ${input.toState}`
      )
    }
    
    // 4. Update tournament status
    await tx.tournament.update({
      where: { id: input.tournamentId },
      data: {
        status: input.toState,
        updatedAt: new Date(),
        // Track autopilot timestamps if applicable
        ...(input.toState === TournamentStatus.REGISTRATION_CLOSED && {
          registrationClosedAt: new Date(),
        }),
        ...(input.toState === TournamentStatus.BRACKET_GENERATED && {
          bracketGeneratedAt: new Date(),
        }),
        ...(input.toState === TournamentStatus.IN_PROGRESS && {
          tournamentStartedAt: new Date(),
        }),
      },
    })
    
    // 5. Log to audit
    await tx.auditLog.create({
      data: {
        sport: input.sport as never,
        action: 'TOURNAMENT_COMPLETED' as never, // Will be used for state changes
        actorId: input.changedById,
        actorRole: 'ADMIN' as never,
        targetType: 'TOURNAMENT',
        targetId: input.tournamentId,
        tournamentId: input.tournamentId,
        reason: input.reason,
        metadata: JSON.stringify({
          fromState: input.fromState,
          toState: input.toState,
          ...input.metadata,
        }),
      },
    })
    
    // 6. Create state history log (using new model if it exists)
    try {
      // PostgreSQL-compatible: use gen_random_uuid() for ID and NOW() for timestamp
      await tx.$queryRaw`
        INSERT INTO "TournamentStateLog" (id, "tournamentId", "fromState", "toState", "changedById", reason, metadata, "createdAt")
        VALUES (gen_random_uuid(), ${input.tournamentId}, ${input.fromState}, ${input.toState}, ${input.changedById}, ${input.reason || null}, ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb, NOW())
      `
    } catch {
      // Table might not exist yet, continue without it
      console.log('[Transaction] TournamentStateLog table not available, skipping state log')
    }
    
    return {
      tournamentId: input.tournamentId,
      fromState: input.fromState,
      toState: input.toState,
      transitionedAt: new Date(),
    }
  })
}

// ============================================
// Batch Operations
// ============================================

/**
 * Execute multiple operations in a single transaction
 * Useful for batch updates like advancing multiple bracket matches
 */
export async function executeBatchOperations<T>(
  operations: Array<(tx: Prisma.TransactionClient) => Promise<T>>
): Promise<TransactionResult<T[]>> {
  return withTransaction(async (tx) => {
    const results: T[] = []
    
    for (const operation of operations) {
      const result = await operation(tx)
      results.push(result)
    }
    
    return results
  })
}

/**
 * Transaction with retry logic for transient failures
 */
export async function withRetry<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxRetries?: number
    retryDelay?: number
    timeout?: number
  }
): Promise<TransactionResult<T>> {
  const maxRetries = options?.maxRetries ?? 3
  const retryDelay = options?.retryDelay ?? 100
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await withTransaction(callback, { timeout: options?.timeout })
    
    if (result.success) {
      return result
    }
    
    // Only retry on database/connection errors
    if (result.errorType !== 'DATABASE_ERROR') {
      return result
    }
    
    lastError = new Error(result.error)
    
    // Wait before retrying
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }
  
  return {
    success: false,
    error: lastError?.message ?? 'Transaction failed after retries',
    errorType: 'DATABASE_ERROR',
  }
}

// ============================================
// Export convenience functions
// ============================================

export const transactions = {
  withTransaction,
  executeMatchResultTransaction,
  executeRefundTransaction,
  executeTournamentStateTransition,
  executeBatchOperations,
  withRetry,
}

export default transactions
