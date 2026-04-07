/**
 * VALORHIVE - Completion Chain Service (v3.48.0)
 * 
 * Handles tournament completion detection, winner confirmation,
 * and status transitions for the Completion & Trust Layer.
 * 
 * Key Features:
 * - Automatic tournament completion detection
 * - Winner confirmation logic for different bracket formats
 * - Manual override capabilities
 * - Complete audit trail
 */

import { db } from '@/lib/db';
import { TournamentStatus, BracketFormat, BracketMatchStatus, CompletionAction, SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface CompletionResult {
  success: boolean;
  tournamentId: string;
  status: 'DETECTED' | 'CONFIRMED' | 'COMPLETED' | 'FAILED';
  winnerId?: string;
  winnerTeamId?: string;
  message?: string;
  error?: string;
}

interface WinnerInfo {
  type: 'PLAYER' | 'TEAM';
  id: string;
  name: string;
}

interface CompletionDetectionResult {
  isComplete: boolean;
  winner: WinnerInfo | null;
  pendingMatches: number;
  completedMatches: number;
  totalMatches: number;
  message?: string;
}

// ============================================
// COMPLETION DETECTION
// ============================================

/**
 * Detect if a tournament is complete based on bracket format
 */
export async function detectTournamentCompletion(
  tournamentId: string
): Promise<CompletionDetectionResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: true
        }
      },
      matches: true
    }
  });

  if (!tournament) {
    return {
      isComplete: false,
      winner: null,
      pendingMatches: 0,
      completedMatches: 0,
      totalMatches: 0,
      message: 'Tournament not found'
    };
  }

  if (!tournament.bracket) {
    return {
      isComplete: false,
      winner: null,
      pendingMatches: 0,
      completedMatches: 0,
      totalMatches: 0,
      message: 'No bracket generated'
    };
  }

  const bracketMatches = tournament.bracket.matches;
  const totalMatches = bracketMatches.length;
  const completedMatches = bracketMatches.filter(
    m => m.status === BracketMatchStatus.COMPLETED
  ).length;
  const pendingMatches = totalMatches - completedMatches;

  // Detect winner based on bracket format
  const winner = await detectWinner(tournament, bracketMatches);

  // Determine if tournament is complete
  let isComplete = false;
  let message = '';

  switch (tournament.bracketFormat) {
    case BracketFormat.SINGLE_ELIMINATION:
      // All matches must be completed
      isComplete = pendingMatches === 0 && winner !== null;
      message = isComplete 
        ? 'Single elimination bracket complete' 
        : `${pendingMatches} matches remaining`;
      break;

    case BracketFormat.DOUBLE_ELIMINATION:
      // All matches must be completed, including grand finals
      isComplete = pendingMatches === 0 && winner !== null;
      message = isComplete 
        ? 'Double elimination bracket complete' 
        : `${pendingMatches} matches remaining`;
      break;

    case BracketFormat.ROUND_ROBIN:
      // All matches must be completed, winner by points
      isComplete = pendingMatches === 0;
      if (isComplete) {
        message = 'Round robin complete';
      } else {
        message = `${pendingMatches} matches remaining`;
      }
      break;

    case BracketFormat.SWISS:
      // All rounds must be completed
      isComplete = pendingMatches === 0;
      message = isComplete 
        ? 'Swiss tournament complete' 
        : `${pendingMatches} matches remaining`;
      break;

    default:
      // Default: all matches completed
      isComplete = pendingMatches === 0;
      message = isComplete ? 'Tournament complete' : `${pendingMatches} matches remaining`;
  }

  return {
    isComplete,
    winner,
    pendingMatches,
    completedMatches,
    totalMatches,
    message
  };
}

/**
 * Detect winner based on bracket format and match results
 */
async function detectWinner(
  tournament: any,
  bracketMatches: any[]
): Promise<WinnerInfo | null> {
  if (bracketMatches.length === 0) return null;

  switch (tournament.bracketFormat) {
    case BracketFormat.SINGLE_ELIMINATION:
    case BracketFormat.DOUBLE_ELIMINATION:
      // Find the final match (highest round number)
      const finalMatch = bracketMatches
        .filter(m => m.status === BracketMatchStatus.COMPLETED)
        .sort((a, b) => b.roundNumber - a.roundNumber)[0];

      if (!finalMatch) return null;

      if (tournament.format === 'INDIVIDUAL') {
        if (!finalMatch.winnerId) return null;
        
        const winner = await db.user.findUnique({
          where: { id: finalMatch.winnerId },
          select: { id: true, firstName: true, lastName: true }
        });

        if (!winner) return null;

        return {
          type: 'PLAYER',
          id: winner.id,
          name: `${winner.firstName} ${winner.lastName}`
        };
      } else {
        // Team format
        if (!finalMatch.winnerTeamId) return null;
        
        const team = await db.team.findUnique({
          where: { id: finalMatch.winnerTeamId },
          select: { id: true, name: true }
        });

        if (!team) return null;

        return {
          type: 'TEAM',
          id: team.id,
          name: team.name
        };
      }

    case BracketFormat.ROUND_ROBIN:
    case BracketFormat.SWISS:
      // Calculate standings based on match results
      return await calculateRoundRobinWinner(tournament, bracketMatches);

    default:
      return null;
  }
}

/**
 * Calculate winner for round-robin/swiss formats
 */
async function calculateRoundRobinWinner(
  tournament: any,
  bracketMatches: any[]
): Promise<WinnerInfo | null> {
  const standings: Map<string, { wins: number; points: number; name: string; type: 'PLAYER' | 'TEAM' }> = new Map();

  // Aggregate match results
  for (const match of bracketMatches) {
    if (match.status !== BracketMatchStatus.COMPLETED) continue;
    if (!match.winnerId && !match.winnerTeamId) continue;

    if (tournament.format === 'INDIVIDUAL') {
      // Player format
      const playerA = match.playerAId;
      const playerB = match.playerBId;
      const winner = match.winnerId;

      if (playerA && !standings.has(playerA)) {
        const user = await db.user.findUnique({
          where: { id: playerA },
          select: { firstName: true, lastName: true }
        });
        standings.set(playerA, { 
          wins: 0, 
          points: 0, 
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          type: 'PLAYER'
        });
      }

      if (playerB && !standings.has(playerB)) {
        const user = await db.user.findUnique({
          where: { id: playerB },
          select: { firstName: true, lastName: true }
        });
        standings.set(playerB, { 
          wins: 0, 
          points: 0, 
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          type: 'PLAYER'
        });
      }

      if (winner && standings.has(winner)) {
        const entry = standings.get(winner)!;
        entry.wins++;
        entry.points += 3; // Standard win points
      }
    } else {
      // Team format
      const teamA = match.teamAId;
      const teamB = match.teamBId;
      const winner = match.winnerTeamId;

      if (teamA && !standings.has(teamA)) {
        const team = await db.team.findUnique({
          where: { id: teamA },
          select: { name: true }
        });
        standings.set(teamA, { 
          wins: 0, 
          points: 0, 
          name: team?.name || 'Unknown',
          type: 'TEAM'
        });
      }

      if (teamB && !standings.has(teamB)) {
        const team = await db.team.findUnique({
          where: { id: teamB },
          select: { name: true }
        });
        standings.set(teamB, { 
          wins: 0, 
          points: 0, 
          name: team?.name || 'Unknown',
          type: 'TEAM'
        });
      }

      if (winner && standings.has(winner)) {
        const entry = standings.get(winner)!;
        entry.wins++;
        entry.points += 3;
      }
    }
  }

  // Find the winner (highest points, then highest wins)
  let winner: { id: string; data: { wins: number; points: number; name: string; type: 'PLAYER' | 'TEAM' } } | null = null;

  for (const [id, data] of standings) {
    if (!winner || 
        data.points > winner.data.points || 
        (data.points === winner.data.points && data.wins > winner.data.wins)) {
      winner = { id, data };
    }
  }

  if (!winner) return null;

  return {
    type: winner.data.type,
    id: winner.id,
    name: winner.data.name
  };
}

// ============================================
// COMPLETION EXECUTION
// ============================================

/**
 * Complete a tournament with winner confirmation
 */
export async function completeTournament(
  tournamentId: string,
  options?: {
    confirmedById?: string;
    confirmedByRole?: string;
    overrideWinnerId?: string;
    overrideWinnerTeamId?: string;
    reason?: string;
  }
): Promise<CompletionResult> {
  try {
    // Step 1: Detect completion status
    const detection = await detectTournamentCompletion(tournamentId);

    if (!detection.isComplete) {
      return {
        success: false,
        tournamentId,
        status: 'FAILED',
        message: detection.message || 'Tournament not complete',
        error: `Pending matches: ${detection.pendingMatches}`
      };
    }

    // Step 2: Determine winner
    let winner = detection.winner;

    // Handle manual override
    if (options?.overrideWinnerId || options?.overrideWinnerTeamId) {
      if (options.overrideWinnerId) {
        const user = await db.user.findUnique({
          where: { id: options.overrideWinnerId },
          select: { id: true, firstName: true, lastName: true }
        });
        if (user) {
          winner = {
            type: 'PLAYER',
            id: user.id,
            name: `${user.firstName} ${user.lastName}`
          };
        }
      } else if (options.overrideWinnerTeamId) {
        const team = await db.team.findUnique({
          where: { id: options.overrideWinnerTeamId },
          select: { id: true, name: true }
        });
        if (team) {
          winner = {
            type: 'TEAM',
            id: team.id,
            name: team.name
          };
        }
      }
    }

    if (!winner) {
      return {
        success: false,
        tournamentId,
        status: 'FAILED',
        message: 'No winner determined'
      };
    }

    // Step 3: Log completion action
    await logCompletionAction(tournamentId, CompletionAction.WINNER_CONFIRMED, {
      winnerType: winner.type,
      winnerId: winner.id,
      winnerName: winner.name,
      confirmedById: options?.confirmedById,
      confirmedByRole: options?.confirmedByRole,
      isOverride: !!(options?.overrideWinnerId || options?.overrideWinnerTeamId),
      reason: options?.reason
    });

    // Step 4: Update tournament status
    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.COMPLETED,
        updatedAt: new Date()
      }
    });

    // Step 5: Log completion
    await logCompletionAction(tournamentId, CompletionAction.TOURNAMENT_COMPLETED, {
      winnerType: winner.type,
      winnerId: winner.id,
      winnerName: winner.name
    });

    return {
      success: true,
      tournamentId,
      status: 'COMPLETED',
      winnerId: winner.type === 'PLAYER' ? winner.id : undefined,
      winnerTeamId: winner.type === 'TEAM' ? winner.id : undefined,
      message: `Tournament completed. Winner: ${winner.name}`
    };

  } catch (error) {
    console.error('Error completing tournament:', error);
    return {
      success: false,
      tournamentId,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Auto-detect and complete tournaments (cron job)
 */
export async function autoCompleteTournaments(): Promise<{
  processed: number;
  completed: number;
  failed: number;
  details: CompletionResult[];
}> {
  // Find tournaments in IN_PROGRESS status that may be complete
  const activeTournaments = await db.tournament.findMany({
    where: {
      status: TournamentStatus.IN_PROGRESS
    },
    include: {
      bracket: {
        include: {
          matches: true
        }
      }
    }
  });

  const results: CompletionResult[] = [];
  let completed = 0;
  let failed = 0;

  for (const tournament of activeTournaments) {
    const detection = await detectTournamentCompletion(tournament.id);

    if (detection.isComplete) {
      const result = await completeTournament(tournament.id, {
        confirmedById: 'SYSTEM',
        confirmedByRole: 'SYSTEM'
      });

      results.push(result);

      if (result.success) {
        completed++;
      } else {
        failed++;
      }
    }
  }

  return {
    processed: activeTournaments.length,
    completed,
    failed,
    details: results
  };
}

// ============================================
// LOGGING
// ============================================

/**
 * Log a completion action
 */
async function logCompletionAction(
  tournamentId: string,
  action: CompletionAction,
  details: Record<string, any>
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { sport: true }
  });

  if (!tournament) return;

  await db.tournamentCompletionLog.create({
    data: {
      tournamentId,
      sport: tournament.sport,
      action,
      status: 'SUCCESS',
      details: JSON.stringify(details),
      actorId: details.confirmedById || null,
      actorRole: details.confirmedByRole || 'SYSTEM',
      executedAt: new Date()
    }
  });
}

// ============================================
// MANUAL OVERRIDES
// ============================================

/**
 * Force complete a tournament (admin override)
 */
export async function forceCompleteTournament(
  tournamentId: string,
  actorId: string,
  actorRole: string,
  options: {
    winnerId?: string;
    winnerTeamId?: string;
    reason: string;
  }
): Promise<CompletionResult> {
  // Validate admin has permission
  const hasPermission = await validateCompletionPermission(actorId, actorRole);
  if (!hasPermission) {
    return {
      success: false,
      tournamentId,
      status: 'FAILED',
      error: 'Insufficient permissions for forced completion'
    };
  }

  // Log the override attempt
  await logCompletionAction(tournamentId, CompletionAction.ADMIN_OVERRIDE, {
    actorId,
    actorRole,
    reason: options.reason,
    winnerId: options.winnerId,
    winnerTeamId: options.winnerTeamId
  });

  // Execute completion with override
  return completeTournament(tournamentId, {
    confirmedById: actorId,
    confirmedByRole: actorRole,
    overrideWinnerId: options.winnerId,
    overrideWinnerTeamId: options.winnerTeamId,
    reason: options.reason
  });
}

/**
 * Validate if user has permission to force complete
 */
async function validateCompletionPermission(
  actorId: string,
  actorRole: string
): Promise<boolean> {
  // Super Admin, Sport Admin, State Admin, or Tournament Director can override
  const allowedRoles = [
    'SUPER_ADMIN',
    'SPORT_ADMIN',
    'STATE_ADMIN',
    'TOURNAMENT_DIRECTOR'
  ];

  if (allowedRoles.includes(actorRole)) {
    return true;
  }

  // Check admin assignment
  const assignment = await db.adminAssignment.findFirst({
    where: {
      userId: actorId,
      isActive: true
    }
  });

  return assignment !== null;
}

// ============================================
// EXPORTS
// ============================================

export const CompletionChainService = {
  detectCompletion: detectTournamentCompletion,
  complete: completeTournament,
  autoComplete: autoCompleteTournaments,
  forceComplete: forceCompleteTournament
};
