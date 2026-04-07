/**
 * Admin Manual Override - Bracket Operations
 * 
 * Allows admins to:
 * - Force advance a player in bracket
 * - Reset a bracket match
 * - Regenerate entire bracket
 * - Manually set match participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BracketMatchStatus, TournamentStatus, SportType } from '@prisma/client';

// Force advance a player to next round (bypassing match result)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, bracketMatchId, tournamentId, playerId, reason } = body;

    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'force_advance':
        return await forceAdvancePlayer(bracketMatchId, playerId, reason, session.userId);
      
      case 'reset_match':
        return await resetBracketMatch(bracketMatchId, reason, session.userId);
      
      case 'set_participant':
        return await setMatchParticipant(bracketMatchId, body.slot, playerId, reason, session.userId);
      
      case 'regenerate_bracket':
        return await regenerateBracket(tournamentId, reason, session.userId);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin override error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Force advance a player to the next round
 * Used when match can't be completed (disputes, technical issues)
 */
async function forceAdvancePlayer(
  bracketMatchId: string,
  playerId: string,
  reason: string,
  adminId: string
) {
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { id: bracketMatchId },
    include: { bracket: { include: { tournament: true } } },
  });

  if (!bracketMatch) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Verify player is in this match
  if (playerId !== bracketMatch.playerAId && playerId !== bracketMatch.playerBId) {
    return NextResponse.json({ error: 'Player not in this match' }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    // Update current match
    await tx.bracketMatch.update({
      where: { id: bracketMatchId },
      data: {
        winnerId: playerId,
        status: BracketMatchStatus.COMPLETED,
      },
    });

    // Find next match and advance player
    const nextMatch = await tx.bracketMatch.findFirst({
      where: {
        bracketId: bracketMatch.bracketId,
        roundNumber: bracketMatch.roundNumber + 1,
        status: BracketMatchStatus.PENDING,
      },
      orderBy: { matchNumber: 'asc' },
    });

    if (nextMatch) {
      const updateData = !nextMatch.playerAId
        ? { playerAId: playerId }
        : { playerBId: playerId };

      await tx.bracketMatch.update({
        where: { id: nextMatch.id },
        data: updateData,
      });
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: bracketMatch.bracket.tournament?.sport || SportType.CORNHOLE,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'BRACKET_MATCH',
        targetId: bracketMatchId,
        reason,
        metadata: JSON.stringify({ 
          action: 'force_advance', 
          playerId,
          advanced: !!nextMatch 
        }),
      },
    });

    return { nextMatchId: nextMatch?.id };
  });

  return NextResponse.json({
    success: true,
    message: 'Player force-advanced to next round',
    nextMatchId: result.nextMatchId,
  });
}

/**
 * Reset a bracket match to pending state
 * Used when result was entered incorrectly
 */
async function resetBracketMatch(
  bracketMatchId: string,
  reason: string,
  adminId: string
) {
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { id: bracketMatchId },
    include: { bracket: { include: { tournament: true } } },
  });

  if (!bracketMatch) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Check if next round matches have been played
  const nextRoundMatch = await db.bracketMatch.findFirst({
    where: {
      bracketId: bracketMatch.bracketId,
      roundNumber: bracketMatch.roundNumber + 1,
      status: BracketMatchStatus.COMPLETED,
    },
  });

  if (nextRoundMatch) {
    return NextResponse.json({
      error: 'Cannot reset - next round matches already completed. Reset those first.',
    }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Reset match
    await tx.bracketMatch.update({
      where: { id: bracketMatchId },
      data: {
        winnerId: null,
        status: BracketMatchStatus.PENDING,
      },
    });

    // Remove winner from next match
    const nextMatch = await tx.bracketMatch.findFirst({
      where: {
        bracketId: bracketMatch.bracketId,
        roundNumber: bracketMatch.roundNumber + 1,
      },
    });

    if (nextMatch && bracketMatch.winnerId) {
      // Remove the player that was advanced
      const updateData = nextMatch.playerAId === bracketMatch.winnerId
        ? { playerAId: null }
        : { playerBId: null };

      await tx.bracketMatch.update({
        where: { id: nextMatch.id },
        data: updateData,
      });
    }

    // Delete associated match record if exists
    if (bracketMatch.matchId) {
      await tx.match.delete({
        where: { id: bracketMatch.matchId },
      });
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: bracketMatch.bracket.tournament?.sport || SportType.CORNHOLE,
        action: 'BRACKET_RESET',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'BRACKET_MATCH',
        targetId: bracketMatchId,
        reason,
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Bracket match reset successfully',
  });
}

/**
 * Manually set a participant in a bracket match
 * Used to fix seeding errors or replace withdrawn players
 */
async function setMatchParticipant(
  bracketMatchId: string,
  slot: 'A' | 'B',
  playerId: string,
  reason: string,
  adminId: string
) {
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { id: bracketMatchId },
    include: { bracket: { include: { tournament: true } } },
  });

  if (!bracketMatch) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (bracketMatch.status !== BracketMatchStatus.PENDING) {
    return NextResponse.json({
      error: 'Can only modify pending matches',
    }, { status: 400 });
  }

  // Check if player is already in another match in this round
  const existingMatch = await db.bracketMatch.findFirst({
    where: {
      bracketId: bracketMatch.bracketId,
      roundNumber: bracketMatch.roundNumber,
      OR: [
        { playerAId: playerId },
        { playerBId: playerId },
      ],
    },
  });

  if (existingMatch && existingMatch.id !== bracketMatchId) {
    return NextResponse.json({
      error: 'Player already in another match this round',
    }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.bracketMatch.update({
      where: { id: bracketMatchId },
      data: slot === 'A' ? { playerAId: playerId } : { playerBId: playerId },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: bracketMatch.bracket.tournament?.sport || SportType.CORNHOLE,
        action: 'ADMIN_OVERRIDE',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'BRACKET_MATCH',
        targetId: bracketMatchId,
        reason,
        metadata: JSON.stringify({ action: 'set_participant', slot, playerId }),
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `Player set as participant ${slot}`,
  });
}

/**
 * Regenerate entire bracket
 * Used when major issues require starting over
 */
async function regenerateBracket(
  tournamentId: string,
  reason: string,
  adminId: string
) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: { bracket: { include: { matches: true } } },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    return NextResponse.json({
      error: 'Cannot regenerate bracket for completed tournament',
    }, { status: 400 });
  }

  // Count completed matches
  const completedMatches = tournament.bracket?.matches.filter(
    m => m.status === BracketMatchStatus.COMPLETED
  ).length || 0;

  if (completedMatches > 0) {
    // Require confirmation for tournaments in progress
    return NextResponse.json({
      error: 'Tournament has completed matches. This action requires explicit confirmation.',
      completedMatches,
      requireConfirmation: true,
    }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Delete existing bracket
    if (tournament.bracket) {
      await tx.bracketMatch.deleteMany({
        where: { bracketId: tournament.bracket.id },
      });
      await tx.bracket.delete({
        where: { id: tournament.bracket.id },
      });
    }

    // Reset tournament status
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.REGISTRATION_CLOSED,
      },
    });

    // Log audit
    await tx.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'BRACKET_DELETED',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'TOURNAMENT',
        targetId: tournamentId,
        reason,
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Bracket deleted. Use bracket generate endpoint to create new bracket.',
  });
}

/**
 * Verify admin session
 */
async function verifyAdminSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || !session.user) return null;
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUB_ADMIN') return null;
  if (session.expiresAt < new Date()) return null;

  return { userId: session.user.id, role: session.user.role };
}
