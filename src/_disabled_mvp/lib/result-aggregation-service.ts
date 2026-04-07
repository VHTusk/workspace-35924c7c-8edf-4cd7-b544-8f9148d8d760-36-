/**
 * Result Aggregation Service
 * 
 * Provides unified result aggregation and standings calculation for:
 * - Open competitions
 * - Inter-school tournaments
 * - Inter-college tournaments
 * - Corporate challenges
 * - Organization dashboards
 * 
 * Ensures consistent calculations across all competition types
 */

import { db } from '@/lib/db';
import { SportType, TournamentScope, TournamentStatus } from '@prisma/client';
import { createLogger } from './logger';

const logger = createLogger('ResultAggregationService');

// ============================================
// Types and Interfaces
// ============================================

export interface StandingEntry {
  rank: number;
  playerId: string;
  playerName: string;
  teamId?: string;
  teamName?: string;
  organizationId?: string;
  organizationName?: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  streak: number;
  streakType: 'WIN' | 'LOSS' | 'NONE';
  medalCount: { gold: number; silver: number; bronze: number };
  previousRank?: number;
  rankChange?: number;
}

export interface StandingsResult {
  competitionId: string;
  competitionName: string;
  competitionType: 'LEAGUE' | 'TOURNAMENT' | 'INTER_ORG';
  scope: TournamentScope;
  entries: StandingEntry[];
  lastUpdated: Date;
  tiebreakers: string[];
}

export interface OrganizationStandingSummary {
  organizationId: string;
  organizationName: string;
  organizationType: 'SCHOOL' | 'COLLEGE' | 'CORPORATE' | 'CLUB';
  totalPlayers: number;
  activePlayers: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalPoints: number;
  medals: { gold: number; silver: number; bronze: number };
  tournamentsParticipated: number;
  tournamentsWon: number;
  avgPlayerRating: number;
  topPlayer?: {
    id: string;
    name: string;
    rating: number;
  };
}

export interface TiebreakerResult {
  playerId: string;
  tiebreakerValue: number;
  tiebreakerType: string;
}

// ============================================
// Core Aggregation Functions
// ============================================

/**
 * Calculate standings for a tournament
 */
export async function calculateTournamentStandings(
  tournamentId: string
): Promise<StandingsResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        where: { verificationStatus: 'VERIFIED' },
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, hiddenElo: true } },
        },
      },
      results: true,
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  // Build player stats map
  const playerStats = new Map<string, {
    wins: number;
    losses: number;
    draws: number;
    pointsFor: number;
    pointsAgainst: number;
    results: ('W' | 'L' | 'D')[];
    medals: { gold: number; silver: number; bronze: number };
  }>();

  // Initialize all registered players
  for (const reg of tournament.registrations) {
    playerStats.set(reg.userId, {
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      results: [],
      medals: { gold: 0, silver: 0, bronze: 0 },
    });
  }

  // Process matches
  for (const match of tournament.matches) {
    if (!match.playerAId || !match.playerBId || match.winnerId === null) continue;

    const isDraw = match.scoreA === match.scoreB;
    const playerAWon = match.winnerId === match.playerAId;

    // Update player A stats
    const statsA = playerStats.get(match.playerAId);
    if (statsA) {
      if (isDraw) {
        statsA.draws++;
        statsA.results.push('D');
      } else if (playerAWon) {
        statsA.wins++;
        statsA.results.push('W');
      } else {
        statsA.losses++;
        statsA.results.push('L');
      }
      statsA.pointsFor += match.scoreA || 0;
      statsA.pointsAgainst += match.scoreB || 0;
    }

    // Update player B stats
    const statsB = playerStats.get(match.playerBId);
    if (statsB) {
      if (isDraw) {
        statsB.draws++;
        statsB.results.push('D');
      } else if (!playerAWon) {
        statsB.wins++;
        statsB.results.push('W');
      } else {
        statsB.losses++;
        statsB.results.push('L');
      }
      statsB.pointsFor += match.scoreB || 0;
      statsB.pointsAgainst += match.scoreA || 0;
    }
  }

  // Process tournament results for medals
  for (const result of tournament.results) {
    const stats = playerStats.get(result.userId);
    if (stats) {
      if (result.rank === 1) stats.medals.gold++;
      else if (result.rank === 2) stats.medals.silver++;
      else if (result.rank === 3) stats.medals.bronze++;
    }
  }

  // Calculate standings
  const entries: StandingEntry[] = [];
  let rank = 1;

  // Sort by wins, then point differential, then head-to-head
  const sortedPlayers = Array.from(playerStats.entries())
    .map(([playerId, stats]) => ({
      playerId,
      ...stats,
      winRate: stats.wins + stats.losses > 0 
        ? Math.round((stats.wins / (stats.wins + stats.losses)) * 1000) / 10 
        : 0,
      pointDifferential: stats.pointsFor - stats.pointsAgainst,
    }))
    .sort((a, b) => {
      // Primary: Wins
      if (b.wins !== a.wins) return b.wins - a.wins;
      // Secondary: Point differential
      if (b.pointDifferential !== a.pointDifferential) return b.pointDifferential - a.pointDifferential;
      // Tertiary: Points for
      return b.pointsFor - a.pointsFor;
    });

  for (const player of sortedPlayers) {
    const reg = tournament.registrations.find((r) => r.userId === player.playerId);
    const user = reg?.user;

    // Calculate streak
    let streak = 0;
    let streakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
    for (const result of player.results.reverse()) {
      if (streak === 0) {
        if (result === 'W') { streak = 1; streakType = 'WIN'; }
        else if (result === 'L') { streak = 1; streakType = 'LOSS'; }
      } else if ((streakType === 'WIN' && result === 'W') || (streakType === 'LOSS' && result === 'L')) {
        streak++;
      } else {
        break;
      }
    }

    // Get previous rank from leaderboard snapshot
    const previousSnapshot = await db.leaderboardSnapshot.findFirst({
      where: {
        userId: player.playerId,
        type: 'TOURNAMENT',
        scopeValue: tournamentId,
        isActive: false,
      },
      orderBy: { snapshotDate: 'desc' },
      select: { rank: true },
    });

    entries.push({
      rank: rank++,
      playerId: player.playerId,
      playerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      matchesPlayed: player.wins + player.losses + player.draws,
      winRate: player.winRate,
      points: player.wins * getWinPoints(tournament.scope) + player.losses * getParticipationPoints(tournament.scope),
      pointsFor: player.pointsFor,
      pointsAgainst: player.pointsAgainst,
      pointDifferential: player.pointDifferential,
      streak,
      streakType,
      medalCount: player.medals,
      previousRank: previousSnapshot?.rank,
      rankChange: previousSnapshot ? previousSnapshot.rank - (rank - 1) : undefined,
    });
  }

  return {
    competitionId: tournamentId,
    competitionName: tournament.name,
    competitionType: tournament.bracketFormat ? 'TOURNAMENT' : 'LEAGUE',
    scope: tournament.scope || 'CITY',
    entries,
    lastUpdated: new Date(),
    tiebreakers: ['wins', 'point_differential', 'points_for'],
  };
}

/**
 * Calculate organization standings summary
 */
export async function calculateOrganizationStandings(
  orgId: string,
  sport: SportType
): Promise<OrganizationStandingSummary> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, type: true },
  });

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  // Get roster players
  const rosterPlayers = await db.orgRosterPlayer.findMany({
    where: { orgId, isActive: true },
    include: {
      user: {
        include: { rating: true },
      },
    },
  });

  const playerIds = rosterPlayers.map((rp) => rp.userId);

  // Get matches for all players
  const matches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: { in: playerIds } },
        { playerBId: { in: playerIds } },
      ],
      sport,
      verificationStatus: 'VERIFIED',
    },
  });

  // Get tournament results
  const results = await db.tournamentResult.findMany({
    where: { userId: { in: playerIds } },
    include: { tournament: { select: { sport: true, status: true } } },
  });

  // Calculate totals
  let totalWins = 0;
  let totalLosses = 0;
  let totalPoints = 0;
  const medals = { gold: 0, silver: 0, bronze: 0 };
  const tournamentIds = new Set<string>();

  for (const match of matches) {
    const won = playerIds.includes(match.winnerId || '');
    if (won) {
      totalWins++;
      totalPoints += getWinPoints(match.tournament?.scope as TournamentScope);
    } else {
      totalLosses++;
      totalPoints += getParticipationPoints(match.tournament?.scope as TournamentScope);
    }
    if (match.tournamentId) {
      tournamentIds.add(match.tournamentId);
    }
  }

  for (const result of results) {
    if (result.tournament.sport !== sport) continue;
    if (result.tournament.status !== 'COMPLETED') continue;
    
    if (result.rank === 1) medals.gold++;
    else if (result.rank === 2) medals.silver++;
    else if (result.rank === 3) medals.bronze++;
  }

  // Calculate tournaments won
  const tournamentsWon = results.filter((r) => r.rank === 1 && r.tournament.sport === sport).length;

  // Find top player
  const topPlayer = rosterPlayers
    .filter((rp) => rp.user.rating?.matchesPlayed)
    .sort((a, b) => (b.user.hiddenElo || 0) - (a.user.hiddenElo || 0))[0];

  // Calculate average rating
  const totalRating = rosterPlayers.reduce((sum, rp) => sum + (rp.user.hiddenElo || 1500), 0);
  const avgPlayerRating = Math.round(totalRating / Math.max(rosterPlayers.length, 1));

  return {
    organizationId: orgId,
    organizationName: org.name,
    organizationType: org.type as 'SCHOOL' | 'COLLEGE' | 'CORPORATE' | 'CLUB',
    totalPlayers: rosterPlayers.length,
    activePlayers: rosterPlayers.filter((rp) => rp.user.rating?.matchesPlayed).length,
    totalWins,
    totalLosses,
    winRate: totalWins + totalLosses > 0 
      ? Math.round((totalWins / (totalWins + totalLosses)) * 1000) / 10 
      : 0,
    totalPoints,
    medals,
    tournamentsParticipated: tournamentIds.size,
    tournamentsWon,
    avgPlayerRating,
    topPlayer: topPlayer ? {
      id: topPlayer.userId,
      name: `${topPlayer.user.firstName} ${topPlayer.user.lastName}`,
      rating: Math.round(topPlayer.user.hiddenElo),
    } : undefined,
  };
}

/**
 * Get inter-school/inter-college standings
 */
export async function calculateInterOrgStandings(
  tournamentId: string
): Promise<StandingsResult[]> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            include: {
              affiliatedOrg: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  // Group players by organization
  const orgPlayers = new Map<string, Set<string>>();
  
  for (const reg of tournament.registrations) {
    const orgId = reg.user.affiliatedOrgId;
    if (!orgId) continue;
    
    if (!orgPlayers.has(orgId)) {
      orgPlayers.set(orgId, new Set());
    }
    orgPlayers.get(orgId)!.add(reg.userId);
  }

  // Calculate standings for each organization
  const standings: StandingsResult[] = [];

  for (const [orgId, players] of orgPlayers) {
    const org = tournament.registrations[0]?.user.affiliatedOrg;
    
    // Get matches involving this org's players
    const matches = await db.match.findMany({
      where: {
        tournamentId,
        verificationStatus: 'VERIFIED',
        OR: [
          { playerAId: { in: Array.from(players) } },
          { playerBId: { in: Array.from(players) } },
        ],
      },
    });

    let wins = 0;
    let losses = 0;
    let points = 0;

    for (const match of matches) {
      const playerAWon = players.has(match.playerAId || '');
      const playerBWon = players.has(match.playerBId || '');
      
      if (match.winnerId && players.has(match.winnerId)) {
        wins++;
        points += getWinPoints(tournament.scope);
      } else if (playerAWon || playerBWon) {
        losses++;
        points += getParticipationPoints(tournament.scope);
      }
    }

    // Get medals for this org
    const results = await db.tournamentResult.findMany({
      where: {
        tournamentId,
        userId: { in: Array.from(players) },
      },
    });

    const medals = { gold: 0, silver: 0, bronze: 0 };
    for (const result of results) {
      if (result.rank === 1) medals.gold++;
      else if (result.rank === 2) medals.silver++;
      else if (result.rank === 3) medals.bronze++;
    }

    standings.push({
      competitionId: orgId,
      competitionName: org?.name || 'Unknown Organization',
      competitionType: 'INTER_ORG',
      scope: tournament.scope || 'CITY',
      entries: [{
        rank: 0, // Will be set after sorting
        playerId: '',
        playerName: org?.name || 'Unknown',
        organizationId: orgId,
        organizationName: org?.name || 'Unknown',
        wins,
        losses,
        draws: 0,
        matchesPlayed: wins + losses,
        winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
        points,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
        streak: 0,
        streakType: 'NONE',
        medalCount: medals,
      }],
      lastUpdated: new Date(),
      tiebreakers: ['points', 'wins', 'medals'],
    });
  }

  // Sort and assign ranks
  standings.sort((a, b) => {
    const entryA = a.entries[0];
    const entryB = b.entries[0];
    
    // Sort by points, then medals
    if (entryA.points !== entryB.points) return entryB.points - entryA.points;
    const medalsA = entryA.medalCount.gold * 3 + entryA.medalCount.silver * 2 + entryA.medalCount.bronze;
    const medalsB = entryB.medalCount.gold * 3 + entryB.medalCount.silver * 2 + entryB.medalCount.bronze;
    return medalsB - medalsA;
  });

  standings.forEach((s, i) => {
    s.entries[0].rank = i + 1;
  });

  return standings;
}

// ============================================
// Tiebreaker Functions
// ============================================

/**
 * Apply tiebreakers to resolve equal standings
 */
export async function applyTiebreakers(
  players: { playerId: string; wins: number; losses: number }[],
  tiebreakers: ('head_to_head' | 'point_differential' | 'strength_of_schedule' | 'most_wins')[]
): Promise<TiebreakerResult[]> {
  const results: TiebreakerResult[] = [];

  for (const player of players) {
    let tiebreakerValue = 0;
    let tiebreakerType = tiebreakers[0] || 'most_wins';

    for (const type of tiebreakers) {
      switch (type) {
        case 'most_wins':
          tiebreakerValue = player.wins * 1000 + (player.wins - player.losses) * 100;
          tiebreakerType = type;
          break;
        
        case 'point_differential':
          // Would need to query match scores
          const matches = await db.match.findMany({
            where: {
              OR: [{ playerAId: player.playerId }, { playerBId: player.playerId }],
              verificationStatus: 'VERIFIED',
            },
            select: { scoreA: true, scoreB: true, playerAId: true },
          });
          
          let diff = 0;
          for (const m of matches) {
            if (m.playerAId === player.playerId) {
              diff += (m.scoreA || 0) - (m.scoreB || 0);
            } else {
              diff += (m.scoreB || 0) - (m.scoreA || 0);
            }
          }
          tiebreakerValue = diff;
          tiebreakerType = type;
          break;
        
        case 'strength_of_schedule':
          // Calculate average opponent rating
          const userMatches = await db.match.findMany({
            where: {
              OR: [{ playerAId: player.playerId }, { playerBId: player.playerId }],
              verificationStatus: 'VERIFIED',
            },
            include: {
              playerA: { select: { hiddenElo: true } },
              playerB: { select: { hiddenElo: true } },
            },
          });
          
          let totalOpponentElo = 0;
          for (const m of userMatches) {
            const opponentElo = m.playerAId === player.playerId 
              ? (m.playerB?.hiddenElo || 1500)
              : (m.playerA?.hiddenElo || 1500);
            totalOpponentElo += opponentElo;
          }
          tiebreakerValue = userMatches.length > 0 
            ? Math.round(totalOpponentElo / userMatches.length) 
            : 0;
          tiebreakerType = type;
          break;
      }

      // If this tiebreaker provides differentiation, use it
      if (tiebreakerValue !== 0) break;
    }

    results.push({
      playerId: player.playerId,
      tiebreakerValue,
      tiebreakerType,
    });
  }

  return results.sort((a, b) => b.tiebreakerValue - a.tiebreakerValue);
}

// ============================================
// Helper Functions
// ============================================

function getWinPoints(scope: TournamentScope | null | undefined): number {
  switch (scope) {
    case 'NATIONAL': return 9;
    case 'STATE': return 6;
    case 'DISTRICT': return 4;
    case 'CITY':
    default: return 3;
  }
}

function getParticipationPoints(scope: TournamentScope | null | undefined): number {
  switch (scope) {
    case 'NATIONAL': return 3;
    case 'STATE': return 2;
    case 'DISTRICT': return 1;
    case 'CITY':
    default: return 1;
  }
}

// ============================================
// Export Aggregation Utilities
// ============================================

export const aggregationUtils = {
  getWinPoints,
  getParticipationPoints,
};
