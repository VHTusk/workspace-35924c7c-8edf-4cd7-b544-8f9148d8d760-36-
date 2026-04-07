/**
 * Team Bracket Generation Utilities for VALORHIVE
 * Supports INDIVIDUAL (1v1), DOUBLES (2v2), and TEAM (3-4 players) formats
 */

import { db } from '@/lib/db';
import { 
  TournamentFormat, 
  TournamentStatus, 
  BracketFormat,
  TeamStatus,
  BracketMatchStatus,
  BracketSide,
  SportType 
} from '@prisma/client';

// Types
interface TeamWithMembers {
  id: string;
  name: string;
  teamElo: number;
  format: TournamentFormat;
  members: {
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      hiddenElo: number;
    };
  }[];
}

interface BracketMatchInput {
  roundNumber: number;
  matchNumber: number;
  teamAId?: string | null;
  teamBId?: string | null;
  status: BracketMatchStatus;
  bracketSide?: BracketSide | null;
  nextMatchId?: string | null;
  loserNextMatchId?: string | null;
}

interface GenerateBracketOptions {
  tournamentId: string;
  seedingMethod?: 'ELO' | 'RANDOM' | 'MANUAL';
  format?: BracketFormat;
}

interface BracketGenerationResult {
  success: boolean;
  bracketId?: string;
  totalRounds?: number;
  totalMatches?: number;
  error?: string;
}

/**
 * Calculate team ELO as average of all members' ELO
 */
export async function calculateTeamElo(teamId: string): Promise<number> {
  const members = await db.teamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: { hiddenElo: true },
      },
    },
  });

  if (members.length === 0) return 1000;

  const totalElo = members.reduce((sum, m) => sum + m.user.hiddenElo, 0);
  return Math.round(totalElo / members.length);
}

/**
 * Recalculate ELO for all teams in a sport
 */
export async function recalculateAllTeamElos(sport: SportType): Promise<void> {
  const teams = await db.team.findMany({
    where: { sport, status: TeamStatus.ACTIVE },
  });

  for (const team of teams) {
    const avgElo = await calculateTeamElo(team.id);
    await db.team.update({
      where: { id: team.id },
      data: { teamElo: avgElo },
    });
  }
}

/**
 * Get seeded teams for a tournament
 * Teams are seeded by ELO (highest first)
 */
export async function getSeededTeamsForTournament(
  tournamentId: string
): Promise<TeamWithMembers[]> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teamRegistrations: {
        where: { status: 'CONFIRMED' },
        include: {
          team: {
            include: {
              members: {
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
          },
        },
      },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Get all confirmed teams
  const teams = tournament.teamRegistrations.map(tr => ({
    ...tr.team,
    members: tr.team.members.map(m => ({
      userId: m.userId,
      user: m.user,
    })),
  }));

  // Sort by team ELO (descending) - highest ELO gets seed 1
  return teams.sort((a, b) => b.teamElo - a.teamElo);
}

/**
 * Get next power of 2 (for bracket size)
 */
function getNextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Calculate number of byes needed
 */
function calculateByes(numTeams: number): number {
  return getNextPowerOf2(numTeams) - numTeams;
}

/**
 * Generate single elimination bracket for teams
 */
async function generateSingleEliminationBracket(
  tournamentId: string,
  teams: TeamWithMembers[],
  generatedById: string
): Promise<BracketGenerationResult> {
  const numTeams = teams.length;
  const bracketSize = getNextPowerOf2(numTeams);
  const totalRounds = Math.log2(bracketSize);
  const byes = calculateByes(numTeams);

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId,
      format: BracketFormat.SINGLE_ELIMINATION,
      totalRounds,
      seedingMethod: 'ELO',
      generatedById,
    },
  });

  // Generate matches
  const matches: BracketMatchInput[] = [];
  let matchNumber = 1;

  // First round matches
  const firstRoundMatches = bracketSize / 2;
  const seededPositions = distributeSeeds(numTeams, bracketSize);

  for (let i = 0; i < firstRoundMatches; i++) {
    const posA = seededPositions[i * 2];
    const posB = seededPositions[i * 2 + 1];

    const teamA = posA !== null && posA <= numTeams ? teams[posA - 1] : null;
    const teamB = posB !== null && posB <= numTeams ? teams[posB - 1] : null;

    // Determine match status
    let status: BracketMatchStatus;
    if (!teamA && !teamB) {
      status = BracketMatchStatus.BYE;
    } else if (!teamA || !teamB) {
      status = BracketMatchStatus.BYE;
    } else {
      status = BracketMatchStatus.PENDING;
    }

    matches.push({
      roundNumber: 1,
      matchNumber,
      teamAId: teamA?.id,
      teamBId: teamB?.id,
      status,
      bracketSide: BracketSide.WINNERS,
    });

    matchNumber++;
  }

  // Generate subsequent rounds (empty slots)
  let roundMatches = firstRoundMatches / 2;
  for (let round = 2; round <= totalRounds; round++) {
    for (let i = 0; i < roundMatches; i++) {
      matches.push({
        roundNumber: round,
        matchNumber,
        status: BracketMatchStatus.PENDING,
        bracketSide: BracketSide.WINNERS,
      });
      matchNumber++;
    }
    roundMatches /= 2;
  }

  // Create all bracket matches
  const createdMatches = await db.bracketMatch.createMany({
    data: matches.map(m => ({
      ...m,
      bracketId: bracket.id,
    })),
  });

  // Set up next match references
  const bracketMatches = await db.bracketMatch.findMany({
    where: { bracketId: bracket.id },
    orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
  });

  // Update next match references
  for (let i = 0; i < bracketMatches.length; i++) {
    const match = bracketMatches[i];
    if (match.roundNumber < totalRounds) {
      const nextMatchIndex = bracketMatches.findIndex(
        m => m.roundNumber === match.roundNumber + 1 && 
             m.matchNumber === Math.ceil(match.matchNumber / 2)
      );
      if (nextMatchIndex !== -1) {
        await db.bracketMatch.update({
          where: { id: match.id },
          data: { nextMatchId: bracketMatches[nextMatchIndex].id },
        });
      }
    }
  }

  // Auto-advance bye matches
  await autoAdvanceByes(bracket.id);

  return {
    success: true,
    bracketId: bracket.id,
    totalRounds,
    totalMatches: matches.length,
  };
}

/**
 * Generate double elimination bracket for teams
 */
async function generateDoubleEliminationBracket(
  tournamentId: string,
  teams: TeamWithMembers[],
  generatedById: string
): Promise<BracketGenerationResult> {
  const numTeams = teams.length;
  const bracketSize = getNextPowerOf2(numTeams);
  const winnersRounds = Math.log2(bracketSize);
  const losersRounds = winnersRounds * 2 - 2;
  const totalRounds = winnersRounds + 1; // +1 for grand finals

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId,
      format: BracketFormat.DOUBLE_ELIMINATION,
      totalRounds,
      seedingMethod: 'ELO',
      generatedById,
    },
  });

  const matches: BracketMatchInput[] = [];
  let matchNumber = 1;
  const seededPositions = distributeSeeds(numTeams, bracketSize);

  // Winners bracket - first round
  const firstRoundMatches = bracketSize / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    const posA = seededPositions[i * 2];
    const posB = seededPositions[i * 2 + 1];

    const teamA = posA !== null && posA <= numTeams ? teams[posA - 1] : null;
    const teamB = posB !== null && posB <= numTeams ? teams[posB - 1] : null;

    let status: BracketMatchStatus;
    if (!teamA || !teamB) {
      status = BracketMatchStatus.BYE;
    } else {
      status = BracketMatchStatus.PENDING;
    }

    matches.push({
      roundNumber: 1,
      matchNumber,
      teamAId: teamA?.id,
      teamBId: teamB?.id,
      status,
      bracketSide: BracketSide.WINNERS,
    });

    matchNumber++;
  }

  // Winners bracket - subsequent rounds
  let roundMatches = firstRoundMatches / 2;
  for (let round = 2; round <= winnersRounds; round++) {
    for (let i = 0; i < roundMatches; i++) {
      matches.push({
        roundNumber: round,
        matchNumber,
        status: BracketMatchStatus.PENDING,
        bracketSide: BracketSide.WINNERS,
      });
      matchNumber++;
    }
    roundMatches /= 2;
  }

  // Losers bracket
  // Round 1 of losers receives losers from winners round 1
  let losersRound = 1;
  let loserMatches = firstRoundMatches / 4; // First losers round has fewer matches
  
  for (let i = 0; i < losersRounds; i++) {
    const matchesThisRound = i % 2 === 0 ? loserMatches : loserMatches;
    for (let j = 0; j < matchesThisRound; j++) {
      matches.push({
        roundNumber: losersRound,
        matchNumber,
        status: BracketMatchStatus.PENDING,
        bracketSide: BracketSide.LOSERS,
      });
      matchNumber++;
    }
    losersRound++;
    if (i % 2 === 1) {
      loserMatches /= 2;
    }
  }

  // Grand finals
  matches.push({
    roundNumber: winnersRounds + 1,
    matchNumber,
    status: BracketMatchStatus.PENDING,
    bracketSide: BracketSide.WINNERS,
  });

  // Create all bracket matches
  await db.bracketMatch.createMany({
    data: matches.map(m => ({
      ...m,
      bracketId: bracket.id,
    })),
  });

  // Auto-advance bye matches
  await autoAdvanceByes(bracket.id);

  return {
    success: true,
    bracketId: bracket.id,
    totalRounds,
    totalMatches: matches.length,
  };
}

/**
 * Generate round robin matches for teams
 */
async function generateRoundRobinBracket(
  tournamentId: string,
  teams: TeamWithMembers[],
  generatedById: string
): Promise<BracketGenerationResult> {
  const numTeams = teams.length;
  const totalMatches = (numTeams * (numTeams - 1)) / 2;
  const totalRounds = numTeams - 1;

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId,
      format: BracketFormat.ROUND_ROBIN,
      totalRounds,
      seedingMethod: 'ELO',
      generatedById,
    },
  });

  const matches: BracketMatchInput[] = [];
  let matchNumber = 1;

  // Round robin scheduling using circle method
  const teamsList = [...teams];
  if (teamsList.length % 2 !== 0) {
    teamsList.push(null as unknown as TeamWithMembers); // Add bye if odd number
  }

  const halfSize = teamsList.length / 2;
  const fixedTeam = teamsList[0];
  const rotatingTeams = teamsList.slice(1);

  for (let round = 1; round <= totalRounds; round++) {
    const roundTeams = [fixedTeam, ...rotatingTeams];
    
    for (let i = 0; i < halfSize; i++) {
      const teamA = roundTeams[i];
      const teamB = roundTeams[roundTeams.length - 1 - i];

      if (teamA && teamB) {
        matches.push({
          roundNumber: round,
          matchNumber,
          teamAId: teamA.id,
          teamBId: teamB.id,
          status: BracketMatchStatus.PENDING,
          bracketSide: null,
        });
        matchNumber++;
      }
    }

    // Rotate teams (keep first team fixed)
    rotatingTeams.push(rotatingTeams.shift()!);
  }

  // Create all bracket matches
  await db.bracketMatch.createMany({
    data: matches.map(m => ({
      ...m,
      bracketId: bracket.id,
    })),
  });

  return {
    success: true,
    bracketId: bracket.id,
    totalRounds,
    totalMatches: matches.length,
  };
}

/**
 * Distribute seeds in bracket positions
 * Ensures top seeds don't meet until later rounds
 */
function distributeSeeds(numTeams: number, bracketSize: number): (number | null)[] {
  const positions: (number | null)[] = new Array(bracketSize).fill(null);
  
  // Standard bracket seeding pattern
  // Seed 1 plays Seed 16, Seed 8 plays Seed 9, etc.
  const seedPattern: number[] = [1];
  let currentSize = 2;
  
  while (currentSize <= bracketSize) {
    const newPattern: number[] = [];
    for (const seed of seedPattern) {
      newPattern.push(seed);
      newPattern.push(currentSize + 1 - seed);
    }
    seedPattern.length = 0;
    seedPattern.push(...newPattern);
    currentSize *= 2;
  }

  // Assign seeds to positions
  let seedIndex = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (seedPattern[seedIndex] <= numTeams) {
      positions[i] = seedPattern[seedIndex];
    }
    seedIndex++;
  }

  return positions;
}

/**
 * Auto-advance teams in bye matches
 */
async function autoAdvanceByes(bracketId: string): Promise<void> {
  const byeMatches = await db.bracketMatch.findMany({
    where: {
      bracketId,
      status: BracketMatchStatus.BYE,
    },
  });

  for (const match of byeMatches) {
    // Find the team that should advance
    const advancingTeamId = match.teamAId || match.teamBId;
    
    if (advancingTeamId && match.nextMatchId) {
      // Get next match
      const nextMatch = await db.bracketMatch.findUnique({
        where: { id: match.nextMatchId },
      });

      if (nextMatch) {
        // Determine which slot to fill in next match
        const isFirstSlot = match.matchNumber % 2 === 1;
        
        await db.bracketMatch.update({
          where: { id: nextMatch.id },
          data: isFirstSlot 
            ? { teamAId: advancingTeamId }
            : { teamBId: advancingTeamId },
        });
      }
    }

    // Update match status
    await db.bracketMatch.update({
      where: { id: match.id },
      data: { 
        status: BracketMatchStatus.COMPLETED,
        winnerTeamId: advancingTeamId,
      },
    });
  }
}

/**
 * Main function to generate bracket for a team tournament
 */
export async function generateTeamBracket(
  options: GenerateBracketOptions,
  generatedById: string
): Promise<BracketGenerationResult> {
  const { tournamentId, format = BracketFormat.SINGLE_ELIMINATION } = options;

  // Verify tournament exists and is in correct status
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teamRegistrations: {
        where: { status: 'CONFIRMED' },
      },
    },
  });

  if (!tournament) {
    return { success: false, error: 'Tournament not found' };
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_CLOSED && 
      tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return { success: false, error: 'Tournament is not in correct status for bracket generation' };
  }

  // Check if bracket already exists
  const existingBracket = await db.bracket.findUnique({
    where: { tournamentId },
  });

  if (existingBracket) {
    return { success: false, error: 'Bracket already exists for this tournament' };
  }

  // Get seeded teams
  const teams = await getSeededTeamsForTournament(tournamentId);

  if (teams.length < 2) {
    return { success: false, error: 'Not enough teams to generate bracket' };
  }

  // Verify tournament format supports teams
  if (tournament.format === 'INDIVIDUAL') {
    return { success: false, error: 'Individual tournaments do not support team brackets' };
  }

  try {
    let result: BracketGenerationResult;

    switch (format) {
      case BracketFormat.SINGLE_ELIMINATION:
        result = await generateSingleEliminationBracket(tournamentId, teams, generatedById);
        break;
      case BracketFormat.DOUBLE_ELIMINATION:
        result = await generateDoubleEliminationBracket(tournamentId, teams, generatedById);
        break;
      case BracketFormat.ROUND_ROBIN:
        result = await generateRoundRobinBracket(tournamentId, teams, generatedById);
        break;
      default:
        return { success: false, error: 'Unsupported bracket format' };
    }

    if (result.success) {
      // Update tournament status
      await db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.BRACKET_GENERATED },
      });
    }

    return result;
  } catch (error) {
    console.error('Error generating team bracket:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate bracket' 
    };
  }
}

/**
 * Get bracket data for display
 */
export async function getTeamBracketData(bracketId: string) {
  const bracket = await db.bracket.findUnique({
    where: { id: bracketId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          format: true,
          bracketFormat: true,
        },
      },
      matches: {
        include: {
          teamA: {
            include: {
              members: {
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
            },
          },
          teamB: {
            include: {
              members: {
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
            },
          },
          match: true,
        },
        orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });

  if (!bracket) {
    return null;
  }

  // Organize matches by round
  const rounds: Record<number, typeof bracket.matches> = {};
  for (const match of bracket.matches) {
    if (!rounds[match.roundNumber]) {
      rounds[match.roundNumber] = [];
    }
    rounds[match.roundNumber].push(match);
  }

  return {
    ...bracket,
    rounds,
  };
}

/**
 * Update team stats after a match
 */
export async function updateTeamStatsAfterMatch(
  winningTeamId: string,
  losingTeamId: string
): Promise<void> {
  // Update winning team
  await db.team.update({
    where: { id: winningTeamId },
    data: {
      wins: { increment: 1 },
      matchesPlayed: { increment: 1 },
    },
  });

  // Update losing team
  await db.team.update({
    where: { id: losingTeamId },
    data: {
      losses: { increment: 1 },
      matchesPlayed: { increment: 1 },
    },
  });
}

/**
 * Calculate team ELO change after a match
 * Using standard ELO formula
 */
export function calculateTeamEloChange(
  winnerElo: number,
  loserElo: number,
  kFactor: number = 32
): { winnerChange: number; loserChange: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerChange = Math.round(kFactor * (1 - expectedWinner));
  const loserChange = Math.round(kFactor * (0 - expectedLoser));

  return { winnerChange, loserChange };
}

/**
 * Apply ELO changes to team
 */
export async function applyTeamEloChange(
  teamId: string,
  eloChange: number
): Promise<void> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { teamElo: true },
  });

  if (!team) return;

  const newElo = Math.max(100, team.teamElo + eloChange);

  await db.team.update({
    where: { id: teamId },
    data: { teamElo: newElo },
  });

  // Also update individual member ELOs (partial share)
  const members = await db.teamMember.findMany({
    where: { teamId },
  });

  const individualChange = eloChange / members.length;

  for (const member of members) {
    await db.user.update({
      where: { id: member.userId },
      data: {
        hiddenElo: { increment: individualChange },
      },
    });
  }
}
