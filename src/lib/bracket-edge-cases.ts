/**
 * Bracket Edge Case Handler for VALORHIVE
 * 
 * Handles:
 * - Mid-tournament player withdrawal
 * - Substitute player insertion
 * - Disqualification handling
 * - Bracket re-seeding
 * - Match re-scheduling
 * - Double elimination edge cases (grand finals reset, bye distribution)
 * - Bye advancement
 */

import { db } from '@/lib/db';
import {
  BracketMatchStatus,
  MatchOutcome,
  TournamentStatus,
  BracketSide,
  BracketFormat,
  AuditAction,
  Role,
  NotificationType,
  SportType,
} from '@prisma/client';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface WithdrawalResult {
  success: boolean;
  message: string;
  affectedMatches: string[];
  advancedPlayers: string[];
}

interface SubstitutionResult {
  success: boolean;
  message: string;
  affectedMatches: string[];
  substitutionId: string;
}

interface DisqualificationResult {
  success: boolean;
  message: string;
  affectedMatches: string[];
  reseeded: boolean;
}

interface ReseedResult {
  success: boolean;
  message: string;
  previousSeeds: Record<string, number>;
  newSeeds: Record<string, number>;
  notifiedPlayers: number;
}

interface RescheduleResult {
  success: boolean;
  message: string;
  matchId: string;
  oldTime: Date | null;
  newTime: Date;
  oldCourt: string | null;
  newCourt: string;
}

interface GrandFinalsResetResult {
  success: boolean;
  message: string;
  bracketMatchId: string;
  resetMatchCreated: boolean;
}

interface ByeDistributionResult {
  success: boolean;
  message: string;
  byeMatches: string[];
  advancedPlayers: string[];
}

// ============================================
// 1. PLAYER WITHDRAWAL
// ============================================

/**
 * Handle player withdrawal from tournament
 * - Marks all pending matches as BYE/WALKOVER
 * - If winner's bracket: advances opponent
 * - If loser's bracket (double elim): handles based on round
 */
export async function handleWithdrawal(
  tournamentId: string,
  playerId: string,
  reason: string,
  actorId?: string
): Promise<WithdrawalResult> {
  const affectedMatches: string[] = [];
  const advancedPlayers: string[] = [];

  // Get tournament and bracket with all relevant data
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: {
            where: {
              OR: [
                { playerAId: playerId },
                { playerBId: playerId },
              ],
              status: { not: BracketMatchStatus.COMPLETED },
            },
            orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
          },
        },
      },
    },
  });

  if (!tournament) {
    return {
      success: false,
      message: 'Tournament not found',
      affectedMatches: [],
      advancedPlayers: [],
    };
  }

  if (!tournament.bracket) {
    return {
      success: false,
      message: 'No bracket found for tournament',
      affectedMatches: [],
      advancedPlayers: [],
    };
  }

  const bracket = tournament.bracket;
  const pendingMatches = bracket.matches.filter(
    (m) => m.status !== BracketMatchStatus.COMPLETED
  );

  // Process each pending match
  for (const match of pendingMatches) {
    const isPlayerA = match.playerAId === playerId;
    const opponentId = isPlayerA ? match.playerBId : match.playerAId;

    if (!opponentId) {
      // Player had a bye match - just remove them
      await db.bracketMatch.update({
        where: { id: match.id },
        data: {
          playerAId: isPlayerA ? null : match.playerAId,
          playerBId: isPlayerA ? match.playerBId : null,
          status: BracketMatchStatus.BYE,
        },
      });
    } else {
      // Opponent wins by walkover
      await db.bracketMatch.update({
        where: { id: match.id },
        data: {
          status: BracketMatchStatus.COMPLETED,
          winnerId: opponentId,
        },
      });

      // Create match result record
      const matchRecord = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId,
          playerAId: match.playerAId!,
          playerBId: match.playerBId!,
          scoreA: isPlayerA ? 0 : 21,
          scoreB: isPlayerA ? 21 : 0,
          winnerId: opponentId,
          outcome: MatchOutcome.WALKOVER,
          outcomeReason: `Withdrawal: ${reason}`,
          tournamentScope: tournament.scope,
        },
      });

      // Link bracket match to match record
      await db.bracketMatch.update({
        where: { id: match.id },
        data: { matchId: matchRecord.id },
      });

      // Advance opponent to next round
      const advanced = await advancePlayerToNextMatch(
        bracket.id,
        match,
        opponentId!
      );
      if (advanced) {
        advancedPlayers.push(opponentId);
      }
    }

    affectedMatches.push(match.id);
  }

  // Update tournament registration
  await db.tournamentRegistration.updateMany({
    where: { tournamentId, userId: playerId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  // Create notification for affected opponents
  for (const opponentId of advancedPlayers) {
    await createNotification(
      opponentId,
      tournament.sport,
      NotificationType.TOURNAMENT_CANCELLED,
      'Opponent Withdrawn',
      `Your opponent has withdrawn. You advance to the next round.`,
      `/tournaments/${tournamentId}/bracket`
    );
  }

  // Log audit
  if (actorId) {
    await createAuditLog({
      sport: tournament.sport,
      action: AuditAction.ADMIN_OVERRIDE,
      actorId,
      actorRole: Role.ADMIN,
      targetType: 'player_withdrawal',
      targetId: playerId,
      tournamentId,
      reason: `Withdrawal: ${reason}`,
      metadata: JSON.stringify({
        affectedMatches,
        advancedPlayers,
      }),
    });
  }

  return {
    success: true,
    message: `Player withdrawn successfully. ${pendingMatches.length} matches affected.`,
    affectedMatches,
    advancedPlayers,
  };
}

// ============================================
// 2. SUBSTITUTE PLAYER
// ============================================

/**
 * Add substitute player to replace original player
 * - Replaces player in all pending matches
 * - Updates bracket display
 * - Logs substitution
 */
export async function addSubstitute(
  tournamentId: string,
  originalPlayerId: string,
  substitutePlayerId: string,
  actorId?: string
): Promise<SubstitutionResult> {
  // Verify substitute is eligible
  const substitute = await db.user.findUnique({
    where: { id: substitutePlayerId },
    include: {
      tournamentRegs: {
        where: { tournamentId },
      },
    },
  });

  if (!substitute) {
    return {
      success: false,
      message: 'Substitute player not found',
      affectedMatches: [],
      substitutionId: '',
    };
  }

  if (substitute.tournamentRegs.length > 0) {
    return {
      success: false,
      message: 'Substitute is already registered for this tournament',
      affectedMatches: [],
      substitutionId: '',
    };
  }

  // Get tournament and bracket
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: {
            where: {
              OR: [
                { playerAId: originalPlayerId },
                { playerBId: originalPlayerId },
              ],
              status: { not: BracketMatchStatus.COMPLETED },
            },
          },
        },
      },
    },
  });

  if (!tournament || !tournament.bracket) {
    return {
      success: false,
      message: 'Tournament or bracket not found',
      affectedMatches: [],
      substitutionId: '',
    };
  }

  const affectedMatches: string[] = [];
  const bracket = tournament.bracket;

  // Replace player in all pending matches
  for (const match of bracket.matches) {
    const updateData: any = {};

    if (match.playerAId === originalPlayerId) {
      updateData.playerAId = substitutePlayerId;
    }
    if (match.playerBId === originalPlayerId) {
      updateData.playerBId = substitutePlayerId;
    }

    if (Object.keys(updateData).length > 0) {
      await db.bracketMatch.update({
        where: { id: match.id },
        data: updateData,
      });
      affectedMatches.push(match.id);
    }
  }

  // Cancel original player's registration
  await db.tournamentRegistration.updateMany({
    where: { tournamentId, userId: originalPlayerId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  // Register substitute
  const registration = await db.tournamentRegistration.create({
    data: {
      tournamentId,
      userId: substitutePlayerId,
      status: 'CONFIRMED',
      amount: 0, // No fee for substitutes
    },
  });

  // Create substitution log
  const substitutionLog = await db.auditLog.create({
    data: {
      sport: tournament.sport,
      action: AuditAction.ADMIN_OVERRIDE,
      actorId: actorId || 'system',
      actorRole: Role.ADMIN,
      targetType: 'player_substitution',
      targetId: originalPlayerId,
      tournamentId,
      reason: `Substituted with ${substitutePlayerId}`,
      metadata: JSON.stringify({
        originalPlayerId,
        substitutePlayerId,
        affectedMatches,
      }),
    },
  });

  // Notify substitute player
  await createNotification(
    substitutePlayerId,
    tournament.sport,
    NotificationType.TOURNAMENT_REGISTERED,
    'Added as Substitute',
    `You have been added as a substitute for ${tournament.name}`,
    `/tournaments/${tournamentId}/bracket`
  );

  return {
    success: true,
    message: `Substitute added successfully. ${affectedMatches.length} matches updated.`,
    affectedMatches,
    substitutionId: substitutionLog.id,
  };
}

// ============================================
// 3. DISQUALIFICATION
// ============================================

/**
 * Handle player disqualification
 * - Marks all matches as FORFEIT
 * - Re-seeds remaining players if before tournament starts
 * - Notifies affected parties
 */
export async function handleDisqualification(
  tournamentId: string,
  playerId: string,
  reason: string,
  evidence: string | null,
  actorId: string
): Promise<DisqualificationResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
      },
    },
  });

  if (!tournament) {
    return {
      success: false,
      message: 'Tournament not found',
      affectedMatches: [],
      reseeded: false,
    };
  }

  // Check if tournament hasn't started
  const canReseed =
    tournament.status === TournamentStatus.REGISTRATION_OPEN ||
    tournament.status === TournamentStatus.REGISTRATION_CLOSED ||
    tournament.status === TournamentStatus.DRAFT;

  let affectedMatches: string[] = [];
  let reseeded = false;

  if (tournament.status === TournamentStatus.IN_PROGRESS ||
      tournament.status === TournamentStatus.BRACKET_GENERATED) {
    // Tournament started - use withdrawal logic with FORFEIT outcome
    const bracket = await db.bracket.findUnique({
      where: { tournamentId },
      include: {
        matches: {
          where: {
            OR: [{ playerAId: playerId }, { playerBId: playerId }],
            status: { not: BracketMatchStatus.COMPLETED },
          },
        },
      },
    });

    if (bracket) {
      for (const match of bracket.matches) {
        const isPlayerA = match.playerAId === playerId;
        const opponentId = isPlayerA ? match.playerBId : match.playerAId;

        if (opponentId) {
          // Opponent wins by forfeit
          await db.bracketMatch.update({
            where: { id: match.id },
            data: {
              status: BracketMatchStatus.COMPLETED,
              winnerId: opponentId,
            },
          });

          // Create match result with FORFEIT outcome
          const matchRecord = await db.match.create({
            data: {
              sport: tournament.sport,
              tournamentId,
              playerAId: match.playerAId!,
              playerBId: match.playerBId!,
              scoreA: isPlayerA ? 0 : 21,
              scoreB: isPlayerA ? 21 : 0,
              winnerId: opponentId,
              outcome: MatchOutcome.FORFEIT,
              outcomeReason: `Disqualified: ${reason}`,
              tournamentScope: tournament.scope,
            },
          });

          await db.bracketMatch.update({
            where: { id: match.id },
            data: { matchId: matchRecord.id },
          });

          // Advance opponent
          await advancePlayerToNextMatch(bracket.id, match, opponentId);

          // Notify opponent
          await createNotification(
            opponentId,
            tournament.sport,
            NotificationType.MATCH_RESULT,
            'Opponent Disqualified',
            `Your opponent was disqualified. You advance to the next round.`,
            `/tournaments/${tournamentId}/bracket`
          );
        }

        affectedMatches.push(match.id);
      }
    }
  }

  // Update registration status
  await db.tournamentRegistration.updateMany({
    where: { tournamentId, userId: playerId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  // Re-seed if before tournament starts
  if (canReseed && tournament.registrations.length > 2) {
    const reseedResult = await reseedBracket(tournamentId, actorId);
    reseeded = reseedResult.success;
  }

  // Create detailed audit log
  await db.auditLog.create({
    data: {
      sport: tournament.sport,
      action: AuditAction.USER_BANNED,
      actorId,
      actorRole: Role.ADMIN,
      targetType: 'player_disqualification',
      targetId: playerId,
      tournamentId,
      reason,
      metadata: JSON.stringify({
        evidence,
        affectedMatches,
        reseeded,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // Notify disqualified player
  await createNotification(
    playerId,
    tournament.sport,
    NotificationType.TOURNAMENT_CANCELLED,
    'Tournament Disqualification',
    `You have been disqualified from ${tournament.name}. Reason: ${reason}`,
    `/tournaments/${tournamentId}`
  );

  return {
    success: true,
    message: `Player disqualified. ${affectedMatches.length} matches affected.${reseeded ? ' Bracket reseeded.' : ''}`,
    affectedMatches,
    reseeded,
  };
}

// ============================================
// 4. RE-SEEDING
// ============================================

/**
 * Re-seed bracket based on current ELO ratings
 * - Only allowed before tournament starts
 * - Notifies all registered players
 */
export async function reseedBracket(
  tournamentId: string,
  actorId: string
): Promise<ReseedResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: {
              id: true,
              hiddenElo: true,
              firstName: true,
              lastName: true,
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
      message: 'Tournament not found',
      previousSeeds: {},
      newSeeds: {},
      notifiedPlayers: 0,
    };
  }

  // Check if re-seeding is allowed
  const allowedStatuses: TournamentStatus[] = [
    TournamentStatus.REGISTRATION_OPEN,
    TournamentStatus.REGISTRATION_CLOSED,
    TournamentStatus.DRAFT,
  ];

  if (!allowedStatuses.includes(tournament.status)) {
    return {
      success: false,
      message: `Cannot re-seed: tournament is ${tournament.status}`,
      previousSeeds: {},
      newSeeds: {},
      notifiedPlayers: 0,
    };
  }

  // Check if bracket exists (for previous seeds)
  if (!tournament.bracket) {
    return {
      success: false,
      message: 'No bracket exists to re-seed',
      previousSeeds: {},
      newSeeds: {},
      notifiedPlayers: 0,
    };
  }

  // Get current seeds
  const previousSeeds: Record<string, number> = {};
  const bracketMatches = await db.bracketMatch.findMany({
    where: { bracketId: tournament.bracket.id, roundNumber: 1 },
    orderBy: { matchNumber: 'asc' },
  });

  let seedNum = 1;
  for (const match of bracketMatches) {
    if (match.playerAId) previousSeeds[match.playerAId] = seedNum++;
    if (match.playerBId) previousSeeds[match.playerBId] = seedNum++;
  }

  // Sort players by ELO (highest first)
  const sortedPlayers = [...tournament.registrations].sort((a, b) => {
    const eloA = a.user.hiddenElo || 1500;
    const eloB = b.user.hiddenElo || 1500;
    return eloB - eloA;
  });

  // Calculate new seeds
  const newSeeds: Record<string, number> = {};
  sortedPlayers.forEach((reg, index) => {
    newSeeds[reg.userId] = index + 1;
  });

  // Check if seeds actually changed
  const seedsChanged = Object.keys(previousSeeds).some(
    (playerId) => previousSeeds[playerId] !== newSeeds[playerId]
  );

  if (!seedsChanged) {
    return {
      success: true,
      message: 'No changes needed - seeds already optimal',
      previousSeeds,
      newSeeds,
      notifiedPlayers: 0,
    };
  }

  // Delete existing bracket
  await db.bracket.delete({
    where: { tournamentId },
  });

  // Regenerate bracket with new seeds
  await regenerateBracketInternal(tournamentId, sortedPlayers);

  // Log audit
  await db.auditLog.create({
    data: {
      sport: tournament.sport,
      action: AuditAction.BRACKET_RESET,
      actorId,
      actorRole: Role.ADMIN,
      targetType: 'bracket_reseed',
      targetId: tournamentId,
      tournamentId,
      metadata: JSON.stringify({
        previousSeeds,
        newSeeds,
        playerCount: sortedPlayers.length,
      }),
    },
  });

  // Notify all registered players
  let notifiedPlayers = 0;
  for (const reg of tournament.registrations) {
    await createNotification(
      reg.userId,
      tournament.sport,
      NotificationType.TOURNAMENT_REGISTERED,
      'Bracket Re-seeded',
      `The bracket for ${tournament.name} has been re-seeded based on current ratings.`,
      `/tournaments/${tournamentId}/bracket`
    );
    notifiedPlayers++;
  }

  return {
    success: true,
    message: `Bracket re-seeded successfully. ${notifiedPlayers} players notified.`,
    previousSeeds,
    newSeeds,
    notifiedPlayers,
  };
}

// ============================================
// 5. MATCH RE-SCHEDULING
// ============================================

/**
 * Re-schedule a bracket match
 * - Updates bracket match times
 * - Notifies both players
 */
export async function rescheduleMatch(
  matchId: string,
  newTime: Date,
  newCourt: string,
  actorId?: string
): Promise<RescheduleResult> {
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { id: matchId },
    include: {
      bracket: {
        include: {
          tournament: true,
        },
      },
    },
  });

  if (!bracketMatch || !bracketMatch.bracket) {
    return {
      success: false,
      message: 'Match not found',
      matchId,
      oldTime: null,
      newTime,
      oldCourt: null,
      newCourt,
    };
  }

  const oldTime = bracketMatch.scheduledAt;
  const oldCourt = bracketMatch.courtAssignment;
  const tournament = bracketMatch.bracket.tournament;

  // Update match schedule
  await db.bracketMatch.update({
    where: { id: matchId },
    data: {
      scheduledAt: newTime,
      courtAssignment: newCourt,
    },
  });

  // Create audit log
  if (actorId) {
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId,
        actorRole: Role.ADMIN,
        targetType: 'match_reschedule',
        targetId: matchId,
        tournamentId: tournament.id,
        metadata: JSON.stringify({
          oldTime: oldTime?.toISOString(),
          newTime: newTime.toISOString(),
          oldCourt,
          newCourt,
        }),
      },
    });
  }

  // Notify both players
  const players = [bracketMatch.playerAId, bracketMatch.playerBId].filter(Boolean);
  for (const playerId of players) {
    await createNotification(
      playerId!,
      tournament.sport,
      NotificationType.MATCH_RESULT,
      'Match Rescheduled',
      `Your match has been rescheduled to ${newTime.toLocaleString()} on Court ${newCourt}`,
      `/tournaments/${tournament.id}/bracket`
    );
  }

  return {
    success: true,
    message: 'Match rescheduled successfully',
    matchId,
    oldTime,
    newTime,
    oldCourt,
    newCourt,
  };
}

// ============================================
// 6. DOUBLE ELIMINATION EDGE CASES
// ============================================

/**
 * Handle grand finals reset for double elimination
 * When loser's bracket winner beats winner's bracket winner
 * A reset match is needed
 */
export async function handleGrandFinalsReset(
  tournamentId: string,
  matchId: string,
  actorId: string
): Promise<GrandFinalsResetResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: {
            include: {
              match: true,
            },
          },
        },
      },
    },
  });

  if (!tournament || !tournament.bracket) {
    return {
      success: false,
      message: 'Tournament or bracket not found',
      bracketMatchId: matchId,
      resetMatchCreated: false,
    };
  }

  const bracket = tournament.bracket;

  // Verify this is double elimination
  if (bracket.format !== BracketFormat.DOUBLE_ELIMINATION) {
    return {
      success: false,
      message: 'Grand finals reset only applies to double elimination',
      bracketMatchId: matchId,
      resetMatchCreated: false,
    };
  }

  // Find the finals match
  const finalsMatch = bracket.matches.find(
    (m) =>
      m.roundNumber === bracket.totalRounds &&
      m.bracketSide === BracketSide.WINNERS
  );

  if (!finalsMatch) {
    return {
      success: false,
      message: 'Finals match not found',
      bracketMatchId: matchId,
      resetMatchCreated: false,
    };
  }

  // Get the winner from loser's bracket finals
  const losersFinalsMatch = bracket.matches.find(
    (m) =>
      m.bracketSide === BracketSide.LOSERS &&
      m.status === BracketMatchStatus.COMPLETED
  );

  if (!losersFinalsMatch || !losersFinalsMatch.winnerId) {
    return {
      success: false,
      message: 'Loser bracket winner not determined',
      bracketMatchId: matchId,
      resetMatchCreated: false,
    };
  }

  // Check if winner's bracket representative lost
  const winnerBracketRep = finalsMatch.playerAId;
  const loserBracketWinner = losersFinalsMatch.winnerId;

  if (finalsMatch.winnerId !== winnerBracketRep) {
    // Winner's bracket rep lost - create reset match
    const resetMatch = await db.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        roundNumber: bracket.totalRounds + 1,
        matchNumber: 1,
        playerAId: finalsMatch.winnerId,
        playerBId: winnerBracketRep,
        status: BracketMatchStatus.PENDING,
        bracketSide: BracketSide.WINNERS,
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: AuditAction.BRACKET_GENERATED,
        actorId,
        actorRole: Role.ADMIN,
        targetType: 'grand_finals_reset',
        targetId: resetMatch.id,
        tournamentId,
        metadata: JSON.stringify({
          originalFinalsMatch: finalsMatch.id,
          resetMatch: resetMatch.id,
          reason: 'Winner bracket representative lost first finals match',
        }),
      },
    });

    // Update tournament total rounds
    await db.bracket.update({
      where: { id: bracket.id },
      data: { totalRounds: bracket.totalRounds + 1 },
    });

    return {
      success: true,
      message: 'Grand finals reset match created',
      bracketMatchId: resetMatch.id,
      resetMatchCreated: true,
    };
  }

  return {
    success: true,
    message: 'No reset needed - winner bracket rep won',
    bracketMatchId: finalsMatch.id,
    resetMatchCreated: false,
  };
}

/**
 * Distribute byes in odd-player brackets
 * Ensures byes are distributed to higher seeds
 */
export async function distributeByesInOddPlayerBracket(
  tournamentId: string
): Promise<ByeDistributionResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: { id: true, hiddenElo: true },
          },
        },
      },
      bracket: true,
    },
  });

  if (!tournament || !tournament.bracket) {
    return {
      success: false,
      message: 'Tournament or bracket not found',
      byeMatches: [],
      advancedPlayers: [],
    };
  }

  const playerCount = tournament.registrations.length;

  // Calculate next power of 2
  let bracketSize = 2;
  while (bracketSize < playerCount) {
    bracketSize *= 2;
  }

  const byeCount = bracketSize - playerCount;

  if (byeCount === 0) {
    return {
      success: true,
      message: 'No byes needed - perfect bracket size',
      byeMatches: [],
      advancedPlayers: [],
    };
  }

  // Sort players by ELO (highest first) for seeding
  const sortedPlayers = [...tournament.registrations].sort((a, b) => {
    const eloA = a.user.hiddenElo || 1500;
    const eloB = b.user.hiddenElo || 1500;
    return eloB - eloA;
  });

  const byeMatches: string[] = [];
  const advancedPlayers: string[] = [];

  // Get first round matches
  const firstRoundMatches = await db.bracketMatch.findMany({
    where: {
      bracketId: tournament.bracket.id,
      roundNumber: 1,
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Assign byes to top seeds (they get "free" wins)
  for (let i = 0; i < byeCount; i++) {
    const topSeed = sortedPlayers[i];
    const matchIndex = i; // Top seeds get matches at the start

    if (firstRoundMatches[matchIndex]) {
      const match = firstRoundMatches[matchIndex];

      // Set the top seed as player A and mark as bye
      await db.bracketMatch.update({
        where: { id: match.id },
        data: {
          playerAId: topSeed.userId,
          playerBId: null,
          status: BracketMatchStatus.BYE,
          winnerId: topSeed.userId,
        },
      });

      byeMatches.push(match.id);
      advancedPlayers.push(topSeed.userId);

      // Advance to next round
      await advancePlayerToNextMatch(tournament.bracket.id, match, topSeed.userId);
    }
  }

  // Fill remaining matches with other players
  let playerIndex = byeCount;
  for (let i = byeCount; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];
    const playerA = sortedPlayers[playerIndex];
    const playerB = sortedPlayers[playerIndex + 1];

    await db.bracketMatch.update({
      where: { id: match.id },
      data: {
        playerAId: playerA?.userId || null,
        playerBId: playerB?.userId || null,
      },
    });

    playerIndex += 2;
  }

  return {
    success: true,
    message: `Distributed ${byeCount} byes to top seeds`,
    byeMatches,
    advancedPlayers,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Advance player to next match in bracket
 */
async function advancePlayerToNextMatch(
  bracketId: string,
  currentMatch: {
    id: string;
    roundNumber: number;
    matchNumber: number;
    bracketSide?: BracketSide | null;
    nextMatchId?: string | null;
    loserNextMatchId?: string | null;
  },
  winnerId: string
): Promise<boolean> {
  // If there's an explicit next match link
  if (currentMatch.nextMatchId) {
    const nextMatch = await db.bracketMatch.findUnique({
      where: { id: currentMatch.nextMatchId },
    });

    if (nextMatch) {
      // Determine which player position to fill
      const isUpperMatch = currentMatch.matchNumber % 2 === 1;
      await db.bracketMatch.update({
        where: { id: nextMatch.id },
        data: isUpperMatch ? { playerAId: winnerId } : { playerBId: winnerId },
      });
      return true;
    }
  }

  // Calculate next match position
  const nextMatchNumber = Math.ceil(currentMatch.matchNumber / 2);
  const nextRoundNumber = currentMatch.roundNumber + 1;

  const nextMatch = await db.bracketMatch.findFirst({
    where: {
      bracketId,
      roundNumber: nextRoundNumber,
      matchNumber: nextMatchNumber,
      bracketSide: currentMatch.bracketSide,
    },
  });

  if (!nextMatch) {
    // This was the final match or next match doesn't exist yet
    return false;
  }

  // Determine if winner goes to playerA or playerB position
  const isUpperMatch = currentMatch.matchNumber % 2 === 1;

  await db.bracketMatch.update({
    where: { id: nextMatch.id },
    data: isUpperMatch ? { playerAId: winnerId } : { playerBId: winnerId },
  });

  return true;
}

/**
 * Internal bracket regeneration
 */
async function regenerateBracketInternal(
  tournamentId: string,
  sortedPlayers: any[]
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) return;

  const playerCount = sortedPlayers.length;
  let bracketSize = 2;
  while (bracketSize < playerCount) {
    bracketSize *= 2;
  }

  const byeCount = bracketSize - playerCount;
  const totalRounds = Math.log2(bracketSize);

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId,
      format: tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION,
      totalRounds,
      seedingMethod: 'ELO',
      generatedById: 'system',
    },
  });

  // Build bracket with byes at the start for top seeds
  const bracketPlayers: (typeof sortedPlayers[0] | null)[] = [];

  // Add top seeds who get byes
  for (let i = 0; i < byeCount; i++) {
    bracketPlayers.push(sortedPlayers[i]);
    bracketPlayers.push(null); // Bye
  }

  // Add remaining players paired up
  for (let i = byeCount; i < sortedPlayers.length; i += 2) {
    bracketPlayers.push(sortedPlayers[i]);
    bracketPlayers.push(sortedPlayers[i + 1] || null);
  }

  // Create first round matches
  const matchesPerRound = bracketSize / 2;
  const firstRoundMatches = [];

  for (let i = 0; i < matchesPerRound; i++) {
    const playerA = bracketPlayers[i * 2];
    const playerB = bracketPlayers[i * 2 + 1];

    const matchData: {
      bracketId: string;
      roundNumber: number;
      matchNumber: number;
      playerAId: string | null;
      playerBId: string | null;
      status: BracketMatchStatus;
      winnerId: string | null;
    } = {
      bracketId: bracket.id,
      roundNumber: 1,
      matchNumber: i + 1,
      playerAId: playerA?.userId || null,
      playerBId: playerB?.userId || null,
      status: BracketMatchStatus.PENDING,
      winnerId: null,
    };

    // Handle byes
    if (!playerA && playerB) {
      matchData.status = BracketMatchStatus.BYE;
      matchData.winnerId = playerB.userId;
    } else if (playerA && !playerB) {
      matchData.status = BracketMatchStatus.BYE;
      matchData.winnerId = playerA.userId;
    }

    firstRoundMatches.push(matchData);
  }

  await db.bracketMatch.createMany({
    data: firstRoundMatches,
  });

  // Create subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const roundMatches = Math.pow(2, totalRounds - round);
    for (let m = 0; m < roundMatches; m++) {
      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          roundNumber: round,
          matchNumber: m + 1,
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }
}

/**
 * Create notification helper
 */
async function createNotification(
  userId: string,
  sport: SportType,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  await db.notification.create({
    data: {
      userId,
      sport,
      type,
      title,
      message,
      link,
    },
  });
}

/**
 * Create audit log helper
 */
async function createAuditLog(data: {
  sport: SportType;
  action: AuditAction;
  actorId: string;
  actorRole: Role;
  targetType: string;
  targetId: string;
  tournamentId: string;
  reason?: string;
  metadata?: string;
}): Promise<void> {
  await db.auditLog.create({ data });
}

/**
 * Get bracket health status
 */
export async function getBracketHealthStatus(tournamentId: string): Promise<{
  healthy: boolean;
  issues: string[];
  pendingMatches: number;
  completedMatches: number;
  playersWithoutOpponent: number;
  byesProcessed: number;
  byesPending: number;
}> {
  const bracket = await db.bracket.findUnique({
    where: { tournamentId },
    include: {
      matches: true,
    },
  });

  if (!bracket) {
    return {
      healthy: false,
      issues: ['Bracket not found'],
      pendingMatches: 0,
      completedMatches: 0,
      playersWithoutOpponent: 0,
      byesProcessed: 0,
      byesPending: 0,
    };
  }

  const issues: string[] = [];
  let pendingMatches = 0;
  let completedMatches = 0;
  let playersWithoutOpponent = 0;
  let byesProcessed = 0;
  let byesPending = 0;

  for (const match of bracket.matches) {
    if (match.status === BracketMatchStatus.COMPLETED) {
      completedMatches++;
    } else if (match.status === BracketMatchStatus.BYE) {
      byesProcessed++;
    } else {
      pendingMatches++;
    }

    // Check for matches with only one player
    if ((match.playerAId && !match.playerBId) || (!match.playerAId && match.playerBId)) {
      playersWithoutOpponent++;

      if (match.status === BracketMatchStatus.PENDING) {
        byesPending++;
        issues.push(
          `Match ${match.matchNumber} in round ${match.roundNumber} has unprocessed bye`
        );
      }
    }

    // Check for matches with no players
    if (!match.playerAId && !match.playerBId && match.status !== BracketMatchStatus.COMPLETED) {
      issues.push(
        `Match ${match.matchNumber} in round ${match.roundNumber} has no players assigned`
      );
    }
  }

  return {
    healthy: issues.length === 0 && byesPending === 0,
    issues,
    pendingMatches,
    completedMatches,
    playersWithoutOpponent,
    byesProcessed,
    byesPending,
  };
}

/**
 * Handle bye advancement
 */
export async function handleByeAdvancement(
  bracketId: string,
  matchId: string
): Promise<boolean> {
  const match = await db.bracketMatch.findUnique({
    where: { id: matchId },
  });

  if (!match || match.status === BracketMatchStatus.COMPLETED) {
    return false;
  }

  // Check if only one player exists
  if (match.playerAId && !match.playerBId) {
    // Player A advances automatically
    await db.bracketMatch.update({
      where: { id: matchId },
      data: {
        status: BracketMatchStatus.BYE,
        winnerId: match.playerAId,
      },
    });

    await advancePlayerToNextMatch(bracketId, match, match.playerAId);
    return true;
  } else if (!match.playerAId && match.playerBId) {
    // Player B advances automatically
    await db.bracketMatch.update({
      where: { id: matchId },
      data: {
        status: BracketMatchStatus.BYE,
        winnerId: match.playerBId,
      },
    });

    await advancePlayerToNextMatch(bracketId, match, match.playerBId!);
    return true;
  }

  return false;
}

/**
 * Process all pending byes in a bracket
 */
export async function processAllPendingByes(bracketId: string): Promise<{
  processed: number;
  errors: string[];
}> {
  const matches = await db.bracketMatch.findMany({
    where: {
      bracketId,
      status: BracketMatchStatus.PENDING,
    },
  });

  let processed = 0;
  const errors: string[] = [];

  for (const match of matches) {
    try {
      const result = await handleByeAdvancement(bracketId, match.id);
      if (result) {
        processed++;
      }
    } catch (error) {
      errors.push(`Failed to process bye for match ${match.id}: ${error}`);
    }
  }

  return { processed, errors };
}
