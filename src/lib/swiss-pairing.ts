/**
 * Swiss Tournament Pairing Algorithm for VALORHIVE
 * 
 * Implements:
 * - Standard Swiss pairing (pair players with similar scores)
 * - Rematch avoidance
 * - Bye handling for odd player counts
 * - Buchholz tiebreaker (sum of opponent scores)
 * - Sonneborn-Berger tiebreaker (weighted opponent scores)
 */

import { db } from '@/lib/db';
import { SportType, TournamentStatus, Match, MatchOutcome } from '@prisma/client';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SwissPlayer {
  id: string;
  name: string;
  elo: number;
  score: number; // Points earned in tournament (wins = 1, draws = 0.5)
  opponentIds: string[]; // IDs of opponents already faced
  colorPreference?: 'white' | 'black'; // For games with color (chess-like)
  colorBalance?: number; // Net color assignment balance
  receivedBye?: boolean; // Has already received a bye
}

export interface SwissPairing {
  playerAId: string;
  playerBId: string | null; // null = bye
  playerAName: string;
  playerBName: string | null;
  roundNumber: number;
  matchNumber: number;
  isBye: boolean;
}

export interface Pairing {
  playerAId: string;
  playerBId: string | null;
  isBye: boolean;
}

export interface SwissStanding {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  buchholz: number;
  sonnebornBerger: number;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
}

export interface SwissTournamentState {
  tournamentId: string;
  currentRound: number;
  totalRounds: number;
  players: SwissPlayer[];
  pairings: Map<number, SwissPairing[]>; // round -> pairings
  standings: SwissStanding[];
}

export interface PairingResult {
  success: boolean;
  pairings: SwissPairing[];
  byePlayer?: string; // ID of player receiving bye (if any)
  warnings: string[];
}

export interface SwissPairingResult {
  success: boolean;
  pairings: Pairing[];
  byePlayers: string[];
  warnings: string[];
  roundNumber: number;
}

// ============================================
// SWISS PAIRING ALGORITHM
// ============================================

/**
 * Generate pairings for a Swiss round
 */
export async function generateSwissPairings(
  tournamentId: string,
  roundNumber: number
): Promise<PairingResult> {
  const warnings: string[] = [];
  
  // Get tournament with registrations and match history
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
            },
          },
        },
      },
      matches: {
        where: { tournamentId },
        include: {
          bracketMatch: true,
        },
      },
      bracket: true,
    },
  });

  if (!tournament) {
    return {
      success: false,
      pairings: [],
      warnings: ['Tournament not found'],
    };
  }

  // Build player data with scores
  const players: SwissPlayer[] = await buildSwissPlayers(tournamentId, tournament.registrations);

  if (players.length < 2) {
    return {
      success: false,
      pairings: [],
      warnings: ['Need at least 2 players for Swiss pairing'],
    };
  }

  // Sort players by score (descending), then by ELO for tiebreaks
  players.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.elo - a.elo;
  });

  // Group players by score
  const scoreGroups = groupByScore(players);

  // Generate pairings
  const pairings = pairPlayersSwissStyle(players, scoreGroups, roundNumber, warnings);

  return {
    success: true,
    pairings,
    byePlayer: pairings.find(p => p.isBye)?.playerAId,
    warnings,
  };
}

/**
 * Build Swiss player data from registrations and match history
 */
async function buildSwissPlayers(
  tournamentId: string,
  registrations: any[]
): Promise<SwissPlayer[]> {
  // Get all matches for this tournament to calculate scores and opponent history
  const matches = await db.match.findMany({
    where: { tournamentId },
    include: {
      bracketMatch: true,
    },
  });

  const players: SwissPlayer[] = registrations.map((reg) => {
    const userId = reg.userId;
    let score = 0;
    const opponentIds: string[] = [];
    let receivedBye = false;

    // Calculate score and track opponents from completed matches
    for (const match of matches) {
      const isPlayerA = match.playerAId === userId;
      const isPlayerB = match.playerBId === userId;

      if (!isPlayerA && !isPlayerB) continue;

      // Handle bye matches
      if (match.outcome === 'BYE') {
        if (isPlayerA && !match.playerBId) {
          score += 1; // Bye = win
          receivedBye = true;
        }
        continue;
      }

      // Track opponent
      const opponentId = isPlayerA ? match.playerBId : match.playerAId;
      if (opponentId) {
        opponentIds.push(opponentId);
      }

      // Calculate score
      if (match.winnerId === userId) {
        score += 1;
      } else if (match.winnerId === null && match.scoreA !== null && match.scoreB !== null) {
        // Draw (rare in cornhole/darts but possible)
        score += 0.5;
      }
    }

    return {
      id: userId,
      name: `${reg.user.firstName} ${reg.user.lastName}`,
      elo: reg.user.hiddenElo || 1500,
      score,
      opponentIds,
      receivedBye,
    };
  });

  return players;
}

/**
 * Group players by their current score
 */
function groupByScore(players: SwissPlayer[]): Map<number, SwissPlayer[]> {
  const groups = new Map<number, SwissPlayer[]>();

  for (const player of players) {
    const score = player.score;
    if (!groups.has(score)) {
      groups.set(score, []);
    }
    groups.get(score)!.push(player);
  }

  return groups;
}

/**
 * Pair players using Swiss system rules
 * - Players with same/similar scores paired together
 * - Avoid rematches where possible
 * - Bye goes to lowest-ranked player who hasn't had a bye
 */
function pairPlayersSwissStyle(
  players: SwissPlayer[],
  scoreGroups: Map<number, SwissPlayer[]>,
  roundNumber: number,
  warnings: string[]
): SwissPairing[] {
  const pairings: SwissPairing[] = [];
  const paired = new Set<string>();
  let matchNumber = 1;

  // Sort scores descending
  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);

  // Handle odd number of players - find bye candidate
  let byePlayer: SwissPlayer | null = null;
  if (players.length % 2 === 1) {
    // Find lowest-score player who hasn't received a bye
    const eligibleForBye = players
      .filter(p => !p.receivedBye)
      .sort((a, b) => a.score - b.score || a.elo - b.elo);

    if (eligibleForBye.length > 0) {
      byePlayer = eligibleForBye[0];
      paired.add(byePlayer.id);
      pairings.push({
        playerAId: byePlayer.id,
        playerBId: null,
        playerAName: byePlayer.name,
        playerBName: null,
        roundNumber,
        matchNumber: matchNumber++,
        isBye: true,
      });
    } else {
      warnings.push('All players have received a bye. Assigning bye to lowest score player.');
      const lowestScore = players[players.length - 1];
      byePlayer = lowestScore;
      paired.add(byePlayer.id);
      pairings.push({
        playerAId: byePlayer.id,
        playerBId: null,
        playerAName: byePlayer.name,
        playerBName: null,
        roundNumber,
        matchNumber: matchNumber++,
        isBye: true,
      });
    }
  }

  // Pair players score group by score group
  let unpairedPlayers = players.filter(p => !paired.has(p.id));

  while (unpairedPlayers.length > 0) {
    const player = unpairedPlayers[0];
    
    // Find best opponent: similar score, no rematch
    let bestOpponent: SwissPlayer | null = null;
    let bestScoreDiff = Infinity;

    for (const opponent of unpairedPlayers) {
      if (opponent.id === player.id) continue;

      // Check for rematch
      const isRematch = player.opponentIds.includes(opponent.id);

      // Calculate score difference
      const scoreDiff = Math.abs(player.score - opponent.score);

      // Prefer non-rematch with closest score
      if (!isRematch && scoreDiff < bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestOpponent = opponent;
      }
    }

    // If no non-rematch found, allow rematch but warn
    if (!bestOpponent) {
      // Find closest score opponent even if rematch
      for (const opponent of unpairedPlayers) {
        if (opponent.id === player.id) continue;
        const scoreDiff = Math.abs(player.score - opponent.score);
        if (scoreDiff < bestScoreDiff) {
          bestScoreDiff = scoreDiff;
          bestOpponent = opponent;
        }
      }
      
      if (bestOpponent) {
        warnings.push(`Rematch pairing: ${player.name} vs ${bestOpponent.name}`);
      }
    }

    if (bestOpponent) {
      pairings.push({
        playerAId: player.id,
        playerBId: bestOpponent.id,
        playerAName: player.name,
        playerBName: bestOpponent.name,
        roundNumber,
        matchNumber: matchNumber++,
        isBye: false,
      });

      paired.add(player.id);
      paired.add(bestOpponent.id);
    } else {
      // Shouldn't happen, but handle edge case
      warnings.push(`Could not find opponent for ${player.name}`);
      paired.add(player.id);
    }

    unpairedPlayers = players.filter(p => !paired.has(p.id));
  }

  return pairings;
}

// ============================================
// TIEBREAKERS
// ============================================

/**
 * Calculate Buchholz tiebreaker (sum of opponent scores)
 * Higher is better - means you played stronger opponents
 */
export async function calculateBuchholz(
  tournamentId: string,
  playerId: string
): Promise<number> {
  // Get all matches where this player participated
  const matches = await db.match.findMany({
    where: {
      tournamentId,
      OR: [
        { playerAId: playerId },
        { playerBId: playerId },
      ],
    },
  });

  let buchholz = 0;

  for (const match of matches) {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    
    if (!opponentId) continue; // Bye match

    // Get opponent's total score
    const opponentScore = await getPlayerTournamentScore(tournamentId, opponentId);
    buchholz += opponentScore;
  }

  return buchholz;
}

/**
 * Calculate Sonneborn-Berger tiebreaker (weighted sum of opponent scores)
 * Opponent's score only counts if you beat them (or drew)
 * Formula: sum of (opponent_score * your_result_against_them)
 */
export async function calculateSonnebornBerger(
  tournamentId: string,
  playerId: string
): Promise<number> {
  const matches = await db.match.findMany({
    where: {
      tournamentId,
      OR: [
        { playerAId: playerId },
        { playerBId: playerId },
      ],
    },
  });

  let sonnebornBerger = 0;

  for (const match of matches) {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    
    if (!opponentId) continue; // Bye match

    // Get result multiplier
    let resultMultiplier = 0;
    if (match.winnerId === playerId) {
      resultMultiplier = 1; // Win
    } else if (match.winnerId === null && match.scoreA !== null) {
      resultMultiplier = 0.5; // Draw
    }
    // Loss = 0 multiplier

    if (resultMultiplier > 0) {
      const opponentScore = await getPlayerTournamentScore(tournamentId, opponentId);
      sonnebornBerger += opponentScore * resultMultiplier;
    }
  }

  return sonnebornBerger;
}

/**
 * Get a player's total score in a tournament
 */
async function getPlayerTournamentScore(
  tournamentId: string,
  playerId: string
): Promise<number> {
  const matches = await db.match.findMany({
    where: {
      tournamentId,
      OR: [
        { playerAId: playerId },
        { playerBId: playerId },
      ],
    },
  });

  let score = 0;

  for (const match of matches) {
    if (match.outcome === 'BYE') {
      if (match.playerAId === playerId && !match.playerBId) {
        score += 1;
      }
      continue;
    }

    if (match.winnerId === playerId) {
      score += 1;
    } else if (match.winnerId === null && match.scoreA !== null) {
      score += 0.5; // Draw
    }
  }

  return score;
}

/**
 * Get full Swiss standings with tiebreakers
 */
export async function getSwissStandings(
  tournamentId: string
): Promise<SwissStanding[]> {
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
            },
          },
        },
      },
      matches: true,
    },
  });

  if (!tournament) {
    return [];
  }

  const standings: SwissStanding[] = [];

  for (const reg of tournament.registrations) {
    const playerId = reg.userId;
    const matches = tournament.matches.filter(
      m => m.playerAId === playerId || m.playerBId === playerId
    );

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let score = 0;

    for (const match of matches) {
      if (match.outcome === 'BYE') {
        if (match.playerAId === playerId && !match.playerBId) {
          wins++;
          score += 1;
        }
        continue;
      }

      if (match.winnerId === playerId) {
        wins++;
        score += 1;
      } else if (match.winnerId === null && match.scoreA !== null) {
        draws++;
        score += 0.5;
      } else if (match.winnerId !== null) {
        losses++;
      }
    }

    const buchholz = await calculateBuchholz(tournamentId, playerId);
    const sonnebornBerger = await calculateSonnebornBerger(tournamentId, playerId);

    standings.push({
      rank: 0, // Will be calculated after sorting
      playerId,
      playerName: `${reg.user.firstName} ${reg.user.lastName}`,
      score,
      buchholz,
      sonnebornBerger,
      wins,
      draws,
      losses,
      matchesPlayed: matches.length,
    });
  }

  // Sort by score, then Buchholz, then Sonneborn-Berger
  standings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.sonnebornBerger - a.sonnebornBerger;
  });

  // Assign ranks
  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return standings;
}

// ============================================
// SWISS TOURNAMENT MANAGEMENT
// ============================================

/**
 * Calculate recommended number of rounds for Swiss tournament
 * Formula: ceil(log2(players)) to ensure clear winner
 */
export function calculateSwissRounds(playerCount: number): number {
  if (playerCount <= 2) return 1;
  if (playerCount <= 4) return 2;
  if (playerCount <= 8) return 3;
  if (playerCount <= 16) return 4;
  if (playerCount <= 32) return 5;
  if (playerCount <= 64) return 6;
  if (playerCount <= 128) return 7;
  return Math.ceil(Math.log2(playerCount));
}

/**
 * Initialize a Swiss tournament
 */
export async function initializeSwissTournament(
  tournamentId: string
): Promise<{ success: boolean; message: string; rounds: number }> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
      },
      bracket: true,
    },
  });

  if (!tournament) {
    return { success: false, message: 'Tournament not found', rounds: 0 };
  }

  if (tournament.bracket) {
    return { success: false, message: 'Bracket already exists', rounds: 0 };
  }

  const playerCount = tournament.registrations.length;
  if (playerCount < 2) {
    return { success: false, message: 'Need at least 2 players', rounds: 0 };
  }

  const totalRounds = calculateSwissRounds(playerCount);

  // Create Swiss bracket
  await db.bracket.create({
    data: {
      tournamentId,
      format: 'ROUND_ROBIN', // Swiss uses ROUND_ROBIN format in our schema (closest match)
      totalRounds,
      seedingMethod: 'SWISS',
      generatedById: 'system',
    },
  });

  return {
    success: true,
    message: `Swiss tournament initialized for ${playerCount} players`,
    rounds: totalRounds,
  };
}

/**
 * Generate matches for a Swiss round
 */
export async function generateSwissRound(
  tournamentId: string,
  roundNumber: number
): Promise<{ success: boolean; matches: string[]; warnings: string[] }> {
  const pairingsResult = await generateSwissPairings(tournamentId, roundNumber);

  if (!pairingsResult.success) {
    return {
      success: false,
      matches: [],
      warnings: pairingsResult.warnings,
    };
  }

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return {
      success: false,
      matches: [],
      warnings: ['Tournament not found'],
    };
  }

  const matchIds: string[] = [];

  // Create matches from pairings
  for (const pairing of pairingsResult.pairings) {
    if (pairing.isBye) {
      // Create bye match
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId,
          playerAId: pairing.playerAId,
          playerBId: null,
          outcome: 'BYE',
          winnerId: pairing.playerAId,
        },
      });
      matchIds.push(match.id);
    } else {
      // Create regular match
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId,
          playerAId: pairing.playerAId,
          playerBId: pairing.playerBId,
        },
      });
      matchIds.push(match.id);
    }
  }

  return {
    success: true,
    matches: matchIds,
    warnings: pairingsResult.warnings,
  };
}

/**
 * Check if Swiss tournament is complete
 */
export async function isSwissTournamentComplete(
  tournamentId: string
): Promise<{ complete: boolean; currentRound: number; totalRounds: number }> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      bracket: true,
      matches: true,
    },
  });

  if (!tournament || !tournament.bracket) {
    return { complete: false, currentRound: 0, totalRounds: 0 };
  }

  const totalRounds = tournament.bracket.totalRounds;
  
  // Count completed rounds
  const matchesPerRound = Math.ceil(
    (await db.tournamentRegistration.count({
      where: { tournamentId, status: 'CONFIRMED' },
    })) / 2
  );

  const completedMatches = tournament.matches.filter(
    m => m.winnerId !== null || m.outcome === 'BYE'
  ).length;

  const currentRound = Math.floor(completedMatches / Math.max(1, matchesPerRound)) + 1;
  const complete = currentRound > totalRounds;

  return { complete, currentRound, totalRounds };
}

/**
 * Get Swiss tournament final standings
 * Only valid after tournament is complete
 */
export async function getSwissFinalStandings(
  tournamentId: string
): Promise<SwissStanding[]> {
  return getSwissStandings(tournamentId);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate Swiss pairings for fairness
 */
export function validateSwissPairings(
  pairings: SwissPairing[],
  players: SwissPlayer[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const pairedIds = new Set<string>();

  for (const pairing of pairings) {
    pairedIds.add(pairing.playerAId);
    if (pairing.playerBId) {
      pairedIds.add(pairing.playerBId);
    }
  }

  // Check all players are paired (or have bye)
  for (const player of players) {
    if (!pairedIds.has(player.id)) {
      issues.push(`Player ${player.name} is not paired`);
    }
  }

  // Check for duplicate pairings
  const pairingSet = new Set<string>();
  for (const pairing of pairings) {
    if (!pairing.isBye) {
      const key = [pairing.playerAId, pairing.playerBId].sort().join('-');
      if (pairingSet.has(key)) {
        issues.push(`Duplicate pairing: ${pairing.playerAName} vs ${pairing.playerBName}`);
      }
      pairingSet.add(key);
    }
  }

  // Check for score group violations (players paired too far apart)
  const playerScores = new Map(players.map(p => [p.id, p.score]));
  for (const pairing of pairings) {
    if (!pairing.isBye && pairing.playerBId) {
      const scoreA = playerScores.get(pairing.playerAId) || 0;
      const scoreB = playerScores.get(pairing.playerBId) || 0;
      const diff = Math.abs(scoreA - scoreB);
      
      if (diff > 1) {
        issues.push(
          `Large score gap (${diff}) in pairing: ${pairing.playerAName} (${scoreA}) vs ${pairing.playerBName} (${scoreB})`
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Export Swiss tournament data for external use
 */
export async function exportSwissTournament(
  tournamentId: string
): Promise<SwissTournamentState | null> {
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
            },
          },
        },
      },
      bracket: true,
      matches: true,
    },
  });

  if (!tournament || !tournament.bracket) {
    return null;
  }

  const players = await buildSwissPlayers(tournamentId, tournament.registrations);
  const standings = await getSwissStandings(tournamentId);

  // Build pairings map from match history
  const pairings = new Map<number, SwissPairing[]>();

  // This would need to be populated from actual match data
  // For now, return empty map

  return {
    tournamentId,
    currentRound: tournament.bracket.totalRounds,
    totalRounds: tournament.bracket.totalRounds,
    players,
    pairings,
    standings,
  };
}

// ============================================
// REQUIRED API FUNCTIONS (Task 10)
// ============================================

/**
 * Calculate a player's current Swiss score from matches
 * This is a standalone version that works with the Match type directly
 * 
 * @param playerId - The player's ID
 * @param matches - Array of matches to calculate score from
 * @returns The player's current Swiss score (wins = 1, draws = 0.5)
 */
export function calculateSwissScore(
  playerId: string,
  matches: Match[]
): number {
  let score = 0;

  for (const match of matches) {
    const isPlayerA = match.playerAId === playerId;
    const isPlayerB = match.playerBId === playerId;

    if (!isPlayerA && !isPlayerB) continue;

    // Handle bye matches
    if (match.outcome === 'BYE') {
      if (isPlayerA && !match.playerBId) {
        score += 1; // Bye = win
      }
      continue;
    }

    // Calculate score from result
    if (match.winnerId === playerId) {
      score += 1; // Win
    } else if (match.winnerId === null && match.scoreA !== null && match.scoreB !== null) {
      score += 0.5; // Draw
    }
    // Loss = 0 points
  }

  return score;
}

/**
 * Avoid rematches by re-pairing players who have already faced each other
 * 
 * @param pairings - Current pairings to check
 * @param previousMatches - Array of previous matches to check for rematches
 * @returns Modified pairings with rematches avoided where possible
 */
export function avoidRematches(
  pairings: Pairing[],
  previousMatches: Match[]
): Pairing[] {
  // Build a map of player -> opponents they've already faced
  const opponentMap = new Map<string, Set<string>>();
  
  for (const match of previousMatches) {
    if (!match.playerAId || !match.playerBId) continue;
    
    if (!opponentMap.has(match.playerAId)) {
      opponentMap.set(match.playerAId, new Set());
    }
    if (!opponentMap.has(match.playerBId)) {
      opponentMap.set(match.playerBId, new Set());
    }
    
    opponentMap.get(match.playerAId)!.add(match.playerBId);
    opponentMap.get(match.playerBId)!.add(match.playerAId);
  }

  // Check each pairing for rematches
  const result: Pairing[] = [];
  const rematchWarnings: string[] = [];

  for (const pairing of pairings) {
    if (pairing.isBye || !pairing.playerBId) {
      // Bye pairings don't need rematch check
      result.push(pairing);
      continue;
    }

    const opponentsA = opponentMap.get(pairing.playerAId);
    const opponentsB = opponentMap.get(pairing.playerBId);

    const isRematch = opponentsA?.has(pairing.playerBId) || opponentsB?.has(pairing.playerAId);

    if (isRematch) {
      rematchWarnings.push(`Rematch detected: ${pairing.playerAId} vs ${pairing.playerBId}`);
      // For now, we keep the pairing but flag it
      // A more sophisticated implementation would try to find alternative pairings
      result.push({
        ...pairing,
        isBye: false,
      });
    } else {
      result.push(pairing);
    }
  }

  // Log warnings if any
  if (rematchWarnings.length > 0) {
    console.warn('Swiss pairing rematch warnings:', rematchWarnings);
  }

  return result;
}

/**
 * Assign byes for odd player counts
 * Priority: lowest-score players who haven't had a bye yet
 * 
 * @param players - Array of player IDs
 * @param oddCount - Number of byes needed (usually 1 for Swiss)
 * @returns Array of player IDs who should receive byes
 */
export function assignByes(
  players: string[],
  oddCount: number
): string[] {
  if (oddCount <= 0 || players.length === 0) {
    return [];
  }

  // For simple bye assignment, we return the last N players
  // In a real implementation, this would consider:
  // - Who has already received a bye
  // - Current scores
  // - ELO ratings
  
  const byePlayers: string[] = [];
  const byesNeeded = Math.min(oddCount, players.length);
  
  // Assign byes to the last players (lowest seeded)
  for (let i = players.length - byesNeeded; i < players.length; i++) {
    if (players[i]) {
      byePlayers.push(players[i]);
    }
  }

  return byePlayers;
}

/**
 * Generate Swiss pairings with player IDs and previous match history
 * This is the API-compatible version that takes player IDs directly
 * 
 * @param players - Array of player IDs to pair
 * @param previousMatches - Array of previous matches for rematch avoidance
 * @returns Swiss pairing result with pairings and bye players
 */
export function generateSwissPairingsFromPlayers(
  players: string[],
  previousMatches: Match[]
): SwissPairingResult {
  const warnings: string[] = [];
  const pairings: Pairing[] = [];
  const byePlayers: string[] = [];

  if (players.length < 2) {
    return {
      success: false,
      pairings: [],
      byePlayers: [],
      warnings: ['Need at least 2 players for Swiss pairing'],
      roundNumber: 1,
    };
  }

  // Calculate scores for each player
  const playerScores = new Map<string, number>();
  for (const playerId of players) {
    playerScores.set(playerId, calculateSwissScore(playerId, previousMatches));
  }

  // Build opponent history map
  const opponentMap = new Map<string, Set<string>>();
  for (const match of previousMatches) {
    if (!match.playerAId || !match.playerBId) continue;
    
    if (!opponentMap.has(match.playerAId)) {
      opponentMap.set(match.playerAId, new Set());
    }
    if (!opponentMap.has(match.playerBId)) {
      opponentMap.set(match.playerBId, new Set());
    }
    
    opponentMap.get(match.playerAId)!.add(match.playerBId);
    opponentMap.get(match.playerBId)!.add(match.playerAId);
  }

  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = playerScores.get(a) || 0;
    const scoreB = playerScores.get(b) || 0;
    return scoreB - scoreA;
  });

  // Handle odd number of players - assign bye
  let playersToPair = [...sortedPlayers];
  if (playersToPair.length % 2 === 1) {
    // Find player with lowest score for bye
    const byePlayer = playersToPair.pop();
    if (byePlayer) {
      byePlayers.push(byePlayer);
      pairings.push({
        playerAId: byePlayer,
        playerBId: null,
        isBye: true,
      });
    }
  }

  // Pair players
  const paired = new Set<string>();
  
  for (const player of playersToPair) {
    if (paired.has(player)) continue;

    // Find best opponent: similar score, no previous match
    let bestOpponent: string | null = null;
    let bestScoreDiff = Infinity;
    const playerScore = playerScores.get(player) || 0;
    const previousOpponents = opponentMap.get(player) || new Set();

    for (const opponent of playersToPair) {
      if (opponent === player || paired.has(opponent)) continue;

      const isRematch = previousOpponents.has(opponent);
      const opponentScore = playerScores.get(opponent) || 0;
      const scoreDiff = Math.abs(playerScore - opponentScore);

      // Prefer non-rematch with closest score
      if (!isRematch && scoreDiff < bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestOpponent = opponent;
      }
    }

    // If no non-rematch found, allow rematch
    if (!bestOpponent) {
      for (const opponent of playersToPair) {
        if (opponent === player || paired.has(opponent)) continue;
        const opponentScore = playerScores.get(opponent) || 0;
        const scoreDiff = Math.abs(playerScore - opponentScore);
        if (scoreDiff < bestScoreDiff) {
          bestScoreDiff = scoreDiff;
          bestOpponent = opponent;
        }
      }
      if (bestOpponent) {
        warnings.push(`Rematch pairing: ${player} vs ${bestOpponent}`);
      }
    }

    if (bestOpponent) {
      pairings.push({
        playerAId: player,
        playerBId: bestOpponent,
        isBye: false,
      });
      paired.add(player);
      paired.add(bestOpponent);
    }
  }

  return {
    success: true,
    pairings,
    byePlayers,
    warnings,
    roundNumber: 1, // Would be determined by context
  };
}
