/**
 * Leaderboard Engine - Event-driven leaderboard computation
 * 
 * Features:
 * - Precomputed rankings for fast reads
 * - Event-driven updates (match completed, tournament completed, rating change)
 * - Redis sorted sets for real-time rankings
 * - Cache invalidation support
 * - Multiple leaderboard types (City, District, State, National, Tournament)
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection for sorted sets
 * - LEADERBOARD_BATCH_SIZE: Batch size for computation (default: 100)
 * - LEADERBOARD_CACHE_TTL: Cache TTL in seconds (default: 3600)
 */

import { db } from '@/lib/db';
import { SportType, LeaderboardType } from '@prisma/client';
import { getPrimaryClient } from './redis-config';
import { createLogger } from './logger';
import { addJob, createScoringJob } from './job-queue';
import { invalidateLeaderboardCache } from './cache-invalidation';
import { buildLeaderboardEligibleUserWhere } from './user-sport';

const logger = createLogger('LeaderboardEngine');

// ============================================
// Types and Interfaces
// ============================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  city?: string | null;
  state?: string | null;
  points: number;
  elo: number;
  tier: string;
  matches: number;
  wins: number;
  winRate: number;
  rankChange?: number | null;
  pointsChange?: number | null;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  total: number;
  scope: string;
  type: LeaderboardType;
  computedAt: Date;
  fromCache: boolean;
}

export interface LeaderboardComputeOptions {
  sport: SportType;
  type: LeaderboardType;
  scopeValue?: string;
  limit?: number;
  offset?: number;
}

export interface PlayerRankingUpdate {
  userId: string;
  sport: SportType;
  pointsChange: number;
  eloChange: number;
  matchCompleted?: boolean;
  tournamentId?: string;
}

export interface LeaderboardStats {
  totalPlayers: number;
  activeThisMonth: number;
  averageElo: number;
  topPlayerId?: string;
  topPlayerName?: string;
}

// ============================================
// Constants
// ============================================

const REDIS_KEY_PREFIX = 'leaderboard:';
const BATCH_SIZE = parseInt(process.env.LEADERBOARD_BATCH_SIZE || '100', 10);
const CACHE_TTL = parseInt(process.env.LEADERBOARD_CACHE_TTL || '3600', 10);

// Tier thresholds
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 1200,
  GOLD: 1400,
  PLATINUM: 1600,
  DIAMOND: 1800,
  MASTER: 2000,
  GRANDMASTER: 2200,
};

// ============================================
// Redis Key Generators
// ============================================

function getRedisKey(sport: SportType, type: LeaderboardType, scopeValue?: string): string {
  const scope = scopeValue || 'all';
  return `${REDIS_KEY_PREFIX}${sport}:${type}:${scope}`;
}

function getRedisHashKey(sport: SportType, type: LeaderboardType, scopeValue?: string): string {
  const scope = scopeValue || 'all';
  return `${REDIS_KEY_PREFIX}${sport}:${type}:${scope}:hash`;
}

// ============================================
// Helper Functions
// ============================================

export function getEloTier(elo: number, matchesPlayed: number): string {
  // Require minimum matches for tier
  if (matchesPlayed < 5) return 'UNRANKED';
  
  if (elo >= TIER_THRESHOLDS.GRANDMASTER) return 'GRANDMASTER';
  if (elo >= TIER_THRESHOLDS.MASTER) return 'MASTER';
  if (elo >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND';
  if (elo >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (elo >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (elo >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

function getDateForSnapshot(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ============================================
// Core Leaderboard Functions
// ============================================

/**
 * Get leaderboard from precomputed data with fallback to live computation
 */
export async function getLeaderboard(
  options: LeaderboardComputeOptions
): Promise<LeaderboardResult> {
  const { sport, type, scopeValue, limit = 100, offset = 0 } = options;
  
  try {
    // Try to get from Redis sorted set first
    const redisClient = await getPrimaryClient();
    
    if (redisClient) {
      const cached = await getFromRedisCache(redisClient, sport, type, scopeValue, limit, offset);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
        };
      }
    }
    
    // Try to get from database snapshots
    const snapshotData = await getFromSnapshots(sport, type, scopeValue, limit, offset);
    if (snapshotData) {
      return {
        ...snapshotData,
        fromCache: true,
      };
    }
    
    // Fallback to live computation
    logger.info(`Computing live leaderboard for ${sport}:${type}:${scopeValue || 'all'}`);
    const liveData = await computeLeaderboardLive(sport, type, scopeValue, limit, offset);
    
    return {
      ...liveData,
      fromCache: false,
    };
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    throw error;
  }
}

/**
 * Get leaderboard from Redis sorted set cache
 */
async function getFromRedisCache(
  redisClient: NonNullable<Awaited<ReturnType<typeof getPrimaryClient>>>,
  sport: SportType,
  type: LeaderboardType,
  scopeValue: string | undefined,
  limit: number,
  offset: number
): Promise<LeaderboardResult | null> {
  try {
    const key = getRedisKey(sport, type, scopeValue);
    const hashKey = getRedisHashKey(sport, type, scopeValue);
    
    // Check if key exists
    const exists = await redisClient.exists(key);
    if (!exists) {
      return null;
    }
    
    // Get total count
    const total = await redisClient.zcard(key);
    
    // Get entries (Redis sorted sets are 0-indexed)
    const entries = await redisClient.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');
    
    if (entries.length === 0) {
      return null;
    }
    
    // Get user details from hash
    const leaderboard: LeaderboardEntry[] = [];
    
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const score = parseInt(entries[i + 1], 10);
      
      // Get user details from hash
      const userDetails = await redisClient.hgetall(`${hashKey}:${userId}`);
      
      if (userDetails) {
        leaderboard.push({
          rank: offset + (i / 2) + 1,
          userId,
          name: userDetails.name || 'Unknown',
          city: userDetails.city || null,
          state: userDetails.state || null,
          points: score,
          elo: parseFloat(userDetails.elo || '0'),
          tier: userDetails.tier || 'BRONZE',
          matches: parseInt(userDetails.matches || '0', 10),
          wins: parseInt(userDetails.wins || '0', 10),
          winRate: parseFloat(userDetails.winRate || '0'),
          rankChange: userDetails.rankChange ? parseInt(userDetails.rankChange, 10) : null,
        });
      }
    }
    
    return {
      entries: leaderboard,
      total,
      scope: scopeValue || 'all',
      type,
      computedAt: new Date(),
      fromCache: true,
    };
  } catch (error) {
    logger.error('Error getting from Redis cache:', error);
    return null;
  }
}

/**
 * Get leaderboard from database snapshots
 */
async function getFromSnapshots(
  sport: SportType,
  type: LeaderboardType,
  scopeValue: string | undefined,
  limit: number,
  offset: number
): Promise<LeaderboardResult | null> {
  try {
    const snapshotDate = getDateForSnapshot();
    
    // Get total count
    const total = await db.leaderboardSnapshot.count({
      where: {
        sport,
        type,
        scopeValue: scopeValue || null,
        isActive: true,
      },
    });
    
    if (total === 0) {
      return null;
    }
    
    // Get entries
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
            city: true,
            state: true,
          },
        },
      },
    });
    
    if (snapshots.length === 0) {
      return null;
    }
    
    const leaderboard: LeaderboardEntry[] = snapshots.map((snapshot, index) => ({
      rank: offset + index + 1,
      userId: snapshot.userId,
      name: `${snapshot.user.firstName} ${snapshot.user.lastName}`,
      city: snapshot.user.city,
      state: snapshot.user.state,
      points: snapshot.visiblePoints,
      elo: Math.round(snapshot.hiddenElo),
      tier: getEloTier(snapshot.hiddenElo, snapshot.matchesPlayed),
      matches: snapshot.matchesPlayed,
      wins: snapshot.wins,
      winRate: snapshot.winRate,
      rankChange: snapshot.rankChange,
      pointsChange: snapshot.pointsChange,
    }));
    
    return {
      entries: leaderboard,
      total,
      scope: scopeValue || 'all',
      type,
      computedAt: snapshots[0]?.computedAt || new Date(),
      fromCache: true,
    };
  } catch (error) {
    logger.error('Error getting from snapshots:', error);
    return null;
  }
}

/**
 * Compute leaderboard live from database
 */
async function computeLeaderboardLive(
  sport: SportType,
  type: LeaderboardType,
  scopeValue: string | undefined,
  limit: number,
  offset: number
): Promise<LeaderboardResult> {
  const where = buildLeaderboardEligibleUserWhere(sport, { requirePublic: true });
  
  // Apply scope filter
  if (type === LeaderboardType.CITY && scopeValue) {
    where.city = scopeValue;
  } else if (type === LeaderboardType.DISTRICT && scopeValue) {
    where.district = scopeValue;
  } else if (type === LeaderboardType.STATE && scopeValue) {
    where.state = scopeValue;
  } else if (type === LeaderboardType.TOURNAMENT && scopeValue) {
    // For tournament leaderboard, we need to get players from tournament registrations
    const tournamentRegs = await db.tournamentRegistration.findMany({
      where: { tournamentId: scopeValue },
      select: { userId: true },
    });
    where.id = { in: tournamentRegs.map(r => r.userId) };
  }
  
  // Get total count
  const total = await db.user.count({ where });
  
  // Get users with pagination
  const users = await db.user.findMany({
    where,
    orderBy: { visiblePoints: 'desc' },
    skip: offset,
    take: limit,
    include: {
      rating: true,
    },
  });
  
  const leaderboard: LeaderboardEntry[] = users.map((user, index) => ({
    rank: offset + index + 1,
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    city: user.city,
    state: user.state,
    points: user.visiblePoints,
    elo: Math.round(user.hiddenElo),
    tier: getEloTier(user.hiddenElo, user.rating?.matchesPlayed || 0),
    matches: user.rating?.matchesPlayed || 0,
    wins: user.rating?.wins || 0,
    winRate: user.rating?.matchesPlayed
      ? Math.round((user.rating.wins / user.rating.matchesPlayed) * 100)
      : 0,
  }));
  
  return {
    entries: leaderboard,
    total,
    scope: scopeValue || 'all',
    type,
    computedAt: new Date(),
    fromCache: false,
  };
}

// ============================================
// Background Computation
// ============================================

/**
 * Compute and store leaderboard in background
 * This is typically called by the BullMQ worker
 */
export async function computeLeaderboard(
  options: LeaderboardComputeOptions
): Promise<{ processed: number; cached: boolean }> {
  const { sport, type, scopeValue } = options;
  
  try {
    logger.info(`Computing leaderboard: ${sport}:${type}:${scopeValue || 'all'}`);
    
    // Get all eligible players
    const where = buildLeaderboardEligibleUserWhere(sport, { requirePublic: true });
    
    // Apply scope filter
    if (type === LeaderboardType.CITY && scopeValue) {
      where.city = scopeValue;
    } else if (type === LeaderboardType.DISTRICT && scopeValue) {
      where.district = scopeValue;
    } else if (type === LeaderboardType.STATE && scopeValue) {
      where.state = scopeValue;
    } else if (type === LeaderboardType.TOURNAMENT && scopeValue) {
      const tournamentRegs = await db.tournamentRegistration.findMany({
        where: { tournamentId: scopeValue },
        select: { userId: true },
      });
      where.id = { in: tournamentRegs.map(r => r.userId) };
    }
    
    // Get all users for this leaderboard
    const users = await db.user.findMany({
      where,
      orderBy: { visiblePoints: 'desc' },
      include: {
        rating: true,
      },
    });
    
    if (users.length === 0) {
      return { processed: 0, cached: false };
    }
    
    // Store in Redis sorted set
    const redisClient = await getPrimaryClient();
    const key = getRedisKey(sport, type, scopeValue);
    const hashKey = getRedisHashKey(sport, type, scopeValue);
    
    if (redisClient) {
      // Clear existing data
      await redisClient.del(key);
      
      // Process in batches
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        
        // Add to sorted set (score is visiblePoints)
        const zaddArgs: (string | number)[] = [];
        for (const user of batch) {
          zaddArgs.push(user.visiblePoints, user.id);
        }
        
        if (zaddArgs.length > 0) {
          await redisClient.zadd(key, ...zaddArgs);
        }
        
        // Store user details in hash
        for (const user of batch) {
          await redisClient.hset(`${hashKey}:${user.id}`, {
            name: `${user.firstName} ${user.lastName}`,
            city: user.city || '',
            state: user.state || '',
            elo: user.hiddenElo.toString(),
            tier: getEloTier(user.hiddenElo, user.rating?.matchesPlayed || 0),
            matches: (user.rating?.matchesPlayed || 0).toString(),
            wins: (user.rating?.wins || 0).toString(),
            winRate: user.rating?.matchesPlayed
              ? Math.round((user.rating.wins / user.rating.matchesPlayed) * 100).toString()
              : '0',
          });
        }
      }
      
      // Set TTL
      await redisClient.expire(key, CACHE_TTL);
    }
    
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
    
    // Store snapshots in database
    const snapshotDate = getDateForSnapshot();
    const periodStart = snapshotDate;
    const periodEnd = null; // Current active period
    
    // Get previous snapshots for rank comparison
    const previousSnapshots = await db.leaderboardSnapshot.findMany({
      where: {
        sport,
        type,
        scopeValue: scopeValue || null,
        isActive: false,
      },
      orderBy: { snapshotDate: 'desc' },
      take: users.length,
    });
    
    const previousRankMap = new Map(
      previousSnapshots.map(s => [s.userId, s.rank])
    );
    
    // Create new snapshots
    const snapshotData = users.map((user, index) => ({
      sport,
      type,
      scopeValue: scopeValue || null,
      periodStart,
      periodEnd,
      snapshotDate,
      userId: user.id,
      rank: index + 1,
      previousRank: previousRankMap.get(user.id) || null,
      visiblePoints: user.visiblePoints,
      hiddenElo: user.hiddenElo,
      matchesPlayed: user.rating?.matchesPlayed || 0,
      wins: user.rating?.wins || 0,
      winRate: user.rating?.matchesPlayed
        ? (user.rating.wins / user.rating.matchesPlayed) * 100
        : 0,
      rankChange: previousRankMap.has(user.id)
        ? (previousRankMap.get(user.id) || 0) - (index + 1)
        : null,
      isActive: true,
      computedAt: new Date(),
    }));
    
    // Insert in batches
    for (let i = 0; i < snapshotData.length; i += BATCH_SIZE) {
      const batch = snapshotData.slice(i, i + BATCH_SIZE);
      await db.leaderboardSnapshot.createMany({ data: batch });
    }
    
    logger.info(`Computed leaderboard for ${users.length} players`);
    
    return { processed: users.length, cached: true };
  } catch (error) {
    logger.error('Error computing leaderboard:', error);
    throw error;
  }
}

// ============================================
// Event-Driven Update Functions
// ============================================

/**
 * Update player ranking after match/tournament
 */
export async function updatePlayerRanking(update: PlayerRankingUpdate): Promise<void> {
  const { userId, sport, matchCompleted, tournamentId } = update;
  
  try {
    // Get user details to determine affected leaderboards
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        city: true,
        district: true,
        state: true,
        visiblePoints: true,
        hiddenElo: true,
      },
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found for ranking update`);
      return;
    }
    
    // Determine which leaderboards need updating
    const leaderboardsToUpdate: Array<{ type: LeaderboardType; scopeValue?: string }> = [];
    
    // Always update national leaderboard
    leaderboardsToUpdate.push({ type: LeaderboardType.NATIONAL });
    
    // Update state leaderboard if user has state
    if (user.state) {
      leaderboardsToUpdate.push({ type: LeaderboardType.STATE, scopeValue: user.state });
    }
    
    // Update district leaderboard if user has district
    if (user.district) {
      leaderboardsToUpdate.push({ type: LeaderboardType.DISTRICT, scopeValue: user.district });
    }
    
    // Update city leaderboard if user has city
    if (user.city) {
      leaderboardsToUpdate.push({ type: LeaderboardType.CITY, scopeValue: user.city });
    }
    
    // Update tournament leaderboard if specified
    if (tournamentId) {
      leaderboardsToUpdate.push({ type: LeaderboardType.TOURNAMENT, scopeValue: tournamentId });
    }
    
    // Queue update jobs
    for (const lb of leaderboardsToUpdate) {
      await addJob('scoring', createScoringJob('leaderboard', {
        sport,
        type: lb.type,
        scopeValue: lb.scopeValue,
        reason: matchCompleted ? 'match_completed' : 'rating_change',
        userId,
      }, {
        priority: 'normal',
        tournamentId,
      }));
    }
    
    // Invalidate cache
    await invalidateLeaderboardCache(sport, 'all');
    
    logger.debug(`Queued ranking update for ${userId} across ${leaderboardsToUpdate.length} leaderboards`);
  } catch (error) {
    logger.error('Error updating player ranking:', error);
    throw error;
  }
}

/**
 * Invalidate leaderboard cache
 */
export async function invalidateLeaderboard(
  sport: SportType,
  type?: LeaderboardType,
  scopeValue?: string
): Promise<void> {
  try {
    const redisClient = await getPrimaryClient();
    
    if (!redisClient) {
      return;
    }
    
    if (type) {
      // Invalidate specific leaderboard
      const key = getRedisKey(sport, type, scopeValue);
      const hashKey = getRedisHashKey(sport, type, scopeValue);
      
      await redisClient.del(key);
      
      // Delete all hash keys (we need to scan for this)
      const pattern = `${hashKey}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      // Invalidate all leaderboards for this sport
      const pattern = `${REDIS_KEY_PREFIX}${sport}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }
    
    // Also invalidate via cache invalidation module
    await invalidateLeaderboardCache(sport, scopeValue);
    
    logger.debug(`Invalidated leaderboard cache for ${sport}:${type || 'all'}:${scopeValue || 'all'}`);
  } catch (error) {
    logger.error('Error invalidating leaderboard:', error);
    throw error;
  }
}

// ============================================
// Leaderboard Stats Functions
// ============================================

/**
 * Get leaderboard statistics
 */
export async function getLeaderboardStats(
  sport: SportType,
  type: LeaderboardType = LeaderboardType.NATIONAL,
  scopeValue?: string
): Promise<LeaderboardStats> {
  try {
    const where = buildLeaderboardEligibleUserWhere(sport, { requirePublic: true });
    
    // Apply scope filter
    if (type === LeaderboardType.CITY && scopeValue) {
      where.city = scopeValue;
    } else if (type === LeaderboardType.DISTRICT && scopeValue) {
      where.district = scopeValue;
    } else if (type === LeaderboardType.STATE && scopeValue) {
      where.state = scopeValue;
    }
    
    // Get stats
    const [totalPlayers, activeThisMonth, avgElo, topPlayer] = await Promise.all([
      db.user.count({ where }),
      db.user.count({
        where: {
          ...where,
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.user.aggregate({
        where,
        _avg: { hiddenElo: true },
      }),
      db.user.findFirst({
        where,
        orderBy: { visiblePoints: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);
    
    return {
      totalPlayers,
      activeThisMonth,
      averageElo: Math.round(avgElo._avg.hiddenElo || 0),
      topPlayerId: topPlayer?.id,
      topPlayerName: topPlayer ? `${topPlayer.firstName} ${topPlayer.lastName}` : undefined,
    };
  } catch (error) {
    logger.error('Error getting leaderboard stats:', error);
    throw error;
  }
}

// ============================================
// Scope Discovery Functions
// ============================================

/**
 * Get all unique scope values for a leaderboard type
 */
export async function getLeaderboardScopes(
  sport: SportType,
  type: LeaderboardType
): Promise<string[]> {
  try {
    const field = type === LeaderboardType.CITY 
      ? 'city' 
      : type === LeaderboardType.DISTRICT 
        ? 'district' 
        : type === LeaderboardType.STATE 
          ? 'state' 
          : null;
    
    if (!field) {
      return [];
    }
    
    const results = await db.user.findMany({
      where: {
        ...buildLeaderboardEligibleUserWhere(sport, { requirePublic: true }),
        [field]: { not: null },
      },
      select: { [field]: true },
      distinct: [field],
    });
    
    return results.reduce<string[]>((scopes, result) => {
      const value = (result as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.length > 0) {
        scopes.push(value);
      }
      return scopes;
    }, []);
  } catch (error) {
    logger.error('Error getting leaderboard scopes:', error);
    return [];
  }
}

// ============================================
// Event Triggers
// ============================================

/**
 * Queue leaderboard update after match completed
 */
export async function onMatchCompleted(
  matchId: string,
  sport: SportType,
  playerIds: string[],
  tournamentId?: string
): Promise<void> {
  try {
    for (const playerId of playerIds) {
      await updatePlayerRanking({
        userId: playerId,
        sport,
        pointsChange: 0, // Points are already updated by scoring system
        eloChange: 0,
        matchCompleted: true,
        tournamentId,
      });
    }
    
    logger.info(`Queued leaderboard updates for match ${matchId}`);
  } catch (error) {
    logger.error('Error handling match completed event:', error);
    throw error;
  }
}

/**
 * Queue tournament leaderboard recomputation
 */
export async function onTournamentCompleted(
  tournamentId: string,
  sport: SportType
): Promise<void> {
  try {
    await computeLeaderboard({
      sport,
      type: LeaderboardType.TOURNAMENT,
      scopeValue: tournamentId,
    });
    
    logger.info(`Computed tournament leaderboard for ${tournamentId}`);
  } catch (error) {
    logger.error('Error handling tournament completed event:', error);
    throw error;
  }
}

/**
 * Queue leaderboard updates after player rating change
 */
export async function onPlayerRatingChange(
  userId: string,
  sport: SportType
): Promise<void> {
  try {
    await updatePlayerRanking({
      userId,
      sport,
      pointsChange: 0,
      eloChange: 0,
    });
    
    logger.debug(`Queued leaderboard update for rating change: ${userId}`);
  } catch (error) {
    logger.error('Error handling player rating change event:', error);
    throw error;
  }
}
