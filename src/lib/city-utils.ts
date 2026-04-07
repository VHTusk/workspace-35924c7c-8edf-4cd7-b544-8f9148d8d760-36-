/**
 * City Page System Utilities
 * v3.82.0 - Local sports community hubs
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// Generate unique city ID
export function generateCityId(cityName: string, state: string, sport: SportType): string {
  const normalizedCity = cityName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedState = state.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `VH-CITY-${normalizedCity}-${normalizedState}-${sport}`;
}

// Get or create city page
export async function getOrCreateCity(
  cityName: string,
  state: string,
  sport: SportType,
  country: string = 'India'
) {
  const cityId = generateCityId(cityName, state, sport);
  
  let city = await db.city.findUnique({
    where: { cityId },
  });
  
  if (!city) {
    city = await db.city.create({
      data: {
        cityId,
        cityName,
        state,
        country,
        sport,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }
  
  return city;
}

// Update city stats (called by background job)
export async function updateCityStats(cityRecordId: string) {
  const city = await db.city.findUnique({
    where: { id: cityRecordId },
  });
  
  if (!city) return null;
  
  // Count players in this city
  const playerCount = await db.user.count({
    where: {
      sport: city.sport,
      city: city.cityName,
      state: city.state,
      isActive: true,
    },
  });
  
  // Count active players (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const activePlayersCount = await db.user.count({
    where: {
      sport: city.sport,
      city: city.cityName,
      state: city.state,
      isActive: true,
      updatedAt: { gte: thirtyDaysAgo },
    },
  });
  
  // Count tournaments in this city
  const tournamentCount = await db.tournament.count({
    where: {
      sport: city.sport,
      city: city.cityName,
      state: city.state,
      status: 'COMPLETED',
    },
  });
  
  // Count matches (from tournaments in this city)
  const matches = await db.match.findMany({
    where: {
      sport: city.sport,
      tournament: {
        city: city.cityName,
        state: city.state,
      },
    },
    select: { id: true },
  });
  const matchCount = matches.length;
  
  // Count duel matches in this city
  const duelMatchCount = await db.duelMatch.count({
    where: {
      sport: city.sport,
      city: city.cityName,
      status: 'COMPLETED',
    },
  });
  
  // Update city stats
  const updatedCity = await db.city.update({
    where: { id: cityRecordId },
    data: {
      playerCount,
      activePlayersCount,
      tournamentCount,
      matchCount,
      duelMatchCount,
      statsUpdatedAt: new Date(),
    },
  });
  
  // Create snapshot
  await db.cityStatsSnapshot.create({
    data: {
      cityId: cityRecordId,
      playerCount,
      activePlayersCount,
      tournamentCount,
      matchCount,
      duelMatchCount,
      snapshotType: 'DAILY',
    },
  });
  
  return updatedCity;
}

// Get city leaderboard (with caching)
export async function getCityLeaderboard(
  cityRecordId: string,
  sport: SportType,
  limit: number = 20,
  period: string = 'ALL_TIME'
) {
  // Try to get from cache first
  const cached = await db.cityLeaderboardCache.findMany({
    where: {
      cityId: cityRecordId,
      sport,
      period,
    },
    orderBy: { rank: 'asc' },
    take: limit,
  });
  
  // Check if cache is fresh (within 5 minutes)
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  
  const isCacheFresh = cached.length > 0 && 
    cached[0].calculatedAt >= fiveMinutesAgo;
  
  if (isCacheFresh) {
    return cached;
  }
  
  // Recalculate leaderboard
  const city = await db.city.findUnique({
    where: { id: cityRecordId },
  });
  
  if (!city) return [];
  
  // Get all players in this city with their ratings
  const players = await db.user.findMany({
    where: {
      sport,
      city: city.cityName,
      state: city.state,
      isActive: true,
      showOnLeaderboard: true,
    },
    include: {
      rating: true,
    },
  });
  
  // Calculate win percentage and rank
  const leaderboardData = players
    .map((player) => {
      const rating = player.rating;
      const matchesPlayed = rating?.matchesPlayed ?? 0;
      const wins = rating?.wins ?? 0;
      const losses = rating?.losses ?? 0;
      const winPercentage = matchesPlayed > 0 
        ? Math.round((wins / matchesPlayed) * 100) 
        : 0;
      
      return {
        userId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        playerRating: player.hiddenElo,
        matchesPlayed,
        wins,
        losses,
        winPercentage,
      };
    })
    .sort((a, b) => {
      // Sort by rating first, then by win percentage
      if (b.playerRating !== a.playerRating) {
        return b.playerRating - a.playerRating;
      }
      return b.winPercentage - a.winPercentage;
    })
    .slice(0, limit)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
  
  // Clear old cache and insert new
  await db.cityLeaderboardCache.deleteMany({
    where: { cityId: cityRecordId, sport, period },
  });
  
  if (leaderboardData.length > 0) {
    await db.cityLeaderboardCache.createMany({
      data: leaderboardData.map((player) => ({
        cityId: cityRecordId,
        sport,
        userId: player.userId,
        playerName: player.playerName,
        playerRating: player.playerRating,
        matchesPlayed: player.matchesPlayed,
        wins: player.wins,
        losses: player.losses,
        winPercentage: player.winPercentage,
        rank: player.rank,
        period,
      })),
    });
  }
  
  return leaderboardData;
}

// Add activity to city feed
export async function addCityActivity(
  cityRecordId: string,
  sport: SportType,
  activityType: string,
  title: string,
  metadata?: Record<string, unknown>,
  options?: {
    description?: string;
    duelMatchId?: string;
    tournamentId?: string;
    userId?: string;
    isFeatured?: boolean;
  }
) {
  return db.cityActivityFeedItem.create({
    data: {
      cityId: cityRecordId,
      sport,
      activityType,
      title,
      description: options?.description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      duelMatchId: options?.duelMatchId,
      tournamentId: options?.tournamentId,
      userId: options?.userId,
      isFeatured: options?.isFeatured ?? false,
    },
  });
}

// Get city activity feed
export async function getCityActivityFeed(
  cityRecordId: string,
  limit: number = 20,
  offset: number = 0
) {
  return db.cityActivityFeedItem.findMany({
    where: { cityId: cityRecordId },
    orderBy: { activityAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

// Express interest in a poll
export async function expressPollInterest(pollId: string, userId: string) {
  const poll = await db.tournamentInterestPoll.findUnique({
    where: { id: pollId },
  });
  
  if (!poll) {
    throw new Error('Poll not found');
  }
  
  if (poll.status !== 'OPEN') {
    throw new Error('Poll is not open for interest');
  }
  
  // Parse existing interested users
  const interestedUserIds: string[] = poll.interestedUserIds 
    ? JSON.parse(poll.interestedUserIds) 
    : [];
  
  // Check if user already expressed interest
  if (interestedUserIds.includes(userId)) {
    throw new Error('Already expressed interest');
  }
  
  // Add user to interested list
  interestedUserIds.push(userId);
  const interestedCount = interestedUserIds.length;
  
  // Check if threshold reached
  const thresholdReached = interestedCount >= poll.minPlayers;
  
  // Update poll
  const updatedPoll = await db.tournamentInterestPoll.update({
    where: { id: pollId },
    data: {
      interestedUserIds: JSON.stringify(interestedUserIds),
      interestedCount,
      status: thresholdReached ? 'THRESHOLD_REACHED' : 'OPEN',
      thresholdReachedAt: thresholdReached ? new Date() : null,
    },
  });
  
  return updatedPoll;
}

// Get upcoming tournaments for city
export async function getCityTournaments(
  cityName: string,
  state: string,
  sport: SportType,
  limit: number = 10
) {
  const now = new Date();
  
  return db.tournament.findMany({
    where: {
      sport,
      city: cityName,
      state,
      status: { in: ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      startDate: { gte: now },
      isPublic: true,
    },
    orderBy: { startDate: 'asc' },
    take: limit,
    include: {
      _count: {
        select: { registrations: true },
      },
    },
  });
}

// City overview data
export async function getCityOverview(cityRecordId: string) {
  const city = await db.city.findUnique({
    where: { id: cityRecordId },
    include: {
      _count: {
        select: {
          interestPolls: true,
          activityFeed: true,
        },
      },
    },
  });
  
  if (!city) return null;
  
  // Get active polls count
  const activePolls = await db.tournamentInterestPoll.count({
    where: {
      cityId: cityRecordId,
      status: 'OPEN',
      expiresAt: { gte: new Date() },
    },
  });
  
  return {
    ...city,
    activePolls,
    totalPolls: city._count.interestPolls,
    totalActivities: city._count.activityFeed,
  };
}
