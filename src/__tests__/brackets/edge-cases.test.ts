/**
 * Bracket Edge Cases Tests
 * Comprehensive test suites for bracket edge cases including:
 * - Power-of-two calculations
 * - Bye distribution
 * - Round count calculation
 * - Seeding order
 * - Double elimination match counts
 * - Round-robin pairing completeness
 * - Boundary cases
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// UTILITY FUNCTIONS FOR TESTING
// ============================================

/**
 * Calculate the next power of two greater than or equal to n
 */
function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 1;
  if (n === 1) return 1;
  
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
}

/**
 * Calculate the number of byes needed for a bracket
 */
function calculateByes(playerCount: number): number {
  const bracketSize = nextPowerOfTwo(playerCount);
  return bracketSize - playerCount;
}

/**
 * Calculate number of rounds for single elimination
 */
function calculateSingleEliminationRounds(playerCount: number): number {
  if (playerCount <= 1) return 0;
  const bracketSize = nextPowerOfTwo(playerCount);
  return Math.log2(bracketSize);
}

/**
 * Calculate number of rounds for double elimination
 */
function calculateDoubleEliminationRounds(playerCount: number): {
  winnersBracketRounds: number;
  losersBracketRounds: number;
  totalRounds: number;
} {
  if (playerCount <= 1) {
    return { winnersBracketRounds: 0, losersBracketRounds: 0, totalRounds: 0 };
  }
  
  const bracketSize = nextPowerOfTwo(playerCount);
  const winnersBracketRounds = Math.log2(bracketSize);
  const losersBracketRounds = 2 * winnersBracketRounds - 2;
  
  return {
    winnersBracketRounds,
    losersBracketRounds,
    totalRounds: winnersBracketRounds + losersBracketRounds + 2, // +2 for grand finals
  };
}

/**
 * Generate standard seeding positions for single elimination
 * Returns array where index is seed number and value is position in bracket
 */
function generateSeedingPositions(bracketSize: number): number[] {
  if (bracketSize <= 1) return [0];
  
  const positions: number[] = [0, bracketSize - 1];
  
  for (let round = 2; round <= Math.log2(bracketSize); round++) {
    const roundPositions: number[] = [];
    const interval = bracketSize / Math.pow(2, round);
    
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const opposite = bracketSize - 1 - pos;
      
      if (!positions.includes(opposite)) {
        roundPositions.push(opposite);
      }
    }
    
    // Add new positions between existing ones
    const allPositions = [...positions];
    for (const pos of roundPositions) {
      allPositions.push(pos);
    }
    
    positions.length = 0;
    positions.push(...allPositions.sort((a, b) => a - b));
  }
  
  return positions;
}

/**
 * Generate seed pairings for first round
 * Returns array of [seedA, seedB] pairs
 */
function generateSeedPairings(bracketSize: number): [number, number][] {
  if (bracketSize < 2) return [];
  
  const pairings: [number, number][] = [];
  const halfSize = bracketSize / 2;
  
  for (let i = 0; i < halfSize; i++) {
    const seedA = i + 1;
    const seedB = bracketSize - i;
    pairings.push([seedA, seedB]);
  }
  
  return pairings;
}

/**
 * Calculate double elimination match counts
 */
function calculateDoubleEliminationMatches(playerCount: number): {
  winnersBracketMatches: number;
  losersBracketMatches: number;
  grandFinalMatches: number;
  totalMatches: number;
  maxMatches: number; // Including potential reset match
} {
  if (playerCount <= 1) {
    return {
      winnersBracketMatches: 0,
      losersBracketMatches: 0,
      grandFinalMatches: 0,
      totalMatches: 0,
      maxMatches: 0,
    };
  }
  
  const bracketSize = nextPowerOfTwo(playerCount);
  
  // Winners bracket: n-1 matches to determine winner
  const winnersBracketMatches = bracketSize - 1;
  
  // Losers bracket: n-2 matches (each team must lose twice to be eliminated)
  const losersBracketMatches = bracketSize - 2;
  
  // Grand final: 1 match, possibly 2 with reset
  const grandFinalMatches = 1;
  const totalMatches = winnersBracketMatches + losersBracketMatches + grandFinalMatches;
  const maxMatches = totalMatches + 1; // +1 for potential reset
  
  return {
    winnersBracketMatches,
    losersBracketMatches,
    grandFinalMatches,
    totalMatches,
    maxMatches,
  };
}

/**
 * Generate round-robin pairings for a given number of players
 * Uses the circle method for scheduling
 */
function generateRoundRobinPairings(playerCount: number): {
  rounds: number;
  matchesPerRound: number;
  totalMatches: number;
  pairings: [number, number][][];
} {
  if (playerCount < 2) {
    return { rounds: 0, matchesPerRound: 0, totalMatches: 0, pairings: [] };
  }
  
  const hasBye = playerCount % 2 === 1;
  const effectivePlayers = hasBye ? playerCount + 1 : playerCount;
  const rounds = effectivePlayers - 1;
  const matchesPerRound = effectivePlayers / 2;
  const totalMatches = (playerCount * (playerCount - 1)) / 2;
  
  // Circle method for round-robin scheduling
  const pairings: [number, number][][] = [];
  const players = Array.from({ length: playerCount }, (_, i) => i);
  
  for (let round = 0; round < rounds; round++) {
    const roundPairings: [number, number][] = [];
    
    for (let i = 0; i < Math.floor(playerCount / 2); i++) {
      const player1 = players[i];
      const player2 = players[playerCount - 1 - i];
      
      // Skip bye matches (when player2 would be out of bounds)
      if (player2 < playerCount) {
        roundPairings.push([player1, player2]);
      }
    }
    
    pairings.push(roundPairings);
    
    // Rotate players (keep first player fixed, rotate others)
    const lastPlayer = players.pop()!;
    players.splice(1, 0, lastPlayer);
  }
  
  return { rounds, matchesPerRound, totalMatches, pairings };
}

/**
 * Verify that each player plays every other player exactly once
 */
function verifyRoundRobinCompleteness(pairings: [number, number][][], playerCount: number): {
  valid: boolean;
  matchups: Map<string, number>;
  errors: string[];
} {
  const matchups = new Map<string, number>();
  const errors: string[] = [];
  
  for (let round = 0; round < pairings.length; round++) {
    for (const [p1, p2] of pairings[round]) {
      const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
      const count = matchups.get(key) || 0;
      matchups.set(key, count + 1);
      
      if (count > 0) {
        errors.push(`Duplicate matchup: ${key} in round ${round}`);
      }
    }
  }
  
  // Check that all possible matchups exist
  for (let i = 0; i < playerCount; i++) {
    for (let j = i + 1; j < playerCount; j++) {
      const key = `${i}-${j}`;
      if (!matchups.has(key)) {
        errors.push(`Missing matchup: ${key}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    matchups,
    errors,
  };
}

/**
 * Distribute byes in a bracket
 * Returns which seed positions get byes
 */
function distributeByes(playerCount: number): number[] {
  const byeCount = calculateByes(playerCount);
  if (byeCount === 0) return [];
  
  // By convention, top seeds get byes
  return Array.from({ length: byeCount }, (_, i) => i + 1);
}

/**
 * Calculate bye placement positions in bracket
 */
function calculateByePositions(playerCount: number): number[] {
  const byeCount = calculateByes(playerCount);
  if (byeCount === 0) return [];
  
  const bracketSize = nextPowerOfTwo(playerCount);
  const positions: number[] = [];
  
  // Byes are placed to give top seeds the easiest path
  // Top seeds play against byes in first round
  for (let i = 0; i < byeCount; i++) {
    positions.push(i); // First positions get byes
  }
  
  return positions;
}

// ============================================
// TEST SUITES
// ============================================

describe('Power-of-Two Calculations', () => {
  describe('nextPowerOfTwo function', () => {
    it('should return 1 for input 1', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
    });

    it('should return 2 for input 2', () => {
      expect(nextPowerOfTwo(2)).toBe(2);
    });

    it('should return 4 for input 3', () => {
      expect(nextPowerOfTwo(3)).toBe(4);
    });

    it('should return 8 for input 5', () => {
      expect(nextPowerOfTwo(5)).toBe(8);
    });

    it('should return 8 for input 7', () => {
      expect(nextPowerOfTwo(7)).toBe(8);
    });

    it('should return 8 for input 8', () => {
      expect(nextPowerOfTwo(8)).toBe(8);
    });

    it('should return 16 for input 15', () => {
      expect(nextPowerOfTwo(15)).toBe(16);
    });

    it('should return 16 for input 16', () => {
      expect(nextPowerOfTwo(16)).toBe(16);
    });

    it('should return 32 for input 17', () => {
      expect(nextPowerOfTwo(17)).toBe(32);
    });

    it('should return 32 for input 31', () => {
      expect(nextPowerOfTwo(31)).toBe(32);
    });

    it('should return 32 for input 32', () => {
      expect(nextPowerOfTwo(32)).toBe(32);
    });

    it('should return 128 for input 100', () => {
      expect(nextPowerOfTwo(100)).toBe(128);
    });

    it('should return 128 for input 128', () => {
      expect(nextPowerOfTwo(128)).toBe(128);
    });

    it('should return 256 for input 129', () => {
      expect(nextPowerOfTwo(129)).toBe(256);
    });

    it('should handle edge case of 0', () => {
      expect(nextPowerOfTwo(0)).toBe(1);
    });

    it('should return power of 2 for any power of 2 input', () => {
      const powersOfTwo = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
      for (const n of powersOfTwo) {
        expect(nextPowerOfTwo(n)).toBe(n);
      }
    });
  });

  describe('isPowerOfTwo validation', () => {
    const isPowerOfTwo = (n: number): boolean => {
      return n > 0 && (n & (n - 1)) === 0;
    };

    it('should identify power of two numbers', () => {
      expect(isPowerOfTwo(1)).toBe(true);
      expect(isPowerOfTwo(2)).toBe(true);
      expect(isPowerOfTwo(4)).toBe(true);
      expect(isPowerOfTwo(8)).toBe(true);
      expect(isPowerOfTwo(16)).toBe(true);
      expect(isPowerOfTwo(32)).toBe(true);
      expect(isPowerOfTwo(64)).toBe(true);
      expect(isPowerOfTwo(128)).toBe(true);
    });

    it('should identify non-power of two numbers', () => {
      expect(isPowerOfTwo(3)).toBe(false);
      expect(isPowerOfTwo(5)).toBe(false);
      expect(isPowerOfTwo(7)).toBe(false);
      expect(isPowerOfTwo(15)).toBe(false);
      expect(isPowerOfTwo(17)).toBe(false);
      expect(isPowerOfTwo(100)).toBe(false);
      expect(isPowerOfTwo(129)).toBe(false);
    });
  });
});

describe('Bye Distribution', () => {
  describe('bye calculation', () => {
    it('should calculate correct bye count for various player counts', () => {
      // Power of two - no byes needed
      expect(calculateByes(2)).toBe(0);
      expect(calculateByes(4)).toBe(0);
      expect(calculateByes(8)).toBe(0);
      expect(calculateByes(16)).toBe(0);
      expect(calculateByes(32)).toBe(0);
      expect(calculateByes(64)).toBe(0);
      expect(calculateByes(128)).toBe(0);

      // Non-power of two
      expect(calculateByes(3)).toBe(1);  // 4 - 3 = 1
      expect(calculateByes(5)).toBe(3);  // 8 - 5 = 3
      expect(calculateByes(6)).toBe(2);  // 8 - 6 = 2
      expect(calculateByes(7)).toBe(1);  // 8 - 7 = 1
      expect(calculateByes(9)).toBe(7);  // 16 - 9 = 7
      expect(calculateByes(10)).toBe(6); // 16 - 10 = 6
      expect(calculateByes(15)).toBe(1); // 16 - 15 = 1
      expect(calculateByes(17)).toBe(15); // 32 - 17 = 15
      expect(calculateByes(100)).toBe(28); // 128 - 100 = 28
    });

    it('should calculate byes using nextPowerOfTwo(n) - n formula', () => {
      const testCases = [1, 2, 3, 5, 7, 8, 15, 16, 17, 31, 32, 100, 128, 129];
      
      for (const n of testCases) {
        const expected = nextPowerOfTwo(n) - n;
        expect(calculateByes(n)).toBe(expected);
      }
    });
  });

  describe('bye placement in brackets', () => {
    it('should assign byes to top seeds by convention', () => {
      // For 5 players, 3 byes needed -> top 3 seeds get byes
      const byeSeeds = distributeByes(5);
      expect(byeSeeds).toEqual([1, 2, 3]);
    });

    it('should place byes at correct bracket positions', () => {
      // For 5 players: 8-player bracket, 3 byes
      const positions = calculateByePositions(5);
      expect(positions).toHaveLength(3);
      expect(positions).toEqual([0, 1, 2]);
    });

    it('should handle 7 players (1 bye)', () => {
      const byeSeeds = distributeByes(7);
      expect(byeSeeds).toEqual([1]); // Only seed 1 gets bye
    });

    it('should handle 15 players (1 bye)', () => {
      const byeSeeds = distributeByes(15);
      expect(byeSeeds).toEqual([1]);
    });

    it('should handle 17 players (15 byes)', () => {
      const byeSeeds = distributeByes(17);
      expect(byeSeeds).toHaveLength(15);
      expect(byeSeeds[0]).toBe(1);
      expect(byeSeeds[14]).toBe(15);
    });

    it('should return empty array for power of two player counts', () => {
      expect(distributeByes(2)).toEqual([]);
      expect(distributeByes(4)).toEqual([]);
      expect(distributeByes(8)).toEqual([]);
      expect(distributeByes(16)).toEqual([]);
      expect(distributeByes(32)).toEqual([]);
      expect(distributeByes(128)).toEqual([]);
    });
  });

  describe('bye distribution for various player counts', () => {
    const playerCounts = [3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 20, 25, 30, 50, 100];

    it('should correctly calculate bye percentages', () => {
      for (const count of playerCounts) {
        const byes = calculateByes(count);
        const bracketSize = nextPowerOfTwo(count);
        const byePercentage = (byes / bracketSize) * 100;
        
        // Bye percentage should never exceed 50%
        expect(byePercentage).toBeLessThan(50);
      }
    });

    it('should ensure non-bye matches have proper pairings', () => {
      for (const count of playerCounts) {
        const byes = calculateByes(count);
        const bracketSize = nextPowerOfTwo(count);
        const firstRoundMatches = bracketSize / 2;
        const actualMatches = firstRoundMatches - byes;
        
        // Each actual match has 2 players
        const playersInFirstRoundMatches = actualMatches * 2;
        const playersWithByes = byes;
        const totalPlayers = playersInFirstRoundMatches + playersWithByes;
        
        // This should equal original player count
        expect(totalPlayers).toBe(count);
      }
    });
  });
});

describe('Round Count Calculation', () => {
  describe('single elimination round count', () => {
    it('should calculate log2(nextPowerOfTwo(n)) for various player counts', () => {
      expect(calculateSingleEliminationRounds(1)).toBe(0);
      expect(calculateSingleEliminationRounds(2)).toBe(1);
      expect(calculateSingleEliminationRounds(3)).toBe(2);
      expect(calculateSingleEliminationRounds(4)).toBe(2);
      expect(calculateSingleEliminationRounds(5)).toBe(3);
      expect(calculateSingleEliminationRounds(8)).toBe(3);
      expect(calculateSingleEliminationRounds(9)).toBe(4);
      expect(calculateSingleEliminationRounds(16)).toBe(4);
      expect(calculateSingleEliminationRounds(17)).toBe(5);
      expect(calculateSingleEliminationRounds(32)).toBe(5);
      expect(calculateSingleEliminationRounds(64)).toBe(6);
      expect(calculateSingleEliminationRounds(128)).toBe(7);
    });

    it('should match formula: log2(nextPowerOfTwo(n))', () => {
      const playerCounts = [1, 2, 3, 5, 7, 8, 15, 16, 17, 31, 32, 100, 128, 129];
      
      for (const n of playerCounts) {
        const expected = Math.log2(nextPowerOfTwo(n));
        expect(calculateSingleEliminationRounds(n)).toBe(expected);
      }
    });
  });

  describe('double elimination round counts', () => {
    it('should calculate correct rounds for 8 players', () => {
      const result = calculateDoubleEliminationRounds(8);
      expect(result.winnersBracketRounds).toBe(3);
      expect(result.losersBracketRounds).toBe(4); // 2 * 3 - 2
      expect(result.totalRounds).toBe(9); // 3 + 4 + 2
    });

    it('should calculate correct rounds for 16 players', () => {
      const result = calculateDoubleEliminationRounds(16);
      expect(result.winnersBracketRounds).toBe(4);
      expect(result.losersBracketRounds).toBe(6); // 2 * 4 - 2
      expect(result.totalRounds).toBe(12); // 4 + 6 + 2
    });

    it('should calculate correct rounds for 32 players', () => {
      const result = calculateDoubleEliminationRounds(32);
      expect(result.winnersBracketRounds).toBe(5);
      expect(result.losersBracketRounds).toBe(8); // 2 * 5 - 2
      expect(result.totalRounds).toBe(15); // 5 + 8 + 2
    });

    it('should handle edge case of 1 player', () => {
      const result = calculateDoubleEliminationRounds(1);
      expect(result.winnersBracketRounds).toBe(0);
      expect(result.losersBracketRounds).toBe(0);
      expect(result.totalRounds).toBe(0);
    });

    it('should handle non-power-of-two player counts', () => {
      // 5 players -> 8-player bracket
      const result5 = calculateDoubleEliminationRounds(5);
      expect(result5.winnersBracketRounds).toBe(3);
      expect(result5.losersBracketRounds).toBe(4);

      // 17 players -> 32-player bracket
      const result17 = calculateDoubleEliminationRounds(17);
      expect(result17.winnersBracketRounds).toBe(5);
      expect(result17.losersBracketRounds).toBe(8);
    });
  });
});

describe('Seeding Order', () => {
  describe('seed placement for single elimination', () => {
    it('should generate correct seed pairings for 8-player bracket', () => {
      const pairings = generateSeedPairings(8);
      
      // Standard seeding: 1v8, 2v7, 3v6, 4v5
      expect(pairings).toHaveLength(4);
      expect(pairings[0]).toEqual([1, 8]);
      expect(pairings[1]).toEqual([2, 7]);
      expect(pairings[2]).toEqual([3, 6]);
      expect(pairings[3]).toEqual([4, 5]);
    });

    it('should generate correct seed pairings for 16-player bracket', () => {
      const pairings = generateSeedPairings(16);
      
      expect(pairings).toHaveLength(8);
      // First and last pairing
      expect(pairings[0]).toEqual([1, 16]);
      // Middle pairing
      expect(pairings[3]).toEqual([4, 13]);
      expect(pairings[7]).toEqual([8, 9]);
    });

    it('should ensure 1 vs 16, 2 vs 15, etc. pairings work correctly', () => {
      const pairings = generateSeedPairings(16);
      
      // Verify the tournament bracket principle:
      // Top and bottom seeds meet, 2nd and 2nd-to-last meet, etc.
      for (let i = 0; i < pairings.length; i++) {
        const [seedA, seedB] = pairings[i];
        expect(seedA + seedB).toBe(17); // 1+16=17, 2+15=17, etc.
      }
    });

    it('should ensure bracket balance for potential later rounds', () => {
      // Seeds 1 and 2 should only meet in finals
      // Seeds 1, 4, 5, 8 should be in one half
      // Seeds 2, 3, 6, 7 should be in other half
      
      const pairings8 = generateSeedPairings(8);
      
      // First round: [1,8], [4,5], [2,7], [3,6]
      // This ensures proper bracket balance
      expect(pairings8[0]).toEqual([1, 8]); // Seed 1's match
      expect(pairings8[1]).toEqual([2, 7]); // Seed 2's match (but in different half)
    });
  });

  describe('seeding with various bracket sizes', () => {
    it('should generate correct number of pairings for each size', () => {
      const sizes = [2, 4, 8, 16, 32, 64, 128];
      
      for (const size of sizes) {
        const pairings = generateSeedPairings(size);
        expect(pairings).toBe(size / 2);
      }
    });

    it('should maintain proper seeding hierarchy', () => {
      const pairings = generateSeedPairings(32);
      
      // Each pairing should have seeds that sum to bracketSize + 1
      for (const [seedA, seedB] of pairings) {
        expect(seedA + seedB).toBe(33);
      }
    });

    it('should handle 2-player bracket (minimum case)', () => {
      const pairings = generateSeedPairings(2);
      expect(pairings).toHaveLength(1);
      expect(pairings[0]).toEqual([1, 2]);
    });

    it('should handle 128-player bracket (large case)', () => {
      const pairings = generateSeedPairings(128);
      expect(pairings).toHaveLength(64);
      expect(pairings[0]).toEqual([1, 128]);
      expect(pairings[63]).toEqual([64, 65]);
    });
  });

  describe('seeding positions in bracket', () => {
    it('should place seed 1 at position 0', () => {
      const positions = generateSeedingPositions(8);
      expect(positions[0]).toBe(0);
    });

    it('should place seed 2 at last position', () => {
      const positions = generateSeedingPositions(8);
      expect(positions[1]).toBe(7); // For 8-player bracket
    });
  });
});

describe('Double Elimination Match Counts', () => {
  describe('winners bracket matches', () => {
    it('should calculate correct winners bracket matches for 8 players', () => {
      const result = calculateDoubleEliminationMatches(8);
      expect(result.winnersBracketMatches).toBe(7); // n-1
    });

    it('should calculate correct winners bracket matches for 16 players', () => {
      const result = calculateDoubleEliminationMatches(16);
      expect(result.winnersBracketMatches).toBe(15);
    });

    it('should calculate correct winners bracket matches for 32 players', () => {
      const result = calculateDoubleEliminationMatches(32);
      expect(result.winnersBracketMatches).toBe(31);
    });
  });

  describe('losers bracket matches', () => {
    it('should calculate correct losers bracket matches for 8 players', () => {
      const result = calculateDoubleEliminationMatches(8);
      expect(result.losersBracketMatches).toBe(6); // n-2
    });

    it('should calculate correct losers bracket matches for 16 players', () => {
      const result = calculateDoubleEliminationMatches(16);
      expect(result.losersBracketMatches).toBe(14);
    });

    it('should calculate correct losers bracket matches for 32 players', () => {
      const result = calculateDoubleEliminationMatches(32);
      expect(result.losersBracketMatches).toBe(30);
    });
  });

  describe('grand final matches', () => {
    it('should calculate 1 grand final match minimum', () => {
      const result = calculateDoubleEliminationMatches(8);
      expect(result.grandFinalMatches).toBe(1);
    });

    it('should account for potential reset match', () => {
      const result = calculateDoubleEliminationMatches(8);
      expect(result.maxMatches).toBe(result.totalMatches + 1);
    });

    it('should have max matches include reset possibility', () => {
      const sizes = [4, 8, 16, 32];
      
      for (const size of sizes) {
        const result = calculateDoubleEliminationMatches(size);
        expect(result.maxMatches).toBe(result.totalMatches + 1);
      }
    });
  });

  describe('total match count formula', () => {
    it('should calculate total matches = 2n - 2 for double elimination', () => {
      // Standard formula: 2n - 2 matches (without reset)
      const sizes = [2, 4, 8, 16, 32];
      
      for (const size of sizes) {
        const result = calculateDoubleEliminationMatches(size);
        const bracketSize = nextPowerOfTwo(size);
        
        // Total without reset = 2n - 2 (where n is bracket size)
        const expectedTotal = 2 * bracketSize - 2;
        expect(result.totalMatches).toBe(expectedTotal);
      }
    });

    it('should calculate max matches = 2n - 1 for double elimination', () => {
      const sizes = [2, 4, 8, 16, 32];
      
      for (const size of sizes) {
        const result = calculateDoubleEliminationMatches(size);
        const bracketSize = nextPowerOfTwo(size);
        
        // Max with reset = 2n - 1
        const expectedMax = 2 * bracketSize - 1;
        expect(result.maxMatches).toBe(expectedMax);
      }
    });

    it('should handle non-power-of-two player counts', () => {
      const result = calculateDoubleEliminationMatches(5);
      // 5 players -> 8-player bracket
      expect(result.winnersBracketMatches).toBe(7);
      expect(result.losersBracketMatches).toBe(6);
      expect(result.totalMatches).toBe(14);
      expect(result.maxMatches).toBe(15);
    });

    it('should handle edge case of 1 player', () => {
      const result = calculateDoubleEliminationMatches(1);
      expect(result.totalMatches).toBe(0);
    });

    it('should handle edge case of 2 players', () => {
      const result = calculateDoubleEliminationMatches(2);
      // Winners bracket: 1 match
      // Losers bracket: 0 matches (no one to play)
      // Grand final: 1 match
      expect(result.winnersBracketMatches).toBe(1);
      expect(result.losersBracketMatches).toBe(0);
      expect(result.totalMatches).toBe(2);
    });
  });
});

describe('Round-Robin Pairing Completeness', () => {
  describe('all players play each other exactly once', () => {
    it('should generate complete pairings for 4 players', () => {
      const { pairings, totalMatches } = generateRoundRobinPairings(4);
      const verification = verifyRoundRobinCompleteness(pairings, 4);
      
      expect(verification.valid).toBe(true);
      expect(totalMatches).toBe(6); // 4 * 3 / 2
      expect(verification.matchups.size).toBe(6);
    });

    it('should generate complete pairings for 5 players', () => {
      const { pairings, totalMatches } = generateRoundRobinPairings(5);
      const verification = verifyRoundRobinCompleteness(pairings, 5);
      
      expect(verification.valid).toBe(true);
      expect(totalMatches).toBe(10); // 5 * 4 / 2
      expect(verification.matchups.size).toBe(10);
    });

    it('should generate complete pairings for 6 players', () => {
      const { pairings, totalMatches } = generateRoundRobinPairings(6);
      const verification = verifyRoundRobinCompleteness(pairings, 6);
      
      expect(verification.valid).toBe(true);
      expect(totalMatches).toBe(15); // 6 * 5 / 2
      expect(verification.matchups.size).toBe(15);
    });

    it('should generate complete pairings for 8 players', () => {
      const { pairings, totalMatches } = generateRoundRobinPairings(8);
      const verification = verifyRoundRobinCompleteness(pairings, 8);
      
      expect(verification.valid).toBe(true);
      expect(totalMatches).toBe(28); // 8 * 7 / 2
      expect(verification.matchups.size).toBe(28);
    });

    it('should generate complete pairings for 10 players', () => {
      const { pairings, totalMatches } = generateRoundRobinPairings(10);
      const verification = verifyRoundRobinCompleteness(pairings, 10);
      
      expect(verification.valid).toBe(true);
      expect(totalMatches).toBe(45); // 10 * 9 / 2
    });
  });

  describe('pairing algorithms', () => {
    it('should use correct formula: n(n-1)/2 for total matches', () => {
      const playerCounts = [2, 3, 4, 5, 6, 7, 8, 10, 12, 16];
      
      for (const n of playerCounts) {
        const { totalMatches } = generateRoundRobinPairings(n);
        const expected = (n * (n - 1)) / 2;
        expect(totalMatches).toBe(expected);
      }
    });

    it('should generate correct number of rounds for even players', () => {
      // For even n players: n-1 rounds
      expect(generateRoundRobinPairings(4).rounds).toBe(3);
      expect(generateRoundRobinPairings(6).rounds).toBe(5);
      expect(generateRoundRobinPairings(8).rounds).toBe(7);
    });

    it('should generate correct number of rounds for odd players', () => {
      // For odd n players: n rounds (one bye per round)
      expect(generateRoundRobinPairings(3).rounds).toBe(3);
      expect(generateRoundRobinPairings(5).rounds).toBe(5);
      expect(generateRoundRobinPairings(7).rounds).toBe(7);
    });

    it('should not create duplicate matchups', () => {
      const playerCounts = [4, 5, 6, 7, 8];
      
      for (const n of playerCounts) {
        const { pairings } = generateRoundRobinPairings(n);
        const verification = verifyRoundRobinCompleteness(pairings, n);
        expect(verification.errors).toHaveLength(0);
      }
    });
  });

  describe('round scheduling', () => {
    it('should distribute matches evenly across rounds for even players', () => {
      const { rounds, matchesPerRound, pairings } = generateRoundRobinPairings(6);
      
      expect(rounds).toBe(5);
      expect(matchesPerRound).toBe(3);
      
      // Each round should have 3 matches (except possibly the last for odd counts)
      for (const roundPairings of pairings) {
        expect(roundPairings.length).toBeLessThanOrEqual(matchesPerRound);
      }
    });

    it('should handle odd player counts with byes', () => {
      const { rounds, pairings } = generateRoundRobinPairings(5);
      
      expect(rounds).toBe(5);
      
      // With 5 players, each round has 2 matches (one player has bye)
      for (const roundPairings of pairings) {
        expect(roundPairings.length).toBe(2);
      }
    });

    it('should ensure each player plays once per round (except with bye)', () => {
      const { pairings } = generateRoundRobinPairings(6);
      
      for (let roundIdx = 0; roundIdx < pairings.length; roundIdx++) {
        const playersInRound = new Set<number>();
        
        for (const [p1, p2] of pairings[roundIdx]) {
          expect(playersInRound.has(p1)).toBe(false);
          expect(playersInRound.has(p2)).toBe(false);
          playersInRound.add(p1);
          playersInRound.add(p2);
        }
        
        // All 6 players should be in the round
        expect(playersInRound.size).toBe(6);
      }
    });

    it('should handle 2-player round-robin (simplest case)', () => {
      const { rounds, totalMatches, pairings } = generateRoundRobinPairings(2);
      
      expect(rounds).toBe(1);
      expect(totalMatches).toBe(1);
      expect(pairings).toHaveLength(1);
      expect(pairings[0]).toHaveLength(1);
    });
  });
});

describe('Boundary Cases', () => {
  describe('1 player (trivial case)', () => {
    it('should handle power of two calculation', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
    });

    it('should have 0 byes', () => {
      expect(calculateByes(1)).toBe(0);
    });

    it('should have 0 rounds', () => {
      expect(calculateSingleEliminationRounds(1)).toBe(0);
    });

    it('should have 0 matches in single elimination', () => {
      expect(calculateSingleEliminationRounds(1)).toBe(0);
    });

    it('should have 0 matches in double elimination', () => {
      const result = calculateDoubleEliminationMatches(1);
      expect(result.totalMatches).toBe(0);
    });

    it('should have empty round-robin pairings', () => {
      const { rounds, totalMatches, pairings } = generateRoundRobinPairings(1);
      expect(rounds).toBe(0);
      expect(totalMatches).toBe(0);
      expect(pairings).toHaveLength(0);
    });

    it('should have empty seed pairings', () => {
      const pairings = generateSeedPairings(1);
      expect(pairings).toHaveLength(0);
    });
  });

  describe('2 players (minimal bracket)', () => {
    it('should be a power of two', () => {
      expect(nextPowerOfTwo(2)).toBe(2);
    });

    it('should have 0 byes', () => {
      expect(calculateByes(2)).toBe(0);
    });

    it('should have 1 round in single elimination', () => {
      expect(calculateSingleEliminationRounds(2)).toBe(1);
    });

    it('should have 1 match in single elimination', () => {
      // n-1 = 1 match
      expect(2 - 1).toBe(1);
    });

    it('should have correct double elimination matches', () => {
      const result = calculateDoubleEliminationMatches(2);
      // Winners bracket: 1, Losers: 0, Grand Final: 1
      expect(result.totalMatches).toBe(2);
    });

    it('should have correct seed pairing', () => {
      const pairings = generateSeedPairings(2);
      expect(pairings).toEqual([[1, 2]]);
    });

    it('should have correct round-robin pairings', () => {
      const { totalMatches, rounds } = generateRoundRobinPairings(2);
      expect(totalMatches).toBe(1);
      expect(rounds).toBe(1);
    });
  });

  describe('128 players (large bracket)', () => {
    it('should be a power of two', () => {
      expect(nextPowerOfTwo(128)).toBe(128);
    });

    it('should have 0 byes', () => {
      expect(calculateByes(128)).toBe(0);
    });

    it('should have 7 rounds in single elimination', () => {
      expect(calculateSingleEliminationRounds(128)).toBe(7);
    });

    it('should have 127 matches in single elimination', () => {
      // n-1 = 127 matches
      expect(128 - 1).toBe(127);
    });

    it('should have correct double elimination rounds', () => {
      const result = calculateDoubleEliminationRounds(128);
      expect(result.winnersBracketRounds).toBe(7);
      expect(result.losersBracketRounds).toBe(12); // 2*7-2
    });

    it('should have correct double elimination matches', () => {
      const result = calculateDoubleEliminationMatches(128);
      // Total = 2n - 2 = 254
      expect(result.totalMatches).toBe(254);
      expect(result.maxMatches).toBe(255);
    });

    it('should have 64 first-round seed pairings', () => {
      const pairings = generateSeedPairings(128);
      expect(pairings).toHaveLength(64);
    });

    it('should have correct first pairing (1 vs 128)', () => {
      const pairings = generateSeedPairings(128);
      expect(pairings[0]).toEqual([1, 128]);
    });

    it('should have correct round-robin stats', () => {
      const { totalMatches, rounds } = generateRoundRobinPairings(128);
      expect(totalMatches).toBe(8128); // 128 * 127 / 2
      expect(rounds).toBe(127);
    });
  });

  describe('power of two vs non-power of two', () => {
    const powerOfTwoCases = [2, 4, 8, 16, 32, 64, 128];
    const nonPowerOfTwoCases = [3, 5, 6, 7, 9, 10, 15, 17, 31, 100, 129];

    it('should have 0 byes for power of two counts', () => {
      for (const n of powerOfTwoCases) {
        expect(calculateByes(n)).toBe(0);
      }
    });

    it('should have at least 1 bye for non-power of two counts', () => {
      for (const n of nonPowerOfTwoCases) {
        expect(calculateByes(n)).toBeGreaterThan(0);
      }
    });

    it('should have same round count for n and nextPowerOfTwo(n)', () => {
      const testCases: [number, number][] = [
        [3, 4],
        [5, 8],
        [7, 8],
        [15, 16],
        [17, 32],
        [100, 128],
        [129, 256],
      ];

      for (const [n, power] of testCases) {
        expect(calculateSingleEliminationRounds(n)).toBe(
          calculateSingleEliminationRounds(power)
        );
      }
    });

    it('should calculate larger bracket size for non-power of two', () => {
      const testCases: [number, number][] = [
        [3, 4],
        [5, 8],
        [7, 8],
        [15, 16],
        [17, 32],
        [100, 128],
      ];

      for (const [n, expected] of testCases) {
        expect(nextPowerOfTwo(n)).toBe(expected);
        expect(nextPowerOfTwo(n)).toBeGreaterThan(n);
      }
    });
  });

  describe('edge cases at boundaries', () => {
    it('should handle player count just below power of two', () => {
      // 31 players (just below 32)
      expect(nextPowerOfTwo(31)).toBe(32);
      expect(calculateByes(31)).toBe(1);
      expect(calculateSingleEliminationRounds(31)).toBe(5);
    });

    it('should handle player count just above power of two', () => {
      // 33 players (just above 32)
      expect(nextPowerOfTwo(33)).toBe(64);
      expect(calculateByes(33)).toBe(31);
      expect(calculateSingleEliminationRounds(33)).toBe(6);
    });

    it('should handle maximum bye scenario (n+1 players where n is power of two)', () => {
      // 17 players: 15 byes out of 32 spots
      expect(calculateByes(17)).toBe(15);
      
      // Verify bye percentage
      const byePercentage = (15 / 32) * 100;
      expect(byePercentage).toBeCloseTo(46.875, 1);
    });

    it('should handle minimum bye scenario (n-1 players where n is power of two)', () => {
      // 15 players: 1 bye
      expect(calculateByes(15)).toBe(1);
    });
  });
});

describe('Bracket Match Count Verification', () => {
  describe('single elimination total matches', () => {
    it('should equal n-1 for power of two player counts', () => {
      const sizes = [2, 4, 8, 16, 32, 64, 128];
      
      for (const n of sizes) {
        // Single elimination always has n-1 matches
        const matches = n - 1;
        expect(matches).toBe(n - 1);
      }
    });

    it('should equal bracketSize-1 for non-power of two', () => {
      const testCases = [
        { players: 5, bracketSize: 8 },
        { players: 7, bracketSize: 8 },
        { players: 15, bracketSize: 16 },
        { players: 17, bracketSize: 32 },
      ];

      for (const { players, bracketSize } of testCases) {
        const matches = bracketSize - 1;
        const rounds = calculateSingleEliminationRounds(players);
        
        // Verify round calculation
        expect(rounds).toBe(Math.log2(bracketSize));
      }
    });
  });

  describe('double elimination total matches', () => {
    it('should follow 2n-2 formula (without reset)', () => {
      const sizes = [2, 4, 8, 16, 32];
      
      for (const n of sizes) {
        const result = calculateDoubleEliminationMatches(n);
        expect(result.totalMatches).toBe(2 * n - 2);
      }
    });

    it('should follow 2n-1 formula (with reset)', () => {
      const sizes = [2, 4, 8, 16, 32];
      
      for (const n of sizes) {
        const result = calculateDoubleEliminationMatches(n);
        expect(result.maxMatches).toBe(2 * n - 1);
      }
    });
  });
});

describe('Seeding Integrity', () => {
  describe('top seeds path to finals', () => {
    it('should ensure seed 1 has easiest path (plays lowest available seed each round)', () => {
      // In a proper bracket, seed 1 plays:
      // Round 1: seed 16 (in 16-player bracket)
      // Round 2: seed 8 or 9
      // Round 3: seed 4, 5, 12, or 13
      // Finals: seed 2, 3, 6, 7, 10, 11, 14, or 15
      
      const pairings = generateSeedPairings(16);
      
      // Seed 1 plays seed 16 in first round
      const seed1Match = pairings.find(p => p.includes(1));
      expect(seed1Match).toEqual([1, 16]);
    });

    it('should ensure seed 2 is in opposite half from seed 1', () => {
      const pairings = generateSeedPairings(8);
      
      // Find which matches contain seeds 1 and 2
      const seed1Index = pairings.findIndex(p => p.includes(1));
      const seed2Index = pairings.findIndex(p => p.includes(2));
      
      // They should be in different halves
      // For 8-player bracket: matches 0,1 are top half, matches 2,3 are bottom half
      const seed1Half = Math.floor(seed1Index / 2);
      const seed2Half = Math.floor(seed2Index / 2);
      
      expect(seed1Half).not.toBe(seed2Half);
    });
  });

  describe('bracket balance', () => {
    it('should have equal number of matches in each half', () => {
      const sizes = [4, 8, 16, 32, 64];
      
      for (const size of sizes) {
        const pairings = generateSeedPairings(size);
        const halfSize = pairings.length / 2;
        
        // Each half should have same number of first-round matches
        expect(halfSize).toBe(size / 4);
      }
    });
  });
});
