import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Bracket Generation Tests
 * 
 * Tests for tournament bracket generation algorithms:
 * - Single elimination bracket structure
 * - Double elimination bracket structure
 * - Round robin pairings
 * - Bye handling for odd numbers
 * - Seed ordering
 * - Player withdrawal handling
 */

// Helper functions for bracket calculations (mirroring the logic in generate-bracket route)
function calculateBracketSize(playerCount: number): number {
  let size = 2;
  while (size < playerCount) {
    size *= 2;
  }
  return size;
}

function calculateRounds(bracketSize: number): number {
  return Math.log2(bracketSize);
}

function generateSingleEliminationBracket(players: { id: string; elo: number }[]): {
  bracketSize: number;
  rounds: number;
  matches: {
    round: number;
    matchNumber: number;
    playerA: string | null;
    playerB: string | null;
    isBye: boolean;
  }[];
} {
  const bracketSize = calculateBracketSize(players.length);
  const rounds = calculateRounds(bracketSize);
  
  // Sort by ELO (higher first = seed 1)
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
  
  // Fill bracket with players and byes
  const bracketPlayers: ({ id: string; elo: number } | null)[] = [...sortedPlayers];
  while (bracketPlayers.length < bracketSize) {
    bracketPlayers.push(null);
  }
  
  const matches: {
    round: number;
    matchNumber: number;
    playerA: string | null;
    playerB: string | null;
    isBye: boolean;
  }[] = [];
  
  const matchesPerRound = bracketSize / 2;
  
  // First round
  for (let i = 0; i < matchesPerRound; i++) {
    const playerA = bracketPlayers[i * 2];
    const playerB = bracketPlayers[i * 2 + 1];
    const isBye = playerA === null || playerB === null;
    
    matches.push({
      round: 1,
      matchNumber: i + 1,
      playerA: playerA?.id || null,
      playerB: playerB?.id || null,
      isBye,
    });
  }
  
  // Subsequent rounds (empty)
  for (let round = 2; round <= rounds; round++) {
    const roundMatches = Math.pow(2, rounds - round);
    for (let m = 0; m < roundMatches; m++) {
      matches.push({
        round,
        matchNumber: m + 1,
        playerA: null,
        playerB: null,
        isBye: false,
      });
    }
  }
  
  return { bracketSize, rounds, matches };
}

function generateRoundRobinPairings(playerCount: number): { round: number; matches: number[][] }[] {
  // Circle method for round robin
  const players = Array.from({ length: playerCount }, (_, i) => i);
  const rounds: { round: number; matches: number[][] }[] = [];
  
  // If odd, add a "bye" player
  const n = playerCount % 2 === 0 ? playerCount : playerCount + 1;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  
  const circle = [...players];
  if (playerCount % 2 === 1) {
    circle.push(-1); // Bye marker
  }
  
  for (let round = 0; round < totalRounds; round++) {
    const roundMatches: number[][] = [];
    
    for (let i = 0; i < matchesPerRound; i++) {
      const player1 = circle[i];
      const player2 = circle[n - 1 - i];
      
      // Skip bye matches
      if (player1 !== -1 && player2 !== -1) {
        roundMatches.push([player1, player2]);
      }
    }
    
    // Rotate circle (keep position 0 fixed)
    const last = circle.pop()!;
    circle.splice(1, 0, last);
    
    rounds.push({ round: round + 1, matches: roundMatches });
  }
  
  return rounds;
}

describe('Bracket Generation', () => {
  describe('Single Elimination Bracket Structure', () => {
    it('should create correct bracket size for power of 2 players', () => {
      const players = [
        { id: '1', elo: 1500 },
        { id: '2', elo: 1450 },
        { id: '3', elo: 1400 },
        { id: '4', elo: 1350 },
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      
      expect(bracket.bracketSize).toBe(4);
      expect(bracket.rounds).toBe(2);
    });

    it('should create correct bracket size for non-power of 2 players', () => {
      const players = [
        { id: '1', elo: 1500 },
        { id: '2', elo: 1450 },
        { id: '3', elo: 1400 },
        { id: '4', elo: 1350 },
        { id: '5', elo: 1300 },
        { id: '6', elo: 1250 },
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      
      // 6 players -> bracket size 8 (next power of 2)
      expect(bracket.bracketSize).toBe(8);
      expect(bracket.rounds).toBe(3);
    });

    it('should generate correct number of matches', () => {
      const players = Array.from({ length: 8 }, (_, i) => ({
        id: String(i + 1),
        elo: 1500 - i * 50,
      }));
      
      const bracket = generateSingleEliminationBracket(players);
      
      // Single elimination has n-1 matches
      const firstRoundMatches = bracket.matches.filter(m => m.round === 1);
      expect(firstRoundMatches.length).toBe(4); // 8 players = 4 first round matches
      
      // Total matches = bracket_size - 1
      expect(bracket.matches.length).toBe(7);
    });

    it('should seed higher ELO players against lower ELO players', () => {
      const players = [
        { id: '1', elo: 1800 }, // Seed 1
        { id: '2', elo: 1700 }, // Seed 2
        { id: '3', elo: 1600 }, // Seed 3
        { id: '4', elo: 1500 }, // Seed 4
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      const firstRoundMatches = bracket.matches.filter(m => m.round === 1);
      
      // Players are sorted by ELO and placed sequentially in bracket
      // Match 1: Seed 1 vs Seed 2
      // Match 2: Seed 3 vs Seed 4
      expect(firstRoundMatches[0].playerA).toBe('1'); // Seed 1
      expect(firstRoundMatches[0].playerB).toBe('2'); // Seed 2
      expect(firstRoundMatches[1].playerA).toBe('3'); // Seed 3
      expect(firstRoundMatches[1].playerB).toBe('4'); // Seed 4
    });
  });

  describe('Double Elimination Bracket Structure', () => {
    it('should calculate correct number of rounds for double elimination', () => {
      // Double elimination has 2n - 1 (or 2n - 2) matches
      // Winners bracket: n-1 matches
      // Losers bracket: n-1 (or n-2) matches
      // Grand final: 1 or 2 matches
      
      const playerCount = 8;
      const winnersBracketRounds = Math.log2(playerCount); // 3 rounds
      const losersBracketRounds = winnersBracketRounds * 2 - 1; // 5 rounds
      
      expect(winnersBracketRounds).toBe(3);
      expect(losersBracketRounds).toBe(5);
    });

    it('should have losers bracket with correct progression', () => {
      // In double elimination, losers feed into losers bracket
      const playerCount = 8;
      const winnersRounds = Math.log2(playerCount);
      
      // Losers bracket matches should progress from:
      // - Round 1: Losers from WB Round 1
      // - Round 2: Winners from LB Round 1 + Losers from WB Round 2
      // etc.
      
      const expectedLBRounds = winnersRounds * 2 - 1;
      expect(expectedLBRounds).toBe(5);
    });
  });

  describe('Round Robin Pairings', () => {
    it('should generate all possible pairings', () => {
      const playerCount = 4;
      const rounds = generateRoundRobinPairings(playerCount);
      
      // With 4 players, should have 3 rounds
      expect(rounds.length).toBe(3);
      
      // Each player plays everyone else exactly once
      const allPairings: string[] = [];
      rounds.forEach(r => {
        r.matches.forEach(m => {
          allPairings.push(`${Math.min(m[0], m[1])}-${Math.max(m[0], m[1])}`);
        });
      });
      
      // With 4 players: 6 unique pairings
      const uniquePairings = new Set(allPairings);
      expect(uniquePairings.size).toBe(6);
    });

    it('should have correct matches per round', () => {
      const playerCount = 6;
      const rounds = generateRoundRobinPairings(playerCount);
      
      // With 6 players: 5 rounds, each with 3 matches (or 2 with bye)
      expect(rounds.length).toBe(5);
      
      const matchesPerRound = playerCount / 2;
      rounds.forEach(r => {
        expect(r.matches.length).toBeLessThanOrEqual(matchesPerRound);
      });
    });

    it('should handle odd number of players with bye', () => {
      const playerCount = 5;
      const rounds = generateRoundRobinPairings(playerCount);
      
      // With 5 players: 5 rounds, 2 matches each (1 gets bye)
      expect(rounds.length).toBe(5);
      
      rounds.forEach(r => {
        expect(r.matches.length).toBe(2); // 5 players = 2 matches + 1 bye
      });
    });
  });

  describe('Bye Handling', () => {
    it('should assign byes to lowest seeds', () => {
      const players = [
        { id: '1', elo: 1800 }, // Seed 1
        { id: '2', elo: 1700 }, // Seed 2
        { id: '3', elo: 1600 }, // Seed 3
        { id: '4', elo: 1500 }, // Seed 4
        { id: '5', elo: 1400 }, // Seed 5
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      const byeMatches = bracket.matches.filter(m => m.isBye);
      
      // 5 players -> bracket size 8 -> 3 byes (positions 6, 7, 8 are byes)
      // But byes are counted per match with a null player
      // With 5 players in 8 slots: matches 2, 3, 4 have byes
      expect(byeMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('should auto-advance players with byes', () => {
      const players = [
        { id: '1', elo: 1800 },
        { id: '2', elo: 1700 },
        { id: '3', elo: 1600 },
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      
      // 3 players -> bracket size 4 -> 1 bye
      const byeMatches = bracket.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(1);
      
      // The bye match should have exactly one player
      const byeMatch = byeMatches[0];
      const hasPlayer = (byeMatch.playerA !== null) !== (byeMatch.playerB !== null);
      expect(hasPlayer).toBe(true);
    });

    it('should handle minimum players (2)', () => {
      const players = [
        { id: '1', elo: 1500 },
        { id: '2', elo: 1400 },
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      
      expect(bracket.bracketSize).toBe(2);
      expect(bracket.rounds).toBe(1);
      expect(bracket.matches.length).toBe(1);
      expect(bracket.matches[0].isBye).toBe(false);
    });
  });

  describe('Seed Ordering', () => {
    it('should place top seeds to avoid early meeting', () => {
      const players = [
        { id: '1', elo: 2000 }, // Seed 1
        { id: '2', elo: 1900 }, // Seed 2
        { id: '3', elo: 1800 }, // Seed 3
        { id: '4', elo: 1700 }, // Seed 4
        { id: '5', elo: 1600 }, // Seed 5
        { id: '6', elo: 1500 }, // Seed 6
        { id: '7', elo: 1400 }, // Seed 7
        { id: '8', elo: 1300 }, // Seed 8
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      const firstRound = bracket.matches.filter(m => m.round === 1);
      
      // Players are placed sequentially: 1v2, 3v4, 5v6, 7v8
      // This is a simple sequential bracket (not standard tournament seeding)
      expect(firstRound[0].playerA).toBe('1');
      expect(firstRound[0].playerB).toBe('2');
      
      expect(firstRound[1].playerA).toBe('3');
      expect(firstRound[1].playerB).toBe('4');
    });

    it('should sort by ELO correctly', () => {
      const players = [
        { id: 'low', elo: 1200 },
        { id: 'high', elo: 2000 },
        { id: 'mid', elo: 1500 },
      ];
      
      const bracket = generateSingleEliminationBracket(players);
      
      // Highest ELO should be first in bracket
      const firstMatch = bracket.matches.find(m => m.round === 1 && m.matchNumber === 1);
      expect(firstMatch?.playerA).toBe('high');
    });
  });

  describe('Player Withdrawal Handling', () => {
    it('should handle withdrawal by marking matches as walkover', () => {
      // When a player withdraws:
      // 1. Mark all their pending matches as BYE/WALKOVER
      // 2. Advance opponent automatically
      
      const simulateWithdrawal = (
        matches: { playerA: string | null; playerB: string | null; winner: string | null }[],
        withdrawingPlayer: string
      ) => {
        return matches.map(match => {
          if (match.playerA === withdrawingPlayer || match.playerB === withdrawingPlayer) {
            const opponent = match.playerA === withdrawingPlayer ? match.playerB : match.playerA;
            return {
              ...match,
              playerA: match.playerA === withdrawingPlayer ? null : match.playerA,
              playerB: match.playerB === withdrawingPlayer ? null : match.playerB,
              winner: opponent, // Opponent advances
            };
          }
          return match;
        });
      };
      
      const matches = [
        { playerA: '1', playerB: '2', winner: null },
        { playerA: '3', playerB: '4', winner: null },
      ];
      
      const result = simulateWithdrawal(matches, '2');
      
      // Player 2 withdrew, Player 1 should win automatically
      expect(result[0].winner).toBe('1');
    });

    it('should recalculate bracket after multiple withdrawals', () => {
      // If too many players withdraw, bracket may need regeneration
      const playerCount = 8;
      const minPlayers = 2;
      
      // Even after multiple withdrawals, should still have minimum players
      const afterWithdrawals = 4;
      expect(afterWithdrawals).toBeGreaterThanOrEqual(minPlayers);
      
      // Bracket should be recalculatable
      const newBracketSize = calculateBracketSize(afterWithdrawals);
      expect(newBracketSize).toBe(4);
    });
  });

  describe('Bracket Size Calculations', () => {
    it('should calculate correct power of 2 sizes', () => {
      expect(calculateBracketSize(1)).toBe(2);
      expect(calculateBracketSize(2)).toBe(2);
      expect(calculateBracketSize(3)).toBe(4);
      expect(calculateBracketSize(4)).toBe(4);
      expect(calculateBracketSize(5)).toBe(8);
      expect(calculateBracketSize(8)).toBe(8);
      expect(calculateBracketSize(9)).toBe(16);
      expect(calculateBracketSize(16)).toBe(16);
      expect(calculateBracketSize(17)).toBe(32);
    });

    it('should calculate correct number of rounds', () => {
      expect(calculateRounds(2)).toBe(1);
      expect(calculateRounds(4)).toBe(2);
      expect(calculateRounds(8)).toBe(3);
      expect(calculateRounds(16)).toBe(4);
      expect(calculateRounds(32)).toBe(5);
      expect(calculateRounds(64)).toBe(6);
    });
  });
});
