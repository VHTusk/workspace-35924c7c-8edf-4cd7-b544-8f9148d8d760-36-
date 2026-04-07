/**
 * VALORHIVE v3.40.0 - Force Service
 * Helper functions for force hierarchy operations
 */

import { db } from '@/lib/db';
import { ForceType, ForceScope, TournamentCategory, SportType } from '@prisma/client';

// ============================================
// TIER WEIGHTS FOR FORCE TOURNAMENTS
// ============================================

export const FORCE_TIER_WEIGHTS: Record<TournamentCategory, number> = {
  // Standard categories
  INTRA: 0.35,
  INVITATIONAL: 0.35,
  FRANCHISE: 0.35,
  EXHIBITION: 0.35,
  INTER_ORG: 0.60,
  AGE_RESTRICTED: 0.60,
  TEAM_OPEN: 0.60,
  LOCAL_OPEN: 0.80,
  CITY_OPEN: 1.00,
  DISTRICT_OPEN: 1.10,
  QUALIFIER: 1.10,
  STATE_OPEN: 1.25,
  NATIONAL_OPEN: 1.50,
  // Force-specific categories
  FORCE_UNIT: 0.70,      // Unit-level competition
  FORCE_ZONE: 0.85,      // Zone-level competition
  FORCE_SECTOR: 1.00,    // Sector-level competition
  FORCE_LEVEL: 1.15,     // Force-level competition
  INTER_FORCE: 1.30,     // Between different forces
};

// ============================================
// TOURNAMENT CATEGORY FROM FORCE SCOPE
// ============================================

export function getCategoryFromForceScope(scope: ForceScope): TournamentCategory {
  const mapping: Record<ForceScope, TournamentCategory> = {
    UNIT: 'FORCE_UNIT',
    ZONE: 'FORCE_ZONE',
    SECTOR: 'FORCE_SECTOR',
    FORCE: 'FORCE_LEVEL',
    INTER_FORCE: 'INTER_FORCE',
  };
  return mapping[scope];
}

// ============================================
// ELIGIBILITY VALIDATION
// ============================================

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export async function validateForceTournamentEligibility(
  tournamentId: string,
  playerId: string
): Promise<EligibilityResult> {
  try {
    // Get tournament with force info
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        forceId: true,
        forceScope: true,
        eligibleUnitIds: true,
        eligibleZoneIds: true,
        eligibleSectorIds: true,
        sport: true,
      },
    });

    if (!tournament) {
      return { eligible: false, reason: 'Tournament not found' };
    }

    // If no force scoping, anyone can play
    if (!tournament.forceId || !tournament.forceScope) {
      return { eligible: true };
    }

    // Get player with force hierarchy
    const player = await db.user.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        forceId: true,
        sectorId: true,
        zoneId: true,
        unitId: true,
        sport: true,
      },
    });

    if (!player) {
      return { eligible: false, reason: 'Player not found' };
    }

    // Check sport matches
    if (player.sport !== tournament.sport) {
      return { eligible: false, reason: 'Sport mismatch' };
    }

    // Check if player belongs to any force
    if (!player.forceId) {
      return { eligible: false, reason: 'Player not assigned to any force' };
    }

    // Check force scope eligibility
    switch (tournament.forceScope) {
      case 'UNIT':
        // Player must be in same force and in an eligible unit
        if (player.forceId !== tournament.forceId) {
          return { eligible: false, reason: 'Player not from this force' };
        }
        if (!player.unitId) {
          return { eligible: false, reason: 'Player not assigned to a unit' };
        }
        // Check if unit is in eligible list (if specified)
        if (tournament.eligibleUnitIds) {
          const eligibleUnits = JSON.parse(tournament.eligibleUnitIds);
          if (eligibleUnits.length > 0 && !eligibleUnits.includes(player.unitId)) {
            return { eligible: false, reason: 'Player\'s unit not eligible for this tournament' };
          }
        }
        break;

      case 'ZONE':
        if (player.forceId !== tournament.forceId) {
          return { eligible: false, reason: 'Player not from this force' };
        }
        if (!player.zoneId) {
          return { eligible: false, reason: 'Player not assigned to a zone' };
        }
        if (tournament.eligibleZoneIds) {
          const eligibleZones = JSON.parse(tournament.eligibleZoneIds);
          if (eligibleZones.length > 0 && !eligibleZones.includes(player.zoneId)) {
            return { eligible: false, reason: 'Player\'s zone not eligible for this tournament' };
          }
        }
        break;

      case 'SECTOR':
        if (player.forceId !== tournament.forceId) {
          return { eligible: false, reason: 'Player not from this force' };
        }
        if (!player.sectorId) {
          return { eligible: false, reason: 'Player not assigned to a sector' };
        }
        if (tournament.eligibleSectorIds) {
          const eligibleSectors = JSON.parse(tournament.eligibleSectorIds);
          if (eligibleSectors.length > 0 && !eligibleSectors.includes(player.sectorId)) {
            return { eligible: false, reason: 'Player\'s sector not eligible for this tournament' };
          }
        }
        break;

      case 'FORCE':
        if (player.forceId !== tournament.forceId) {
          return { eligible: false, reason: 'Player not from this force' };
        }
        break;

      case 'INTER_FORCE':
        // Any player from any force can participate
        if (!player.forceId) {
          return { eligible: false, reason: 'Player not assigned to any force' };
        }
        break;
    }

    return { eligible: true };
  } catch (error) {
    console.error('Error validating force tournament eligibility:', error);
    return { eligible: false, reason: 'Validation error' };
  }
}

// ============================================
// FORCE RANKING CALCULATION
// ============================================

export async function updateForceRanking(
  playerId: string,
  sport: SportType,
  pointsEarned: number,
  category: TournamentCategory
): Promise<void> {
  try {
    // Get player's force hierarchy
    const player = await db.user.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        forceId: true,
        sectorId: true,
        zoneId: true,
        unitId: true,
      },
    });

    if (!player || !player.forceId) {
      return; // Player not in force hierarchy
    }

    // Determine which points to update based on category
    const pointField = getCategoryPointField(category);

    // Upsert force ranking
    await db.forceRanking.upsert({
      where: {
        playerId_sport: {
          playerId,
          sport,
        },
      },
      create: {
        playerId,
        sport,
        forceId: player.forceId,
        sectorId: player.sectorId,
        zoneId: player.zoneId,
        unitId: player.unitId,
        [pointField]: pointsEarned,
        totalPoints: pointsEarned,
        tournamentsPlayed: 1,
      },
      update: {
        [pointField]: { increment: pointsEarned },
        totalPoints: { increment: pointsEarned },
        tournamentsPlayed: { increment: 1 },
      },
    });
  } catch (error) {
    console.error('Error updating force ranking:', error);
  }
}

function getCategoryPointField(category: TournamentCategory): string {
  switch (category) {
    case 'FORCE_UNIT':
      return 'unitPoints';
    case 'FORCE_ZONE':
      return 'zonePoints';
    case 'FORCE_SECTOR':
      return 'sectorPoints';
    case 'FORCE_LEVEL':
    case 'INTER_FORCE':
      return 'forcePoints';
    default:
      return 'individualPoints';
  }
}

// ============================================
// UNIT RANKING AGGREGATION
// ============================================

export async function recalculateUnitRankings(
  unitId: string,
  sport: SportType
): Promise<void> {
  try {
    // Aggregate player rankings for this unit
    const aggregation = await db.forceRanking.aggregate({
      where: {
        unitId,
        sport,
      },
      _sum: {
        totalPoints: true,
      },
      _count: {
        playerId: true,
      },
    });

    // Update or create unit ranking
    await db.unitRanking.upsert({
      where: {
        unitId_sport: {
          unitId,
          sport,
        },
      },
      create: {
        unitId,
        sport,
        totalPoints: aggregation._sum.totalPoints || 0,
        playersCount: aggregation._count.playerId,
      },
      update: {
        totalPoints: aggregation._sum.totalPoints || 0,
        playersCount: aggregation._count.playerId,
      },
    });
  } catch (error) {
    console.error('Error recalculating unit rankings:', error);
  }
}

// ============================================
// FREE ACCESS CHECK
// ============================================

export async function hasFreeForceAccess(forceId: string): Promise<boolean> {
  try {
    const force = await db.force.findUnique({
      where: { id: forceId },
      select: {
        isFreeAccess: true,
        type: true,
        subscriptionStatus: true,
      },
    });

    if (!force) return false;

    // Check explicit free access
    if (force.isFreeAccess) return true;

    // Check if force type qualifies for free access
    const freeTypes: ForceType[] = ['ARMED_FORCE', 'MILITARY', 'POLICE', 'GOVT_DEPARTMENT'];
    if (freeTypes.includes(force.type)) {
      return true;
    }

    // Check subscription status
    if (force.subscriptionStatus === 'ACTIVE') {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking free access:', error);
    return false;
  }
}

// ============================================
// EXPORTS
// ============================================

export const ForceService = {
  FORCE_TIER_WEIGHTS,
  getCategoryFromForceScope,
  validateForceTournamentEligibility,
  updateForceRanking,
  recalculateUnitRankings,
  hasFreeForceAccess,
};
