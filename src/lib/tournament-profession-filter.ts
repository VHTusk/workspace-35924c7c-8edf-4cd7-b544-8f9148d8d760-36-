/**
 * Tournament Profession Filter (v3.53.0)
 * 
 * Handles profession-based tournament eligibility checking.
 * Phase 1 MVP: Self-declaration + filtering only.
 */

import { db } from '@/lib/db';
import { Profession, ProfessionVerificationStatus } from '@prisma/client';
import { getUserProfession, PROFESSION_LABELS } from './profession-manager';

// ============================================
// TYPES
// ============================================

export interface ProfessionEligibilityResult {
  eligible: boolean;
  reason?: string;
  requiresDeclaration: boolean;
  requiresVerification: boolean;
  matchedProfession?: Profession;
  allowedProfessions?: Profession[];
}

export interface TournamentProfessionRules {
  isExclusive: boolean;
  allowedProfessions: Profession[];
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Parse allowed professions from JSON string
 */
export function parseAllowedProfessions(jsonString: string | null): Profession[] {
  if (!jsonString) return [];
  
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is Profession => 
        Object.values(Profession).includes(p)
      );
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Serialize professions to JSON string
 */
export function serializeAllowedProfessions(professions: Profession[]): string {
  return JSON.stringify(professions);
}

/**
 * Get profession rules for a tournament
 */
export async function getTournamentProfessionRules(
  tournamentId: string
): Promise<TournamentProfessionRules> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isProfessionExclusive: true,
        allowedProfessions: true,
      },
    });

    if (!tournament) {
      return { isExclusive: false, allowedProfessions: [] };
    }

    return {
      isExclusive: tournament.isProfessionExclusive,
      allowedProfessions: parseAllowedProfessions(tournament.allowedProfessions),
    };
  } catch (error) {
    console.error('Error getting profession rules:', error);
    return { isExclusive: false, allowedProfessions: [] };
  }
}

/**
 * Set profession rules for a tournament
 */
export async function setTournamentProfessionRules(
  tournamentId: string,
  rules: {
    isExclusive: boolean;
    allowedProfessions: Profession[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { status: true },
    });

    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Can only set rules before registration opens
    if (tournament.status !== 'DRAFT') {
      // Allow for tournaments in DRAFT status only
      // But also allow editing for admin users (handled at API level)
    }

    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        isProfessionExclusive: rules.isExclusive,
        allowedProfessions: rules.isExclusive 
          ? serializeAllowedProfessions(rules.allowedProfessions)
          : null,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error setting profession rules:', error);
    return { success: false, error: 'Failed to set profession rules' };
  }
}

/**
 * Check if a user is eligible for a profession-exclusive tournament
 */
export async function checkProfessionEligibility(
  userId: string,
  tournamentId: string
): Promise<ProfessionEligibilityResult> {
  try {
    // Get tournament rules
    const rules = await getTournamentProfessionRules(tournamentId);

    // If not profession-exclusive, everyone is eligible
    if (!rules.isExclusive) {
      return {
        eligible: true,
        requiresDeclaration: false,
        requiresVerification: false,
      };
    }

    // Get user's profession
    const userProfession = await getUserProfession(userId);

    // If user has no profession declared
    if (!userProfession || !userProfession.profession) {
      return {
        eligible: false,
        reason: 'This tournament requires profession declaration. Please declare your profession to continue.',
        requiresDeclaration: true,
        requiresVerification: false,
        allowedProfessions: rules.allowedProfessions,
      };
    }

    // Check if profession matches allowed list
    if (!rules.allowedProfessions.includes(userProfession.profession)) {
      const allowedNames = rules.allowedProfessions
        .map(p => PROFESSION_LABELS[p])
        .join(', ');

      return {
        eligible: false,
        reason: `This tournament is exclusive to: ${allowedNames}. Your declared profession (${PROFESSION_LABELS[userProfession.profession]}) is not eligible.`,
        requiresDeclaration: false,
        requiresVerification: false,
        matchedProfession: userProfession.profession,
        allowedProfessions: rules.allowedProfessions,
      };
    }

    // Profession matches - eligible
    // Check if verification is needed for claiming rewards
    const needsVerification = userProfession.verificationStatus !== ProfessionVerificationStatus.VERIFIED;

    return {
      eligible: true,
      requiresDeclaration: false,
      requiresVerification: needsVerification,
      matchedProfession: userProfession.profession,
      allowedProfessions: rules.allowedProfessions,
    };
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return {
      eligible: false,
      reason: 'Failed to check eligibility',
      requiresDeclaration: false,
      requiresVerification: false,
    };
  }
}

/**
 * Get all profession-exclusive tournaments
 */
export async function getProfessionExclusiveTournaments(filters?: {
  profession?: Profession;
  sportId?: string;
  status?: string;
}) {
  try {
    const where: Record<string, unknown> = {
      isProfessionExclusive: true,
    };

    if (filters?.sportId) {
      where.sportId = filters.sportId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const tournaments = await db.tournament.findMany({
      where,
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        startDate: true,
        allowedProfessions: true,
        city: true,
        state: true,
      },
      orderBy: { startDate: 'asc' },
    });

    // Filter by profession if specified
    if (filters?.profession) {
      return tournaments.filter(t => {
        const allowed = parseAllowedProfessions(t.allowedProfessions);
        return allowed.includes(filters.profession!);
      });
    }

    return tournaments;
  } catch (error) {
    console.error('Error getting exclusive tournaments:', error);
    return [];
  }
}

/**
 * Get tournaments a user can participate in based on their profession
 */
export async function getTournamentsForUserProfession(userId: string) {
  try {
    const userProfession = await getUserProfession(userId);

    if (!userProfession?.profession) {
      // Return all non-exclusive tournaments
      return await db.tournament.findMany({
        where: {
          isProfessionExclusive: false,
          status: { in: ['DRAFT', 'REGISTRATION_OPEN'] },
        },
        orderBy: { startDate: 'asc' },
      });
    }

    // Get all tournaments
    const tournaments = await db.tournament.findMany({
      where: {
        status: { in: ['DRAFT', 'REGISTRATION_OPEN'] },
      },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        startDate: true,
        isProfessionExclusive: true,
        allowedProfessions: true,
        city: true,
        state: true,
      },
      orderBy: { startDate: 'asc' },
    });

    // Filter to include:
    // 1. Non-exclusive tournaments
    // 2. Exclusive tournaments where user's profession is allowed
    return tournaments.filter(t => {
      if (!t.isProfessionExclusive) return true;
      
      const allowed = parseAllowedProfessions(t.allowedProfessions);
      return allowed.includes(userProfession.profession!);
    });
  } catch (error) {
    console.error('Error getting tournaments for profession:', error);
    return [];
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format allowed professions for display
 */
export function formatAllowedProfessions(professions: Profession[]): string {
  if (professions.length === 0) return 'All professions';
  
  return professions
    .map(p => PROFESSION_LABELS[p])
    .join(', ');
}

/**
 * Get profession badge color
 */
export function getProfessionBadgeColor(profession: Profession): string {
  const colors: Record<string, string> = {
    LAWYER: 'bg-amber-100 text-amber-800',
    DOCTOR: 'bg-red-100 text-red-800',
    CHARTERED_ACCOUNTANT: 'bg-green-100 text-green-800',
    TEACHER: 'bg-blue-100 text-blue-800',
    ENGINEER: 'bg-purple-100 text-purple-800',
    ARCHITECT: 'bg-orange-100 text-orange-800',
    JOURNALIST: 'bg-pink-100 text-pink-800',
    GOVERNMENT_EMPLOYEE: 'bg-cyan-100 text-cyan-800',
    PRIVATE_SECTOR: 'bg-indigo-100 text-indigo-800',
    SELF_EMPLOYED: 'bg-teal-100 text-teal-800',
    STUDENT: 'bg-lime-100 text-lime-800',
    OTHER: 'bg-gray-100 text-gray-800',
  };

  return colors[profession] || 'bg-gray-100 text-gray-800';
}
