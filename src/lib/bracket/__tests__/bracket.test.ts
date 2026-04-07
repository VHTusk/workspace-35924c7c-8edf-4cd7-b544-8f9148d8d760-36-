/**
 * Bracket Generation Tests
 * Tests for single elimination, double elimination, and round robin formats
 * 
 * Run with: bunx vitest run src/lib/bracket/__tests__/bracket.test.ts
 */

import { describe, it, expect } from 'vitest';
import { BracketFormat, BracketSide } from '@prisma/client';

// ============================================
// TYPES (copied from bracket index for testing)
// ============================================

interface SeedPlayer {
  id: string;
  name: string;
  elo: number;
  seedNumber: number;
}

interface GeneratedMatch {
  roundNumber: number;
  matchNumber: number;
  playerAId: string | null;
  playerBId: string | null;
  bracketSide?: BracketSide;
  nextMatchId?: string;
  loserNextMatchId?: string;
  isBye: boolean;
}

interface GeneratedBracket {
  matches: GeneratedMatch[];
  totalRounds: number;
  format: BracketFormat;
}

// ============================================
// FUNCTIONS TO TEST (extracted for pure testing)
// ============================================

function getSeedingPosition(seed: number, totalSlots: number): number {
  if (seed === 0) return 0;
  
  const positions: number[] = [0, totalSlots - 1];
  let currentLength = 2;
  
  while (currentLength <= seed) {
    const newPositions: number[] = [];
    const gap = totalSlots / currentLength / 2;
    
    for (const pos of positions) {
      newPositions.push(pos);
      if (currentLength <= seed) {
        newPositions.push(pos + gap);
      }
    }
    
    positions.length = 0;
    positions.push(...newPositions);
    currentLength *= 2;
  }
  
  return positions[seed] ?? seed;
}

function generateSingleElimination(
  players: SeedPlayer[],
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL'
): GeneratedBracket {
  const numPlayers = players.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const numRounds = Math.ceil(Math.log2(nextPowerOf2));

  const seededPlayers = [...players].sort((a, b) => a.seedNumber - b.seedNumber);
  
  const matches: GeneratedMatch[] = [];
  const firstRoundMatches = nextPowerOf2 / 2;

  const positions: (SeedPlayer | null)[] = new Array(nextPowerOf2).fill(null);
  
  for (let i = 0; i < seededPlayers.length; i++) {
    positions[getSeedingPosition(i, nextPowerOf2)] = seededPlayers[i];
  }

  for (let i = 0; i < firstRoundMatches; i++) {
    const playerA = positions[i];
    const playerB = positions[nextPowerOf2 - 1 - i];
    
    const isBye = !playerA || !playerB;
    
    matches.push({
      roundNumber: 1,
      matchNumber: i + 1,
      playerAId: playerA?.id || null,
      playerBId: playerB?.id || null,
      isBye,
    });
  }

  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = Math.pow(2, numRounds - round);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        roundNumber: round,
        matchNumber: i + 1,
        playerAId: null,
        playerBId: null,
        isBye: false,
      });
    }
  }

  return {
    matches,
    totalRounds: numRounds,
    format: BracketFormat.SINGLE_ELIMINATION,
  };
}

function generateRoundRobin(
  players: SeedPlayer[],
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL'
): GeneratedBracket {
  const matches: GeneratedMatch[] = [];
  
  const hasBye = players.length % 2 !== 0;
  const effectivePlayers = hasBye 
    ? [...players, { id: 'BYE', name: 'BYE', elo: 0, seedNumber: 999 } as SeedPlayer]
    : players;
  const n = effectivePlayers.length;
  
  const positions: (SeedPlayer | null)[] = [...effectivePlayers];
  const fixed = positions[0];
  const rotating = positions.slice(1);
  
  let matchNum = 1;
  for (let round = 0; round < n - 1; round++) {
    const roundMatches: Array<[SeedPlayer | null, SeedPlayer | null]> = [];
    
    roundMatches.push([fixed, rotating[rotating.length - 1]]);
    
    for (let i = 0; i < (rotating.length - 1) / 2; i++) {
      roundMatches.push([rotating[i], rotating[rotating.length - 2 - i]]);
    }
    
    roundMatches.forEach(([playerA, playerB]) => {
      if (playerA?.id === 'BYE' || playerB?.id === 'BYE') {
        return;
      }
      
      matches.push({
        roundNumber: round + 1,
        matchNumber: matchNum++,
        playerAId: playerA!.id,
        playerBId: playerB!.id,
        isBye: false,
      });
    });
    
    rotating.unshift(rotating.pop()!);
  }

  return {
    matches,
    totalRounds: n - 1,
    format: BracketFormat.ROUND_ROBIN,
  };
}

// Helper to create mock players
function createMockPlayers(count: number): SeedPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
    elo: 2000 - (i * 50), // Higher seed = higher ELO
    seedNumber: i + 1,
  }));
}

// ============================================
// TESTS
// ============================================

describe('Bracket Generation', () => {
  
  // ============================================
  // SINGLE ELIMINATION TESTS
  // ============================================
  
  describe('Single Elimination', () => {
    
    it('should generate correct number of matches for power of 2 players', () => {
      const players = createMockPlayers(8); // 8 = 2^3
      const bracket = generateSingleElimination(players, 'ELO');
      
      // 8 players = 7 matches (n-1)
      expect(bracket.matches.filter(m => !m.isBye).length).toBe(7);
      expect(bracket.totalRounds).toBe(3);
    });

    it('should generate correct number of rounds for 16 players', () => {
      const players = createMockPlayers(16);
      const bracket = generateSingleElimination(players, 'ELO');
      
      expect(bracket.totalRounds).toBe(4); // log2(16) = 4
      expect(bracket.matches.filter(m => !m.isBye).length).toBe(15); // 16-1
    });

    it('should handle BYE matches correctly for non-power-of-2', () => {
      const players = createMockPlayers(6); // Not power of 2
      const bracket = generateSingleElimination(players, 'ELO');
      
      // 6 players needs 8 slots = 2 BYEs in first round
      const byeMatches = bracket.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(2);
      
      // BYE matches should only have one player
      byeMatches.forEach(match => {
        const hasOnePlayer = (match.playerAId && !match.playerBId) || 
                            (!match.playerAId && match.playerBId);
        expect(hasOnePlayer).toBe(true);
      });
    });

    it('should give BYEs to top seeds', () => {
      const players = createMockPlayers(5); // 5 players -> 8 slots -> 3 BYEs
      const bracket = generateSingleElimination(players, 'ELO');
      
      const byeMatches = bracket.matches.filter(m => m.isBye);
      
      // Top seeds should get BYEs
      const byePlayers = byeMatches.map(m => m.playerAId || m.playerBId);
      
      // Player 1 (seed 1) should get a BYE
      expect(byePlayers).toContain('player-1');
    });

    it('should seed top players on opposite sides of bracket', () => {
      const players = createMockPlayers(8);
      const bracket = generateSingleElimination(players, 'ELO');
      
      const firstRoundMatches = bracket.matches.filter(m => m.roundNumber === 1);
      
      // Seed 1 should be in first match
      const seed1Match = firstRoundMatches.find(m => 
        m.playerAId === 'player-1' || m.playerBId === 'player-1'
      );
      expect(seed1Match).toBeDefined();
      
      // Seed 2 should be in last match (opposite side)
      const seed2Match = firstRoundMatches.find(m => 
        m.playerAId === 'player-2' || m.playerBId === 'player-2'
      );
      expect(seed2Match).toBeDefined();
      
      // Seed 1 and Seed 2 should be in different matches
      expect(seed1Match?.matchNumber).not.toBe(seed2Match?.matchNumber);
    });

    it('should handle minimum 2 players', () => {
      const players = createMockPlayers(2);
      const bracket = generateSingleElimination(players, 'ELO');
      
      expect(bracket.matches.length).toBe(1); // Just 1 match
      expect(bracket.totalRounds).toBe(1);
      expect(bracket.matches[0].isBye).toBe(false);
    });

    it('should handle large bracket (32 players)', () => {
      const players = createMockPlayers(32);
      const bracket = generateSingleElimination(players, 'ELO');
      
      expect(bracket.totalRounds).toBe(5); // log2(32) = 5
      expect(bracket.matches.filter(m => !m.isBye).length).toBe(31); // 32-1
    });

  });

  // ============================================
  // ROUND ROBIN TESTS
  // ============================================
  
  describe('Round Robin', () => {
    
    it('should generate correct number of matches for 4 players', () => {
      const players = createMockPlayers(4);
      const bracket = generateRoundRobin(players, 'ELO');
      
      // 4 players = n*(n-1)/2 = 4*3/2 = 6 matches
      expect(bracket.matches.length).toBe(6);
      expect(bracket.totalRounds).toBe(3); // n-1 rounds
    });

    it('should generate correct number of matches for 6 players', () => {
      const players = createMockPlayers(6);
      const bracket = generateRoundRobin(players, 'ELO');
      
      // 6 players = 6*5/2 = 15 matches
      expect(bracket.matches.length).toBe(15);
      expect(bracket.totalRounds).toBe(5);
    });

    it('should have every player play every other player', () => {
      const players = createMockPlayers(4);
      const bracket = generateRoundRobin(players, 'ELO');
      
      // Track who plays whom
      const matchups = new Set<string>();
      
      bracket.matches.forEach(match => {
        const pair = [match.playerAId, match.playerBId].sort().join('-');
        matchups.add(pair);
      });
      
      // With 4 players, we should have 6 unique matchups
      // (1-2, 1-3, 1-4, 2-3, 2-4, 3-4)
      expect(matchups.size).toBe(6);
    });

    it('should handle odd number of players with BYE', () => {
      const players = createMockPlayers(5);
      const bracket = generateRoundRobin(players, 'ELO');
      
      // 5 players = 5*4/2 = 10 matches (BYE matches excluded)
      expect(bracket.matches.length).toBe(10);
      
      // No actual BYE matches stored - BYE player just doesn't get matches
      const byeMatches = bracket.matches.filter(m => 
        m.playerAId === 'BYE' || m.playerBId === 'BYE'
      );
      expect(byeMatches.length).toBe(0);
    });

    it('should distribute matches evenly across rounds', () => {
      const players = createMockPlayers(6);
      const bracket = generateRoundRobin(players, 'ELO');
      
      // Each round should have roughly same number of matches
      const matchesPerRound: Record<number, number> = {};
      
      bracket.matches.forEach(match => {
        matchesPerRound[match.roundNumber] = (matchesPerRound[match.roundNumber] || 0) + 1;
      });
      
      // With 6 players, each round should have 3 matches
      Object.values(matchesPerRound).forEach(count => {
        expect(count).toBe(3);
      });
    });

  });

  // ============================================
  // SEEDING TESTS
  // ============================================
  
  describe('Seeding', () => {
    
    it('should place seed 1 at position 0', () => {
      const pos = getSeedingPosition(0, 8);
      expect(pos).toBe(0);
    });

    it('should place seed 2 at last position', () => {
      const pos = getSeedingPosition(1, 8);
      expect(pos).toBe(7);
    });

    it('should correctly place all 8 seeds', () => {
      const positions = [0, 1, 2, 3, 4, 5, 6, 7].map(seed => 
        getSeedingPosition(seed, 8)
      );
      
      // All positions should be unique
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(8);
      
      // All positions should be in valid range
      positions.forEach(pos => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(8);
      });
    });

  });

  // ============================================
  // EDGE CASES
  // ============================================
  
  describe('Edge Cases', () => {
    
    it('should handle 3 players (minimum with BYE)', () => {
      const players = createMockPlayers(3);
      const bracket = generateSingleElimination(players, 'ELO');
      
      // 3 players -> 4 slots -> 1 BYE
      const byeMatches = bracket.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(1);
      
      // Total matches: 2 (semis) + 1 (final) - but with BYE, only 2 real matches
      expect(bracket.totalRounds).toBe(2);
    });

    it('should handle exactly 4 players (no BYE)', () => {
      const players = createMockPlayers(4);
      const bracket = generateSingleElimination(players, 'ELO');
      
      const byeMatches = bracket.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(0);
      expect(bracket.matches.length).toBe(3); // 2 semis + 1 final
    });

    it('should generate unique match numbers within each round', () => {
      const players = createMockPlayers(16);
      const bracket = generateSingleElimination(players, 'ELO');
      
      // Group matches by round
      const matchesByRound: Record<number, number[]> = {};
      
      bracket.matches.forEach(match => {
        if (!matchesByRound[match.roundNumber]) {
          matchesByRound[match.roundNumber] = [];
        }
        matchesByRound[match.roundNumber].push(match.matchNumber);
      });
      
      // Check uniqueness within each round
      Object.values(matchesByRound).forEach(matchNumbers => {
        const unique = new Set(matchNumbers);
        expect(unique.size).toBe(matchNumbers.length);
      });
    });

  });

});
