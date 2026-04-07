/**
 * Swiss Tournament Bracket Generation
 * 
 * Swiss format: All players play all rounds, paired with similar scores
 * No elimination - ideal for larger fields and fair competition
 */

import { db } from '@/lib/db';
import { SportType, BracketFormat } from '@prisma/client';

interface SwissPlayer {
  id: string;
  name: string;
  elo: number;
  score: number; // Points: win = 1, draw = 0.5, loss = 0
  opponents: string[];
  buchholz: number; // Tiebreaker: sum of opponents' scores
}

interface SwissPairing {
  playerAId: string;
  playerBId: string;
  round: number;
}

interface SwissRoundResult {
  pairings: SwissPairing[];
  byes: string[]; // Players who get a bye (odd player count)
}

/**
 * Generate Swiss tournament pairings for a round
 */
export function generateSwissPairings(
  players: SwissPlayer[],
  round: number
): SwissRoundResult {
  // Sort players by score (descending), then by ELO (descending)
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.elo - a.elo;
  });

  const pairings: SwissPairing[] = [];
  const byes: string[] = [];
  const paired = new Set<string>();

  // Handle odd number of players
  if (sortedPlayers.length % 2 !== 0) {
    // Give bye to lowest-score player who hasn't had a bye
    // (In a full implementation, track byes given)
    const byeCandidate = sortedPlayers[sortedPlayers.length - 1];
    byes.push(byeCandidate.id);
    paired.add(byeCandidate.id);
  }

  // Pair players from top to bottom
  for (const player of sortedPlayers) {
    if (paired.has(player.id)) continue;

    // Find best opponent: same score preferred, no rematch
    let bestOpponent: SwissPlayer | null = null;
    let bestScoreDiff = Infinity;

    for (const opponent of sortedPlayers) {
      if (paired.has(opponent.id)) continue;
      if (opponent.id === player.id) continue;
      
      // Check for previous matchup
      if (player.opponents.includes(opponent.id)) continue;

      const scoreDiff = Math.abs(player.score - opponent.score);

      // Prefer same score, then closest score
      if (scoreDiff < bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestOpponent = opponent;
      }
    }

    if (bestOpponent) {
      pairings.push({
        playerAId: player.id,
        playerBId: bestOpponent.id,
        round,
      });
      paired.add(player.id);
      paired.add(bestOpponent.id);
    }
  }

  return { pairings, byes };
}

/**
 * Calculate Buchholz tiebreaker score
 */
export function calculateBuchholz(
  playerId: string,
  players: SwissPlayer[]
): number {
  const player = players.find(p => p.id === playerId);
  if (!player) return 0;

  return player.opponents.reduce((sum, oppId) => {
    const opponent = players.find(p => p.id === oppId);
    return sum + (opponent?.score || 0);
  }, 0);
}

/**
 * Get final Swiss standings with tiebreakers
 */
export function getSwissStandings(players: SwissPlayer[]): SwissPlayer[] {
  // Sort by score, then Buchholz, then ELO
  return [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.elo - a.elo;
  });
}

/**
 * Generate Swiss tournament brackets
 */
export async function generateSwissBracket(
  tournamentId: string,
  numberOfRounds?: number
): Promise<{
  success: boolean;
  bracketId?: string;
  rounds: number;
  players: number;
  error?: string;
}> {
  try {
    // Get tournament with registrations
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
      },
    });

    if (!tournament) {
      return { success: false, rounds: 0, players: 0, error: 'Tournament not found' };
    }

    const playerCount = tournament.registrations.length;
    if (playerCount < 2) {
      return { success: false, rounds: 0, players: 0, error: 'Need at least 2 players' };
    }

    // Calculate number of rounds (log2 of player count, rounded up)
    const rounds = numberOfRounds || Math.ceil(Math.log2(playerCount));

    // Initialize players
    const swissPlayers: SwissPlayer[] = tournament.registrations.map(r => ({
      id: r.userId,
      name: `${r.user.firstName} ${r.user.lastName}`,
      elo: r.user.hiddenElo || 1500,
      score: 0,
      opponents: [],
      buchholz: 0,
    }));

    // Create bracket record
    const bracket = await db.bracket.create({
      data: {
        tournamentId,
        format: BracketFormat.SINGLE_ELIMINATION, // Swiss doesn't have its own format
        totalRounds: rounds,
        seedingMethod: 'SWISS',
      },
    });

    // Generate all round pairings upfront
    let matchNumber = 1;
    
    for (let round = 1; round <= rounds; round++) {
      const { pairings, byes } = generateSwissPairings(swissPlayers, round);

      // Create matches for this round
      for (const pairing of pairings) {
        // Create the match record
        const match = await db.match.create({
          data: {
            tournamentId,
            player1Id: pairing.playerAId,
            player2Id: pairing.playerBId,
            status: 'PENDING',
          },
        });

        // Create bracket match
        await db.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            matchId: match.id,
            roundNumber: round,
            matchNumber: matchNumber++,
            playerAId: pairing.playerAId,
            playerBId: pairing.playerBId,
            status: 'PENDING',
          },
        });
      }

      // Handle byes - award points automatically
      for (const byePlayerId of byes) {
        const match = await db.match.create({
          data: {
            tournamentId,
            player1Id: byePlayerId,
            player2Id: null,
            status: 'COMPLETED',
            winnerId: byePlayerId,
          },
        });

        await db.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            matchId: match.id,
            roundNumber: round,
            matchNumber: matchNumber++,
            playerAId: byePlayerId,
            playerBId: null,
            status: 'BYE',
            winnerId: byePlayerId,
          },
        });

        // Update player score for bye
        const player = swissPlayers.find(p => p.id === byePlayerId);
        if (player) {
          player.score += 1; // Bye counts as a win
        }
      }
    }

    return {
      success: true,
      bracketId: bracket.id,
      rounds,
      players: playerCount,
    };
  } catch (error) {
    console.error('Error generating Swiss bracket:', error);
    return { success: false, rounds: 0, players: 0, error: 'Failed to generate bracket' };
  }
}

/**
 * Update Swiss standings after a match result
 */
export async function updateSwissStandings(
  matchId: string,
  winnerId: string | null,
  scoreA: number,
  scoreB: number
): Promise<void> {
  // Get match details
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        include: {
          bracket: true,
        },
      },
    },
  });

  if (!match || !match.tournament?.bracket) return;

  // For Swiss, update the player's score
  // This would need to track scores across all matches
  // Implementation depends on your specific scoring rules
}
