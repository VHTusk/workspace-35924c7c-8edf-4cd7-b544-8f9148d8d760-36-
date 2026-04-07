/**
 * Automated Seeding Library for VALORHIVE
 * 
 * Generates tournament seedings based on player ELO ratings.
 * Supports different seeding strategies and anti-collision rules.
 * 
 * Features:
 * - ELO-based seeding
 * - Random seeding
 * - Hybrid seeding (top N by ELO, rest random)
 * - Anti-collision rules for same-org players
 * - Top seed protection for bracket balance
 */

import { db } from '@/lib/db';
import { SportType, TournamentScope } from '@prisma/client';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SeedingMethod = 'ELO' | 'RANDOM' | 'MANUAL' | 'HYBRID';

export interface SeedingOptions {
  method: SeedingMethod;
  antiCollision?: boolean; // Prevent same-org players meeting early
  topSeedProtection?: boolean; // Protect top seeds in early rounds
  randomizeLowerSeeds?: boolean; // Randomize seeds below threshold
  randomThreshold?: number; // Seed threshold for randomization
  topN?: number; // For hybrid seeding: number of top seeds by ELO
}

export interface SeedAssignment {
  userId: string;
  seed: number;
  elo: number;
  orgId?: string | null;
  reason: string;
  playerName?: string;
}

export interface SeedResult {
  success: boolean;
  seeds: SeedAssignment[];
  playerCount: number;
  method: SeedingMethod;
  warnings: string[];
  antiCollisionApplied: boolean;
  topSeedProtectionApplied: boolean;
}

// ============================================
// MAIN SEEDING FUNCTIONS
// ============================================

/**
 * Seed players by hidden ELO rating
 * Highest ELO = seed 1
 * 
 * @param playerIds - Array of player IDs to seed
 * @param sport - Optional sport type for sport-specific ELO (future use)
 */
export async function seedByElo(
  playerIds: string[],
  sport?: SportType
): Promise<SeedResult> {
  const warnings: string[] = [];

  if (playerIds.length === 0) {
    return {
      success: false,
      seeds: [],
      playerCount: 0,
      method: 'ELO',
      warnings: ['No players provided'],
      antiCollisionApplied: false,
      topSeedProtectionApplied: false,
    };
  }

  // Get player data with ELO
  const players = await db.user.findMany({
    where: { 
      id: { in: playerIds },
      // If sport is specified, filter by sport for accurate ELO
      ...(sport ? { sport } : {})
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hiddenElo: true,
      affiliatedOrgId: true,
      sport: true,
    },
  });

  // Check for missing players
  if (players.length !== playerIds.length) {
    const foundIds = new Set(players.map(p => p.id));
    const missingIds = playerIds.filter(id => !foundIds.has(id));
    warnings.push(`Missing player data for: ${missingIds.join(', ')}`);
  }

  // Sort by ELO descending
  const sorted = [...players].sort((a, b) => {
    const eloA = a.hiddenElo || 1500;
    const eloB = b.hiddenElo || 1500;
    return eloB - eloA;
  });

  const seeds: SeedAssignment[] = sorted.map((player, index) => ({
    userId: player.id,
    seed: index + 1,
    elo: player.hiddenElo || 1500,
    orgId: player.affiliatedOrgId,
    playerName: `${player.firstName} ${player.lastName}`,
    reason: `ELO: ${Math.round(player.hiddenElo || 1500)}`,
  }));

  return {
    success: true,
    seeds,
    playerCount: seeds.length,
    method: 'ELO',
    warnings,
    antiCollisionApplied: false,
    topSeedProtectionApplied: false,
  };
}

/**
 * Seed players randomly
 */
export function seedRandom(playerIds: string[]): SeedResult {
  if (playerIds.length === 0) {
    return {
      success: false,
      seeds: [],
      playerCount: 0,
      method: 'RANDOM',
      warnings: ['No players provided'],
      antiCollisionApplied: false,
      topSeedProtectionApplied: false,
    };
  }

  // Fisher-Yates shuffle
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const seeds: SeedAssignment[] = shuffled.map((id, index) => ({
    userId: id,
    seed: index + 1,
    elo: 0, // Unknown for random seeding
    orgId: null,
    reason: 'Random draw',
  }));

  return {
    success: true,
    seeds,
    playerCount: seeds.length,
    method: 'RANDOM',
    warnings: [],
    antiCollisionApplied: false,
    topSeedProtectionApplied: false,
  };
}

/**
 * Hybrid seeding: Top N players by ELO, rest randomized
 * 
 * @param playerIds - Array of player IDs to seed
 * @param topN - Number of top seeds by ELO (rest randomized)
 * @param sport - Optional sport type for sport-specific ELO (future use)
 */
export async function seedHybrid(
  playerIds: string[],
  topN: number,
  sport?: SportType
): Promise<SeedResult> {
  const warnings: string[] = [];

  if (playerIds.length === 0) {
    return {
      success: false,
      seeds: [],
      playerCount: 0,
      method: 'HYBRID',
      warnings: ['No players provided'],
      antiCollisionApplied: false,
      topSeedProtectionApplied: false,
    };
  }

  // Get player data
  const players = await db.user.findMany({
    where: { 
      id: { in: playerIds },
      ...(sport ? { sport } : {})
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hiddenElo: true,
      affiliatedOrgId: true,
      sport: true,
    },
  });

  // Adjust topN if it exceeds player count
  const actualTopN = Math.min(topN, players.length);
  if (actualTopN !== topN) {
    warnings.push(`Adjusted topN from ${topN} to ${actualTopN} due to player count`);
  }

  // Sort by ELO for top seeds
  const sorted = [...players].sort((a, b) => {
    const eloA = a.hiddenElo || 1500;
    const eloB = b.hiddenElo || 1500;
    return eloB - eloA;
  });

  // Top seeds by ELO
  const topSeeds: SeedAssignment[] = sorted.slice(0, actualTopN).map((player, index) => ({
    userId: player.id,
    seed: index + 1,
    elo: player.hiddenElo || 1500,
    orgId: player.affiliatedOrgId,
    playerName: `${player.firstName} ${player.lastName}`,
    reason: `ELO: ${Math.round(player.hiddenElo || 1500)}`,
  }));

  // Remaining seeds randomized
  const remaining = sorted.slice(actualTopN);
  // Fisher-Yates shuffle for remaining
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  const bottomSeeds: SeedAssignment[] = remaining.map((player, index) => ({
    userId: player.id,
    seed: actualTopN + index + 1,
    elo: player.hiddenElo || 1500,
    orgId: player.affiliatedOrgId,
    playerName: `${player.firstName} ${player.lastName}`,
    reason: 'Random draw (lower seeds)',
  }));

  const seeds = [...topSeeds, ...bottomSeeds];

  return {
    success: true,
    seeds,
    playerCount: seeds.length,
    method: 'HYBRID',
    warnings,
    antiCollisionApplied: false,
    topSeedProtectionApplied: false,
  };
}

// ============================================
// TOURNAMENT-LEVEL SEEDING
// ============================================

/**
 * Generate seedings for a tournament based on registration IDs
 */
export async function generateSeedings(
  tournamentId: string,
  options: SeedingOptions = { method: 'ELO' }
): Promise<SeedAssignment[]> {
  // Get tournament details
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      sport: true,
      scope: true,
      maxPlayers: true,
    }
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Get all confirmed registrations with player data
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'CONFIRMED'
    },
    include: {
      user: {
        select: {
          id: true,
          hiddenElo: true,
          visiblePoints: true,
          affiliatedOrgId: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  });

  if (registrations.length === 0) {
    return [];
  }

  // Sort and assign seeds based on method
  let assignments: SeedAssignment[];

  switch (options.method) {
    case 'ELO':
      assignments = seedByEloInternal(registrations);
      break;
    case 'RANDOM':
      assignments = seedRandomly(registrations);
      break;
    case 'HYBRID':
      assignments = seedHybridInternal(registrations, options.topN || options.randomThreshold || 8);
      break;
    case 'MANUAL':
    default:
      // For manual, return current order with placeholder seeds
      assignments = registrations.map((r, i) => ({
        userId: r.userId,
        seed: i + 1,
        elo: r.user.hiddenElo || 1500,
        orgId: r.user.affiliatedOrgId,
        playerName: `${r.user.firstName} ${r.user.lastName}`,
        reason: 'Manual order'
      }));
  }

  // Apply anti-collision if enabled
  if (options.antiCollision) {
    assignments = applyAntiCollision(assignments);
  }

  // Apply top seed protection if enabled
  if (options.topSeedProtection) {
    assignments = applyTopSeedProtection(assignments);
  }

  return assignments;
}

/**
 * Internal: Seed players by ELO rating (highest ELO = seed 1)
 */
function seedByEloInternal(
  registrations: any[]
): SeedAssignment[] {
  // Sort by ELO descending
  const sorted = [...registrations].sort((a, b) => {
    const eloA = a.user.hiddenElo || 1500;
    const eloB = b.user.hiddenElo || 1500;
    return eloB - eloA;
  });

  return sorted.map((r, i) => ({
    userId: r.userId,
    seed: i + 1,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
    playerName: `${r.user.firstName} ${r.user.lastName}`,
    reason: `ELO: ${Math.round(r.user.hiddenElo || 1500)}`
  }));
}

/**
 * Internal: Seed players randomly
 */
function seedRandomly(registrations: any[]): SeedAssignment[] {
  const shuffled = [...registrations].sort(() => Math.random() - 0.5);

  return shuffled.map((r, i) => ({
    userId: r.userId,
    seed: i + 1,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
    playerName: `${r.user.firstName} ${r.user.lastName}`,
    reason: 'Random draw'
  }));
}

/**
 * Internal: Hybrid seeding: Top players by ELO, rest randomized
 */
function seedHybridInternal(
  registrations: any[],
  topN: number
): SeedAssignment[] {
  // Sort by ELO
  const sorted = [...registrations].sort((a, b) => {
    const eloA = a.user.hiddenElo || 1500;
    const eloB = b.user.hiddenElo || 1500;
    return eloB - eloA;
  });

  // Top seeds by ELO
  const topSeeds = sorted.slice(0, topN).map((r, i) => ({
    userId: r.userId,
    seed: i + 1,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
    playerName: `${r.user.firstName} ${r.user.lastName}`,
    reason: `ELO: ${Math.round(r.user.hiddenElo || 1500)}`
  }));

  // Remaining seeds randomized
  const remaining = sorted.slice(topN).sort(() => Math.random() - 0.5);
  const bottomSeeds = remaining.map((r, i) => ({
    userId: r.userId,
    seed: topN + i + 1,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
    playerName: `${r.user.firstName} ${r.user.lastName}`,
    reason: 'Random draw (lower seeds)'
  }));

  return [...topSeeds, ...bottomSeeds];
}

// ============================================
// ANTI-COLLISION RULES
// ============================================

/**
 * Apply anti-collision rules to prevent same-org players meeting early
 * Strategy: Distribute same-org players across different bracket sections
 */
export function applyAntiCollision(assignments: SeedAssignment[]): SeedAssignment[] {
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

  // If no org has multiple players, no collision possible
  const multiPlayerOrgs = [...orgGroups.values()].filter(g => g.length > 1);
  if (multiPlayerOrgs.length === 0) {
    return assignments;
  }

  const totalPlayers = assignments.length;
  const result: (SeedAssignment | null)[] = new Array(totalPlayers).fill(null);
  const assignedIds = new Set<string>();

  // For each org with multiple players, spread them across bracket sections
  for (const orgPlayers of multiPlayerOrgs) {
    // Sort by original seed to maintain relative strength ordering
    orgPlayers.sort((a, b) => a.seed - b.seed);

    // Calculate spacing to maximize distance between same-org players
    // For bracket: top half vs bottom half, then quarters, etc.
    const spacing = Math.floor(totalPlayers / orgPlayers.length);

    orgPlayers.forEach((player, idx) => {
      // Calculate target position - spread across different bracket quarters
      // Use snake pattern to ensure maximum separation
      const sectionSize = Math.ceil(totalPlayers / 4);
      const targetSection = idx % 4;
      const positionInSection = Math.floor(idx / 4);
      
      let targetPosition: number;
      
      if (orgPlayers.length === 2) {
        // For 2 players: place one in top half, one in bottom half
        targetPosition = idx === 0 ? player.seed - 1 : Math.min(totalPlayers - 1, player.seed + Math.floor(totalPlayers / 2) - 1);
      } else if (orgPlayers.length <= 4) {
        // For 3-4 players: distribute across quarters
        targetPosition = targetSection * sectionSize + positionInSection;
      } else {
        // For more than 4: use even spacing
        targetPosition = idx * spacing;
      }

      // Find nearest available position
      let finalPosition = targetPosition;
      let offset = 0;
      
      while (finalPosition < 0 || finalPosition >= totalPlayers || result[finalPosition] !== null) {
        offset = offset <= 0 ? -offset + 1 : -offset;
        finalPosition = targetPosition + offset;
        
        if (finalPosition < 0) {
          finalPosition = 0;
          while (finalPosition < totalPlayers && result[finalPosition] !== null) {
            finalPosition++;
          }
        } else if (finalPosition >= totalPlayers) {
          finalPosition = totalPlayers - 1;
          while (finalPosition >= 0 && result[finalPosition] !== null) {
            finalPosition--;
          }
        }
        
        if (Math.abs(offset) > totalPlayers) break; // Safety break
      }

      if (finalPosition >= 0 && finalPosition < totalPlayers && result[finalPosition] === null) {
        result[finalPosition] = { 
          ...player, 
          reason: `${player.reason} (anti-collision)` 
        };
        assignedIds.add(player.userId);
      }
    });
  }

  // Fill remaining positions with unassigned players (maintaining their seed order)
  const remainingPlayers = assignments
    .filter(a => !assignedIds.has(a.userId))
    .sort((a, b) => a.seed - b.seed);

  let remainingIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      result[i] = remainingPlayers[remainingIdx++] || null;
    }
  }

  // Remove any nulls (shouldn't happen but safety check)
  const finalResult = result.filter((a): a is SeedAssignment => a !== null);

  // Renumber seeds
  return finalResult.map((a, i) => ({ ...a, seed: i + 1 }));
}

// ============================================
// TOP SEED PROTECTION
// ============================================

/**
 * Apply top seed protection for bracket balance
 * Ensures top seeds are placed optimally in the bracket
 * 
 * For single elimination:
 * - Seed 1 and 2 can only meet in finals
 * - Seed 1-4 can only meet in semi-finals
 * - Seed 1-8 can only meet in quarter-finals
 * 
 * For double elimination:
 * - Top 4 seeds distributed across different quarters
 */
export function applyTopSeedProtection(assignments: SeedAssignment[]): SeedAssignment[] {
  if (assignments.length < 4) {
    return assignments; // Not enough players for meaningful protection
  }

  const result = [...assignments];

  // Standard bracket seeding adjustment
  // This ensures proper bracket balance by adjusting positions 2-4
  // In a standard bracket:
  // - Seed 1 plays Seed 16 in Round 1 (if 16 players)
  // - Seed 2 plays Seed 15
  // - Seed 3 plays Seed 14
  // - Seed 4 plays Seed 13
  // But for bracket balance, seeds 2 and 3 are often swapped
  // so that Seed 1 and Seed 2 are on opposite sides of the bracket

  if (assignments.length >= 4) {
    // For proper bracket balance:
    // Top half: Seeds 1, 4, 5, 8, 9, 12, 13, 16...
    // Bottom half: Seeds 2, 3, 6, 7, 10, 11, 14, 15...
    
    // Apply the "snake" pattern for optimal bracket balance
    // This ensures seed 1 and 2 meet only in finals
    
    // For simplicity in our system, we ensure:
    // - Seed 1 and 2 are in opposite halves
    // - Seed 1-4 are in different quarters (for 8+ players)
    
    const reordered = applySnakePattern(result);
    return reordered.map((a, i) => ({ 
      ...a, 
      seed: i + 1,
      reason: a.reason.includes('(protected)') ? a.reason : `${a.reason} (protected)`
    }));
  }

  return result.map((a, i) => ({ ...a, seed: i + 1 }));
}

/**
 * Apply snake pattern for optimal bracket distribution
 * This ensures top seeds are properly spaced in the bracket
 */
function applySnakePattern(assignments: SeedAssignment[]): SeedAssignment[] {
  const n = assignments.length;
  
  // Find the next power of 2 >= n
  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;
  
  // Create the snake pattern mapping
  const result: SeedAssignment[] = new Array(n);
  const snakeOrder = generateSnakeOrder(bracketSize);
  
  // Map players to positions based on snake order
  for (let i = 0; i < n; i++) {
    const targetPosition = snakeOrder.indexOf(i + 1);
    if (targetPosition >= 0 && targetPosition < n) {
      result[targetPosition] = assignments[i];
    }
  }
  
  // Fill any gaps (for non-power-of-2 player counts)
  let fillIndex = 0;
  for (let i = 0; i < n; i++) {
    if (!result[i]) {
      while (fillIndex < n && snakeOrder.indexOf(fillIndex + 1) < n && result[snakeOrder.indexOf(fillIndex + 1)]) {
        fillIndex++;
      }
      if (fillIndex < n) {
        result[i] = assignments[fillIndex];
        fillIndex++;
      }
    }
  }
  
  // Final safety check - fill remaining nulls
  const assigned = new Set(result.filter(Boolean).map(a => a.userId));
  const remaining = assignments.filter(a => !assigned.has(a.userId));
  let remainingIdx = 0;
  
  for (let i = 0; i < n; i++) {
    if (!result[i]) {
      result[i] = remaining[remainingIdx++] || assignments[i];
    }
  }
  
  return result;
}

/**
 * Generate snake order for bracket seeding
 * Example for 8 players: [1, 8, 4, 5, 2, 7, 3, 6]
 * This ensures seed 1 plays seed 8 in round 1, etc.
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
// DATABASE OPERATIONS
// ============================================

/**
 * Save seedings to database (update bracket matches)
 */
export async function saveSeedings(
  tournamentId: string,
  assignments: SeedAssignment[]
): Promise<void> {
  // Get the tournament bracket
  const bracket = await db.bracket.findUnique({
    where: { tournamentId },
    include: { matches: true }
  });

  if (!bracket) {
    throw new Error('Bracket not found');
  }

  // Map seeds to first round matches
  const firstRoundMatches = bracket.matches
    .filter(m => m.roundNumber === 1)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  // Assign players to matches based on seeding
  // Standard seeding: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11 (for 16 players)
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];
    const seedA = getSeedForMatchPosition(i, 'A', assignments.length);
    const seedB = getSeedForMatchPosition(i, 'B', assignments.length);

    const playerA = assignments.find(a => a.seed === seedA);
    const playerB = assignments.find(a => a.seed === seedB);

    await db.bracketMatch.update({
      where: { id: match.id },
      data: {
        playerAId: playerA?.userId,
        playerBId: playerB?.userId,
      }
    });
  }
}

/**
 * Get seed number for a match position using standard bracket placement
 */
function getSeedForMatchPosition(
  matchIndex: number,
  position: 'A' | 'B',
  totalPlayers: number
): number {
  // Standard bracket seeding pattern
  // For 16 players: Match 0 has seeds 1v16, Match 1 has 8v9, etc.
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

/**
 * Preview seedings without saving
 */
export async function previewSeedings(
  tournamentId: string,
  options: SeedingOptions = { method: 'ELO' }
): Promise<{
  assignments: SeedAssignment[];
  bracketPreview: Array<{ match: number; playerA: string; playerB: string; seedA: number; seedB: number }>;
}> {
  const assignments = await generateSeedings(tournamentId, options);
  
  // Generate bracket preview
  const bracketPreview: Array<{ match: number; playerA: string; playerB: string; seedA: number; seedB: number }> = [];
  const matchCount = Math.ceil(assignments.length / 2);
  
  for (let i = 0; i < matchCount; i++) {
    const seedA = getSeedForMatchPosition(i, 'A', assignments.length);
    const seedB = getSeedForMatchPosition(i, 'B', assignments.length);
    
    const playerA = assignments.find(a => a.seed === seedA);
    const playerB = assignments.find(a => a.seed === seedB);
    
    bracketPreview.push({
      match: i + 1,
      playerA: playerA ? `${playerA.playerName || `Seed ${playerA.seed}`}` : 'BYE',
      playerB: playerB ? `${playerB.playerName || `Seed ${playerB.seed}`}` : 'BYE',
      seedA,
      seedB
    });
  }

  return { assignments, bracketPreview };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get seeding statistics for a tournament
 */
export async function getSeedingStats(tournamentId: string): Promise<{
  playerCount: number;
  avgElo: number;
  maxElo: number;
  minElo: number;
  eloRange: number;
  orgsRepresented: number;
  playersWithOrg: number;
}> {
  const registrations = await db.tournamentRegistration.findMany({
    where: { tournamentId, status: 'CONFIRMED' },
    include: {
      user: {
        select: { hiddenElo: true, affiliatedOrgId: true }
      }
    }
  });

  const elos = registrations.map(r => r.user.hiddenElo || 1500);
  const orgIds = new Set(registrations.map(r => r.user.affiliatedOrgId).filter(Boolean));

  return {
    playerCount: registrations.length,
    avgElo: elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0,
    maxElo: elos.length > 0 ? Math.max(...elos) : 0,
    minElo: elos.length > 0 ? Math.min(...elos) : 0,
    eloRange: elos.length > 0 ? Math.max(...elos) - Math.min(...elos) : 0,
    orgsRepresented: orgIds.size,
    playersWithOrg: registrations.filter(r => r.user.affiliatedOrgId).length,
  };
}

/**
 * Validate seeding for fairness
 */
export function validateSeeding(assignments: SeedAssignment[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for duplicate seeds
  const seeds = new Set<number>();
  for (const a of assignments) {
    if (seeds.has(a.seed)) {
      issues.push(`Duplicate seed: ${a.seed}`);
    }
    seeds.add(a.seed);
  }

  // Check for missing seeds
  for (let i = 1; i <= assignments.length; i++) {
    if (!seeds.has(i)) {
      issues.push(`Missing seed: ${i}`);
    }
  }

  // Check for duplicate user IDs
  const userIds = new Set<string>();
  for (const a of assignments) {
    if (userIds.has(a.userId)) {
      issues.push(`Duplicate player: ${a.userId}`);
    }
    userIds.add(a.userId);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================
// REQUIRED API FUNCTIONS (Task 10)
// ============================================

/**
 * Get seeding preview for a tournament without applying it
 * Returns a SeedResult with the computed seeds
 * 
 * @param tournamentId - The tournament ID to preview seeding for
 * @returns Promise<SeedResult> with seeding preview
 */
export async function getSeedingPreview(tournamentId: string): Promise<SeedResult> {
  // Get tournament details
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      sport: true,
      scope: true,
      maxPlayers: true,
      bracketFormat: true,
    }
  });

  if (!tournament) {
    return {
      success: false,
      seeds: [],
      playerCount: 0,
      method: 'ELO',
      warnings: ['Tournament not found'],
      antiCollisionApplied: false,
      topSeedProtectionApplied: false,
    };
  }

  // Get all confirmed registrations with player data
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'CONFIRMED'
    },
    include: {
      user: {
        select: {
          id: true,
          hiddenElo: true,
          visiblePoints: true,
          affiliatedOrgId: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  });

  if (registrations.length === 0) {
    return {
      success: false,
      seeds: [],
      playerCount: 0,
      method: 'ELO',
      warnings: ['No confirmed registrations'],
      antiCollisionApplied: false,
      topSeedProtectionApplied: false,
    };
  }

  // Sort by ELO and create seeds
  const sorted = [...registrations].sort((a, b) => {
    const eloA = a.user.hiddenElo || 1500;
    const eloB = b.user.hiddenElo || 1500;
    return eloB - eloA;
  });

  const seeds: SeedAssignment[] = sorted.map((r, i) => ({
    userId: r.userId,
    seed: i + 1,
    elo: r.user.hiddenElo || 1500,
    orgId: r.user.affiliatedOrgId,
    playerName: `${r.user.firstName} ${r.user.lastName}`,
    reason: `ELO: ${Math.round(r.user.hiddenElo || 1500)}`
  }));

  return {
    success: true,
    seeds,
    playerCount: seeds.length,
    method: 'ELO',
    warnings: [],
    antiCollisionApplied: false,
    topSeedProtectionApplied: false,
  };
}

/**
 * Apply anti-collision rules with explicit org map
 * Use this when you already have a mapping of player -> organization
 * 
 * @param seeds - The seed result to apply anti-collision to
 * @param orgMap - Map of player ID to organization ID
 * @returns Modified SeedResult with anti-collision applied
 */
export function applyAntiCollisionWithOrgMap(
  seeds: SeedResult,
  orgMap: Map<string, string>
): SeedResult {
  if (!seeds.success || seeds.seeds.length === 0) {
    return seeds;
  }

  // Update seeds with org info from map
  const updatedSeeds = seeds.seeds.map(seed => ({
    ...seed,
    orgId: orgMap.get(seed.userId) || seed.orgId
  }));

  // Apply the existing anti-collision logic
  const adjustedSeeds = applyAntiCollision(updatedSeeds);

  return {
    ...seeds,
    seeds: adjustedSeeds,
    antiCollisionApplied: true,
  };
}

/**
 * Apply anti-collision rules to prevent same-org players meeting early
 * This is an overloaded version that can accept an orgMap parameter
 * 
 * @param seedsOrAssignments - Either SeedResult or SeedAssignment[]
 * @param orgMap - Optional Map of player ID to organization ID
 * @returns Modified seeds with anti-collision applied
 */
export function applyAntiCollisionWithMap(
  assignments: SeedAssignment[],
  orgMap?: Map<string, string>
): SeedAssignment[] {
  // If orgMap is provided, update assignments with org info
  let seedsToProcess = assignments;
  if (orgMap) {
    seedsToProcess = assignments.map(seed => ({
      ...seed,
      orgId: orgMap.get(seed.userId) || seed.orgId
    }));
  }

  // Use the existing anti-collision logic
  return applyAntiCollision(seedsToProcess);
}
