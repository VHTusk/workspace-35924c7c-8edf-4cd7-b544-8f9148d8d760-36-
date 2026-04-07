/**
 * Challenger Permissions - API Middleware
 * 
 * Backend validation for district permissions in Challenger Mode.
 * Provides server-side permission checks before allowing actions.
 * 
 * Rules:
 * - Case A (No district): Can only VIEW content, cannot PARTICIPATE
 * - Case B (Other district): View only mode for non-home districts
 * 
 * @module challenger-permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// ============================================
// TYPES
// ============================================

export type ChallengerAction = 'join-tournament' | 'create-challenge' | 'accept-challenge';

export interface ChallengerPermissionResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Type of restriction if not allowed */
  restrictionType: 'none' | 'no-district' | 'other-district';
  /** Human-readable message */
  message: string | null;
  /** User's district (if set) */
  userDistrict: string | null;
  /** Target district being accessed */
  targetDistrict: string | null;
}

export interface ChallengerPermissionError {
  error: string;
  code: 'NO_DISTRICT' | 'OTHER_DISTRICT' | 'UNAUTHORIZED';
  message: string;
}

// ============================================
// CONSTANTS
// ============================================

const ERROR_MESSAGES = {
  NO_DISTRICT: "Add your district in your profile to participate in Challenger Mode.",
  OTHER_DISTRICT: "View Only — Challenger participation is limited to your district.",
  UNAUTHORIZED: "You must be logged in to perform this action.",
} as const;

// ============================================
// CORE PERMISSION FUNCTIONS
// ============================================

/**
 * Check challenger permissions for a user
 * 
 * @param userId - The user ID to check permissions for
 * @param targetDistrictId - The district ID being accessed
 * @returns Permission result with allowed status and message
 */
export async function checkChallengerPermissions(
  userId: string,
  targetDistrictId: string
): Promise<ChallengerPermissionResult> {
  // Get user with district info
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      district: true,
      role: true,
      adminAssignments: {
        where: { isActive: true },
        select: { adminRole: true },
      },
    },
  });

  if (!user) {
    return {
      allowed: false,
      restrictionType: 'no-district',
      message: "User not found",
      userDistrict: null,
      targetDistrict: targetDistrictId,
    };
  }

  // Check if user is admin (admins bypass restrictions)
  const isAdmin = user.role === 'ADMIN' || 
    user.role === 'SUB_ADMIN' ||
    user.adminAssignments.length > 0;

  if (isAdmin) {
    return {
      allowed: true,
      restrictionType: 'none',
      message: null,
      userDistrict: user.district,
      targetDistrict: targetDistrictId,
    };
  }

  // Check if user has a district
  if (!user.district) {
    return {
      allowed: false,
      restrictionType: 'no-district',
      message: ERROR_MESSAGES.NO_DISTRICT,
      userDistrict: null,
      targetDistrict: targetDistrictId,
    };
  }

  // Check if user is in their own district
  if (user.district !== targetDistrictId) {
    return {
      allowed: false,
      restrictionType: 'other-district',
      message: ERROR_MESSAGES.OTHER_DISTRICT,
      userDistrict: user.district,
      targetDistrict: targetDistrictId,
    };
  }

  // User is in their own district - full access
  return {
    allowed: true,
    restrictionType: 'none',
    message: null,
    userDistrict: user.district,
    targetDistrict: targetDistrictId,
  };
}

/**
 * Validate challenger permissions for a specific action
 * 
 * @param userId - The user ID to check
 * @param targetDistrictId - The district being accessed
 * @param action - The action being attempted
 * @returns Permission result or throws error
 */
export async function validateChallengerAction(
  userId: string,
  targetDistrictId: string,
  action: ChallengerAction
): Promise<ChallengerPermissionResult> {
  const result = await checkChallengerPermissions(userId, targetDistrictId);

  if (!result.allowed) {
    // Log the restricted attempt (for analytics/monitoring)
    console.log(`[Challenger Permission] User ${userId} blocked from ${action} in district ${targetDistrictId}: ${result.restrictionType}`);
  }

  return result;
}

// ============================================
// API MIDDLEWARE HELPERS
// ============================================

/**
 * Create an error response for permission denial
 */
export function createPermissionErrorResponse(
  result: ChallengerPermissionResult
): NextResponse<ChallengerPermissionError> {
  const code = result.restrictionType === 'no-district' 
    ? 'NO_DISTRICT' 
    : result.restrictionType === 'other-district'
      ? 'OTHER_DISTRICT'
      : 'UNAUTHORIZED';

  return NextResponse.json(
    {
      error: 'Permission denied',
      code,
      message: result.message || 'Access restricted',
    } as ChallengerPermissionError,
    { status: 403 }
  );
}

/**
 * Middleware function to check challenger permissions in API routes
 * 
 * @example
 * ```ts
 * // In an API route handler
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireChallengerPermission(request, districtId);
 *   if (!authResult.success) {
 *     return authResult.response;
 *   }
 *   
 *   const { user } = authResult;
 *   // Continue with authenticated request
 * }
 * ```
 */
export async function requireChallengerPermission(
  request: NextRequest,
  targetDistrictId: string
): Promise<
  | { success: true; user: { id: string; district: string | null } }
  | { success: false; response: NextResponse<ChallengerPermissionError> }
> {
  // Get authenticated user
  const authResult = await getAuthenticatedUser(request);

  if (!authResult) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          message: ERROR_MESSAGES.UNAUTHORIZED,
        } as ChallengerPermissionError,
        { status: 401 }
      ),
    };
  }

  const { user } = authResult;

  // Check permissions
  const result = await checkChallengerPermissions(user.id, targetDistrictId);

  if (!result.allowed) {
    return {
      success: false,
      response: createPermissionErrorResponse(result),
    };
  }

  return {
    success: true,
    user: { id: user.id, district: user.district },
  };
}

/**
 * Higher-order function to wrap API handlers with challenger permission checks
 * 
 * @example
 * ```ts
 * // Wrap an API handler
 * export const POST = withChallengerPermission(async (request, { user }) => {
 *   // Handler code here - user is authenticated and has district permission
 *   return NextResponse.json({ success: true });
 * }, 'districtIdParam');
 * ```
 */
export function withChallengerPermission<T extends { user: { id: string; district: string | null } }>(
  handler: (request: NextRequest, context: T) => Promise<NextResponse>,
  districtIdParam: string
): (request: NextRequest, context: Record<string, unknown>) => Promise<NextResponse> {
  return async (request: NextRequest, context: Record<string, unknown>) => {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          message: ERROR_MESSAGES.UNAUTHORIZED,
        } as ChallengerPermissionError,
        { status: 401 }
      );
    }

    const { user } = authResult;
    const districtId = context[districtIdParam] as string | undefined;

    if (!districtId) {
      return NextResponse.json(
        { error: 'District ID required' },
        { status: 400 }
      );
    }

    const result = await checkChallengerPermissions(user.id, districtId);

    if (!result.allowed) {
      return createPermissionErrorResponse(result);
    }

    return handler(request, { ...context, user: { id: user.id, district: user.district } } as T);
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if user can perform a specific action in a district
 * Simplified boolean check for use in business logic
 */
export async function canUserPerformAction(
  userId: string,
  districtId: string,
  action: ChallengerAction
): Promise<boolean> {
  const result = await checkChallengerPermissions(userId, districtId);

  if (!result.allowed) {
    return false;
  }

  // All actions are allowed if user passes district check
  return true;
}

/**
 * Get user's home district
 * Returns null if user has no district set
 */
export async function getUserDistrict(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { district: true },
  });

  return user?.district ?? null;
}

/**
 * Check if user has a district set
 */
export async function userHasDistrict(userId: string): Promise<boolean> {
  const district = await getUserDistrict(userId);
  return district !== null;
}

/**
 * Validate that a tournament is in the user's district
 * For use when checking tournament registration permissions
 */
export async function validateTournamentDistrictAccess(
  userId: string,
  tournamentId: string
): Promise<ChallengerPermissionResult> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { district: true },
  });

  if (!tournament) {
    return {
      allowed: false,
      restrictionType: 'no-district',
      message: "Tournament not found",
      userDistrict: null,
      targetDistrict: null,
    };
  }

  return checkChallengerPermissions(userId, tournament.district || '');
}

/**
 * Get all districts where user can participate
 * For users, this is just their own district (or none)
 */
export async function getUserParticipableDistricts(userId: string): Promise<string[]> {
  const district = await getUserDistrict(userId);
  return district ? [district] : [];
}

export default {
  checkChallengerPermissions,
  validateChallengerAction,
  requireChallengerPermission,
  withChallengerPermission,
  canUserPerformAction,
  getUserDistrict,
  userHasDistrict,
  validateTournamentDistrictAccess,
  getUserParticipableDistricts,
  createPermissionErrorResponse,
};
