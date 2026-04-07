/**
 * Admin Manual Override - Match Operations
 * 
 * Allows admins to:
 * - Override match result
 * - Adjust Elo manually
 * - Mark match as disputed
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MatchOutcome, SportType, Role } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { withRateLimit } from '@/lib/rate-limit';

// FIX: Wrap handler with rate limiting to prevent abuse
async function matchOverrideHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, matchId, winnerId, scoreA, scoreB, reason } = body;

    // FIX: Use proper auth helper that hashes tokens correctly
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: adminUser } = auth;

    // FIX: Verify admin role
    if (adminUser.role !== Role.ADMIN && adminUser.role !== Role.SUB_ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    switch (action) {
      case 'override_result':
        return await overrideMatchResult(matchId, winnerId, scoreA, scoreB, reason, adminUser.id);
      
      case 'adjust_elo':
        return await adjustPlayerElo(body.playerId, body.sport, body.eloChange, reason, adminUser.id);
      
      case 'revert_result':
        return await revertMatchResult(matchId, reason, adminUser.id);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin match override error:', error);
    // FIX: Don't leak internal error details in production
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with rate limiting
export const POST = withRateLimit(matchOverrideHandler, 'ADMIN');

/**
 * Override match result
 * Used when scores were entered incorrectly
 */
async function overrideMatchResult(
  matchId: string,
  winnerId: string,
  scoreA: number,
  scoreB: number,
  reason: string,
  adminId: string
) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true, playerA: true, playerB: true },
  });

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Verify winner is a participant
  if (winnerId !== match.playerAId && winnerId !== match.playerBId) {
    return NextResponse.json({ error: 'Winner must be a participant' }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Store history
    await tx.matchResultHistory.create({
      data: {
        matchId,
        oldScoreA: match.scoreA,
        oldScoreB: match.scoreB,
        oldWinnerId: match.winnerId,
        newScoreA: scoreA,
        newScoreB: scoreB,
        newWinnerId: winnerId,
        reason,
        editedById: adminId,
      },
    });

    // Update match
    await tx.match.update({
      where: { id: matchId },
      data: {
        scoreA,
        scoreB,
        winnerId,
        outcome: MatchOutcome.PLAYED,
        updatedById: adminId,
      },
    });

    // Update Elo for both players
    const winnerElo = winnerId === match.playerAId ? match.playerA.hiddenElo : match.playerB!.hiddenElo;
    const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
    const loserElo = winnerId === match.playerAId ? match.playerB!.hiddenElo : match.playerA.hiddenElo;
    
    // Calculate Elo changes (simplified)
    const k = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const eloChange = k * (1 - expectedWinner);
    
    // Update winner Elo
    await tx.user.update({
      where: { id: winnerId },
      data: { hiddenElo: { increment: eloChange } },
    });
    
    // Update loser Elo
    await tx.user.update({
      where: { id: loserId! },
      data: { hiddenElo: { decrement: eloChange } },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: match.sport,
        action: 'MATCH_RESULT_EDITED',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'MATCH',
        targetId: matchId,
        reason,
        metadata: JSON.stringify({ 
          oldWinner: match.winnerId,
          newWinner: winnerId,
          oldScore: `${match.scoreA}-${match.scoreB}`,
          newScore: `${scoreA}-${scoreB}`,
        }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Match result overridden',
    matchId,
    newWinnerId: winnerId,
  });
}

/**
 * Manually adjust player Elo
 * Used to correct rating errors
 */
async function adjustPlayerElo(
  playerId: string,
  sport: SportType,
  eloChange: number,
  reason: string,
  adminId: string
) {
  const user = await db.user.findUnique({
    where: { id: playerId },
  });

  if (!user) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const oldElo = user.hiddenElo;
  const newElo = Math.max(100, oldElo + eloChange); // Apply floor

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: playerId },
      data: { hiddenElo: newElo },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'PLAYER',
        targetId: playerId,
        reason,
        metadata: JSON.stringify({ 
          action: 'adjust_elo',
          oldElo,
          newElo,
          change: eloChange,
        }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `Elo adjusted by ${eloChange > 0 ? '+' : ''}${eloChange}`,
    playerId,
    oldElo,
    newElo,
  });
}

/**
 * Revert match result to pending
 * Used when result needs to be completely redone
 */
async function revertMatchResult(
  matchId: string,
  reason: string,
  adminId: string
) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.winnerId === null) {
    return NextResponse.json({ error: 'Match has no result to revert' }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Store history
    await tx.matchResultHistory.create({
      data: {
        matchId,
        oldScoreA: match.scoreA,
        oldScoreB: match.scoreB,
        oldWinnerId: match.winnerId,
        newScoreA: null,
        newScoreB: null,
        newWinnerId: null,
        reason,
        editedById: adminId,
      },
    });

    // Reset match
    await tx.match.update({
      where: { id: matchId },
      data: {
        scoreA: null,
        scoreB: null,
        winnerId: null,
        outcome: null,
        pointsA: null,
        pointsB: null,
        eloChangeA: null,
        eloChangeB: null,
        updatedById: adminId,
      },
    });

    // Update bracket match if exists
    if (match.tournamentId) {
      await tx.bracketMatch.updateMany({
        where: { matchId },
        data: {
          winnerId: null,
          status: 'PENDING',
        },
      });
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: match.sport,
        action: 'MATCH_RESULT_REVERTED',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'MATCH',
        targetId: matchId,
        reason,
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Match result reverted to pending',
    matchId,
  });
}

// FIX: Removed local verifyAdminSession function - now using getAuthenticatedAdmin from lib/auth.ts
// which properly hashes tokens before database lookup
