/**
 * Rating History Service
 * 
 * Provides comprehensive rating history tracking and analytics:
 * - ELO rating snapshots after matches
 * - Historical trend analysis
 * - Rank change tracking
 * - Performance metrics over time
 * 
 * Used by:
 * - Analytics dashboard
 * - Player profile charts
 * - Organization development tracking
 * - Leaderboard movement calculations
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { createLogger } from './logger';

const logger = createLogger('RatingHistoryService');

// ============================================
// Types and Interfaces
// ============================================

export interface RatingSnapshotData {
  playerId: string;
  sport: SportType;
  rating: number;
  rd?: number; // Rating Deviation (Glicko-2)
  matchId?: string;
}

export interface EloHistoryPoint {
  date: Date;
  rating: number;
  ratingChange: number;
  matchId?: string;
  opponent?: string;
  won?: boolean;
}

export interface EloHistoryResult {
  playerId: string;
  currentRating: number;
  startRating: number;
  ratingChange: number;
  highestRating: number;
  lowestRating: number;
  history: EloHistoryPoint[];
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
}

export interface RankHistoryPoint {
  date: Date;
  rank: number;
  rankChange: number;
  scope: string;
  scopeType: 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL';
}

export interface PerformanceSnapshot {
  date: Date;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgOpponentRating: number;
}

// ============================================
// Core Rating Snapshot Functions
// ============================================

/**
 * Create a rating snapshot after a match
 * Should be called whenever a player's rating changes
 */
export async function createRatingSnapshot(data: RatingSnapshotData): Promise<void> {
  try {
    await db.ratingSnapshot.create({
      data: {
        playerId: data.playerId,
        sport: data.sport,
        rating: Math.round(data.rating),
        rd: data.rd || 350,
        matchId: data.matchId,
      },
    });
    
    logger.debug(`Created rating snapshot for player ${data.playerId}: ${Math.round(data.rating)}`);
  } catch (error) {
    logger.error('Error creating rating snapshot:', error);
    throw error;
  }
}

/**
 * Create rating snapshots for both players after a match
 */
export async function createMatchRatingSnapshots(
  matchId: string,
  playerAId: string,
  playerBId: string,
  sport: SportType,
  playerANewRating: number,
  playerBNewRating: number,
  playerARd?: number,
  playerBRd?: number
): Promise<void> {
  await Promise.all([
    createRatingSnapshot({
      playerId: playerAId,
      sport,
      rating: playerANewRating,
      rd: playerARd,
      matchId,
    }),
    createRatingSnapshot({
      playerId: playerBId,
      sport,
      rating: playerBNewRating,
      rd: playerBRd,
      matchId,
    }),
  ]);
}

// ============================================
// ELO History Query Functions
// ============================================

/**
 * Get ELO history for a player over a time period
 */
export async function getPlayerEloHistory(
  playerId: string,
  sport: SportType,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<EloHistoryResult> {
  const startDate = options?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default 1 year
  const endDate = options?.endDate || new Date();
  const limit = options?.limit || 100;

  // Get current user rating
  const user = await db.user.findUnique({
    where: { id: playerId },
    select: { hiddenElo: true, sport: true },
  });

  const currentRating = Math.round(user?.hiddenElo || 1500);

  // Get rating snapshots in date range
  const snapshots = await db.ratingSnapshot.findMany({
    where: {
      playerId,
      sport,
      createdAt: { gte: startDate, lte: endDate },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      match: {
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Build history points
  const history: EloHistoryPoint[] = [];
  let prevRating = snapshots.length > 0 ? snapshots[0].rating : currentRating;
  let highestRating = currentRating;
  let lowestRating = currentRating;

  for (const snapshot of snapshots) {
    const ratingChange = snapshot.rating - prevRating;
    
    let opponent: string | undefined;
    let won: boolean | undefined;
    
    if (snapshot.match) {
      const isPlayerA = snapshot.match.playerAId === playerId;
      opponent = isPlayerA
        ? `${snapshot.match.playerB?.firstName} ${snapshot.match.playerB?.lastName}`
        : `${snapshot.match.playerA?.firstName} ${snapshot.match.playerA?.lastName}`;
      won = snapshot.match.winnerId === playerId;
    }

    history.push({
      date: snapshot.createdAt,
      rating: snapshot.rating,
      ratingChange,
      matchId: snapshot.matchId || undefined,
      opponent,
      won,
    });

    highestRating = Math.max(highestRating, snapshot.rating);
    lowestRating = Math.min(lowestRating, snapshot.rating);
    prevRating = snapshot.rating;
  }

  // Calculate trend
  const recentHistory = history.slice(-10);
  let trend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
  
  if (recentHistory.length >= 3) {
    const recentAvg = recentHistory.slice(-3).reduce((sum, h) => sum + h.rating, 0) / 3;
    const olderAvg = recentHistory.slice(0, 3).reduce((sum, h) => sum + h.rating, 0) / 3;
    
    if (recentAvg > olderAvg + 20) trend = 'IMPROVING';
    else if (recentAvg < olderAvg - 20) trend = 'DECLINING';
  }

  const startRating = history.length > 0 ? history[0].rating : currentRating;
  const totalRatingChange = currentRating - startRating;

  return {
    playerId,
    currentRating,
    startRating,
    ratingChange: totalRatingChange,
    highestRating,
    lowestRating,
    history,
    trend,
  };
}

/**
 * Get aggregated rating snapshots for a player (daily/weekly/monthly)
 */
export async function getPlayerAggregatedEloHistory(
  playerId: string,
  sport: SportType,
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  days: number = 90
): Promise<{ date: string; rating: number }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await db.ratingSnapshot.findMany({
    where: {
      playerId,
      sport,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      rating: true,
      createdAt: true,
    },
  });

  if (snapshots.length === 0) {
    // Return current rating if no snapshots
    const user = await db.user.findUnique({
      where: { id: playerId },
      select: { hiddenElo: true },
    });
    return [{ date: new Date().toISOString().split('T')[0], rating: Math.round(user?.hiddenElo || 1500) }];
  }

  // Aggregate by period
  const aggregated = new Map<string, number[]>();

  for (const snapshot of snapshots) {
    const date = new Date(snapshot.createdAt);
    let key: string;

    if (period === 'daily') {
      key = date.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!aggregated.has(key)) {
      aggregated.set(key, []);
    }
    aggregated.get(key)!.push(snapshot.rating);
  }

  // Calculate average rating per period
  const result = Array.from(aggregated.entries())
    .map(([date, ratings]) => ({
      date,
      rating: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

// ============================================
// Rank History Functions
// ============================================

/**
 * Get rank history for a player from leaderboard snapshots
 */
export async function getPlayerRankHistory(
  playerId: string,
  sport: SportType,
  type: 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL' = 'NATIONAL',
  days: number = 90
): Promise<RankHistoryPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await db.leaderboardSnapshot.findMany({
    where: {
      userId: playerId,
      sport,
      type: type as any,
      isActive: false, // Get historical snapshots
      snapshotDate: { gte: startDate },
    },
    orderBy: { snapshotDate: 'asc' },
    select: {
      rank: true,
      previousRank: true,
      snapshotDate: true,
      scopeValue: true,
    },
  });

  return snapshots.map((snapshot) => ({
    date: snapshot.snapshotDate,
    rank: snapshot.rank,
    rankChange: snapshot.previousRank ? snapshot.previousRank - snapshot.rank : 0,
    scope: snapshot.scopeValue || 'all',
    scopeType: type,
  }));
}

// ============================================
// Performance Metrics Functions
// ============================================

/**
 * Get performance metrics over time for a player
 */
export async function getPlayerPerformanceHistory(
  playerId: string,
  sport: SportType,
  months: number = 6
): Promise<PerformanceSnapshot[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const performance: PerformanceSnapshot[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Get matches for this month
    const matches = await db.match.findMany({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        sport,
        verificationStatus: 'VERIFIED',
        playedAt: { gte: monthStart, lte: monthEnd },
      },
      include: {
        playerA: { select: { hiddenElo: true } },
        playerB: { select: { hiddenElo: true } },
      },
    });

    const wins = matches.filter((m) => m.winnerId === playerId).length;
    const losses = matches.length - wins;

    // Calculate average opponent rating
    const opponentRatings = matches.map((m) => {
      const isPlayerA = m.playerAId === playerId;
      return isPlayerA ? (m.playerB?.hiddenElo || 1500) : (m.playerA?.hiddenElo || 1500);
    });

    const avgOpponentRating = opponentRatings.length > 0
      ? Math.round(opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length)
      : 0;

    performance.push({
      date: monthStart,
      matchesPlayed: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? Math.round((wins / matches.length) * 1000) / 10 : 0,
      avgOpponentRating,
    });
  }

  return performance;
}

// ============================================
// Batch Operations
// ============================================

/**
 * Backfill rating snapshots for a player from match history
 * Useful for populating history for demo data or migrated players
 */
export async function backfillRatingSnapshots(
  playerId: string,
  sport: SportType
): Promise<{ created: number }> {
  // Get all matches for the player with ELO changes
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
      sport,
      verificationStatus: 'VERIFIED',
      eloChangeA: { not: null },
    },
    orderBy: { playedAt: 'asc' },
    select: {
      id: true,
      playedAt: true,
      playerAId: true,
      eloChangeA: true,
      eloChangeB: true,
    },
  });

  let currentRating = 1500; // Starting rating
  let created = 0;

  for (const match of matches) {
    const isPlayerA = match.playerAId === playerId;
    const eloChange = isPlayerA ? (match.eloChangeA || 0) : (match.eloChangeB || 0);
    currentRating += eloChange;

    // Check if snapshot already exists for this match
    const existing = await db.ratingSnapshot.findFirst({
      where: { playerId, matchId: match.id },
    });

    if (!existing) {
      await db.ratingSnapshot.create({
        data: {
          playerId,
          sport,
          rating: Math.round(currentRating),
          matchId: match.id,
          createdAt: match.playedAt,
        },
      });
      created++;
    }
  }

  logger.info(`Backfilled ${created} rating snapshots for player ${playerId}`);
  return { created };
}

/**
 * Generate demo rating history for a player
 * Creates realistic-looking ELO progression for demo/investor presentations
 */
export async function generateDemoRatingHistory(
  playerId: string,
  sport: SportType,
  options?: {
    startingRating?: number;
    endingRating?: number;
    days?: number;
    volatility?: number;
  }
): Promise<{ created: number }> {
  const startingRating = options?.startingRating || 1200;
  const endingRating = options?.endingRating || 1650;
  const days = options?.days || 180;
  const volatility = options?.volatility || 30;

  // Delete existing demo snapshots for this player
  await db.ratingSnapshot.deleteMany({
    where: { playerId, sport },
  });

  let currentRating = startingRating;
  let created = 0;
  const now = new Date();

  // Generate daily snapshots with realistic progression
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Calculate target rating based on linear progression with randomness
    const progress = (days - i) / days;
    const targetRating = startingRating + (endingRating - startingRating) * progress;
    
    // Add realistic noise
    const noise = (Math.sin(i * 0.5) * volatility) + (Math.random() - 0.5) * volatility * 0.5;
    currentRating = Math.round(targetRating + noise);

    // Create snapshot
    await db.ratingSnapshot.create({
      data: {
        playerId,
        sport,
        rating: currentRating,
        createdAt: date,
      },
    });
    created++;
  }

  // Update user's current ELO to match
  await db.user.update({
    where: { id: playerId },
    data: { hiddenElo: endingRating },
  });

  logger.info(`Generated ${created} demo rating snapshots for player ${playerId}`);
  return { created };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate ELO trend direction and magnitude
 */
export function calculateEloTrend(history: EloHistoryPoint[]): {
  direction: 'UP' | 'DOWN' | 'STABLE';
  magnitude: number;
  confidence: number;
} {
  if (history.length < 5) {
    return { direction: 'STABLE', magnitude: 0, confidence: 0 };
  }

  const recentRatings = history.slice(-10).map((h) => h.rating);
  const olderRatings = history.slice(0, 10).map((h) => h.rating);

  const recentAvg = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
  const olderAvg = olderRatings.reduce((a, b) => a + b, 0) / olderRatings.length;

  const difference = recentAvg - olderAvg;
  const magnitude = Math.abs(difference);

  let direction: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
  if (difference > 25) direction = 'UP';
  else if (difference < -25) direction = 'DOWN';

  // Confidence based on consistency of direction
  const changes = history.slice(-10).map((h) => h.ratingChange);
  const positiveChanges = changes.filter((c) => c > 0).length;
  const consistency = direction === 'UP' ? positiveChanges / changes.length : (changes.length - positiveChanges) / changes.length;
  const confidence = Math.round(consistency * 100);

  return { direction, magnitude: Math.round(magnitude), confidence };
}
