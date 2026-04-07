/**
 * VALORHIVE Tournament Autopilot Service (v3.45.0)
 * 
 * Automated tournament management system:
 * - Registration Auto-Close
 * - Auto-Bracket Generation  
 * - Auto-Start Tournament
 * - Auto-Advance Winner
 * - Waitlist Auto-Promotion
 * - Match Reminder Engine
 */

import { db } from './db';
import { TournamentStatus, BracketMatchStatus, BracketFormat, WaitlistStatus, RegistrationStatus } from '@prisma/client';
import { generateSeedings, SeedingOptions } from './seeding';
import { buildAppUrl } from './app-url';
import { 
  initializeSwissTournament, 
  generateSwissRound, 
  calculateSwissRounds,
  generateSwissPairings 
} from './swiss-pairing';
import { NotificationService } from './email-service';

// ============================================
// TYPES & CONSTANTS
// ============================================

export interface AutopilotResult {
  success: boolean;
  action: string;
  tournamentId: string;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

export const AUTOPILOT_ACTIONS = {
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  BRACKET_GENERATED: 'BRACKET_GENERATED',
  TOURNAMENT_STARTED: 'TOURNAMENT_STARTED',
  WINNER_ADVANCED: 'WINNER_ADVANCED',
  WAITLIST_PROMOTED: 'WAITLIST_PROMOTED',
} as const;

const MATCH_REMINDER_INTERVALS = [
  { minutesBefore: 120, label: '2-hour reminder' },
  { minutesBefore: 30, label: '30-minute reminder' },
  { minutesBefore: 5, label: '5-minute reminder' },
];

// ============================================
// LOGGING HELPER
// ============================================

async function logAutopilotAction(
  tournamentId: string,
  action: string,
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
  details?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    await db.autopilotLog.create({
      data: {
        tournamentId,
        action,
        status,
        details: details ? JSON.stringify(details) : null,
        errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to log autopilot action:', error);
  }
}

// ============================================
// 1. REGISTRATION AUTO-CLOSE
// ============================================

/**
 * Process tournaments that need registration auto-close
 * Called by cron job every minute
 */
export async function processRegistrationAutoClose(): Promise<AutopilotResult[]> {
  const results: AutopilotResult[] = [];
  const now = new Date();

  // Find tournaments with:
  // - autopilotEnabled = true
  // - autoCloseRegistration = true
  // - status = REGISTRATION_OPEN
  // - regDeadline <= now
  // - registrationClosedAt is null (not already closed)
  const tournaments = await db.tournament.findMany({
    where: {
      autopilotEnabled: true,
      autoCloseRegistration: true,
      status: TournamentStatus.REGISTRATION_OPEN,
      regDeadline: { lte: now },
      registrationClosedAt: null,
    },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  for (const tournament of tournaments) {
    try {
      const result = await autoCloseRegistration(tournament.id);
      results.push(result);
    } catch (error) {
      const result: AutopilotResult = {
        success: false,
        action: AUTOPILOT_ACTIONS.REGISTRATION_CLOSED,
        tournamentId: tournament.id,
        message: `Failed to auto-close registration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.push(result);
      await logAutopilotAction(
        tournament.id,
        AUTOPILOT_ACTIONS.REGISTRATION_CLOSED,
        'FAILED',
        undefined,
        result.error
      );
    }
  }

  return results;
}

/**
 * Auto-close registration for a specific tournament
 */
export async function autoCloseRegistration(tournamentId: string): Promise<AutopilotResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.REGISTRATION_CLOSED,
      tournamentId,
      message: 'Tournament not found',
    };
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.REGISTRATION_CLOSED,
      tournamentId,
      message: `Tournament is not in REGISTRATION_OPEN status (current: ${tournament.status})`,
    };
  }

  // Update tournament status
  const updated = await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.REGISTRATION_CLOSED,
      registrationClosedAt: new Date(),
    },
  });

  await logAutopilotAction(tournamentId, AUTOPILOT_ACTIONS.REGISTRATION_CLOSED, 'SUCCESS', {
    previousStatus: tournament.status,
    newStatus: TournamentStatus.REGISTRATION_CLOSED,
    registrationCount: tournament._count.registrations,
  });

  return {
    success: true,
    action: AUTOPILOT_ACTIONS.REGISTRATION_CLOSED,
    tournamentId,
    message: `Registration auto-closed. ${tournament._count.registrations} players registered.`,
    details: {
      registrationCount: tournament._count.registrations,
      closedAt: updated.registrationClosedAt,
    },
  };
}

// ============================================
// 2. AUTO-BRACKET GENERATION
// ============================================

/**
 * Process tournaments that need auto-bracket generation
 * Called by cron job every minute
 */
export async function processAutoBracketGeneration(): Promise<AutopilotResult[]> {
  const results: AutopilotResult[] = [];

  // Find tournaments with:
  // - autopilotEnabled = true
  // - autoGenerateBracket = true
  // - status = REGISTRATION_CLOSED
  // - bracketGeneratedAt is null (not already generated)
  const tournaments = await db.tournament.findMany({
    where: {
      autopilotEnabled: true,
      autoGenerateBracket: true,
      status: TournamentStatus.REGISTRATION_CLOSED,
      bracketGeneratedAt: null,
    },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
              affiliatedOrgId: true,
            },
          },
        },
      },
      bracket: true,
    },
  });

  for (const tournament of tournaments) {
    try {
      // Skip if bracket already exists (race condition check)
      if (tournament.bracket) {
        continue;
      }

      const result = await autoGenerateBracket(tournament.id);
      results.push(result);
    } catch (error) {
      const result: AutopilotResult = {
        success: false,
        action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
        tournamentId: tournament.id,
        message: `Failed to auto-generate bracket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.push(result);
      await logAutopilotAction(
        tournament.id,
        AUTOPILOT_ACTIONS.BRACKET_GENERATED,
        'FAILED',
        undefined,
        result.error
      );
    }
  }

  return results;
}

/**
 * Auto-generate bracket for a specific tournament
 */
export async function autoGenerateBracket(tournamentId: string): Promise<AutopilotResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
              affiliatedOrgId: true,
            },
          },
        },
      },
      bracket: true,
    },
  });

  if (!tournament) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
      tournamentId,
      message: 'Tournament not found',
    };
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_CLOSED) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
      tournamentId,
      message: `Tournament is not in REGISTRATION_CLOSED status`,
    };
  }

  // Check if bracket already exists
  if (tournament.bracket) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
      tournamentId,
      message: 'Bracket already exists',
    };
  }

  // Get confirmed players
  const players = tournament.registrations.map((r) => ({
    id: r.userId,
    name: `${r.user.firstName} ${r.user.lastName}`,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
  }));

  if (players.length < 2) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
      tournamentId,
      message: 'Need at least 2 players to generate bracket',
    };
  }

  const bracketFormat = tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION;

  // Generate bracket based on format
  if (bracketFormat === BracketFormat.SWISS) {
    await generateSwissBracketInternal(tournament, players);
  } else {
    await generateEliminationBracketInternal(tournament, players, bracketFormat);
  }

  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.BRACKET_GENERATED,
      bracketGeneratedAt: new Date(),
    },
  });

  await logAutopilotAction(tournamentId, AUTOPILOT_ACTIONS.BRACKET_GENERATED, 'SUCCESS', {
    playerCount: players.length,
    bracketFormat,
  });

  return {
    success: true,
    action: AUTOPILOT_ACTIONS.BRACKET_GENERATED,
    tournamentId,
    message: `Bracket generated successfully for ${players.length} players`,
    details: {
      playerCount: players.length,
      bracketFormat,
    },
  };
}

/**
 * Generate Swiss bracket (internal helper)
 */
async function generateSwissBracketInternal(
  tournament: { id: string; sport: string },
  players: Array<{ id: string; name: string; elo: number; orgId: string | null }>
): Promise<void> {
  const totalRounds = calculateSwissRounds(players.length);

  // Create bracket with SWISS format
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      format: BracketFormat.SWISS,
      totalRounds,
      seedingMethod: 'SWISS',
      generatedById: 'autopilot',
    },
  });

  // Generate first round pairings
  const pairingsResult = await generateSwissPairings(tournament.id, 1);

  if (!pairingsResult.success) {
    await db.bracket.delete({ where: { id: bracket.id } });
    throw new Error('Failed to generate Swiss pairings');
  }

  // Create matches from pairings
  let matchNumber = 1;
  for (const pairing of pairingsResult.pairings) {
    if (pairing.isBye) {
      const match = await db.match.create({
        data: {
          sport: tournament.sport as any,
          tournamentId: tournament.id,
          playerAId: pairing.playerAId,
          playerBId: null,
          outcome: 'BYE',
          winnerId: pairing.playerAId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: 1,
          matchNumber: matchNumber++,
          playerAId: pairing.playerAId,
          status: BracketMatchStatus.BYE,
          winnerId: pairing.playerAId,
        },
      });
    } else {
      const match = await db.match.create({
        data: {
          sport: tournament.sport as any,
          tournamentId: tournament.id,
          playerAId: pairing.playerAId,
          playerBId: pairing.playerBId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: 1,
          matchNumber: matchNumber++,
          playerAId: pairing.playerAId,
          playerBId: pairing.playerBId,
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }
}

/**
 * Generate elimination bracket (internal helper)
 */
async function generateEliminationBracketInternal(
  tournament: { id: string; sport: string },
  players: Array<{ id: string; name: string; elo: number; orgId: string | null }>,
  bracketFormat: BracketFormat
): Promise<void> {
  // Generate seedings
  const seedingOptions: SeedingOptions = {
    method: 'ELO',
    antiCollision: true,
    topSeedProtection: true,
    topN: 8,
  };

  const assignments = await generateSeedings(tournament.id, seedingOptions);

  // Calculate bracket size (next power of 2)
  const playerCount = assignments.length;
  let bracketSize = 2;
  while (bracketSize < playerCount) {
    bracketSize *= 2;
  }

  const totalRounds = Math.log2(bracketSize);

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      format: bracketFormat,
      totalRounds,
      seedingMethod: 'ELO',
      generatedById: 'autopilot',
    },
  });

  // Create seeded bracket positions using snake order
  const snakeOrder = generateSnakeOrder(bracketSize);
  const seededBracket: Array<{ id: string | null; isBye: boolean }> = Array(bracketSize)
    .fill(null)
    .map(() => ({ id: null, isBye: true }));

  for (let i = 0; i < assignments.length; i++) {
    const position = snakeOrder.indexOf(i + 1);
    if (position >= 0 && position < bracketSize) {
      seededBracket[position] = {
        id: assignments[i].userId,
        isBye: false,
      };
    }
  }

  // Create first round matches
  let matchNumber = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    const playerA = seededBracket[i];
    const playerB = seededBracket[i + 1];

    const isBye = playerA.isBye || playerB.isBye;

    const match = await db.match.create({
      data: {
        sport: tournament.sport as any,
        tournamentId: tournament.id,
        playerAId: playerA.isBye ? null : playerA.id,
        playerBId: playerB.isBye ? null : playerB.id,
        outcome: isBye ? 'BYE' : undefined,
        winnerId: playerA.isBye ? playerB.id : playerB.isBye ? playerA.id : null,
      },
    });

    await db.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        matchId: match.id,
        roundNumber: 1,
        matchNumber: matchNumber++,
        playerAId: playerA.isBye ? null : playerA.id,
        playerBId: playerB.isBye ? null : playerB.id,
        status: isBye ? BracketMatchStatus.BYE : BracketMatchStatus.PENDING,
        winnerId: playerA.isBye ? playerB.id : playerB.isBye ? playerA.id : null,
      },
    });
  }

  // Create empty matches for subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let m = 1; m <= matchesInRound; m++) {
      const match = await db.match.create({
        data: {
          sport: tournament.sport as any,
          tournamentId: tournament.id,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: round,
          matchNumber: m,
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }

  // Create loser's bracket for double elimination
  if (bracketFormat === BracketFormat.DOUBLE_ELIMINATION) {
    await createLosersBracketInternal(bracket.id, tournament.id, tournament.sport as any, playerCount);
  }
}

/**
 * Create loser's bracket for double elimination (internal helper)
 */
async function createLosersBracketInternal(
  bracketId: string,
  tournamentId: string,
  sport: string,
  playerCount: number
): Promise<void> {
  const totalRounds = Math.ceil(Math.log2(playerCount));
  const losersRounds = totalRounds + (totalRounds > 2 ? 1 : 0);

  let matchNumber = 1;
  for (let round = 1; round <= losersRounds; round++) {
    const matchesInRound = Math.max(1, Math.floor(playerCount / Math.pow(2, round + 1)));

    for (let m = 1; m <= matchesInRound; m++) {
      const match = await db.match.create({
        data: {
          sport: sport as any,
          tournamentId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId,
          matchId: match.id,
          roundNumber: round,
          matchNumber: matchNumber++,
          bracketSide: 'LOSERS',
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }

  // Create grand finals match
  const grandFinalsMatch = await db.match.create({
    data: {
      sport: sport as any,
      tournamentId,
    },
  });

  await db.bracketMatch.create({
    data: {
      bracketId,
      matchId: grandFinalsMatch.id,
      roundNumber: totalRounds + losersRounds,
      matchNumber: 1,
      bracketSide: 'WINNERS',
      status: BracketMatchStatus.PENDING,
    },
  });
}

/**
 * Generate snake order for bracket seeding
 */
function generateSnakeOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  if (size === 4) return [1, 4, 2, 3];

  const halfSize = size / 2;
  const topHalf = generateSnakeOrder(halfSize);
  const bottomHalf = generateSnakeOrder(halfSize);

  const result: number[] = [];
  for (let i = 0; i < halfSize; i++) {
    result.push(topHalf[i]);
    result.push(bottomHalf[i] + halfSize);
  }

  return result;
}

// ============================================
// 3. AUTO-START TOURNAMENT
// ============================================

/**
 * Process tournaments that need auto-start
 * Called by cron job every minute
 */
export async function processAutoStartTournament(): Promise<AutopilotResult[]> {
  const results: AutopilotResult[] = [];
  const now = new Date();

  // Find tournaments with:
  // - autopilotEnabled = true
  // - autoStartTournament = true
  // - status = BRACKET_GENERATED
  // - startDate <= now
  // - tournamentStartedAt is null
  const tournaments = await db.tournament.findMany({
    where: {
      autopilotEnabled: true,
      autoStartTournament: true,
      status: TournamentStatus.BRACKET_GENERATED,
      startDate: { lte: now },
      tournamentStartedAt: null,
    },
    include: {
      bracket: {
        include: {
          matches: {
            where: { status: BracketMatchStatus.PENDING },
            take: 1,
          },
        },
      },
    },
  });

  for (const tournament of tournaments) {
    try {
      const result = await autoStartTournament(tournament.id);
      results.push(result);
    } catch (error) {
      const result: AutopilotResult = {
        success: false,
        action: AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
        tournamentId: tournament.id,
        message: `Failed to auto-start tournament: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.push(result);
      await logAutopilotAction(
        tournament.id,
        AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
        'FAILED',
        undefined,
        result.error
      );
    }
  }

  return results;
}

/**
 * Auto-start a specific tournament
 */
export async function autoStartTournament(tournamentId: string): Promise<AutopilotResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: true,
    },
  });

  if (!tournament) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
      tournamentId,
      message: 'Tournament not found',
    };
  }

  if (tournament.status !== TournamentStatus.BRACKET_GENERATED) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
      tournamentId,
      message: `Tournament is not in BRACKET_GENERATED status`,
    };
  }

  if (!tournament.bracket) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
      tournamentId,
      message: 'No bracket found for tournament',
    };
  }

  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      tournamentStartedAt: new Date(),
    },
  });

  await logAutopilotAction(tournamentId, AUTOPILOT_ACTIONS.TOURNAMENT_STARTED, 'SUCCESS', {
    startedAt: new Date(),
  });

  return {
    success: true,
    action: AUTOPILOT_ACTIONS.TOURNAMENT_STARTED,
    tournamentId,
    message: 'Tournament started successfully',
    details: {
      startedAt: new Date(),
    },
  };
}

// ============================================
// 4. AUTO-ADVANCE WINNER
// ============================================

/**
 * Process matches where winners need to be advanced
 * Called by cron job every minute, or triggered by match completion
 */
export async function processAutoAdvanceWinner(): Promise<AutopilotResult[]> {
  const results: AutopilotResult[] = [];

  // Find tournaments with:
  // - autopilotEnabled = true
  // - autoAdvanceWinner = true
  // - status = IN_PROGRESS
  const tournaments = await db.tournament.findMany({
    where: {
      autopilotEnabled: true,
      autoAdvanceWinner: true,
      status: TournamentStatus.IN_PROGRESS,
    },
    include: {
      bracket: {
        include: {
          matches: {
            where: {
              status: BracketMatchStatus.COMPLETED,
              winnerId: { not: null },
            },
          },
        },
      },
    },
  });

  for (const tournament of tournaments) {
    if (!tournament.bracket) continue;

    // Check each completed match to see if winner needs advancing
    for (const bracketMatch of tournament.bracket.matches) {
      if (!bracketMatch.winnerId || !bracketMatch.nextMatchId) continue;

      // Check if next match already has this player
      const nextMatch = await db.bracketMatch.findUnique({
        where: { id: bracketMatch.nextMatchId },
      });

      if (!nextMatch || nextMatch.status !== BracketMatchStatus.PENDING) continue;

      // Check if player already in next match
      if (nextMatch.playerAId === bracketMatch.winnerId || nextMatch.playerBId === bracketMatch.winnerId) {
        continue;
      }

      try {
        const result = await advanceWinnerToNextMatch(bracketMatch.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to advance winner for match ${bracketMatch.id}:`, error);
      }
    }
  }

  return results;
}

/**
 * Advance winner to the next match in the bracket
 */
export async function advanceWinnerToNextMatch(bracketMatchId: string): Promise<AutopilotResult> {
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { id: bracketMatchId },
    include: {
      bracket: {
        include: { tournament: true },
      },
    },
  });

  if (!bracketMatch || !bracketMatch.winnerId || !bracketMatch.nextMatchId) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WINNER_ADVANCED,
      tournamentId: bracketMatch?.bracket?.tournamentId || '',
      message: 'Invalid bracket match or no winner/next match',
    };
  }

  const nextMatch = await db.bracketMatch.findUnique({
    where: { id: bracketMatch.nextMatchId },
  });

  if (!nextMatch) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WINNER_ADVANCED,
      tournamentId: bracketMatch.bracket.tournamentId,
      message: 'Next match not found',
    };
  }

  // Determine which slot to fill in the next match
  // For simplicity, we alternate A/B based on match number
  const isEvenMatchNumber = bracketMatch.matchNumber % 2 === 0;
  const playerField = isEvenMatchNumber ? 'playerBId' : 'playerAId';

  // Update next match with winner
  await db.bracketMatch.update({
    where: { id: nextMatch.id },
    data: {
      [playerField]: bracketMatch.winnerId,
      // If both players are now set, keep it PENDING. If only one set, it's waiting
      status: BracketMatchStatus.PENDING,
    },
  });

  // Also update the underlying match record
  const matchUpdateData: Record<string, unknown> = {
    [playerField === 'playerAId' ? 'playerAId' : 'playerBId']: bracketMatch.winnerId,
  };

  if (nextMatch.matchId) {
    await db.match.update({
      where: { id: nextMatch.matchId },
      data: matchUpdateData,
    });
  }

  // Check if this was a final match (no next match means finals)
  const isFinalMatch = !bracketMatch.nextMatchId;

  await logAutopilotAction(bracketMatch.bracket.tournamentId, AUTOPILOT_ACTIONS.WINNER_ADVANCED, 'SUCCESS', {
    bracketMatchId,
    winnerId: bracketMatch.winnerId,
    nextMatchId: bracketMatch.nextMatchId,
    isFinalMatch,
  });

  return {
    success: true,
    action: AUTOPILOT_ACTIONS.WINNER_ADVANCED,
    tournamentId: bracketMatch.bracket.tournamentId,
    message: `Winner advanced to next match`,
    details: {
      winnerId: bracketMatch.winnerId,
      nextMatchId: bracketMatch.nextMatchId,
      slot: playerField,
    },
  };
}

// ============================================
// 5. WAITLIST AUTO-PROMOTION
// ============================================

/**
 * Process waitlist promotions
 * Called by cron job every minute, or triggered by withdrawal
 */
export async function processWaitlistAutoPromotion(): Promise<AutopilotResult[]> {
  const results: AutopilotResult[] = [];

  // Find tournaments with:
  // - autopilotEnabled = true
  // - autoPromoteWaitlist = true
  // - status = REGISTRATION_OPEN
  // - has available slots and waiting people on waitlist
  const tournaments = await db.tournament.findMany({
    where: {
      autopilotEnabled: true,
      autoPromoteWaitlist: true,
      status: TournamentStatus.REGISTRATION_OPEN,
    },
    include: {
      _count: {
        select: {
          registrations: { where: { status: RegistrationStatus.CONFIRMED } },
          waitlist: { where: { status: WaitlistStatus.WAITING } },
        },
      },
    },
  });

  for (const tournament of tournaments) {
    const availableSlots = tournament.maxPlayers - tournament._count.registrations;
    const waitingCount = tournament._count.waitlist;

    if (availableSlots > 0 && waitingCount > 0) {
      try {
        // Promote up to available slots
        for (let i = 0; i < availableSlots && i < waitingCount; i++) {
          const result = await promoteNextFromWaitlist(tournament.id);
          results.push(result);

          if (!result.success) break; // Stop if promotion fails
        }
      } catch (error) {
        console.error(`Failed to promote from waitlist for tournament ${tournament.id}:`, error);
      }
    }
  }

  return results;
}

/**
 * Promote next person from waitlist
 */
export async function promoteNextFromWaitlist(tournamentId: string): Promise<AutopilotResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WAITLIST_PROMOTED,
      tournamentId,
      message: 'Tournament not found',
    };
  }

  // Check if there's space
  if (tournament._count.registrations >= tournament.maxPlayers) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WAITLIST_PROMOTED,
      tournamentId,
      message: 'Tournament is full',
    };
  }

  // Get next person on waitlist (FIFO)
  const nextInLine = await db.tournamentWaitlist.findFirst({
    where: {
      tournamentId,
      status: WaitlistStatus.WAITING,
    },
    orderBy: { position: 'asc' },
  });

  if (!nextInLine) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WAITLIST_PROMOTED,
      tournamentId,
      message: 'No one on waitlist',
    };
  }

  const nextUser = await db.user.findUnique({
    where: { id: nextInLine.userId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!nextUser) {
    return {
      success: false,
      action: AUTOPILOT_ACTIONS.WAITLIST_PROMOTED,
      tournamentId,
      message: 'Waitlist user not found',
    };
  }

  // Promote the user - give them 24 hours to confirm
  const promoted = await db.tournamentWaitlist.update({
    where: { id: nextInLine.id },
    data: {
      status: WaitlistStatus.PROMOTED,
      promotedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Create notification for promoted user
  await db.notification.create({
    data: {
      userId: nextInLine.userId,
      sport: tournament.sport,
      type: 'WAITLIST_PROMOTED',
      title: 'Waitlist Promotion!',
      message: `You've been promoted from the waitlist for ${tournament.name}. You have 24 hours to complete registration.`,
      link: `/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`,
    },
  });

  // Recalculate positions for remaining waitlist
  const remainingEntries = await db.tournamentWaitlist.findMany({
    where: {
      tournamentId,
      status: WaitlistStatus.WAITING,
      position: { gt: nextInLine.position },
    },
  });

  for (const entry of remainingEntries) {
    await db.tournamentWaitlist.update({
      where: { id: entry.id },
      data: { position: entry.position - 1 },
    });
  }

  await logAutopilotAction(tournamentId, AUTOPILOT_ACTIONS.WAITLIST_PROMOTED, 'SUCCESS', {
    userId: nextInLine.userId,
    userName: `${nextUser.firstName} ${nextUser.lastName}`,
    expiresAt: promoted.expiresAt,
  });

  return {
    success: true,
    action: AUTOPILOT_ACTIONS.WAITLIST_PROMOTED,
    tournamentId,
    message: `${nextUser.firstName} ${nextUser.lastName} promoted from waitlist`,
    details: {
      userId: nextInLine.userId,
      userName: `${nextUser.firstName} ${nextUser.lastName}`,
      expiresAt: promoted.expiresAt,
    },
  };
}

// ============================================
// 6. MATCH REMINDER ENGINE
// ============================================

/**
 * Process match reminders (2h, 30m, 5m before match)
 * Called by cron job every minute
 */
export async function processMatchReminders(): Promise<{
  processed: number;
  reminders: Array<{ matchId: string; userId: string; minutesBefore: number }>;
  errors: string[];
}> {
  const result = {
    processed: 0,
    reminders: [] as Array<{ matchId: string; userId: string; minutesBefore: number }>,
    errors: [] as string[],
  };

  const now = new Date();

  // Find matches with scheduled times within the next 2 hours
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const matches = await db.match.findMany({
    where: {
      scheduledTime: {
        gte: now,
        lte: twoHoursFromNow,
      },
      outcome: null, // Match not yet completed
    },
    include: {
      tournament: true,
      playerA: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      playerB: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });

  const notificationService = new NotificationService();

  for (const match of matches) {
    if (!match.scheduledTime) continue;

    const minutesUntilMatch = Math.floor(
      (match.scheduledTime.getTime() - now.getTime()) / (1000 * 60)
    );

    // Check each reminder interval
    for (const interval of MATCH_REMINDER_INTERVALS) {
      // Send reminder if within the window (e.g., 30m ± 1 minute tolerance)
      if (minutesUntilMatch <= interval.minutesBefore && minutesUntilMatch > interval.minutesBefore - 2) {
        // Check both players
        const players = [
          { user: match.playerA, isPlayerA: true },
          { user: match.playerB, isPlayerA: false },
        ].filter((p) => p.user);

        for (const { user } of players) {
          if (!user) continue;

          // Check if reminder already sent
          const existingReminder = await db.matchReminder.findUnique({
            where: {
              matchId_userId_minutesBefore: {
                matchId: match.id,
                userId: user.id,
                minutesBefore: interval.minutesBefore,
              },
            },
          });

          if (existingReminder) continue;

          try {
            // Get opponent info
            const opponent = match.playerAId === user.id ? match.playerB : match.playerA;

            // Send notification
            if (match.tournament) {
              await notificationService.sendMatchReminder(
                user,
                {
                  matchId: match.id,
                  tournamentName: match.tournament.name,
                  opponentName: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'TBD',
                  scheduledTime: match.scheduledTime!,
                  court: null, // Could be enhanced with court info
                  minutesBefore: interval.minutesBefore,
                  matchUrl: buildAppUrl(`/${match.tournament.sport.toLowerCase()}/tournaments/${match.tournament.id}/matches/${match.id}`),
                }
              );
            }

            // Mark as sent
            await db.matchReminder.create({
              data: {
                matchId: match.id,
                userId: user.id,
                minutesBefore: interval.minutesBefore,
              },
            });

            result.reminders.push({
              matchId: match.id,
              userId: user.id,
              minutesBefore: interval.minutesBefore,
            });
            result.processed++;
          } catch (error) {
            result.errors.push(
              `Failed to send ${interval.label} for match ${match.id} to user ${user.id}: ${error}`
            );
          }
        }
      }
    }
  }

  return result;
}

// ============================================
// MASTER PROCESSOR
// ============================================

/**
 * Run all autopilot processors
 * Called by cron job
 */
export async function runAutopilotProcessors(): Promise<{
  registrationAutoClose: AutopilotResult[];
  autoBracketGeneration: AutopilotResult[];
  autoStartTournament: AutopilotResult[];
  autoAdvanceWinner: AutopilotResult[];
  waitlistAutoPromotion: AutopilotResult[];
  matchReminders: { processed: number; errors: string[] };
}> {
  const [registrationAutoClose, autoBracketGeneration, autoStartTournament, autoAdvanceWinner, waitlistAutoPromotion, matchReminders] =
    await Promise.all([
      processRegistrationAutoClose(),
      processAutoBracketGeneration(),
      processAutoStartTournament(),
      processAutoAdvanceWinner(),
      processWaitlistAutoPromotion(),
      processMatchReminders(),
    ]);

  return {
    registrationAutoClose,
    autoBracketGeneration,
    autoStartTournament,
    autoAdvanceWinner,
    waitlistAutoPromotion,
    matchReminders,
  };
}
