/**
 * VALORHIVE v3.39.0 - Global Rating System
 * 
 * A competitive skill measurement system replacing geographic gamification.
 * Features:
 * - Single globalElo per sport (not mixed with visiblePoints)
 * - Tournament category-based tier weights
 * - Provisional period (first 10 matches with K=48)
 * - Standard period (K=32 after 10 matches)
 */

import { db } from '@/lib/db';
import { TournamentCategory, SportType } from '@prisma/client';

// ============================================
// TIER WEIGHT CONFIGURATION
// ============================================

/**
 * Tier weights for rating calculations
 * Higher tier = more rating impact for wins/losses
 */
export const TIER_WEIGHTS: Record<number, number> = {
  1: 0.35,   // INTRA, INVITATIONAL, FRANCHISE, EXHIBITION - Lower impact
  2: 0.60,   // INTER_ORG, AGE_RESTRICTED, TEAM_OPEN
  3: 0.80,   // LOCAL_OPEN
  4: 1.00,   // CITY_OPEN (baseline)
  5: 1.10,   // DISTRICT_OPEN, QUALIFIER
  6: 1.25,   // STATE_OPEN
  7: 1.50,   // NATIONAL_OPEN - Highest impact
};

/**
 * Mapping from TournamentCategory to Tier level
 */
export const CATEGORY_TIER_MAPPING: Record<TournamentCategory, number> = {
  INTRA: 1,
  INVITATIONAL: 1,
  FRANCHISE: 1,
  EXHIBITION: 1,
  INTER_ORG: 2,
  AGE_RESTRICTED: 2,
  TEAM_OPEN: 2,
  LOCAL_OPEN: 3,
  CITY_OPEN: 4,
  DISTRICT_OPEN: 5,
  QUALIFIER: 5,
  STATE_OPEN: 6,
  NATIONAL_OPEN: 7,
};

// ============================================
// K-FACTOR CONFIGURATION
// ============================================

/** K-factor for provisional players (first 10 matches) */
export const K_PROVISIONAL = 48;

/** K-factor for established players (after 10 matches) */
export const K_STANDARD = 32;

/** Number of matches in provisional period */
export const PROVISIONAL_MATCH_COUNT = 10;

/** Default starting ELO */
export const DEFAULT_ELO = 1500;

// ============================================
// ELO CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate expected score for a player against an opponent
 * Standard ELO expected score formula
 */
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Get K-factor based on player's provisional status
 */
export function getKFactor(isProvisional: boolean): number {
  return isProvisional ? K_PROVISIONAL : K_STANDARD;
}

/**
 * Get tier weight for a tournament category
 */
export function getTierWeight(category: TournamentCategory | null): number {
  if (!category) return TIER_WEIGHTS[4]; // Default to CITY_OPEN (baseline)
  const tier = CATEGORY_TIER_MAPPING[category];
  return TIER_WEIGHTS[tier] || TIER_WEIGHTS[4];
}

/**
 * Calculate ELO change for a match result
 * 
 * @param playerElo - Current ELO of the player
 * @param opponentElo - Current ELO of the opponent
 * @param actualScore - 1 for win, 0 for loss, 0.5 for draw
 * @param category - Tournament category for tier weight
 * @param isProvisional - Whether player is in provisional period
 * @returns ELO change (positive for gain, negative for loss)
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  actualScore: number,
  category: TournamentCategory | null,
  isProvisional: boolean
): number {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const kFactor = getKFactor(isProvisional);
  const tierWeight = getTierWeight(category);
  
  // Base ELO change
  const baseDelta = kFactor * (actualScore - expectedScore);
  
  // Apply tier weight
  const finalDelta = baseDelta * tierWeight;
  
  return finalDelta;
}

// ============================================
// RATING UPDATE FUNCTIONS
// ============================================

interface RatingUpdateParams {
  matchId: string;  // Required for integrity snapshot
  playerId: string;
  opponentId: string;
  sport: SportType;
  tournamentId: string;
  tournamentCategory: TournamentCategory | null;
  isRated: boolean;
  playerWon: boolean;
  isDraw?: boolean;
}

interface RatingUpdateResult {
  success: boolean;
  playerEloChange: number;
  opponentEloChange: number;
  playerNewElo: number;
  opponentNewElo: number;
  playerIsProvisional: boolean;
  opponentIsProvisional: boolean;
  playerProvisionalMatches?: number;
  opponentProvisionalMatches?: number;
  error?: string;
}

/**
 * Update ratings for both players after a match
 * This is the main function to call after a match is completed
 * 
 * Features:
 * - Idempotent (checks if already processed)
 * - Updates provisional status after 10 matches
 * - Uses sport-specific globalElo (not cross-sport)
 */
export async function updateRatingsAfterMatch(params: RatingUpdateParams): Promise<RatingUpdateResult> {
  const { matchId, playerId, opponentId, sport, tournamentId, tournamentCategory, isRated, playerWon, isDraw } = params;

  // Calculate tier info for snapshot (even if not rated, for audit trail)
  const tierUsed = tournamentCategory ? CATEGORY_TIER_MAPPING[tournamentCategory] || 4 : 4;
  const tierWeightUsed = TIER_WEIGHTS[tierUsed] || 1.0;

  // Skip if tournament is not rated
  if (!isRated) {
    // Still update match with snapshot for audit trail
    await db.match.update({
      where: { id: matchId },
      data: {
        categoryUsed: tournamentCategory,
        tierUsed,
        tierWeightUsed,
        isRatedUsed: false,
      },
    });
    
    return {
      success: true,
      playerEloChange: 0,
      opponentEloChange: 0,
      playerNewElo: 0,
      opponentNewElo: 0,
      playerIsProvisional: false,
      opponentIsProvisional: false,
    };
  }

  try {
    // Get both players with their current rating data
    const [player, opponent] = await Promise.all([
      db.user.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          globalElo: true,
          isProvisional: true,
          provisionalMatches: true,
          sport: true,
        },
      }),
      db.user.findUnique({
        where: { id: opponentId },
        select: {
          id: true,
          globalElo: true,
          isProvisional: true,
          provisionalMatches: true,
          sport: true,
        },
      }),
    ]);

    if (!player || !opponent) {
      return {
        success: false,
        playerEloChange: 0,
        opponentEloChange: 0,
        playerNewElo: 0,
        opponentNewElo: 0,
        playerIsProvisional: false,
        opponentIsProvisional: false,
        error: 'Player or opponent not found',
      };
    }

    // Ensure both players are in the same sport
    if (player.sport !== opponent.sport || player.sport !== sport) {
      return {
        success: false,
        playerEloChange: 0,
        opponentEloChange: 0,
        playerNewElo: 0,
        opponentNewElo: 0,
        playerIsProvisional: false,
        opponentIsProvisional: false,
        error: 'Players must be in the same sport',
      };
    }

    // Determine actual scores
    let playerActualScore: number;
    let opponentActualScore: number;
    
    if (isDraw) {
      playerActualScore = 0.5;
      opponentActualScore = 0.5;
    } else if (playerWon) {
      playerActualScore = 1;
      opponentActualScore = 0;
    } else {
      playerActualScore = 0;
      opponentActualScore = 1;
    }

    // Calculate ELO changes
    const playerEloChange = calculateEloChange(
      player.globalElo,
      opponent.globalElo,
      playerActualScore,
      tournamentCategory,
      player.isProvisional
    );

    const opponentEloChange = calculateEloChange(
      opponent.globalElo,
      player.globalElo,
      opponentActualScore,
      tournamentCategory,
      opponent.isProvisional
    );

    // Calculate new ELOs
    const playerNewElo = Math.max(100, player.globalElo + playerEloChange); // Floor at 100
    const opponentNewElo = Math.max(100, opponent.globalElo + opponentEloChange);

    // Update players and match with rating snapshot in a transaction
    const [updatedPlayer, updatedOpponent] = await db.$transaction([
      db.user.update({
        where: { id: playerId },
        data: {
          globalElo: playerNewElo,
          // Update provisional status
          ...(player.isProvisional && {
            provisionalMatches: { increment: 1 },
            ...(player.provisionalMatches + 1 >= PROVISIONAL_MATCH_COUNT && {
              isProvisional: false,
            }),
          }),
        },
        select: {
          globalElo: true,
          isProvisional: true,
          provisionalMatches: true,
        },
      }),
      db.user.update({
        where: { id: opponentId },
        data: {
          globalElo: opponentNewElo,
          // Update provisional status
          ...(opponent.isProvisional && {
            provisionalMatches: { increment: 1 },
            ...(opponent.provisionalMatches + 1 >= PROVISIONAL_MATCH_COUNT && {
              isProvisional: false,
            }),
          }),
        },
        select: {
          globalElo: true,
          isProvisional: true,
          provisionalMatches: true,
        },
      }),
      // Update match with rating snapshot for integrity
      db.match.update({
        where: { id: matchId },
        data: {
          globalEloChangeA: playerEloChange,
          globalEloChangeB: opponentEloChange,
          categoryUsed: tournamentCategory,
          tierUsed,
          tierWeightUsed,
          isRatedUsed: true,
          ratingLockedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      playerEloChange,
      opponentEloChange,
      playerNewElo: updatedPlayer.globalElo,
      opponentNewElo: updatedOpponent.globalElo,
      playerIsProvisional: updatedPlayer.isProvisional,
      opponentIsProvisional: updatedOpponent.isProvisional,
      playerProvisionalMatches: updatedPlayer.provisionalMatches,
      opponentProvisionalMatches: updatedOpponent.provisionalMatches,
    };
  } catch (error) {
    console.error('Error updating ratings:', error);
    return {
      success: false,
      playerEloChange: 0,
      opponentEloChange: 0,
      playerNewElo: 0,
      opponentNewElo: 0,
      playerIsProvisional: false,
      opponentIsProvisional: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// ADMIN OVERRIDE FUNCTIONS
// ============================================

interface AdminRatingAdjustmentParams {
  playerId: string;
  newElo: number;
  reason: string;
  adminId: string;
  sport: SportType;
}

/**
 * Admin override for player rating
 * Used for verified players who need initial rating adjustment
 */
export async function adminAdjustRating(params: AdminRatingAdjustmentParams): Promise<{ success: boolean; error?: string }> {
  const { playerId, newElo, reason, adminId, sport } = params;

  try {
    await db.$transaction([
      db.user.update({
        where: { id: playerId },
        data: {
          globalElo: newElo,
          isProvisional: false, // Admin override removes provisional status
          provisionalMatches: PROVISIONAL_MATCH_COUNT,
        },
      }),
      db.auditLog.create({
        data: {
          sport,
          action: 'ADMIN_OVERRIDE',
          actorId: adminId,
          actorRole: 'ADMIN',
          targetType: 'player_rating',
          targetId: playerId,
          reason,
          metadata: JSON.stringify({ newElo }),
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error in admin rating adjustment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// LEADERBOARD FUNCTIONS
// ============================================

interface LeaderboardEntry {
  id: string;
  firstName: string;
  lastName: string;
  globalElo: number;
  isProvisional: boolean;
  provisionalMatches: number;
  city?: string | null;
  state?: string | null;
  tier: string;
  wins: number;
  losses: number;
  rank: number;
}

/**
 * Get global rating leaderboard
 * Sport-specific (each sport has its own leaderboard)
 */
export async function getGlobalLeaderboard(
  sport: SportType,
  options: {
    limit?: number;
    offset?: number;
    city?: string;
    state?: string;
    excludeProvisional?: boolean;
  } = {}
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const { limit = 50, offset = 0, city, state, excludeProvisional = true } = options;

  const whereClause: any = {
    sport,
    isActive: true,
    showOnLeaderboard: true,
    ...(excludeProvisional && { isProvisional: false }),
    ...(city && { city }),
    ...(state && { state }),
  };

  const [players, total] = await Promise.all([
    db.user.findMany({
      where: whereClause,
      orderBy: { globalElo: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        globalElo: true,
        isProvisional: true,
        provisionalMatches: true,
        city: true,
        state: true,
        rating: {
          select: {
            wins: true,
            losses: true,
          },
        },
      },
    }),
    db.user.count({ where: whereClause }),
  ]);

  const entries: LeaderboardEntry[] = players.map((player, index) => ({
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    globalElo: player.globalElo,
    isProvisional: player.isProvisional,
    provisionalMatches: player.provisionalMatches,
    city: player.city,
    state: player.state,
    tier: getEloTier(player.globalElo, player.isProvisional ? 0 : PROVISIONAL_MATCH_COUNT),
    wins: player.rating?.wins || 0,
    losses: player.rating?.losses || 0,
    rank: offset + index + 1,
  }));

  return { entries, total };
}

// ============================================
// TIER FUNCTIONS
// ============================================

/**
 * Get ELO tier based on rating and match count
 * Players need to complete provisional period to be ranked
 */
export function getEloTier(elo: number, matchCount: number): string {
  if (matchCount < PROVISIONAL_MATCH_COUNT) {
    return 'UNRANKED';
  }

  if (elo >= 1900) return 'DIAMOND';
  if (elo >= 1700) return 'PLATINUM';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1300) return 'SILVER';
  if (elo >= 1000) return 'BRONZE';
  return 'BRONZE';
}

/**
 * Get tier color for UI display
 */
export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    UNRANKED: '#9CA3AF', // Gray
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#008080',
    DIAMOND: '#4169E1',
  };
  return colors[tier] || colors.UNRANKED;
}

// ============================================
// MIGRATION HELPER
// ============================================

/**
 * Migrate existing players from hiddenElo to globalElo
 * Run once during v3.39.0 deployment
 */
export async function migrateToGlobalElo(sport: SportType): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  try {
    const result = await db.user.updateMany({
      where: {
        sport,
        globalElo: DEFAULT_ELO, // Only migrate those still at default
        hiddenElo: { not: DEFAULT_ELO }, // Who have played matches
      },
      data: {
        globalElo: db.user.fields.hiddenElo, // Copy from hiddenElo
      },
    });

    return { success: true, migratedCount: result.count };
  } catch (error) {
    console.error('Error migrating to globalElo:', error);
    return {
      success: false,
      migratedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// SEEDING HELPER
// ============================================

/**
 * Get seeding order for tournament bracket generation
 * Uses globalElo for seeding, with provisional players at the bottom
 */
export async function getSeedingOrder(
  sport: SportType,
  playerIds: string[]
): Promise<{ id: string; seed: number; globalElo: number; isProvisional: boolean }[]> {
  const players = await db.user.findMany({
    where: {
      id: { in: playerIds },
      sport,
    },
    select: {
      id: true,
      globalElo: true,
      isProvisional: true,
    },
  });

  // Sort: established players by globalElo desc, then provisional players
  const sorted = players.sort((a, b) => {
    // Provisional players go to the bottom
    if (a.isProvisional !== b.isProvisional) {
      return a.isProvisional ? 1 : -1;
    }
    // Within same provisional status, sort by ELO descending
    return b.globalElo - a.globalElo;
  });

  return sorted.map((player, index) => ({
    id: player.id,
    seed: index + 1,
    globalElo: player.globalElo,
    isProvisional: player.isProvisional,
  }));
}

// ============================================
// EXPORT ALL
// ============================================

export const GlobalRatingService = {
  // Configuration
  TIER_WEIGHTS,
  CATEGORY_TIER_MAPPING,
  K_PROVISIONAL,
  K_STANDARD,
  PROVISIONAL_MATCH_COUNT,
  DEFAULT_ELO,
  
  // Calculation
  calculateExpectedScore,
  calculateEloChange,
  getKFactor,
  getTierWeight,
  
  // Updates
  updateRatingsAfterMatch,
  adminAdjustRating,
  
  // Leaderboard
  getGlobalLeaderboard,
  
  // Tier
  getEloTier,
  getTierColor,
  
  // Migration
  migrateToGlobalElo,
  
  // Seeding
  getSeedingOrder,
};
