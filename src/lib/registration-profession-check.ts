/**
 * Registration Profession Check (v3.53.0)
 * 
 * Handles profession-aware registration flow.
 * Validates eligibility before payment and handles inline declaration.
 */

import { db } from '@/lib/db';
import { Profession, ProfessionVerificationStatus } from '@prisma/client';
import { 
  checkProfessionEligibility, 
  parseAllowedProfessions 
} from './tournament-profession-filter';
import { setUserProfession, getUserProfession } from './profession-manager';

// ============================================
// TYPES
// ============================================

export interface RegistrationEligibilityResult {
  canRegister: boolean;
  blockReason?: string;
  requiresDeclaration: boolean;
  allowedProfessions?: Profession[];
  currentProfession?: Profession | null;
}

export interface ProfessionDeclarationResult {
  success: boolean;
  profession?: Profession;
  eligibility?: RegistrationEligibilityResult;
  error?: string;
}

export interface RegistrationProfessionData {
  userId: string;
  tournamentId: string;
  declaredProfession: Profession | null;
  checkPassed: boolean;
  requiresVerification: boolean;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Validate registration eligibility for profession-exclusive tournaments
 * This runs BEFORE payment processing
 */
export async function validateRegistrationEligibility(
  userId: string,
  tournamentId: string
): Promise<RegistrationEligibilityResult> {
  try {
    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isProfessionExclusive: true,
        allowedProfessions: true,
        status: true,
      },
    });

    if (!tournament) {
      return {
        canRegister: false,
        blockReason: 'Tournament not found',
        requiresDeclaration: false,
      };
    }

    // If not profession-exclusive, allow registration
    if (!tournament.isProfessionExclusive) {
      return {
        canRegister: true,
        requiresDeclaration: false,
      };
    }

    // Get user's current profession
    const userProfession = await getUserProfession(userId);
    const allowedProfessions = parseAllowedProfessions(tournament.allowedProfessions);

    // User has no profession declared - trigger declaration flow
    if (!userProfession?.profession) {
      return {
        canRegister: false,
        blockReason: 'This tournament is exclusive to specific professions. Please declare your profession to continue.',
        requiresDeclaration: true,
        allowedProfessions,
        currentProfession: null,
      };
    }

    // User has profession - check if it matches
    if (!allowedProfessions.includes(userProfession.profession)) {
      return {
        canRegister: false,
        blockReason: `Your profession (${userProfession.profession}) is not eligible for this tournament.`,
        requiresDeclaration: false,
        allowedProfessions,
        currentProfession: userProfession.profession,
      };
    }

    // Profession matches - allow registration
    return {
      canRegister: true,
      requiresDeclaration: false,
      allowedProfessions,
      currentProfession: userProfession.profession,
    };
  } catch (error) {
    console.error('Error validating registration eligibility:', error);
    return {
      canRegister: false,
      blockReason: 'Failed to validate eligibility',
      requiresDeclaration: false,
    };
  }
}

/**
 * Handle inline profession declaration during registration
 * Called when user needs to declare profession to continue registration
 */
export async function handleInlineProfessionDeclaration(
  userId: string,
  tournamentId: string,
  selectedProfession: Profession
): Promise<ProfessionDeclarationResult> {
  try {
    // Get tournament to verify profession is in allowed list
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isProfessionExclusive: true,
        allowedProfessions: true,
      },
    });

    if (!tournament) {
      return {
        success: false,
        error: 'Tournament not found',
      };
    }

    const allowedProfessions = parseAllowedProfessions(tournament.allowedProfessions);

    // Verify profession is allowed
    if (tournament.isProfessionExclusive && !allowedProfessions.includes(selectedProfession)) {
      return {
        success: false,
        error: 'Selected profession is not eligible for this tournament',
      };
    }

    // Set user's profession
    const result = await setUserProfession({
      userId,
      profession: selectedProfession,
      showPublicly: false,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to set profession',
      };
    }

    // Re-validate eligibility
    const eligibility = await validateRegistrationEligibility(userId, tournamentId);

    return {
      success: true,
      profession: selectedProfession,
      eligibility,
    };
  } catch (error) {
    console.error('Error handling inline declaration:', error);
    return {
      success: false,
      error: 'Failed to process profession declaration',
    };
  }
}

/**
 * Create profession data for a registration
 * Called when creating a tournament registration
 */
export async function createRegistrationProfessionData(
  userId: string,
  tournamentId: string
): Promise<RegistrationProfessionData> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isProfessionExclusive: true,
        allowedProfessions: true,
      },
    });

    const userProfession = await getUserProfession(userId);

    // Default values
    let declaredProfession: Profession | null = userProfession?.profession || null;
    let checkPassed = true;
    let requiresVerification = false;

    if (tournament?.isProfessionExclusive) {
      const allowedProfessions = parseAllowedProfessions(tournament.allowedProfessions);
      
      // Check if profession matches
      if (userProfession?.profession && allowedProfessions.includes(userProfession.profession)) {
        checkPassed = true;
        // Verification needed if not verified yet
        requiresVerification = userProfession.verificationStatus !== ProfessionVerificationStatus.VERIFIED;
      } else if (userProfession?.profession) {
        // Profession doesn't match - should not happen if eligibility was checked
        checkPassed = false;
      } else {
        // No profession - should not happen if declaration was triggered
        checkPassed = false;
      }
    }

    return {
      userId,
      tournamentId,
      declaredProfession,
      checkPassed,
      requiresVerification,
    };
  } catch (error) {
    console.error('Error creating registration profession data:', error);
    return {
      userId,
      tournamentId,
      declaredProfession: null,
      checkPassed: true,
      requiresVerification: false,
    };
  }
}

/**
 * Update registration with profession data
 */
export async function updateRegistrationProfession(
  registrationId: string,
  data: RegistrationProfessionData
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        declaredProfession: data.declaredProfession,
        professionCheckPassed: data.checkPassed,
        requiresProfessionVerification: data.requiresVerification,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating registration profession:', error);
    return { success: false, error: 'Failed to update registration' };
  }
}

/**
 * Check if a registration can claim rewards
 * Returns false if profession verification is required but not completed
 */
export async function canClaimRegistrationRewards(
  registrationId: string
): Promise<{ canClaim: boolean; reason?: string }> {
  try {
    const registration = await db.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        requiresProfessionVerification: true,
        userId: true,
      },
    });

    if (!registration) {
      return { canClaim: false, reason: 'Registration not found' };
    }

    // If verification not required, can claim
    if (!registration.requiresProfessionVerification) {
      return { canClaim: true };
    }

    // Check if user's profession is now verified
    const userProfession = await getUserProfession(registration.userId);

    if (userProfession?.verificationStatus === ProfessionVerificationStatus.VERIFIED) {
      return { canClaim: true };
    }

    return {
      canClaim: false,
      reason: 'Profession verification required to claim rewards. Please verify your profession by uploading supporting documents.',
    };
  } catch (error) {
    console.error('Error checking reward eligibility:', error);
    return { canClaim: false, reason: 'Failed to verify eligibility' };
  }
}

/**
 * Get all registrations that are blocking rewards due to unverified profession
 */
export async function getRegistrationsPendingProfessionVerification(tournamentId?: string) {
  try {
    const where: Record<string, unknown> = {
      requiresProfessionVerification: true,
      status: 'CONFIRMED',
    };

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    const registrations = await db.tournamentRegistration.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profession: true,
            professionVerified: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Filter to only those with unverified profession
    return registrations.filter(r => 
      r.user.professionVerified !== ProfessionVerificationStatus.VERIFIED
    );
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    return [];
  }
}

// ============================================
// REWARD ENGINE INTEGRATION
// ============================================

/**
 * Check and hold rewards if profession verification pending
 * Called by reward engine before awarding prizes
 */
export async function checkProfessionForRewards(
  userId: string,
  tournamentId: string
): Promise<{
  canAward: boolean;
  holdReason?: string;
  requiresVerification: boolean;
}> {
  try {
    // Check if tournament is profession-exclusive
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { isProfessionExclusive: true },
    });

    // If not exclusive, can always award
    if (!tournament?.isProfessionExclusive) {
      return { canAward: true, requiresVerification: false };
    }

    // Check user's profession verification status
    const userProfession = await getUserProfession(userId);

    if (!userProfession?.profession) {
      return {
        canAward: false,
        holdReason: 'No profession declared',
        requiresVerification: true,
      };
    }

    if (userProfession.verificationStatus === ProfessionVerificationStatus.VERIFIED) {
      return { canAward: true, requiresVerification: false };
    }

    return {
      canAward: false,
      holdReason: 'Profession verification pending',
      requiresVerification: true,
    };
  } catch (error) {
    console.error('Error checking profession for rewards:', error);
    return {
      canAward: false,
      holdReason: 'Failed to verify profession',
      requiresVerification: false,
    };
  }
}
