/**
 * Season Recap Generator for VALORHIVE
 * 
 * Generates Spotify Wrapped-style season summaries for players.
 * Calculates comprehensive stats from match history, tournaments, and ratings.
 */

import { db } from './db';
import { SportType } from '@prisma/client';
import { getEloTier } from './tier';

// Types for recap data
export interface UpsetWinData {
  opponentName: string;
  opponentElo: number;
  playerElo: number;
  score: string;
  date: string;
  tournamentName?: string;
  eloDiff: number;  // How much higher opponent's Elo was
}

export interface SeasonRecapData {
  userId: string;
  sport: SportType;
  seasonYear: number;
  
  // Tournament stats
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  
  // Rating progression
  startingElo: number;
  endingElo: number;
  startingTier: string;
  endingTier: string;
  
  // Notable achievements
  biggestUpsetWin: UpsetWinData | null;
  bestFinish: number | null;
  bestTournamentName: string | null;
  
  // Rival data
  mostPlayedRivalId: string | null;
  mostPlayedRivalName: string | null;
  rivalMatchCount: number | null;
  rivalWinCount: number | null;
  
  // Points & Scoreline
  totalPointsEarned: number;
  signatureScoreline: string | null;
  
  // Venue stats
  favoriteVenue: string | null;
  
  // Time estimate
  estimatedHours: number | null;
  
  // Additional highlights
  topFiveFinishes: number;
  longestWinStreak: number;
  totalMatchesPlayed: number;
}

export interface RecapGenerationResult {
  success: boolean;
  recap?: SeasonRecapData;
  error?: string;
}

/**
 * Generate a comprehensive season recap for a player
 */
export async function generateSeasonRecap(
  userId: string,
  sport: SportType,
  seasonYear: number
): Promise<RecapGenerationResult> {
  try {
    // Get date range for the season
    const seasonStart = new Date(seasonYear, 0, 1); // January 1st
    const seasonEnd = new Date(seasonYear, 11, 31, 23, 59, 59); // December 31st

    // Fetch user data
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        hiddenElo: true,
        visiblePoints: true,
        firstName: true,
        lastName: true,
      }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Get all matches in the season where the user was player A or player B
    const matchesAsA = await db.match.findMany({
      where: {
        playerAId: userId,
        sport,
        playedAt: {
          gte: seasonStart,
          lte: seasonEnd,
        },
        outcome: { not: 'BYE' },
      },
      include: {
        tournament: {
          select: { name: true, location: true, scope: true }
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true }
        }
      }
    });

    const matchesAsB = await db.match.findMany({
      where: {
        playerBId: userId,
        sport,
        playedAt: {
          gte: seasonStart,
          lte: seasonEnd,
        },
        outcome: { not: 'BYE' },
      },
      include: {
        tournament: {
          select: { name: true, location: true, scope: true }
        },
        playerA: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true }
        }
      }
    });

    // Combine all matches
    const allMatches = [...matchesAsA, ...matchesAsB];

    // Get tournament registrations for the season
    const tournamentRegistrations = await db.tournamentRegistration.findMany({
      where: {
        userId,
        tournament: {
          sport,
          startDate: {
            gte: seasonStart,
            lte: seasonEnd,
          },
        },
        status: 'CONFIRMED',
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
          }
        }
      }
    });

    // Get tournament results for the season
    const tournamentResults = await db.tournamentResult.findMany({
      where: {
        userId,
        sport,
        awardedAt: {
          gte: seasonStart,
          lte: seasonEnd,
        },
      },
      include: {
        tournament: {
          select: { name: true }
        }
      }
    });

    // Calculate basic stats
    let wins = 0;
    let losses = 0;
    let totalPointsEarned = 0;
    const scorelines: Map<string, number> = new Map();
    const opponents: Map<string, { name: string; count: number; wins: number }> = new Map();
    const venues: Map<string, number> = new Map();
    const upsetWins: UpsetWinData[] = [];
    
    // Track Elo changes from matches
    let firstMatchElo: number | null = null;
    let lastMatchElo = user.hiddenElo;
    const eloHistory: { date: Date; elo: number }[] = [];

    // Process matches
    for (const match of allMatches) {
      const isPlayerA = match.playerAId === userId;
      const opponent = isPlayerA ? match.playerB : match.playerA;
      const playerScore = isPlayerA ? match.scoreA : match.scoreB;
      const opponentScore = isPlayerA ? match.scoreB : match.scoreA;
      const playerPoints = isPlayerA ? match.pointsA : match.pointsB;
      const playerEloChange = isPlayerA ? match.eloChangeA : match.eloChangeB;

      // Track wins/losses
      const isWin = match.winnerId === userId;
      if (isWin) {
        wins++;
      } else if (match.winnerId && match.winnerId !== userId) {
        losses++;
      }

      // Track points
      if (playerPoints) {
        totalPointsEarned += playerPoints;
      }

      // Track Elo history
      if (playerEloChange !== null && playerEloChange !== undefined) {
        const eloAtMatch = lastMatchElo - playerEloChange;
        if (firstMatchElo === null) {
          firstMatchElo = eloAtMatch;
        }
        eloHistory.push({ date: match.playedAt, elo: lastMatchElo });
      }

      // Track scorelines (only for wins)
      if (isWin && playerScore !== null && opponentScore !== null) {
        const scoreline = `${playerScore}-${opponentScore}`;
        scorelines.set(scoreline, (scorelines.get(scoreline) || 0) + 1);
      }

      // Track opponents
      if (opponent) {
        const opponentName = `${opponent.firstName} ${opponent.lastName}`;
        const existing = opponents.get(opponent.id) || { name: opponentName, count: 0, wins: 0 };
        existing.count++;
        if (isWin) {
          existing.wins++;
        }
        opponents.set(opponent.id, existing);

        // Track upset wins (beating higher-rated opponent)
        if (isWin && opponent.hiddenElo) {
          const currentElo = eloHistory.length > 0 
            ? eloHistory[eloHistory.length - 1].elo 
            : user.hiddenElo;
          
          // Consider it an upset if opponent was 100+ Elo higher
          const eloDiff = opponent.hiddenElo - currentElo;
          if (eloDiff >= 100) {
            upsetWins.push({
              opponentName,
              opponentElo: opponent.hiddenElo,
              playerElo: currentElo,
              score: `${playerScore}-${opponentScore}`,
              date: match.playedAt.toISOString(),
              tournamentName: match.tournament?.name || undefined,
              eloDiff,
            });
          }
        }
      }

      // Track venues
      if (match.tournament?.location) {
        venues.set(match.tournament.location, (venues.get(match.tournament.location) || 0) + 1);
      }
    }

    // Find biggest upset win
    const biggestUpsetWin = upsetWins.length > 0 
      ? upsetWins.reduce((max, current) => current.eloDiff > max.eloDiff ? current : max)
      : null;

    // Find most played rival
    let mostPlayedRivalId: string | null = null;
    let mostPlayedRivalName: string | null = null;
    let rivalMatchCount: number | null = null;
    let rivalWinCount: number | null = null;
    
    let maxMatches = 0;
    for (const [id, data] of opponents) {
      if (data.count > maxMatches) {
        maxMatches = data.count;
        mostPlayedRivalId = id;
        mostPlayedRivalName = data.name;
        rivalMatchCount = data.count;
        rivalWinCount = data.wins;
      }
    }

    // Find signature scoreline
    let signatureScoreline: string | null = null;
    let maxScorelineCount = 0;
    for (const [scoreline, count] of scorelines) {
      if (count > maxScorelineCount) {
        maxScorelineCount = count;
        signatureScoreline = scoreline;
      }
    }

    // Find favorite venue
    let favoriteVenue: string | null = null;
    let maxVenueCount = 0;
    for (const [venue, count] of venues) {
      if (count > maxVenueCount) {
        maxVenueCount = count;
        favoriteVenue = venue;
      }
    }

    // Find best tournament finish
    const bestResult = tournamentResults.length > 0
      ? tournamentResults.reduce((best, current) => current.rank < best.rank ? current : best)
      : null;

    // Count top 5 finishes
    const topFiveFinishes = tournamentResults.filter(r => r.rank <= 5).length;

    // Calculate longest win streak
    const sortedMatches = allMatches
      .filter(m => m.winnerId !== null)
      .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
    
    let longestWinStreak = 0;
    let currentStreak = 0;
    for (const match of sortedMatches) {
      if (match.winnerId === userId) {
        currentStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Estimate hours played (assume 15 minutes per match on average)
    const estimatedHours = Math.round((allMatches.length * 15 / 60) * 10) / 10;

    // Calculate starting/ending Elo and tiers
    const startingElo = firstMatchElo ?? user.hiddenElo;
    const endingElo = user.hiddenElo;

    // Get match count at start of season (approximate - use current total minus this season's matches)
    const matchCountAtStart = await db.match.count({
      where: {
        OR: [{ playerAId: userId }, { playerBId: userId }],
        sport,
        playedAt: { lt: seasonStart },
        outcome: { not: 'BYE' },
      }
    });

    const matchCountAtEnd = matchCountAtStart + allMatches.length;

    const startingTier = getEloTier(startingElo, matchCountAtStart).name.toUpperCase();
    const endingTier = getEloTier(endingElo, matchCountAtEnd).name.toUpperCase();

    const recapData: SeasonRecapData = {
      userId,
      sport,
      seasonYear,
      tournamentsPlayed: tournamentRegistrations.length,
      wins,
      losses,
      startingElo,
      endingElo,
      startingTier,
      endingTier,
      biggestUpsetWin,
      bestFinish: bestResult?.rank ?? null,
      bestTournamentName: bestResult?.tournament.name ?? null,
      mostPlayedRivalId,
      mostPlayedRivalName,
      rivalMatchCount,
      rivalWinCount,
      totalPointsEarned,
      signatureScoreline,
      favoriteVenue,
      estimatedHours,
      topFiveFinishes,
      longestWinStreak,
      totalMatchesPlayed: allMatches.length,
    };

    // Save to database
    await db.seasonRecap.upsert({
      where: {
        userId_sport_seasonYear: {
          userId,
          sport,
          seasonYear,
        }
      },
      update: {
        tournamentsPlayed: recapData.tournamentsPlayed,
        wins: recapData.wins,
        losses: recapData.losses,
        startingElo: recapData.startingElo,
        endingElo: recapData.endingElo,
        startingTier: recapData.startingTier,
        endingTier: recapData.endingTier,
        biggestUpsetWin: recapData.biggestUpsetWin ? JSON.stringify(recapData.biggestUpsetWin) : null,
        bestFinish: recapData.bestFinish,
        bestTournamentName: recapData.bestTournamentName,
        mostPlayedRivalId: recapData.mostPlayedRivalId,
        mostPlayedRivalName: recapData.mostPlayedRivalName,
        rivalMatchCount: recapData.rivalMatchCount,
        rivalWinCount: recapData.rivalWinCount,
        totalPointsEarned: recapData.totalPointsEarned,
        signatureScoreline: recapData.signatureScoreline,
        favoriteVenue: recapData.favoriteVenue,
        estimatedHours: recapData.estimatedHours,
        topFiveFinishes: recapData.topFiveFinishes,
        longestWinStreak: recapData.longestWinStreak,
        totalMatchesPlayed: recapData.totalMatchesPlayed,
        updatedAt: new Date(),
      },
      create: {
        userId,
        sport,
        seasonYear,
        tournamentsPlayed: recapData.tournamentsPlayed,
        wins: recapData.wins,
        losses: recapData.losses,
        startingElo: recapData.startingElo,
        endingElo: recapData.endingElo,
        startingTier: recapData.startingTier,
        endingTier: recapData.endingTier,
        biggestUpsetWin: recapData.biggestUpsetWin ? JSON.stringify(recapData.biggestUpsetWin) : null,
        bestFinish: recapData.bestFinish,
        bestTournamentName: recapData.bestTournamentName,
        mostPlayedRivalId: recapData.mostPlayedRivalId,
        mostPlayedRivalName: recapData.mostPlayedRivalName,
        rivalMatchCount: recapData.rivalMatchCount,
        rivalWinCount: recapData.rivalWinCount,
        totalPointsEarned: recapData.totalPointsEarned,
        signatureScoreline: recapData.signatureScoreline,
        favoriteVenue: recapData.favoriteVenue,
        estimatedHours: recapData.estimatedHours,
        topFiveFinishes: recapData.topFiveFinishes,
        longestWinStreak: recapData.longestWinStreak,
        totalMatchesPlayed: recapData.totalMatchesPlayed,
      }
    });

    return { success: true, recap: recapData };
  } catch (error) {
    console.error('Error generating season recap:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate recap' 
    };
  }
}

/**
 * Get existing recap from database or generate if not exists
 */
export async function getOrGenerateRecap(
  userId: string,
  sport: SportType,
  seasonYear: number,
  forceRegenerate = false
): Promise<RecapGenerationResult> {
  try {
    // Check for existing recap
    if (!forceRegenerate) {
      const existingRecap = await db.seasonRecap.findUnique({
        where: {
          userId_sport_seasonYear: {
            userId,
            sport,
            seasonYear,
          }
        }
      });

      if (existingRecap) {
        return {
          success: true,
          recap: {
            userId: existingRecap.userId,
            sport: existingRecap.sport,
            seasonYear: existingRecap.seasonYear,
            tournamentsPlayed: existingRecap.tournamentsPlayed,
            wins: existingRecap.wins,
            losses: existingRecap.losses,
            startingElo: existingRecap.startingElo,
            endingElo: existingRecap.endingElo,
            startingTier: existingRecap.startingTier,
            endingTier: existingRecap.endingTier,
            biggestUpsetWin: existingRecap.biggestUpsetWin 
              ? JSON.parse(existingRecap.biggestUpsetWin) as UpsetWinData 
              : null,
            bestFinish: existingRecap.bestFinish,
            bestTournamentName: existingRecap.bestTournamentName,
            mostPlayedRivalId: existingRecap.mostPlayedRivalId,
            mostPlayedRivalName: existingRecap.mostPlayedRivalName,
            rivalMatchCount: existingRecap.rivalMatchCount,
            rivalWinCount: existingRecap.rivalWinCount,
            totalPointsEarned: existingRecap.totalPointsEarned,
            signatureScoreline: existingRecap.signatureScoreline,
            favoriteVenue: existingRecap.favoriteVenue,
            estimatedHours: existingRecap.estimatedHours,
            topFiveFinishes: existingRecap.topFiveFinishes,
            longestWinStreak: existingRecap.longestWinStreak,
            totalMatchesPlayed: existingRecap.totalMatchesPlayed,
          }
        };
      }
    }

    // Generate new recap
    return generateSeasonRecap(userId, sport, seasonYear);
  } catch (error) {
    console.error('Error getting/generating recap:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get recap' 
    };
  }
}

/**
 * Get all available years for a user (years with matches)
 */
export async function getAvailableSeasonYears(
  userId: string,
  sport: SportType
): Promise<number[]> {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      sport,
    },
    select: { playedAt: true }
  });

  const years = new Set<number>();
  for (const match of matches) {
    years.add(match.playedAt.getFullYear());
  }

  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Get user's recaps for all years
 */
export async function getAllUserRecaps(
  userId: string,
  sport: SportType
): Promise<SeasonRecapData[]> {
  const recaps = await db.seasonRecap.findMany({
    where: { userId, sport },
    orderBy: { seasonYear: 'desc' }
  });

  return recaps.map(r => ({
    userId: r.userId,
    sport: r.sport,
    seasonYear: r.seasonYear,
    tournamentsPlayed: r.tournamentsPlayed,
    wins: r.wins,
    losses: r.losses,
    startingElo: r.startingElo,
    endingElo: r.endingElo,
    startingTier: r.startingTier,
    endingTier: r.endingTier,
    biggestUpsetWin: r.biggestUpsetWin ? JSON.parse(r.biggestUpsetWin) as UpsetWinData : null,
    bestFinish: r.bestFinish,
    bestTournamentName: r.bestTournamentName,
    mostPlayedRivalId: r.mostPlayedRivalId,
    mostPlayedRivalName: r.mostPlayedRivalName,
    rivalMatchCount: r.rivalMatchCount,
    rivalWinCount: r.rivalWinCount,
    totalPointsEarned: r.totalPointsEarned,
    signatureScoreline: r.signatureScoreline,
    favoriteVenue: r.favoriteVenue,
    estimatedHours: r.estimatedHours,
    topFiveFinishes: r.topFiveFinishes,
    longestWinStreak: r.longestWinStreak,
    totalMatchesPlayed: r.totalMatchesPlayed,
  }));
}

/**
 * Generate shareable card content
 */
export function generateShareableText(recap: SeasonRecapData, playerName: string): string {
  const winRate = recap.totalMatchesPlayed > 0 
    ? Math.round((recap.wins / recap.totalMatchesPlayed) * 100) 
    : 0;
  
  const eloChange = recap.endingElo - recap.startingElo;
  const eloChangeStr = eloChange >= 0 ? `+${Math.round(eloChange)}` : `${Math.round(eloChange)}`;

  const lines = [
    `📊 My ${recap.seasonYear} Season on VALORHIVE`,
    ``,
    `🏆 ${recap.tournamentsPlayed} Tournaments | ${recap.wins}W - ${recap.losses}L`,
    `📈 Elo: ${eloChangeStr} | Tier: ${recap.startingTier} → ${recap.endingTier}`,
    `⭐ ${recap.totalPointsEarned} Points Earned | ${winRate}% Win Rate`,
  ];

  if (recap.bestFinish && recap.bestTournamentName) {
    const position = recap.bestFinish === 1 ? '🥇 1st' : 
                     recap.bestFinish === 2 ? '🥈 2nd' : 
                     recap.bestFinish === 3 ? '🥉 3rd' : 
                     `#${recap.bestFinish}`;
    lines.push(`🎯 Best Finish: ${position} at ${recap.bestTournamentName}`);
  }

  if (recap.signatureScoreline) {
    lines.push(`💪 Signature Win: ${recap.signatureScoreline}`);
  }

  if (recap.mostPlayedRivalName) {
    lines.push(`⚔️ Biggest Rival: ${recap.mostPlayedRivalName} (${recap.rivalWinCount}/${recap.rivalMatchCount} wins)`);
  }

  lines.push(``, `Play competitive ${recap.sport.toLowerCase()} at valorhive.com`);

  return lines.join('\n');
}
