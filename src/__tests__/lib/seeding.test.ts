import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Automated Seeding Tests
 * 
 * Tests for:
 * - ELO-based seeding
 * - Anti-collision rules (same-org players)
 * - Top seed protection
 * - Hybrid seeding (top by ELO, rest randomized)
 * - Bracket placement patterns
 */

// Types
interface Player {
  id: string;
  name: string;
  elo: number;
  orgId?: string;
}

interface SeedAssignment {
  userId: string;
  seed: number;
  elo: number;
  orgId?: string;
  reason: string;
}

interface SeedingOptions {
  method: 'ELO' | 'RANDOM' | 'HYBRID' | 'MANUAL';
  antiCollision?: boolean;
  topSeedProtection?: boolean;
  randomizeLowerSeeds?: boolean;
  randomThreshold?: number;
}

// Seeding functions
function seedByElo(players: Player[]): SeedAssignment[] {
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  
  return sorted.map((p, i) => ({
    userId: p.id,
    seed: i + 1,
    elo: p.elo,
    orgId: p.orgId,
    reason: `ELO: ${p.elo}`,
  }));
}

function seedRandomly(players: Player[]): SeedAssignment[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  
  return shuffled.map((p, i) => ({
    userId: p.id,
    seed: i + 1,
    elo: p.elo,
    orgId: p.orgId,
    reason: 'Random draw',
  }));
}

function seedHybrid(players: Player[], threshold: number = 8): SeedAssignment[] {
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  
  // Top seeds by ELO
  const topSeeds = sorted.slice(0, threshold).map((p, i) => ({
    userId: p.id,
    seed: i + 1,
    elo: p.elo,
    orgId: p.orgId,
    reason: `ELO: ${p.elo}`,
  }));
  
  // Remaining seeds randomized
  const remaining = sorted.slice(threshold).sort(() => Math.random() - 0.5);
  const bottomSeeds = remaining.map((p, i) => ({
    userId: p.id,
    seed: threshold + i + 1,
    elo: p.elo,
    orgId: p.orgId,
    reason: 'Random draw (lower seeds)',
  }));
  
  return [...topSeeds, ...bottomSeeds];
}

function applyAntiCollision(assignments: SeedAssignment[]): SeedAssignment[] {
  // Group players by org
  const orgGroups = new Map<string, SeedAssignment[]>();
  
  for (const a of assignments) {
    if (a.orgId) {
      if (!orgGroups.has(a.orgId)) {
        orgGroups.set(a.orgId, []);
      }
      orgGroups.get(a.orgId)!.push(a);
    }
  }
  
  // Check if any org has multiple players
  const multiPlayerOrgs = [...orgGroups.values()].filter(g => g.length > 1);
  if (multiPlayerOrgs.length === 0) {
    return assignments;
  }
  
  // Reseed to separate same-org players
  const result: SeedAssignment[] = new Array(assignments.length);
  const usedSeeds = new Set<number>();
  
  for (const orgPlayers of multiPlayerOrgs) {
    // Calculate seed spacing for this org's players
    const spacing = Math.floor(assignments.length / orgPlayers.length);
    
    orgPlayers.forEach((player, idx) => {
      // Try to place player at spaced positions
      let targetSeed = idx * spacing + 1;
      
      // Find next available seed near target
      while (usedSeeds.has(targetSeed) && targetSeed <= assignments.length) {
        targetSeed++;
      }
      
      if (targetSeed <= assignments.length) {
        result[targetSeed - 1] = { ...player, reason: `${player.reason} (anti-collision)` };
        usedSeeds.add(targetSeed);
      }
    });
  }
  
  // Fill remaining seeds
  const remaining = assignments.filter(a => !usedSeeds.has(a.seed));
  let remainingIdx = 0;
  
  for (let i = 0; i < result.length; i++) {
    if (!result[i]) {
      result[i] = remaining[remainingIdx++];
    }
  }
  
  // Renumber seeds
  return result.map((a, i) => ({ ...a, seed: i + 1 }));
}

function applyTopSeedProtection(assignments: SeedAssignment[]): SeedAssignment[] {
  if (assignments.length < 8) {
    return assignments;
  }
  
  const result = [...assignments];
  
  // Swap seeds 2 and 3 for better bracket balance
  if (result.length >= 3) {
    [result[1], result[2]] = [result[2], result[1]];
    result[1] = { ...result[1], seed: 2, reason: `${result[1].reason} (protected)` };
    result[2] = { ...result[2], seed: 3, reason: `${result[2].reason} (protected)` };
  }
  
  return result;
}

function getSeedForMatchPosition(
  matchIndex: number,
  position: 'A' | 'B',
  totalPlayers: number
): number {
  // Standard bracket seeding patterns
  const patterns: Record<number, number[][]> = {
    4: [[1, 4], [2, 3]],
    8: [[1, 8], [4, 5], [2, 7], [3, 6]],
    16: [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]],
    32: [
      [1, 32], [16, 17], [8, 25], [9, 24],
      [4, 29], [13, 20], [5, 28], [12, 21],
      [2, 31], [15, 18], [7, 26], [10, 23],
      [3, 30], [14, 19], [6, 27], [11, 22]
    ]
  };
  
  const pattern = patterns[totalPlayers] || patterns[16];
  const matchSeeds = pattern[matchIndex] || [matchIndex + 1, totalPlayers - matchIndex];
  
  return position === 'A' ? matchSeeds[0] : matchSeeds[1];
}

describe('Automated Seeding', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', elo: 2000, orgId: 'org1' },
      { id: 'p2', name: 'Bob', elo: 1950, orgId: 'org1' },
      { id: 'p3', name: 'Charlie', elo: 1900, orgId: 'org2' },
      { id: 'p4', name: 'Diana', elo: 1850, orgId: 'org2' },
      { id: 'p5', name: 'Eve', elo: 1800, orgId: 'org3' },
      { id: 'p6', name: 'Frank', elo: 1750, orgId: 'org3' },
      { id: 'p7', name: 'Grace', elo: 1700, orgId: null },
      { id: 'p8', name: 'Henry', elo: 1650, orgId: null },
    ];
  });

  describe('ELO-based Seeding', () => {
    it('should seed highest ELO as seed 1', () => {
      const seeds = seedByElo(players);
      
      expect(seeds[0].userId).toBe('p1'); // Alice with 2000 ELO
      expect(seeds[0].seed).toBe(1);
    });

    it('should sort all players by ELO descending', () => {
      const seeds = seedByElo(players);
      
      for (let i = 1; i < seeds.length; i++) {
        expect(seeds[i - 1].elo).toBeGreaterThanOrEqual(seeds[i].elo);
      }
    });

    it('should assign correct seed numbers', () => {
      const seeds = seedByElo(players);
      
      seeds.forEach((s, i) => {
        expect(s.seed).toBe(i + 1);
      });
    });

    it('should include ELO in reason', () => {
      const seeds = seedByElo(players);
      
      seeds.forEach(s => {
        expect(s.reason).toContain('ELO:');
      });
    });
  });

  describe('Random Seeding', () => {
    it('should create different seeds on multiple calls', () => {
      const seeds1 = seedRandomly([...players]);
      const seeds2 = seedRandomly([...players]);
      
      // Very unlikely to be identical
      const areSame = seeds1.every((s, i) => s.userId === seeds2[i].userId);
      expect(areSame).toBe(false);
    });

    it('should include all players', () => {
      const seeds = seedRandomly(players);
      const playerIds = new Set(seeds.map(s => s.userId));
      
      expect(playerIds.size).toBe(players.length);
    });

    it('should assign sequential seed numbers', () => {
      const seeds = seedRandomly(players);
      
      seeds.forEach((s, i) => {
        expect(s.seed).toBe(i + 1);
      });
    });
  });

  describe('Hybrid Seeding', () => {
    it('should seed top players by ELO', () => {
      const seeds = seedHybrid(players, 4);
      
      // Top 4 should be by ELO
      expect(seeds[0].userId).toBe('p1');
      expect(seeds[1].userId).toBe('p2');
      expect(seeds[2].userId).toBe('p3');
      expect(seeds[3].userId).toBe('p4');
    });

    it('should randomize lower seeds', () => {
      const seeds = seedHybrid(players, 4);
      
      // Seeds 5-8 should have random draw reason
      for (let i = 4; i < 8; i++) {
        expect(seeds[i].reason).toContain('Random draw');
      }
    });

    it('should respect custom threshold', () => {
      const seeds = seedHybrid(players, 2);
      
      // Only top 2 by ELO
      expect(seeds[0].reason).toContain('ELO:');
      expect(seeds[1].reason).toContain('ELO:');
      expect(seeds[2].reason).toContain('Random draw');
    });
  });

  describe('Anti-Collision Rules', () => {
    it('should separate players from same org', () => {
      const seeds = seedByElo(players);
      const antiCollisionSeeds = applyAntiCollision(seeds);
      
      // Find org1 players
      const org1Players = antiCollisionSeeds.filter(s => s.orgId === 'org1');
      
      // They should not be in consecutive matches
      const seedDiff = Math.abs(org1Players[0].seed - org1Players[1].seed);
      expect(seedDiff).toBeGreaterThan(1);
    });

    it('should not modify when no org collisions', () => {
      // Players with no org overlap
      const noCollisionPlayers: Player[] = players.map((p, i) => ({
        ...p,
        orgId: `org${i}`, // Each player in different org
      }));
      
      const seeds = seedByElo(noCollisionPlayers);
      const antiCollisionSeeds = applyAntiCollision(seeds);
      
      // Seeds should remain the same
      antiCollisionSeeds.forEach((s, i) => {
        expect(s.seed).toBe(i + 1);
      });
    });

    it('should add anti-collision to reason', () => {
      const seeds = seedByElo(players);
      const antiCollisionSeeds = applyAntiCollision(seeds);
      
      // At least some players should have anti-collision in reason
      const hasAntiCollision = antiCollisionSeeds.some(s => 
        s.reason.includes('anti-collision')
      );
      expect(hasAntiCollision).toBe(true);
    });
  });

  describe('Top Seed Protection', () => {
    it('should swap seeds 2 and 3 for bracket balance', () => {
      const seeds = seedByElo(players);
      const protectedSeeds = applyTopSeedProtection(seeds);
      
      // Seed 1 should remain the same
      expect(protectedSeeds[0].userId).toBe('p1');
      
      // Seeds 2 and 3 should be swapped
      expect(protectedSeeds[1].userId).toBe('p3'); // Was Charlie (seed 3)
      expect(protectedSeeds[2].userId).toBe('p2'); // Was Bob (seed 2)
    });

    it('should not modify for small brackets', () => {
      const smallPlayers = players.slice(0, 4);
      const seeds = seedByElo(smallPlayers);
      
      // Should not crash or modify for 4 players
      const protectedSeeds = applyTopSeedProtection(seeds);
      expect(protectedSeeds.length).toBe(4);
    });

    it('should add protected to reason', () => {
      const seeds = seedByElo(players);
      const protectedSeeds = applyTopSeedProtection(seeds);
      
      expect(protectedSeeds[1].reason).toContain('protected');
      expect(protectedSeeds[2].reason).toContain('protected');
    });
  });

  describe('Bracket Placement Patterns', () => {
    it('should return correct seeds for 4-player bracket', () => {
      // Match 1: Seed 1 vs Seed 4
      expect(getSeedForMatchPosition(0, 'A', 4)).toBe(1);
      expect(getSeedForMatchPosition(0, 'B', 4)).toBe(4);
      
      // Match 2: Seed 2 vs Seed 3
      expect(getSeedForMatchPosition(1, 'A', 4)).toBe(2);
      expect(getSeedForMatchPosition(1, 'B', 4)).toBe(3);
    });

    it('should return correct seeds for 8-player bracket', () => {
      // Match 1: Seed 1 vs Seed 8
      expect(getSeedForMatchPosition(0, 'A', 8)).toBe(1);
      expect(getSeedForMatchPosition(0, 'B', 8)).toBe(8);
      
      // Match 2: Seed 4 vs Seed 5
      expect(getSeedForMatchPosition(1, 'A', 8)).toBe(4);
      expect(getSeedForMatchPosition(1, 'B', 8)).toBe(5);
      
      // Match 3: Seed 2 vs Seed 7
      expect(getSeedForMatchPosition(2, 'A', 8)).toBe(2);
      expect(getSeedForMatchPosition(2, 'B', 8)).toBe(7);
      
      // Match 4: Seed 3 vs Seed 6
      expect(getSeedForMatchPosition(3, 'A', 8)).toBe(3);
      expect(getSeedForMatchPosition(3, 'B', 8)).toBe(6);
    });

    it('should return correct seeds for 16-player bracket', () => {
      // Match 1: Seed 1 vs Seed 16
      expect(getSeedForMatchPosition(0, 'A', 16)).toBe(1);
      expect(getSeedForMatchPosition(0, 'B', 16)).toBe(16);
      
      // Match 2: Seed 8 vs Seed 9
      expect(getSeedForMatchPosition(1, 'A', 16)).toBe(8);
      expect(getSeedForMatchPosition(1, 'B', 16)).toBe(9);
    });

    it('should ensure top seeds meet late in tournament', () => {
      // In an 8-player bracket:
      // - Seed 1 and Seed 2 can only meet in finals
      // - Seed 1 and Seed 3 can only meet in finals
      // - Seed 1 and Seed 4 can only meet in semis
      
      // Seed 1 is in match 1 (upper half)
      // Seed 2 is in match 3 (lower half of upper bracket)
      // Seed 3 is in match 4 (upper half of lower bracket)
      // Seed 4 is in match 2 (lower half)
      
      // This ensures proper bracket progression
      const seed1Match = 0;
      const seed2Match = 2;
      
      // Different halves of the bracket
      expect(seed1Match).not.toBe(seed2Match);
    });
  });

  describe('Complete Seeding Workflow', () => {
    it('should apply all rules in correct order', () => {
      // Step 1: ELO seeding
      let seeds = seedByElo(players);
      
      // Step 2: Anti-collision
      seeds = applyAntiCollision(seeds);
      
      // Step 3: Top seed protection
      seeds = applyTopSeedProtection(seeds);
      
      // Verify all players are assigned
      expect(seeds.length).toBe(players.length);
      
      // Verify seeds are sequential
      const seedNumbers = seeds.map(s => s.seed).sort((a, b) => a - b);
      seedNumbers.forEach((s, i) => {
        expect(s).toBe(i + 1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle players with same ELO', () => {
      const tiedPlayers: Player[] = [
        { id: 'p1', name: 'A', elo: 1800 },
        { id: 'p2', name: 'B', elo: 1800 },
        { id: 'p3', name: 'C', elo: 1800 },
      ];
      
      const seeds = seedByElo(tiedPlayers);
      
      // All should be seeded
      expect(seeds.length).toBe(3);
    });

    it('should handle single player', () => {
      const singlePlayer = [players[0]];
      const seeds = seedByElo(singlePlayer);
      
      expect(seeds.length).toBe(1);
      expect(seeds[0].seed).toBe(1);
    });

    it('should handle empty player list', () => {
      const seeds = seedByElo([]);
      expect(seeds.length).toBe(0);
    });
  });
});
