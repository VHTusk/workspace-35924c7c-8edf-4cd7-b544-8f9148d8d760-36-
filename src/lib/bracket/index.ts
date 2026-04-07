/**
 * Bracket Generation Service
 * Supports Single Elimination, Double Elimination, and Round Robin formats
 * 
 * Key features:
 * - ELO-based seeding
 * - BYE handling with auto-advancement
 * - Double elimination loser bracket logic
 * - Court/board assignment support
 */

import { db } from '@/lib/db';
import { BracketFormat, BracketMatchStatus, BracketSide, RegistrationStatus } from '@prisma/client';

// ============================================
// TYPES
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
// SINGLE ELIMINATION
// ============================================

/**
 * Generate single elimination bracket with proper BYE handling
 */
function generateSingleElimination(
  players: SeedPlayer[],
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL'
): GeneratedBracket {
  const numPlayers = players.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const numRounds = Math.ceil(Math.log2(nextPowerOf2));
  const numByes = nextPowerOf2 - numPlayers;

  // Seed players - sort by seed number (lower = better seed)
  const seededPlayers = [...players].sort((a, b) => a.seedNumber - b.seedNumber);
  
  const matches: GeneratedMatch[] = [];
  const firstRoundMatches = nextPowerOf2 / 2;

  // Create bracket positions using standard seeding pattern
  // Top seeds get BYEs in first round when needed
  const positions: (SeedPlayer | null)[] = new Array(nextPowerOf2).fill(null);
  
  // Place players using snake seeding pattern
  // This ensures top seeds face lower seeds in early rounds
  let position = 0;
  for (let i = 0; i < seededPlayers.length; i++) {
    // Find next empty position using seeding pattern
    while (positions[position] !== null && position < nextPowerOf2) {
      position++;
    }
    positions[getSeedingPosition(i, nextPowerOf2)] = seededPlayers[i];
  }

  // Generate first round matches
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

  // Generate subsequent rounds (empty slots for winners)
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

/**
 * Get seeding position for standard bracket seeding
 */
function getSeedingPosition(seed: number, totalSlots: number): number {
  // Standard tournament seeding pattern
  // Seed 1 at position 0, seed 2 at position (totalSlots-1)
  // Then fill remaining positions recursively
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

// ============================================
// DOUBLE ELIMINATION
// ============================================

/**
 * Generate double elimination bracket
 * Winners bracket + Losers bracket
 */
function generateDoubleElimination(
  players: SeedPlayer[],
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL'
): GeneratedBracket {
  const numPlayers = players.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const numRounds = Math.ceil(Math.log2(nextPowerOf2));

  // Generate winners bracket first
  const winnersBracket = generateSingleElimination(players, seedingMethod);
  
  // Mark all winners bracket matches
  winnersBracket.matches.forEach(m => {
    m.bracketSide = BracketSide.WINNERS;
  });

  // Generate losers bracket
  const losersBracketMatches: GeneratedMatch[] = [];
  let lbMatchNum = 1;

  // Losers bracket structure:
  // Round 1: Losers from WB Round 1
  // Round 2: Winners from LB R1 vs Losers from WB R2
  // And so on...
  
  const totalLBRounds = numRounds * 2 - 2;
  
  for (let round = 1; round <= totalLBRounds; round++) {
    // Calculate matches in this round
    let matchesInRound: number;
    
    if (round <= numRounds) {
      matchesInRound = Math.floor(nextPowerOf2 / Math.pow(2, Math.ceil(round / 2) + 1));
    } else {
      matchesInRound = Math.max(1, Math.floor(nextPowerOf2 / Math.pow(2, numRounds - (round - numRounds))));
    }
    
    matchesInRound = Math.max(1, matchesInRound);
    
    for (let i = 0; i < matchesInRound; i++) {
      losersBracketMatches.push({
        roundNumber: round,
        matchNumber: lbMatchNum++,
        playerAId: null,
        playerBId: null,
        bracketSide: BracketSide.LOSERS,
        isBye: false,
      });
    }
  }

  // Add championship match
  const championshipMatch: GeneratedMatch = {
    roundNumber: numRounds + 1,
    matchNumber: 1,
    playerAId: null,
    playerBId: null,
    bracketSide: BracketSide.WINNERS,
    isBye: false,
  };

  // Combine all matches
  const allMatches = [
    ...winnersBracket.matches,
    ...losersBracketMatches,
    championshipMatch,
  ];

  // Set up loser progression for WB matches
  const wbRound1 = winnersBracket.matches.filter(m => m.roundNumber === 1);
  const lbRound1 = losersBracketMatches.filter(m => m.roundNumber === 1);
  
  wbRound1.forEach((match, idx) => {
    const lbMatch = lbRound1[Math.floor(idx / 2)];
    if (lbMatch) {
      match.loserNextMatchId = `temp-lb-${lbMatch.roundNumber}-${lbMatch.matchNumber}`;
    }
  });

  // Link LB matches
  for (let round = 1; round < totalLBRounds; round++) {
    const currentRoundLB = losersBracketMatches.filter(m => m.roundNumber === round);
    const nextRoundLB = losersBracketMatches.filter(m => m.roundNumber === round + 1);
    
    currentRoundLB.forEach((match, idx) => {
      if (nextRoundLB.length > 0) {
        const nextMatchIdx = Math.floor(idx / 2);
        const nextMatch = nextRoundLB[nextMatchIdx];
        if (nextMatch) {
          match.nextMatchId = `temp-lb-${nextMatch.roundNumber}-${nextMatch.matchNumber}`;
        }
      }
    });
  }

  // Link final LB match to championship
  const finalLBMatch = losersBracketMatches[losersBracketMatches.length - 1];
  if (finalLBMatch) {
    finalLBMatch.nextMatchId = `temp-${championshipMatch.roundNumber}-${championshipMatch.matchNumber}`;
  }

  // Link WB final to championship
  const wbFinal = winnersBracket.matches.find(
    m => m.roundNumber === numRounds && m.bracketSide === BracketSide.WINNERS
  );
  if (wbFinal) {
    wbFinal.nextMatchId = `temp-${championshipMatch.roundNumber}-${championshipMatch.matchNumber}`;
  }

  return {
    matches: allMatches,
    totalRounds: numRounds + 1,
    format: BracketFormat.DOUBLE_ELIMINATION,
  };
}

// ============================================
// ROUND ROBIN
// ============================================

/**
 * Generate round robin bracket
 * Every player plays every other player
 */
function generateRoundRobin(
  players: SeedPlayer[],
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL'
): GeneratedBracket {
  const matches: GeneratedMatch[] = [];
  
  // If odd number of players, add a "BYE" placeholder
  const hasBye = players.length % 2 !== 0;
  const effectivePlayers = hasBye 
    ? [...players, { id: 'BYE', name: 'BYE', elo: 0, seedNumber: 999 } as SeedPlayer]
    : players;
  const n = effectivePlayers.length;
  
  // Round robin algorithm (circle method)
  const positions: (SeedPlayer | null)[] = [...effectivePlayers];
  const fixed = positions[0]; // First player stays fixed
  const rotating = positions.slice(1);
  
  // Generate rounds
  let matchNum = 1;
  for (let round = 0; round < n - 1; round++) {
    const roundMatches: Array<[SeedPlayer | null, SeedPlayer | null]> = [];
    
    // First position plays last rotating position
    roundMatches.push([fixed, rotating[rotating.length - 1]]);
    
    // Other matches
    for (let i = 0; i < (rotating.length - 1) / 2; i++) {
      roundMatches.push([rotating[i], rotating[rotating.length - 2 - i]]);
    }
    
    // Add matches (skip BYE matches)
    roundMatches.forEach(([playerA, playerB]) => {
      // Skip matches involving BYE placeholder
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
    
    // Rotate positions
    rotating.unshift(rotating.pop()!);
  }

  return {
    matches,
    totalRounds: n - 1,
    format: BracketFormat.ROUND_ROBIN,
  };
}

// ============================================
// SEEDING
// ============================================

/**
 * Assign seed numbers based on ELO rating
 */
async function assignSeedsByElo(
  tournamentId: string,
  userIds: string[]
): Promise<SeedPlayer[]> {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hiddenElo: true,
    },
  });

  // Sort by ELO descending (highest ELO = seed 1)
  const sorted = users.sort((a, b) => b.hiddenElo - a.hiddenElo);
  
  return sorted.map((user, idx) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    elo: user.hiddenElo,
    seedNumber: idx + 1,
  }));
}

/**
 * Assign random seeds
 */
async function assignSeedsRandom(
  tournamentId: string,
  userIds: string[]
): Promise<SeedPlayer[]> {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hiddenElo: true,
    },
  });

  // Shuffle array
  const shuffled = users.sort(() => Math.random() - 0.5);
  
  return shuffled.map((user, idx) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    elo: user.hiddenElo,
    seedNumber: idx + 1,
  }));
}

// ============================================
// BYE AUTO-ADVANCEMENT
// ============================================

/**
 * Process BYE matches - auto-advance player to next round
 */
async function processByeMatches(
  bracketId: string,
  matches: GeneratedMatch[]
): Promise<void> {
  const byeMatches = matches.filter(m => m.isBye);
  
  for (const byeMatch of byeMatches) {
    // The player who gets a BYE
    const advancingPlayer = byeMatch.playerAId || byeMatch.playerBId;
    
    if (!advancingPlayer) continue;
    
    // Find the next round match this player should be placed in
    const nextRoundMatch = await db.bracketMatch.findFirst({
      where: {
        bracketId,
        roundNumber: byeMatch.roundNumber + 1,
        status: BracketMatchStatus.PENDING,
      },
      orderBy: { matchNumber: 'asc' },
    });
    
    if (nextRoundMatch) {
      // Place the BYE player in the next round
      await db.bracketMatch.update({
        where: { id: nextRoundMatch.id },
        data: {
          playerAId: nextRoundMatch.playerAId || advancingPlayer,
          playerBId: nextRoundMatch.playerAId ? advancingPlayer : null,
        },
      });
    }
  }
}

// ============================================
// MAIN GENERATOR
// ============================================

interface GenerateBracketParams {
  tournamentId: string;
  format: BracketFormat;
  seedingMethod: 'ELO' | 'RANDOM' | 'MANUAL';
  generatedById: string;
}

export async function generateBracket(params: GenerateBracketParams): Promise<{
  success: boolean;
  bracketId?: string;
  totalMatches?: number;
  totalRounds?: number;
  error?: string;
}> {
  const { tournamentId, format, seedingMethod, generatedById } = params;

  try {
    // Check if bracket already exists
    const existingBracket = await db.bracket.findUnique({
      where: { tournamentId },
    });

    if (existingBracket) {
      return { success: false, error: 'Bracket already exists for this tournament' };
    }

    // Bracket generation should only include players who are both confirmed
    // and checked in through the active tournament check-in flow.
    const [registrations, checkins] = await Promise.all([
      db.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status: RegistrationStatus.CONFIRMED,
        },
        select: { userId: true },
      }),
      db.tournamentCheckin.findMany({
        where: { tournamentId },
        select: { userId: true },
      }),
    ]);

    const checkedInUserIds = new Set(checkins.map((checkin) => checkin.userId));
    const checkedInRegistrations = registrations.filter((registration) =>
      checkedInUserIds.has(registration.userId)
    );

    if (checkedInRegistrations.length < 2) {
      return { success: false, error: 'Need at least 2 checked-in players to generate bracket' };
    }

    const userIds = checkedInRegistrations.map((registration) => registration.userId);

    // Assign seeds
    let seededPlayers: SeedPlayer[];
    switch (seedingMethod) {
      case 'ELO':
        seededPlayers = await assignSeedsByElo(tournamentId, userIds);
        break;
      case 'RANDOM':
        seededPlayers = await assignSeedsRandom(tournamentId, userIds);
        break;
      default:
        seededPlayers = await assignSeedsByElo(tournamentId, userIds);
    }

    // Generate bracket structure
    let generatedBracket: GeneratedBracket;
    switch (format) {
      case BracketFormat.SINGLE_ELIMINATION:
        generatedBracket = generateSingleElimination(seededPlayers, seedingMethod);
        break;
      case BracketFormat.DOUBLE_ELIMINATION:
        generatedBracket = generateDoubleElimination(seededPlayers, seedingMethod);
        break;
      case BracketFormat.ROUND_ROBIN:
        generatedBracket = generateRoundRobin(seededPlayers, seedingMethod);
        break;
      default:
        return { success: false, error: 'Invalid bracket format' };
    }

    // Create bracket in database
    const bracket = await db.$transaction(async (tx) => {
      // Create bracket record
      const newBracket = await tx.bracket.create({
        data: {
          tournamentId,
          format,
          totalRounds: generatedBracket.totalRounds,
          seedingMethod,
          generatedById,
        },
      });

      // Create bracket matches
      for (const match of generatedBracket.matches) {
        await tx.bracketMatch.create({
          data: {
            bracketId: newBracket.id,
            roundNumber: match.roundNumber,
            matchNumber: match.matchNumber,
            playerAId: match.playerAId,
            playerBId: match.playerBId,
            status: match.isBye ? BracketMatchStatus.BYE : BracketMatchStatus.PENDING,
            bracketSide: match.bracketSide,
          },
        });
      }

      // Lock the tournament bracket
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { 
          bracketGeneratedAt: new Date(),
          status: 'BRACKET_GENERATED',
        },
      });

      return newBracket;
    });

    // Process BYE auto-advancement
    await processByeMatches(bracket.id, generatedBracket.matches);

    console.log(`Bracket generated: ${bracket.id}, Matches: ${generatedBracket.matches.length}`);

    return {
      success: true,
      bracketId: bracket.id,
      totalMatches: generatedBracket.matches.filter(m => !m.isBye).length,
      totalRounds: generatedBracket.totalRounds,
    };
  } catch (error) {
    console.error('Bracket generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get bracket with all matches
 */
export async function getBracketWithMatches(tournamentId: string) {
  const bracket = await db.bracket.findUnique({
    where: { tournamentId },
    include: {
      matches: {
        include: {
          match: {
            include: {
              playerA: { select: { id: true, firstName: true, lastName: true } },
              playerB: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });

  return bracket;
}

/**
 * Update bracket match with winner and advance to next round
 */
export async function advanceBracketMatch(
  bracketMatchId: string, 
  winnerId: string
): Promise<{
  success: boolean;
  advanced?: boolean;
  nextMatchId?: string;
  error?: string;
}> {
  try {
    const bracketMatch = await db.bracketMatch.findUnique({
      where: { id: bracketMatchId },
      include: { bracket: true },
    });

    if (!bracketMatch) {
      return { success: false, error: 'Match not found' };
    }

    // Verify winner is a participant
    if (winnerId !== bracketMatch.playerAId && winnerId !== bracketMatch.playerBId) {
      return { success: false, error: 'Winner must be a participant' };
    }

    // Find next match
    const nextMatch = await db.bracketMatch.findFirst({
      where: {
        bracketId: bracketMatch.bracketId,
        roundNumber: bracketMatch.roundNumber + 1,
        status: BracketMatchStatus.PENDING,
      },
      orderBy: { matchNumber: 'asc' },
    });

    // Update in transaction
    await db.$transaction(async (tx) => {
      // Mark current match as completed
      await tx.bracketMatch.update({
        where: { id: bracketMatchId },
        data: {
          winnerId,
          status: BracketMatchStatus.COMPLETED,
        },
      });

      // Advance winner to next match
      if (nextMatch) {
        const updateData = nextMatch.playerAId === null
          ? { playerAId: winnerId }
          : { playerBId: winnerId };

        await tx.bracketMatch.update({
          where: { id: nextMatch.id },
          data: updateData,
        });
      }
    });

    return { 
      success: true, 
      advanced: !!nextMatch,
      nextMatchId: nextMatch?.id 
    };
  } catch (error) {
    console.error('Failed to advance match:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
