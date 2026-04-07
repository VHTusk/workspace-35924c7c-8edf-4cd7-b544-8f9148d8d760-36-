/**
 * VALORHIVE - Tournament Snapshot Service (v3.48.0)
 * 
 * Handles capturing and storing tournament snapshots for historical records.
 * Part of the Completion & Trust Layer.
 * 
 * Key Features:
 * - Complete tournament state capture
 * - Final standings calculation
 * - Bracket state preservation
 * - Data integrity verification
 * - Historical record management
 */

import { db } from '@/lib/db';
import { TournamentStatus, BracketMatchStatus, CompletionAction } from '@prisma/client';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

interface SnapshotResult {
  success: boolean;
  snapshotId?: string;
  checksum?: string;
  error?: string;
}

interface FinalStanding {
  rank: number;
  playerId?: string;
  teamId?: string;
  playerName?: string;
  teamName?: string;
  wins: number;
  losses: number;
  points: number;
  bonusPoints?: number;
}

interface BracketStateMatch {
  matchId: string;
  roundNumber: number;
  matchNumber: number;
  playerAId?: string;
  playerBId?: string;
  teamAId?: string;
  teamBId?: string;
  playerAName?: string;
  playerBName?: string;
  teamAName?: string;
  teamBName?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  winnerTeamId?: string;
  status: string;
  bracketSide?: string;
}

interface MatchResult {
  matchId: string;
  playerAId?: string;
  playerBId?: string;
  teamAId?: string;
  teamBId?: string;
  playerAName?: string;
  playerBName?: string;
  teamAName?: string;
  teamBName?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  winnerTeamId?: string;
  outcome?: string;
  playedAt: Date;
}

interface TournamentStats {
  totalMatches: number;
  completedMatches: number;
  totalParticipants: number;
  tournamentDuration: string;
  averageMatchDuration?: number;
  longestMatch?: MatchResult;
  highestScore?: MatchResult;
  upsets: number;
  closeMatches: number;
}

// ============================================
// SNAPSHOT CREATION
// ============================================

/**
 * Create a complete tournament snapshot
 */
export async function createTournamentSnapshot(
  tournamentId: string
): Promise<SnapshotResult> {
  try {
    // Check if snapshot already exists
    const existing = await db.tournamentSnapshot.findUnique({
      where: { tournamentId }
    });

    if (existing) {
      return {
        success: true,
        snapshotId: existing.id,
        checksum: existing.checksum,
        error: 'Snapshot already exists'
      };
    }

    // Get tournament with all related data
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        bracket: {
          include: {
            matches: {
              include: {
                match: true
              }
            }
          }
        },
        matches: {
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } }
          }
        },
        registrations: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        teamRegistrations: {
          include: {
            team: { 
              include: { 
                members: { 
                  include: { 
                    user: { select: { id: true, firstName: true, lastName: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Calculate final standings
    const finalStandings = await calculateFinalStandings(tournament);

    // Capture bracket state
    const bracketState = await captureBracketState(tournament);

    // Capture match results
    const matchResults = await captureMatchResults(tournament);

    // Calculate statistics
    const statistics = await calculateStatistics(tournament);

    // Serialize data
    const standingsJson = JSON.stringify(finalStandings);
    const bracketJson = JSON.stringify(bracketState);
    const matchesJson = JSON.stringify(matchResults);
    const statsJson = JSON.stringify(statistics);

    // Generate checksum for integrity
    const checksum = generateChecksum(standingsJson + bracketJson + matchesJson + statsJson);

    // Create snapshot
    const snapshot = await db.tournamentSnapshot.create({
      data: {
        tournamentId,
        sport: tournament.sport,
        finalStandings: standingsJson,
        bracketState: bracketJson,
        matchResults: matchesJson,
        statistics: statsJson,
        checksum,
        snapshotVersion: '1.0'
      }
    });

    // Log action
    await logSnapshotAction(tournamentId, CompletionAction.SNAPSHOT_CAPTURED, {
      snapshotId: snapshot.id,
      checksum,
      matchCount: matchResults.length,
      participantCount: finalStandings.length
    });

    return {
      success: true,
      snapshotId: snapshot.id,
      checksum
    };

  } catch (error) {
    console.error('Error creating tournament snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// STANDINGS CALCULATION
// ============================================

/**
 * Calculate final standings based on tournament format
 */
async function calculateFinalStandings(tournament: any): Promise<FinalStanding[]> {
  const isTeamFormat = tournament.format === 'DOUBLES' || tournament.format === 'TEAM';
  const standings: Map<string, FinalStanding> = new Map();

  // Initialize participants
  if (isTeamFormat) {
    for (const reg of tournament.teamRegistrations || []) {
      standings.set(reg.teamId, {
        rank: 0,
        teamId: reg.teamId,
        teamName: reg.team?.name || 'Unknown',
        wins: 0,
        losses: 0,
        points: 0
      });
    }
  } else {
    for (const reg of tournament.registrations || []) {
      standings.set(reg.userId, {
        rank: 0,
        playerId: reg.userId,
        playerName: `${reg.user?.firstName || ''} ${reg.user?.lastName || ''}`.trim(),
        wins: 0,
        losses: 0,
        points: 0
      });
    }
  }

  // Process matches
  for (const match of tournament.matches || []) {
    const winnerId = isTeamFormat ? match.winnerTeamId : match.winnerId;
    const loserId = isTeamFormat
      ? (match.winnerTeamId === match.teamAId ? match.teamBId : match.teamAId)
      : (match.winnerId === match.playerAId ? match.playerBId : match.playerAId);

    if (winnerId && standings.has(winnerId)) {
      const winner = standings.get(winnerId)!;
      winner.wins++;
      winner.points += 3; // Standard win points
    }

    if (loserId && standings.has(loserId)) {
      const loser = standings.get(loserId)!;
      loser.losses++;
    }
  }

  // Sort by points, then wins
  const sortedStandings = Array.from(standings.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });

  // Assign ranks
  sortedStandings.forEach((standing, index) => {
    standing.rank = index + 1;
  });

  return sortedStandings;
}

// ============================================
// BRACKET STATE CAPTURE
// ============================================

/**
 * Capture complete bracket state
 */
async function captureBracketState(tournament: any): Promise<BracketStateMatch[]> {
  if (!tournament.bracket) {
    return [];
  }

  const bracketMatches: BracketStateMatch[] = [];
  const isTeamFormat = tournament.format === 'DOUBLES' || tournament.format === 'TEAM';

  for (const bm of tournament.bracket.matches) {
    const match = bm.match;
    
    let playerAName: string | undefined;
    let playerBName: string | undefined;
    let teamAName: string | undefined;
    let teamBName: string | undefined;

    if (isTeamFormat) {
      if (bm.teamAId) {
        const team = await db.team.findUnique({
          where: { id: bm.teamAId },
          select: { name: true }
        });
        teamAName = team?.name;
      }
      if (bm.teamBId) {
        const team = await db.team.findUnique({
          where: { id: bm.teamBId },
          select: { name: true }
        });
        teamBName = team?.name;
      }
    } else {
      if (bm.playerAId) {
        const user = await db.user.findUnique({
          where: { id: bm.playerAId },
          select: { firstName: true, lastName: true }
        });
        playerAName = user ? `${user.firstName} ${user.lastName}` : undefined;
      }
      if (bm.playerBId) {
        const user = await db.user.findUnique({
          where: { id: bm.playerBId },
          select: { firstName: true, lastName: true }
        });
        playerBName = user ? `${user.firstName} ${user.lastName}` : undefined;
      }
    }

    bracketMatches.push({
      matchId: bm.id,
      roundNumber: bm.roundNumber,
      matchNumber: bm.matchNumber,
      playerAId: bm.playerAId || undefined,
      playerBId: bm.playerBId || undefined,
      teamAId: bm.teamAId || undefined,
      teamBId: bm.teamBId || undefined,
      playerAName,
      playerBName,
      teamAName,
      teamBName,
      scoreA: match?.scoreA || undefined,
      scoreB: match?.scoreB || undefined,
      winnerId: bm.winnerId || undefined,
      winnerTeamId: bm.winnerTeamId || undefined,
      status: bm.status,
      bracketSide: bm.bracketSide || undefined
    });
  }

  return bracketMatches;
}

// ============================================
// MATCH RESULTS CAPTURE
// ============================================

/**
 * Capture all match results
 */
async function captureMatchResults(tournament: any): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const isTeamFormat = tournament.format === 'DOUBLES' || tournament.format === 'TEAM';

  for (const match of tournament.matches || []) {
    results.push({
      matchId: match.id,
      playerAId: match.playerAId || undefined,
      playerBId: match.playerBId || undefined,
      teamAId: match.teamAId || undefined,
      teamBId: match.teamBId || undefined,
      playerAName: match.playerA 
        ? `${match.playerA.firstName} ${match.playerA.lastName}` 
        : undefined,
      playerBName: match.playerB 
        ? `${match.playerB.firstName} ${match.playerB.lastName}` 
        : undefined,
      teamAName: match.teamA?.name,
      teamBName: match.teamB?.name,
      scoreA: match.scoreA || undefined,
      scoreB: match.scoreB || undefined,
      winnerId: match.winnerId || undefined,
      winnerTeamId: match.winnerTeamId || undefined,
      outcome: match.outcome || undefined,
      playedAt: match.playedAt
    });
  }

  return results;
}

// ============================================
// STATISTICS CALCULATION
// ============================================

/**
 * Calculate tournament statistics
 */
async function calculateStatistics(tournament: any): Promise<TournamentStats> {
  const matches = tournament.matches || [];
  const completedMatches = matches.filter((m: any) => m.winnerId || m.winnerTeamId);
  
  // Calculate duration
  const start = tournament.tournamentStartedAt || tournament.startDate;
  const end = new Date();
  const durationMs = end.getTime() - new Date(start).getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const duration = `${durationHours}h ${durationMinutes}m`;

  // Find longest and highest scoring matches
  let longestMatch: MatchResult | undefined;
  let highestScore: MatchResult | undefined;
  let maxScore = 0;

  for (const match of completedMatches) {
    const totalScore = (match.scoreA || 0) + (match.scoreB || 0);
    if (totalScore > maxScore) {
      maxScore = totalScore;
      highestScore = {
        matchId: match.id,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        playerAName: match.playerA ? `${match.playerA.firstName} ${match.playerA.lastName}` : undefined,
        playerBName: match.playerB ? `${match.playerB.firstName} ${match.playerB.lastName}` : undefined,
        teamAName: match.teamA?.name,
        teamBName: match.teamB?.name,
        playedAt: match.playedAt
      };
    }
  }

  // Calculate upsets (lower seed beating higher seed)
  let upsets = 0;
  let closeMatches = 0;

  for (const match of completedMatches) {
    const scoreDiff = Math.abs((match.scoreA || 0) - (match.scoreB || 0));
    if (scoreDiff <= 2) {
      closeMatches++;
    }
    // FUTURE: Calculate actual upsets based on seeding vs final result
  }

  // Get participant count
  const participantCount = tournament.format === 'INDIVIDUAL'
    ? (tournament.registrations || []).length
    : (tournament.teamRegistrations || []).length;

  return {
    totalMatches: matches.length,
    completedMatches: completedMatches.length,
    totalParticipants: participantCount,
    tournamentDuration: duration,
    longestMatch,
    highestScore,
    upsets,
    closeMatches
  };
}

// ============================================
// INTEGRITY VERIFICATION
// ============================================

/**
 * Generate checksum for data integrity
 */
function generateChecksum(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify snapshot integrity
 */
export async function verifySnapshotIntegrity(
  snapshotId: string
): Promise<{ valid: boolean; error?: string }> {
  const snapshot = await db.tournamentSnapshot.findUnique({
    where: { id: snapshotId }
  });

  if (!snapshot) {
    return { valid: false, error: 'Snapshot not found' };
  }

  // Regenerate checksum
  const data = snapshot.finalStandings + snapshot.bracketState + snapshot.matchResults + snapshot.statistics;
  const expectedChecksum = generateChecksum(data);

  if (expectedChecksum !== snapshot.checksum) {
    return { valid: false, error: 'Checksum mismatch - data may have been modified' };
  }

  return { valid: true };
}

// ============================================
// SNAPSHOT RETRIEVAL
// ============================================

/**
 * Get snapshot for a tournament
 */
export async function getTournamentSnapshot(tournamentId: string): Promise<{
  exists: boolean;
  snapshot?: any;
  parsed?: {
    standings: FinalStanding[];
    bracket: BracketStateMatch[];
    matches: MatchResult[];
    stats: TournamentStats;
  };
}> {
  const snapshot = await db.tournamentSnapshot.findUnique({
    where: { tournamentId }
  });

  if (!snapshot) {
    return { exists: false };
  }

  return {
    exists: true,
    snapshot,
    parsed: {
      standings: JSON.parse(snapshot.finalStandings),
      bracket: JSON.parse(snapshot.bracketState),
      matches: JSON.parse(snapshot.matchResults),
      stats: JSON.parse(snapshot.statistics)
    }
  };
}

/**
 * Export snapshot as JSON
 */
export async function exportSnapshotAsJson(tournamentId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const result = await getTournamentSnapshot(tournamentId);

  if (!result.exists) {
    return { success: false, error: 'Snapshot not found' };
  }

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      sport: true,
      startDate: true,
      endDate: true,
      location: true,
      scope: true,
      format: true,
      bracketFormat: true
    }
  });

  return {
    success: true,
    data: {
      tournament,
      snapshot: result.snapshot,
      data: result.parsed
    }
  };
}

// ============================================
// HELPERS
// ============================================

async function logSnapshotAction(
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
      actorId: null,
      actorRole: 'SYSTEM',
      executedAt: new Date()
    }
  });
}

// ============================================
// EXPORTS
// ============================================

export const TournamentSnapshotService = {
  create: createTournamentSnapshot,
  get: getTournamentSnapshot,
  verify: verifySnapshotIntegrity,
  export: exportSnapshotAsJson
};
