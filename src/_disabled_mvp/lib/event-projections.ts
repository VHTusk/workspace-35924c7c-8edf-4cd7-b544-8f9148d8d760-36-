/**
 * VALORHIVE Event Projections
 * 
 * Precomputed read models (projections) for fast queries.
 * These are updated by event handlers and provide denormalized data
 * for common queries without expensive joins.
 * 
 * Projections:
 * - LeaderboardProjection: Precomputed rankings
 * - CityStatsProjection: City-level statistics
 * - PlayerStatsProjection: Player statistics cache
 * - TournamentStatsProjection: Tournament statistics
 * 
 * @module event-projections
 */

import { db } from './db';
import { SportType, LeaderboardType } from '@prisma/client';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';

const logger = createLogger('EventProjections');

// ============================================
// Types and Interfaces
// ============================================

export interface LeaderboardProjection {
  sport: SportType;
  type: LeaderboardType;
  scopeValue: string | null;
  userId: string;
  rank: number;
  points: number;
  elo: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  rankChange: number | null;
  updatedAt: Date;
}

export interface CityStatsProjection {
  city: string;
  state: string;
  sport: SportType;
  totalPlayers: number;
  activePlayers: number;
  totalTournaments: number;
  upcomingTournaments: number;
  completedMatches: number;
  averageRating: number;
  topPlayerId: string | null;
  topPlayerName: string | null;
  updatedAt: Date;
}

export interface PlayerStatsProjection {
  userId: string;
  sport: SportType;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  totalPoints: number;
  currentElo: number;
  peakElo: number;
  badges: string[];
  lastMatchAt: Date | null;
  lastTournamentAt: Date | null;
  updatedAt: Date;
}

export interface TournamentStatsProjection {
  tournamentId: string;
  sport: SportType;
  totalRegistrations: number;
  activePlayers: number;
  completedMatches: number;
  pendingMatches: number;
  totalPointsAwarded: number;
  averageMatchDuration: number;
  topScorerId: string | null;
  updatedAt: Date;
}

// ============================================
// Redis Keys
// ============================================

const REDIS_KEY_PREFIX = 'projection:';
const LEADERBOARD_KEY = (sport: SportType, type: LeaderboardType, scope?: string) =>
  `${REDIS_KEY_PREFIX}leaderboard:${sport}:${type}:${scope || 'all'}`;
const CITY_STATS_KEY = (city: string, sport: SportType) =>
  `${REDIS_KEY_PREFIX}city_stats:${city}:${sport}`;
const PLAYER_STATS_KEY = (userId: string) =>
  `${REDIS_KEY_PREFIX}player_stats:${userId}`;
const TOURNAMENT_STATS_KEY = (tournamentId: string) =>
  `${REDIS_KEY_PREFIX}tournament_stats:${tournamentId}`;

// ============================================
// Leaderboard Projection
// ============================================

/**
 * Update leaderboard projection after ranking changes
 */
export async function updateLeaderboardProjection(
  sport: SportType,
  type: LeaderboardType,
  scopeValue?: string
): Promise<void> {
  const redis = await getPrimaryClient();
  if (!redis) {
    logger.warn('Redis not available for leaderboard projection');
    return;
  }

  logger.info(`Updating leaderboard projection: ${sport}:${type}:${scopeValue || 'all'}`);

  // Build query based on leaderboard type
  const where: Record<string, unknown> = {
    sport,
    isActive: true,
    isAnonymized: false,
    showOnLeaderboard: true,
  };

  if (type === LeaderboardType.CITY && scopeValue) {
    where.city = scopeValue;
  } else if (type === LeaderboardType.DISTRICT && scopeValue) {
    where.district = scopeValue;
  } else if (type === LeaderboardType.STATE && scopeValue) {
    where.state = scopeValue;
  }

  // Get all players for this leaderboard
  const players = await db.user.findMany({
    where,
    orderBy: { visiblePoints: 'desc' },
    include: {
      rating: true,
    },
  });

  // Get previous rankings for comparison
  const key = LEADERBOARD_KEY(sport, type, scopeValue);
  const previousRankings = await redis.hgetall(`${key}:ranks`);

  // Clear existing projection
  await redis.del(key);
  await redis.del(`${key}:ranks`);
  await redis.del(`${key}:details`);

  // Build new projection
  const pipeline = redis.pipeline();
  const detailsHash: Record<string, string> = {};
  const ranksHash: Record<string, string> = {};

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const rank = i + 1;
    const previousRank = previousRankings[player.id] ? parseInt(previousRankings[player.id], 10) : null;
    const rankChange = previousRank ? previousRank - rank : null;

    // Add to sorted set
    pipeline.zadd(key, player.visiblePoints, player.id);

    // Store details
    const details = {
      name: `${player.firstName} ${player.lastName}`,
      city: player.city || '',
      state: player.state || '',
      elo: player.hiddenElo,
      tier: getTierFromElo(player.hiddenElo, player.rating?.matchesPlayed || 0),
      matches: player.rating?.matchesPlayed || 0,
      wins: player.rating?.wins || 0,
      winRate: player.rating?.matchesPlayed
        ? Math.round((player.rating.wins / player.rating.matchesPlayed) * 100)
        : 0,
      rankChange,
    };

    detailsHash[player.id] = JSON.stringify(details);
    ranksHash[player.id] = String(rank);
  }

  // Execute pipeline
  await pipeline.exec();

  // Store details and ranks
  if (Object.keys(detailsHash).length > 0) {
    await redis.hset(`${key}:details`, detailsHash);
    await redis.hset(`${key}:ranks`, ranksHash);
  }

  // Set TTL (1 hour)
  await redis.expire(key, 3600);
  await redis.expire(`${key}:details`, 3600);
  await redis.expire(`${key}:ranks`, 3600);

  // Store in database for persistence
  await storeLeaderboardSnapshot(sport, type, scopeValue, players);

  logger.info(`Updated leaderboard projection with ${players.length} players`);
}

/**
 * Get leaderboard from projection
 */
export async function getLeaderboardProjection(
  sport: SportType,
  type: LeaderboardType,
  scopeValue?: string,
  limit: number = 100,
  offset: number = 0
): Promise<LeaderboardProjection[]> {
  const redis = await getPrimaryClient();

  if (redis) {
    const key = LEADERBOARD_KEY(sport, type, scopeValue);
    const exists = await redis.exists(key);

    if (exists) {
      // Get from Redis
      const playerIds = await redis.zrevrange(key, offset, offset + limit - 1);
      const details = await redis.hmget(`${key}:details`, ...playerIds);

      return playerIds.map((id, index) => {
        const detail = details[index] ? JSON.parse(details[index]) : {};
        return {
          sport,
          type,
          scopeValue: scopeValue || null,
          userId: id,
          rank: offset + index + 1,
          points: 0, // Would need to fetch from sorted set
          elo: detail.elo || 0,
          matchesPlayed: detail.matches || 0,
          wins: detail.wins || 0,
          winRate: detail.winRate || 0,
          rankChange: detail.rankChange || null,
          updatedAt: new Date(),
        };
      });
    }
  }

  // Fallback to database snapshot
  return getLeaderboardFromSnapshot(sport, type, scopeValue, limit, offset);
}

/**
 * Store leaderboard snapshot in database
 */
async function storeLeaderboardSnapshot(
  sport: SportType,
  type: LeaderboardType,
  scopeValue: string | undefined,
  players: any[]
): Promise<void> {
  const snapshotDate = new Date();

  // Mark old snapshots as inactive
  await db.leaderboardSnapshot.updateMany({
    where: {
      sport,
      type,
      scopeValue: scopeValue || null,
      isActive: true,
    },
    data: { isActive: false },
  });

  // Create new snapshots
  const snapshots = players.slice(0, 1000).map((player, index) => ({
    sport,
    type,
    scopeValue: scopeValue || null,
    periodStart: snapshotDate,
    snapshotDate,
    userId: player.id,
    rank: index + 1,
    visiblePoints: player.visiblePoints,
    hiddenElo: player.hiddenElo,
    matchesPlayed: player.rating?.matchesPlayed || 0,
    wins: player.rating?.wins || 0,
    winRate: player.rating?.matchesPlayed
      ? (player.rating.wins / player.rating.matchesPlayed) * 100
      : 0,
    isActive: true,
    computedAt: snapshotDate,
  }));

  if (snapshots.length > 0) {
    await db.leaderboardSnapshot.createMany({ data: snapshots, skipDuplicates: true });
  }
}

/**
 * Get leaderboard from database snapshot
 */
async function getLeaderboardFromSnapshot(
  sport: SportType,
  type: LeaderboardType,
  scopeValue: string | undefined,
  limit: number,
  offset: number
): Promise<LeaderboardProjection[]> {
  const snapshots = await db.leaderboardSnapshot.findMany({
    where: {
      sport,
      type,
      scopeValue: scopeValue || null,
      isActive: true,
    },
    orderBy: { rank: 'asc' },
    skip: offset,
    take: limit,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return snapshots.map(s => ({
    sport: s.sport,
    type: s.type,
    scopeValue: s.scopeValue,
    userId: s.userId,
    rank: s.rank,
    points: s.visiblePoints,
    elo: Math.round(s.hiddenElo),
    matchesPlayed: s.matchesPlayed,
    wins: s.wins,
    winRate: Math.round(s.winRate),
    rankChange: s.rankChange,
    updatedAt: s.computedAt,
  }));
}

// ============================================
// City Stats Projection
// ============================================

/**
 * Update city statistics projection
 */
export async function updateCityStatsProjection(
  city: string,
  state: string,
  sport: SportType
): Promise<CityStatsProjection | null> {
  const redis = await getPrimaryClient();

  logger.info(`Updating city stats projection: ${city}, ${state}`);

  // Compute stats
  const [
    totalPlayers,
    activePlayers,
    tournamentStats,
    completedMatches,
    avgRating,
    topPlayer,
  ] = await Promise.all([
    // Total players
    db.user.count({
      where: { sport, city, state, isActive: true, isAnonymized: false },
    }),

    // Active players (played in last 30 days)
    db.user.count({
      where: {
        sport,
        city,
        state,
        isActive: true,
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Tournament stats
    db.tournament.groupBy({
      by: ['status'],
      where: { sport, city, state },
      _count: true,
    }),

    // Completed matches
    db.match.count({
      where: {
        sport,
        outcome: { not: null },
        tournament: { city, state },
      },
    }),

    // Average rating
    db.user.aggregate({
      where: { sport, city, state, isActive: true },
      _avg: { hiddenElo: true },
    }),

    // Top player
    db.user.findFirst({
      where: { sport, city, state, isActive: true },
      orderBy: { visiblePoints: 'desc' },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const totalTournaments = tournamentStats.reduce((sum, s) => sum + s._count, 0);
  const upcomingTournaments = tournamentStats
    .filter(s => s.status === 'REGISTRATION_OPEN' || s.status === 'DRAFT')
    .reduce((sum, s) => sum + s._count, 0);

  const projection: CityStatsProjection = {
    city,
    state,
    sport,
    totalPlayers,
    activePlayers,
    totalTournaments,
    upcomingTournaments,
    completedMatches,
    averageRating: Math.round(avgRating._avg.hiddenElo || 0),
    topPlayerId: topPlayer?.id || null,
    topPlayerName: topPlayer ? `${topPlayer.firstName} ${topPlayer.lastName}` : null,
    updatedAt: new Date(),
  };

  // Store in Redis
  if (redis) {
    const key = CITY_STATS_KEY(city, sport);
    await redis.setex(key, 300, JSON.stringify(projection)); // 5-minute TTL
  }

  // Store in database for persistence
  await db.cityStatsSnapshot.upsert({
    where: {
      city_state_sport: { city, state, sport },
    },
    update: {
      totalPlayers,
      activePlayers,
      totalTournaments,
      upcomingTournaments,
      completedMatches,
      averageRating: projection.averageRating,
      topPlayerId: projection.topPlayerId,
      snapshotDate: new Date(),
    },
    create: {
      city,
      state,
      sport,
      totalPlayers,
      activePlayers,
      totalTournaments,
      upcomingTournaments,
      completedMatches,
      averageRating: projection.averageRating,
      topPlayerId: projection.topPlayerId,
      snapshotDate: new Date(),
    },
  }).catch(err => logger.warn('Failed to store city stats snapshot:', err));

  return projection;
}

/**
 * Get city stats from projection
 */
export async function getCityStatsProjection(
  city: string,
  sport: SportType
): Promise<CityStatsProjection | null> {
  const redis = await getPrimaryClient();

  if (redis) {
    const key = CITY_STATS_KEY(city, sport);
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Fallback to database
  const snapshot = await db.cityStatsSnapshot.findFirst({
    where: { city, sport },
    orderBy: { snapshotDate: 'desc' },
  });

  if (!snapshot) return null;

  return {
    city: snapshot.city,
    state: snapshot.state,
    sport: snapshot.sport,
    totalPlayers: snapshot.totalPlayers,
    activePlayers: snapshot.activePlayers,
    totalTournaments: snapshot.totalTournaments,
    upcomingTournaments: snapshot.upcomingTournaments,
    completedMatches: snapshot.completedMatches,
    averageRating: snapshot.averageRating,
    topPlayerId: snapshot.topPlayerId,
    topPlayerName: null, // Would need to join
    updatedAt: snapshot.snapshotDate,
  };
}

// ============================================
// Player Stats Projection
// ============================================

/**
 * Update player statistics projection
 */
export async function updatePlayerStatsProjection(
  userId: string,
  sport: SportType
): Promise<PlayerStatsProjection | null> {
  const redis = await getPrimaryClient();

  logger.debug(`Updating player stats projection: ${userId}`);

  // Get player data
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      rating: true,
      tournamentRegs: {
        where: { status: 'CONFIRMED' },
        select: { tournamentId: true, createdAt: true },
      },
      matchesAsA: {
        where: { outcome: { not: null } },
        select: { playedAt: true, winnerId: true },
      },
      matchesAsB: {
        where: { outcome: { not: null } },
        select: { playedAt: true, winnerId: true },
      },
    },
  });

  if (!user) return null;

  // Calculate stats
  const matches = [...user.matchesAsA, ...user.matchesAsB];
  const wins = matches.filter(m => m.winnerId === userId).length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Get tournament wins
  const tournamentWins = await db.tournamentResult.count({
    where: { userId, position: 1 },
  });

  // Get badges
  const achievements = await db.playerAchievement.findMany({
    where: { userId },
    select: { type: true },
  });

  const projection: PlayerStatsProjection = {
    userId,
    sport,
    totalMatches: matches.length,
    wins,
    losses,
    winRate,
    currentStreak: calculateCurrentStreak(userId, matches),
    bestStreak: user.rating?.bestStreak || 0,
    tournamentsPlayed: user.tournamentRegs.length,
    tournamentsWon: tournamentWins,
    totalPoints: user.visiblePoints,
    currentElo: Math.round(user.hiddenElo),
    peakElo: user.rating?.peakElo || Math.round(user.hiddenElo),
    badges: achievements.map(a => a.type),
    lastMatchAt: matches.length > 0 
      ? new Date(Math.max(...matches.map(m => m.playedAt.getTime())))
      : null,
    lastTournamentAt: user.tournamentRegs.length > 0
      ? new Date(Math.max(...user.tournamentRegs.map(t => t.createdAt.getTime())))
      : null,
    updatedAt: new Date(),
  };

  // Store in Redis
  if (redis) {
    const key = PLAYER_STATS_KEY(userId);
    await redis.setex(key, 300, JSON.stringify(projection)); // 5-minute TTL
  }

  // Update PlayerSkillMetrics
  await db.playerSkillMetrics.upsert({
    where: { userId },
    update: {
      totalWins: wins,
      totalLosses: losses,
      currentStreak: projection.currentStreak,
      bestStreak: projection.bestStreak,
      lastMatchAt: projection.lastMatchAt,
    },
    create: {
      userId,
      totalWins: wins,
      totalLosses: losses,
      currentStreak: projection.currentStreak,
      bestStreak: projection.bestStreak,
      lastMatchAt: projection.lastMatchAt,
    },
  }).catch(err => logger.warn('Failed to update player skill metrics:', err));

  return projection;
}

/**
 * Get player stats from projection
 */
export async function getPlayerStatsProjection(
  userId: string
): Promise<PlayerStatsProjection | null> {
  const redis = await getPrimaryClient();

  if (redis) {
    const key = PLAYER_STATS_KEY(userId);
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Recompute and return
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sport: true },
  });

  if (!user) return null;

  return updatePlayerStatsProjection(userId, user.sport);
}

// ============================================
// Helper Functions
// ============================================

function getTierFromElo(elo: number, matchesPlayed: number): string {
  if (matchesPlayed < 5) return 'UNRANKED';
  if (elo >= 2200) return 'GRANDMASTER';
  if (elo >= 2000) return 'MASTER';
  if (elo >= 1800) return 'DIAMOND';
  if (elo >= 1600) return 'PLATINUM';
  if (elo >= 1400) return 'GOLD';
  if (elo >= 1200) return 'SILVER';
  return 'BRONZE';
}

function calculateCurrentStreak(userId: string, matches: any[]): number {
  if (matches.length === 0) return 0;

  const sortedMatches = matches.sort((a, b) => 
    new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );

  let streak = 0;
  for (const match of sortedMatches) {
    if (match.winnerId === userId) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ============================================
// Projection Refresh Service
// ============================================

export async function refreshAllProjections(sport: SportType): Promise<void> {
  logger.info(`Refreshing all projections for ${sport}`);

  // Refresh leaderboards
  const leaderboardTypes: LeaderboardType[] = [
    LeaderboardType.NATIONAL,
    LeaderboardType.STATE,
    LeaderboardType.DISTRICT,
    LeaderboardType.CITY,
  ];

  for (const type of leaderboardTypes) {
    await updateLeaderboardProjection(sport, type);
  }

  // Refresh city stats (top 50 cities by player count)
  const cities = await db.user.groupBy({
    by: ['city', 'state'],
    where: { sport, isActive: true, city: { not: null } },
    _count: true,
    orderBy: { _count: { city: true } },
    take: 50,
  });

  for (const { city, state } of cities) {
    if (city && state) {
      await updateCityStatsProjection(city, state, sport);
    }
  }

  logger.info('All projections refreshed');
}

export async function scheduleProjectionRefresh(): Promise<void> {
  // This would be called by a cron job
  const sports = [SportType.CORNHOLE, SportType.DARTS];

  for (const sport of sports) {
    await refreshAllProjections(sport);
  }
}
