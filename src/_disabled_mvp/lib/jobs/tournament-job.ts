/**
 * Tournament Job Handler for VALORHIVE
 * 
 * Handles tournament automation jobs:
 * - Close registration
 * - Generate brackets
 * - Start tournaments
 * - Advance winners
 * - Promote from waitlist
 * - Complete tournaments
 * - Finalize results
 * - Process prizes
 * 
 * @version v3.83.0
 */

import { Job } from 'bullmq';
import { db } from '../db';
import { log } from '../logger';
import type { TournamentJobData, JobResult } from '../job-queue';

// ============================================
// Types and Interfaces
// ============================================

interface BracketGenerationResult {
  bracketId: string;
  totalMatches: number;
  totalRounds: number;
}

interface MatchmakingResult {
  matchesCreated: number;
  byesAssigned: number;
}

// ============================================
// Tournament Job Handlers
// ============================================

/**
 * Handle tournament job
 */
export async function handleTournamentJob(
  job: Job<TournamentJobData>
): Promise<JobResult> {
  const startTime = Date.now();
  const { tournamentId, action, sport, data } = job.data;
  
  log.info(`[TournamentJob] Processing tournament job ${job.id}`, {
    tournamentId,
    action,
  });
  
  try {
    let result: Record<string, unknown> = {};
    
    switch (action) {
      case 'close_registration':
        result = await handleCloseRegistration(tournamentId);
        break;
        
      case 'generate_bracket':
        result = await handleGenerateBracket(tournamentId, sport);
        break;
        
      case 'start_tournament':
        result = await handleStartTournament(tournamentId);
        break;
        
      case 'advance_winner':
        result = await handleAdvanceWinner(
          tournamentId,
          data?.matchId as string,
          data?.winnerId as string
        );
        break;
        
      case 'promote_waitlist':
        result = await handlePromoteWaitlist(
          tournamentId,
          data?.count as number || 1
        );
        break;
        
      case 'complete_tournament':
        result = await handleCompleteTournament(tournamentId);
        break;
        
      case 'send_reminders':
        result = await handleSendReminders(tournamentId);
        break;
        
      case 'finalize_results':
        result = await handleFinalizeResults(tournamentId);
        break;
        
      case 'process_prizes':
        result = await handleProcessPrizes(tournamentId);
        break;
        
      default:
        throw new Error(`Unknown tournament action: ${action}`);
    }
    
    return {
      success: true,
      data: result,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    log.error(`[TournamentJob] Failed tournament job ${job.id}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Action Handlers
// ============================================

/**
 * Close tournament registration
 */
async function handleCloseRegistration(
  tournamentId: string
): Promise<{ registrations: number; waitlist: number }> {
  // Get tournament and update status
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: { where: { status: 'CONFIRMED' } },
      waitlist: { where: { status: 'WAITING' } },
    },
  });
  
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  if (tournament.status !== 'REGISTRATION_OPEN') {
    throw new Error(`Cannot close registration - current status: ${tournament.status}`);
  }
  
  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'REGISTRATION_CLOSED',
      registrationClosedAt: new Date(),
    },
  });
  
  // Log autopilot action
  await db.autopilotLog.create({
    data: {
      tournamentId,
      action: 'REGISTRATION_CLOSED',
      details: {
        registrations: tournament.registrations.length,
        waitlist: tournament.waitlist.length,
      },
    },
  });
  
  log.info(`[TournamentJob] Closed registration for ${tournamentId}`, {
    registrations: tournament.registrations.length,
    waitlist: tournament.waitlist.length,
  });
  
  return {
    registrations: tournament.registrations.length,
    waitlist: tournament.waitlist.length,
  };
}

/**
 * Generate tournament bracket
 */
async function handleGenerateBracket(
  tournamentId: string,
  sport?: string
): Promise<BracketGenerationResult> {
  // Get tournament with registrations
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: { player: { select: { id: true, hiddenElo: true } } },
      },
    },
  });
  
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  if (tournament.status !== 'REGISTRATION_CLOSED') {
    throw new Error(`Cannot generate bracket - current status: ${tournament.status}`);
  }
  
  // Check if bracket already exists
  const existingBracket = await db.bracket.findUnique({
    where: { tournamentId },
  });
  
  if (existingBracket) {
    throw new Error('Bracket already exists for this tournament');
  }
  
  // Get user ID for bracket generation
  const systemUser = await db.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  
  if (!systemUser) {
    throw new Error('No admin user found for bracket generation');
  }
  
  // Import bracket generation logic
  const { generateBracket } = await import('../bracket-edge-cases');
  
  // Generate bracket based on format
  const players = tournament.registrations.map(r => ({
    id: r.playerId,
    elo: r.player.hiddenElo,
  }));
  
  // Sort by Elo for seeding
  players.sort((a, b) => b.elo - a.elo);
  
  // Calculate total rounds
  const totalRounds = Math.ceil(Math.log2(players.length));
  
  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId,
      format: tournament.bracketFormat || 'SINGLE_ELIMINATION',
      totalRounds,
      seedingMethod: 'ELO',
      generatedById: systemUser.id,
    },
  });
  
  // Create bracket matches
  const bracketMatches = [];
  let matchNumber = 1;
  
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = Math.pow(2, totalRounds - round);
    
    for (let i = 0; i < matchesInRound; i++) {
      bracketMatches.push({
        bracketId: bracket.id,
        roundNumber: round,
        matchNumber: matchNumber++,
        status: 'PENDING',
      });
    }
  }
  
  await db.bracketMatch.createMany({
    data: bracketMatches,
  });
  
  // Assign players to first round matches
  const firstRoundMatches = await db.bracketMatch.findMany({
    where: { bracketId: bracket.id, roundNumber: 1 },
    orderBy: { matchNumber: 'asc' },
  });
  
  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'BRACKET_GENERATED',
      bracketGeneratedAt: new Date(),
    },
  });
  
  // Log autopilot action
  await db.autopilotLog.create({
    data: {
      tournamentId,
      action: 'BRACKET_GENERATED',
      details: {
        bracketId: bracket.id,
        totalMatches: bracketMatches.length,
        totalRounds,
        players: players.length,
      },
    },
  });
  
  log.info(`[TournamentJob] Generated bracket for ${tournamentId}`, {
    bracketId: bracket.id,
    totalMatches: bracketMatches.length,
  });
  
  return {
    bracketId: bracket.id,
    totalMatches: bracketMatches.length,
    totalRounds,
  };
}

/**
 * Start tournament
 */
async function handleStartTournament(
  tournamentId: string
): Promise<{ status: string; matchesStarted: number }> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: {
            where: { roundNumber: 1, status: 'PENDING' },
          },
        },
      },
    },
  });
  
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  if (tournament.status !== 'BRACKET_GENERATED') {
    throw new Error(`Cannot start tournament - current status: ${tournament.status}`);
  }
  
  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'IN_PROGRESS',
      tournamentStartedAt: new Date(),
    },
  });
  
  // Start first round matches
  const matchesStarted = tournament.bracket?.matches.length || 0;
  
  // Update first round matches to LIVE if both players assigned
  for (const match of tournament.bracket?.matches || []) {
    if (match.playerAId && match.playerBId) {
      await db.bracketMatch.update({
        where: { id: match.id },
        data: { status: 'LIVE' },
      });
    }
  }
  
  // Log autopilot action
  await db.autopilotLog.create({
    data: {
      tournamentId,
      action: 'TOURNAMENT_STARTED',
      details: {
        matchesStarted,
      },
    },
  });
  
  log.info(`[TournamentJob] Started tournament ${tournamentId}`, {
    matchesStarted,
  });
  
  return {
    status: 'IN_PROGRESS',
    matchesStarted,
  };
}

/**
 * Advance winner to next round
 */
async function handleAdvanceWinner(
  tournamentId: string,
  matchId: string,
  winnerId: string
): Promise<{ advanced: boolean; nextMatchId?: string }> {
  // Get bracket match
  const bracketMatch = await db.bracketMatch.findFirst({
    where: {
      match: { id: matchId },
      bracket: { tournamentId },
    },
    include: {
      bracket: true,
    },
  });
  
  if (!bracketMatch) {
    throw new Error('Bracket match not found');
  }
  
  // Update match with winner
  await db.bracketMatch.update({
    where: { id: bracketMatch.id },
    data: {
      winnerId,
      status: 'COMPLETED',
    },
  });
  
  // Find next match
  const nextRound = bracketMatch.roundNumber + 1;
  if (nextRound > bracketMatch.bracket.totalRounds) {
    // Tournament complete - winner is the champion
    return { advanced: false };
  }
  
  // Calculate next match position
  const nextMatchNumber = Math.ceil(bracketMatch.matchNumber / 2);
  
  const nextMatch = await db.bracketMatch.findFirst({
    where: {
      bracketId: bracketMatch.bracketId,
      roundNumber: nextRound,
      matchNumber: nextMatchNumber,
    },
  });
  
  if (!nextMatch) {
    throw new Error('Next match not found');
  }
  
  // Determine which slot to fill (playerA or playerB)
  const isOddMatch = bracketMatch.matchNumber % 2 === 1;
  
  await db.bracketMatch.update({
    where: { id: nextMatch.id },
    data: isOddMatch
      ? { playerAId: winnerId }
      : { playerBId: winnerId },
  });
  
  // Check if next match is ready to start
  const updatedNextMatch = await db.bracketMatch.findUnique({
    where: { id: nextMatch.id },
  });
  
  if (updatedNextMatch?.playerAId && updatedNextMatch?.playerBId) {
    await db.bracketMatch.update({
      where: { id: nextMatch.id },
      data: { status: 'LIVE' },
    });
  }
  
  log.info(`[TournamentJob] Advanced winner ${winnerId} to next round`, {
    tournamentId,
    matchId,
    nextMatchId: nextMatch.id,
  });
  
  return {
    advanced: true,
    nextMatchId: nextMatch.id,
  };
}

/**
 * Promote from waitlist
 */
async function handlePromoteWaitlist(
  tournamentId: string,
  count: number = 1
): Promise<{ promoted: number; remaining: number }> {
  // Get waitlist entries
  const waitlistEntries = await db.tournamentWaitlist.findMany({
    where: {
      tournamentId,
      status: 'WAITING',
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: count,
  });
  
  if (waitlistEntries.length === 0) {
    return { promoted: 0, remaining: 0 };
  }
  
  // Promote each entry
  for (const entry of waitlistEntries) {
    // Create registration
    await db.tournamentRegistration.create({
      data: {
        tournamentId,
        playerId: entry.playerId,
        status: 'CONFIRMED',
        amount: 0, // No payment for waitlist promotion
        registeredAt: new Date(),
      },
    });
    
    // Update waitlist status
    await db.tournamentWaitlist.update({
      where: { id: entry.id },
      data: {
        status: 'PROMOTED',
        promotedAt: new Date(),
      },
    });
    
    // Send notification
    const { addNotificationJob } = await import('../job-queue');
    await addNotificationJob({
      userId: entry.playerId,
      notificationType: 'WAITLIST_PROMOTED',
      title: 'You\'re In!',
      message: 'You have been promoted from the waitlist!',
      link: `/tournaments/${tournamentId}`,
      channels: ['in_app', 'push'],
    });
  }
  
  // Get remaining waitlist count
  const remaining = await db.tournamentWaitlist.count({
    where: {
      tournamentId,
      status: 'WAITING',
    },
  });
  
  log.info(`[TournamentJob] Promoted ${waitlistEntries.length} from waitlist`, {
    tournamentId,
    remaining,
  });
  
  return {
    promoted: waitlistEntries.length,
    remaining,
  };
}

/**
 * Complete tournament
 */
async function handleCompleteTournament(
  tournamentId: string
): Promise<{ status: string; resultsRecorded: number }> {
  // Get tournament with final results
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: true,
        },
      },
    },
  });
  
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  // Find the final match winner (tournament champion)
  const finalMatch = tournament.bracket?.matches.find(
    m => m.roundNumber === tournament.bracket?.totalRounds
  );
  
  if (!finalMatch?.winnerId) {
    throw new Error('Tournament has no winner');
  }
  
  // Update tournament status
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'COMPLETED',
    },
  });
  
  // Create tournament result for winner
  await db.tournamentResult.create({
    data: {
      tournamentId,
      userId: finalMatch.winnerId,
      position: 1,
      prizeAmount: tournament.prizePool, // Winner takes all (simplified)
    },
  });
  
  // Log autopilot action
  await db.autopilotLog.create({
    data: {
      tournamentId,
      action: 'TOURNAMENT_COMPLETED',
      details: {
        winnerId: finalMatch.winnerId,
      },
    },
  });
  
  log.info(`[TournamentJob] Completed tournament ${tournamentId}`, {
    winnerId: finalMatch.winnerId,
  });
  
  return {
    status: 'COMPLETED',
    resultsRecorded: 1,
  };
}

/**
 * Send tournament reminders
 */
async function handleSendReminders(
  tournamentId: string
): Promise<{ sent: number }> {
  // Get registered players
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'CONFIRMED',
    },
    select: {
      playerId: true,
    },
  });
  
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, startDate: true, location: true },
  });
  
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  // Send reminders to all players
  const { addBulkJobs } = await import('../job-queue');
  
  const jobs = registrations.map(reg => ({
    data: {
      type: 'notification' as const,
      userId: reg.playerId,
      notificationType: 'TOURNAMENT_REMINDER',
      title: `Reminder: ${tournament.name}`,
      message: `Tournament starts at ${tournament.location} on ${tournament.startDate.toLocaleDateString()}`,
      link: `/tournaments/${tournamentId}`,
      channels: ['in_app', 'push'],
      createdAt: Date.now(),
    },
  }));
  
  await addBulkJobs('notification', jobs);
  
  log.info(`[TournamentJob] Sent reminders for ${tournamentId}`, {
    sent: registrations.length,
  });
  
  return { sent: registrations.length };
}

/**
 * Finalize tournament results
 */
async function handleFinalizeResults(
  tournamentId: string
): Promise<{ finalized: boolean }> {
  // Calculate final standings
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: {
        include: {
          matches: {
            orderBy: { roundNumber: 'desc' },
          },
        },
      },
      results: true,
    },
  });
  
  if (!tournament || !tournament.bracket) {
    throw new Error('Tournament or bracket not found');
  }
  
  // Lock tournament results
  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'COMPLETED',
    },
  });
  
  log.info(`[TournamentJob] Finalized results for ${tournamentId}`);
  
  return { finalized: true };
}

/**
 * Process tournament prizes
 */
async function handleProcessPrizes(
  tournamentId: string
): Promise<{ payoutsCreated: number }> {
  // Get tournament results
  const results = await db.tournamentResult.findMany({
    where: { tournamentId },
    include: {
      tournament: {
        select: { prizePool: true },
      },
    },
  });
  
  if (results.length === 0) {
    return { payoutsCreated: 0 };
  }
  
  // Create prize payouts
  const { addPaymentJob } = await import('../job-queue');
  let payoutsCreated = 0;
  
  for (const result of results) {
    if (result.prizeAmount > 0) {
      await addPaymentJob({
        type: 'payment',
        paymentId: `prize-${result.id}`,
        action: 'process_payout',
        userId: result.userId,
        amount: result.prizeAmount,
        data: {
          tournamentId,
          position: result.position,
        },
      });
      payoutsCreated++;
    }
  }
  
  log.info(`[TournamentJob] Processed prizes for ${tournamentId}`, {
    payoutsCreated,
  });
  
  return { payoutsCreated };
}

// ============================================
// Export Default Handler
// ============================================

export default handleTournamentJob;
