/**
 * VALORHIVE v3.39.0 - Rating Integrity Service
 * 
 * Enforces integrity protections for the Global Rating System:
 * - Tournament category/scope/rated locks after certain stages
 * - Match result finalization window
 * - Tier snapshot at match resolution
 * - Historical audit trail
 */

import { db } from '@/lib/db';
import { TournamentStatus, TournamentCategory, TournamentScope, SportType } from '@prisma/client';

// ============================================
// CONFIGURATION
// ============================================

/** Result dispute window in hours */
export const DISPUTE_WINDOW_HOURS = 48;

/** Result finalization window in hours (after dispute window) */
export const FINALIZATION_WINDOW_HOURS = 72;

/** Total hours until result is immutable */
export const IMMUTABILITY_WINDOW_HOURS = DISPUTE_WINDOW_HOURS + FINALIZATION_WINDOW_HOURS;

// ============================================
// TOURNAMENT LOCKING FUNCTIONS
// ============================================

/**
 * Check if tournament category can be modified
 * Category is locked after REGISTRATION_CLOSED
 */
export function canModifyCategory(tournament: { status: TournamentStatus; categoryLockedAt: Date | null }): boolean {
  if (tournament.categoryLockedAt) return false;
  
  const lockedStatuses: TournamentStatus[] = [
    'REGISTRATION_CLOSED',
    'BRACKET_GENERATED',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  
  return !lockedStatuses.includes(tournament.status);
}

/**
 * Check if tournament scope can be modified
 * Scope is locked after REGISTRATION_CLOSED
 */
export function canModifyScope(tournament: { status: TournamentStatus; scopeLockedAt: Date | null }): boolean {
  if (tournament.scopeLockedAt) return false;
  
  const lockedStatuses: TournamentStatus[] = [
    'REGISTRATION_CLOSED',
    'BRACKET_GENERATED',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  
  return !lockedStatuses.includes(tournament.status);
}

/**
 * Check if tournament rated status can be modified
 * isRated is locked after IN_PROGRESS
 */
export function canModifyRatedStatus(tournament: { status: TournamentStatus; ratedLockedAt: Date | null }): boolean {
  if (tournament.ratedLockedAt) return false;
  
  const lockedStatuses: TournamentStatus[] = [
    'IN_PROGRESS',
    'COMPLETED',
  ];
  
  return !lockedStatuses.includes(tournament.status);
}

/**
 * Apply locks when tournament status changes
 * Call this when tournament status is updated
 */
export async function applyTournamentLocks(
  tournamentId: string,
  newStatus: TournamentStatus
): Promise<{ categoryLocked: boolean; scopeLocked: boolean; ratedLocked: boolean }> {
  const result = { categoryLocked: false, scopeLocked: false, ratedLocked: false };
  
  const lockData: any = {};
  const now = new Date();
  
  // Lock category and scope when registration closes
  if (newStatus === 'REGISTRATION_CLOSED') {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { categoryLockedAt: true, scopeLockedAt: true },
    });
    
    if (!tournament?.categoryLockedAt) {
      lockData.categoryLockedAt = now;
      result.categoryLocked = true;
    }
    if (!tournament?.scopeLockedAt) {
      lockData.scopeLockedAt = now;
      result.scopeLocked = true;
    }
  }
  
  // Lock rated status when tournament starts
  if (newStatus === 'IN_PROGRESS') {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { ratedLockedAt: true },
    });
    
    if (!tournament?.ratedLockedAt) {
      lockData.ratedLockedAt = now;
      result.ratedLocked = true;
    }
  }
  
  // Apply locks if any
  if (Object.keys(lockData).length > 0) {
    await db.tournament.update({
      where: { id: tournamentId },
      data: lockData,
    });
  }
  
  return result;
}

// ============================================
// MATCH RESULT FINALIZATION
// ============================================

/**
 * Check if match result is within dispute window
 */
export function isWithinDisputeWindow(matchPlayedAt: Date): boolean {
  const disputeDeadline = new Date(matchPlayedAt.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
  return new Date() < disputeDeadline;
}

/**
 * Check if match result is finalized (past dispute and finalization windows)
 */
export function isMatchResultFinalized(matchPlayedAt: Date): boolean {
  const finalizationDeadline = new Date(
    matchPlayedAt.getTime() + IMMUTABILITY_WINDOW_HOURS * 60 * 60 * 1000
  );
  return new Date() >= finalizationDeadline;
}

/**
 * Check if match result can be edited
 * - Within dispute window: can be edited
 * - Past dispute window but not finalized: limited edits
 * - Finalized: cannot be edited (only voided by super admin)
 */
export function canEditMatchResult(match: { 
  playedAt: Date; 
  ratingLockedAt: Date | null;
  outcome: string | null;
}): { canEdit: boolean; reason: string; requiresAdmin: boolean } {
  
  // If rating is locked, result is immutable
  if (match.ratingLockedAt) {
    return {
      canEdit: false,
      reason: 'Match result is finalized and immutable',
      requiresAdmin: true,
    };
  }
  
  const playedAt = new Date(match.playedAt);
  
  // Within dispute window - normal edits allowed
  if (isWithinDisputeWindow(playedAt)) {
    return {
      canEdit: true,
      reason: 'Within dispute window',
      requiresAdmin: false,
    };
  }
  
  // Past dispute window but not finalized - admin edits only
  if (!isMatchResultFinalized(playedAt)) {
    return {
      canEdit: true,
      reason: 'Past dispute window - admin override required',
      requiresAdmin: true,
    };
  }
  
  // Finalized - cannot edit
  return {
    canEdit: false,
    reason: 'Match result is immutable after finalization window',
    requiresAdmin: true,
  };
}

// ============================================
// RATING SNAPSHOT FUNCTIONS
// ============================================

interface RatingSnapshot {
  categoryUsed: TournamentCategory | null;
  tierUsed: number;
  tierWeightUsed: number;
  isRatedUsed: boolean;
}

/**
 * Get rating snapshot for a match
 * This captures the tournament's rating configuration at match time
 */
export async function getRatingSnapshot(tournamentId: string | null): Promise<RatingSnapshot> {
  const defaultSnapshot: RatingSnapshot = {
    categoryUsed: null,
    tierUsed: 4, // Default to CITY_OPEN tier
    tierWeightUsed: 1.0,
    isRatedUsed: true,
  };
  
  if (!tournamentId) {
    return defaultSnapshot;
  }
  
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      category: true,
      isRated: true,
      categoryLockedAt: true,
    },
  });
  
  if (!tournament) {
    return defaultSnapshot;
  }
  
  const categoryUsed = tournament.category;
  const isRatedUsed = tournament.isRated;
  
  // Calculate tier and weight
  let tierUsed = 4; // Default CITY_OPEN
  let tierWeightUsed = 1.0;
  
  if (categoryUsed) {
    const tierMapping: Record<TournamentCategory, number> = {
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
    
    const tierWeights: Record<number, number> = {
      1: 0.35,
      2: 0.60,
      3: 0.80,
      4: 1.00,
      5: 1.10,
      6: 1.25,
      7: 1.50,
    };
    
    tierUsed = tierMapping[categoryUsed] || 4;
    tierWeightUsed = tierWeights[tierUsed] || 1.0;
  }
  
  return {
    categoryUsed,
    tierUsed,
    tierWeightUsed,
    isRatedUsed,
  };
}

/**
 * Lock match rating - call this after rating calculation
 * This makes the match result immutable
 */
export async function lockMatchRating(matchId: string): Promise<void> {
  await db.match.update({
    where: { id: matchId },
    data: { ratingLockedAt: new Date() },
  });
}

// ============================================
// AUDIT FUNCTIONS
// ============================================

interface RatingAuditLog {
  matchId: string;
  tournamentId: string | null;
  playerAId: string | null;
  playerBId: string | null;
  categoryUsed: TournamentCategory | null;
  tierUsed: number;
  tierWeightUsed: number;
  isRatedUsed: boolean;
  globalEloChangeA: number;
  globalEloChangeB: number;
  playerAEloBefore: number;
  playerAEloAfter: number;
  playerBEloBefore: number;
  playerBEloAfter: number;
  calculatedAt: Date;
}

/**
 * Get rating audit log for a match
 */
export async function getRatingAuditLog(matchId: string): Promise<RatingAuditLog | null> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      tournamentId: true,
      playerAId: true,
      playerBId: true,
      categoryUsed: true,
      tierUsed: true,
      tierWeightUsed: true,
      isRatedUsed: true,
      globalEloChangeA: true,
      globalEloChangeB: true,
      ratingLockedAt: true,
      playerA: {
        select: { globalElo: true },
      },
      playerB: {
        select: { globalElo: true },
      },
    },
  });
  
  if (!match) return null;
  
  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    playerAId: match.playerAId,
    playerBId: match.playerBId,
    categoryUsed: match.categoryUsed,
    tierUsed: match.tierUsed || 4,
    tierWeightUsed: match.tierWeightUsed || 1.0,
    isRatedUsed: match.isRatedUsed ?? true,
    globalEloChangeA: match.globalEloChangeA || 0,
    globalEloChangeB: match.globalEloChangeB || 0,
    playerAEloBefore: (match.playerA?.globalElo || 1500) - (match.globalEloChangeA || 0),
    playerAEloAfter: match.playerA?.globalElo || 1500,
    playerBEloBefore: (match.playerB?.globalElo || 1500) - (match.globalEloChangeB || 0),
    playerBEloAfter: match.playerB?.globalElo || 1500,
    calculatedAt: match.ratingLockedAt || new Date(),
  };
}

// ============================================
// RATED TOURNAMENT POLICY
// ============================================

/**
 * Default rated status for tournament categories
 * This documents which tournaments should affect ratings
 */
export const RATED_TOURNAMENT_POLICY: Record<TournamentCategory, { 
  shouldRate: boolean; 
  description: string 
}> = {
  EXHIBITION: { shouldRate: false, description: 'Exhibition/friendly matches - not rated' },
  INVITATIONAL: { shouldRate: true, description: 'Invite-only events - rated if competitive' },
  INTRA: { shouldRate: false, description: 'Internal organization tournaments - optional' },
  FRANCHISE: { shouldRate: true, description: 'League-owned events - rated' },
  INTER_ORG: { shouldRate: true, description: 'Organization vs organization - rated' },
  AGE_RESTRICTED: { shouldRate: true, description: 'Age-limited competitions - rated' },
  TEAM_OPEN: { shouldRate: true, description: 'Open team events - rated' },
  LOCAL_OPEN: { shouldRate: true, description: 'Local open entry - rated' },
  CITY_OPEN: { shouldRate: true, description: 'City-level open - rated (baseline)' },
  DISTRICT_OPEN: { shouldRate: true, description: 'District-level open - rated' },
  QUALIFIER: { shouldRate: true, description: 'Qualifier events - rated' },
  STATE_OPEN: { shouldRate: true, description: 'State-level open - rated' },
  NATIONAL_OPEN: { shouldRate: true, description: 'National-level open - rated' },
};

/**
 * Validate tournament creation for rating policy
 */
export function validateRatingPolicy(
  category: TournamentCategory,
  isRated: boolean
): { valid: boolean; warning?: string } {
  const policy = RATED_TOURNAMENT_POLICY[category];
  
  if (isRated !== policy.shouldRate) {
    return {
      valid: true,
      warning: `Category ${category} typically ${policy.shouldRate ? 'should' : 'should not'} be rated. Current setting: ${isRated ? 'rated' : 'not rated'}. ${policy.description}`,
    };
  }
  
  return { valid: true };
}

// ============================================
// EXPORT ALL
// ============================================

export const RatingIntegrityService = {
  // Configuration
  DISPUTE_WINDOW_HOURS,
  FINALIZATION_WINDOW_HOURS,
  IMMUTABILITY_WINDOW_HOURS,
  
  // Tournament locking
  canModifyCategory,
  canModifyScope,
  canModifyRatedStatus,
  applyTournamentLocks,
  
  // Match finalization
  isWithinDisputeWindow,
  isMatchResultFinalized,
  canEditMatchResult,
  
  // Rating snapshot
  getRatingSnapshot,
  lockMatchRating,
  
  // Audit
  getRatingAuditLog,
  
  // Policy
  RATED_TOURNAMENT_POLICY,
  validateRatingPolicy,
};
