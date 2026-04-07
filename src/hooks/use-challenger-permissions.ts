"use client";

import { useMemo } from 'react';

/**
 * Challenger Mode Permission System
 * 
 * Implements district-based participation restrictions for Challenger Mode.
 * Users can only participate (join tournaments, create/accept challenges) in their own district.
 * 
 * Rules:
 * - Case A (No district): Can only VIEW content, cannot PARTICIPATE
 * - Case B (Other district): View only mode for non-home districts
 */

export interface ChallengerPermissions {
  /** Whether the user has selected a district in their profile */
  hasDistrict: boolean;
  /** Whether the user is viewing their own district */
  isOwnDistrict: boolean;
  /** Can view content - always true */
  canView: boolean;
  /** Can join tournaments in this district */
  canJoinTournament: boolean;
  /** Can create challenges in this district */
  canCreateChallenge: boolean;
  /** Can accept challenges in this district */
  canAcceptChallenge: boolean;
  /** Can participate in any challenger activity (joins, creates, accepts) */
  canParticipate: boolean;
  /** Human-readable restriction message, null if no restriction */
  restrictionMessage: string | null;
  /** Type of restriction for programmatic handling */
  restrictionType: 'none' | 'no-district' | 'other-district' | null;
}

export interface UseChallengerPermissionsOptions {
  /** The user's district from their profile */
  userDistrict: string | null | undefined;
  /** The district ID being viewed/targeted */
  targetDistrictId: string | null | undefined;
  /** Optional: Override for admin users who can bypass restrictions */
  isAdmin?: boolean;
}

/**
 * Hook to determine user permissions for Challenger Mode activities
 * 
 * @param options - Configuration options including user district and target district
 * @returns ChallengerPermissions object with permission states and messages
 * 
 * @example
 * ```tsx
 * const permissions = useChallengerPermissions({
 *   userDistrict: user?.district,
 *   targetDistrictId: districtId,
 * });
 * 
 * if (!permissions.canJoinTournament) {
 *   return <ChallengerRestrictionBanner type={permissions.restrictionType} />;
 * }
 * ```
 */
export function useChallengerPermissions(
  options: UseChallengerPermissionsOptions
): ChallengerPermissions {
  const { userDistrict, targetDistrictId, isAdmin = false } = options;

  return useMemo(() => {
    // Admins bypass all restrictions
    if (isAdmin) {
      return {
        hasDistrict: true,
        isOwnDistrict: true,
        canView: true,
        canJoinTournament: true,
        canCreateChallenge: true,
        canAcceptChallenge: true,
        canParticipate: true,
        restrictionMessage: null,
        restrictionType: 'none',
      };
    }

    // Case A: User has not selected a district
    const hasDistrict = Boolean(userDistrict);
    
    if (!hasDistrict) {
      return {
        hasDistrict: false,
        isOwnDistrict: false,
        canView: true,
        canJoinTournament: false,
        canCreateChallenge: false,
        canAcceptChallenge: false,
        canParticipate: false,
        restrictionMessage: "Add your district in your profile to participate in Challenger Mode.",
        restrictionType: 'no-district',
      };
    }

    // Check if viewing own district
    const isOwnDistrict = userDistrict === targetDistrictId;

    // Case B: Viewing a different district (view-only mode)
    if (!isOwnDistrict) {
      return {
        hasDistrict: true,
        isOwnDistrict: false,
        canView: true,
        canJoinTournament: false,
        canCreateChallenge: false,
        canAcceptChallenge: false,
        canParticipate: false,
        restrictionMessage: "View Only — Challenger participation is limited to your district.",
        restrictionType: 'other-district',
      };
    }

    // User is in their own district - full access
    return {
      hasDistrict: true,
      isOwnDistrict: true,
      canView: true,
      canJoinTournament: true,
      canCreateChallenge: true,
      canAcceptChallenge: true,
      canParticipate: true,
      restrictionMessage: null,
      restrictionType: 'none',
    };
  }, [userDistrict, targetDistrictId, isAdmin]);
}

/**
 * Get permission message for a specific action
 * Useful for inline error messages or tooltips
 */
export function getActionPermissionMessage(
  action: 'join-tournament' | 'create-challenge' | 'accept-challenge',
  permissions: ChallengerPermissions
): string | null {
  // Check based on action type
  const canPerform = {
    'join-tournament': permissions.canJoinTournament,
    'create-challenge': permissions.canCreateChallenge,
    'accept-challenge': permissions.canAcceptChallenge,
  };

  if (canPerform[action]) {
    return null;
  }

  // Return action-specific message if needed
  return permissions.restrictionMessage;
}

/**
 * Check if a specific action is allowed
 */
export function isActionAllowed(
  action: 'join-tournament' | 'create-challenge' | 'accept-challenge' | 'view',
  permissions: ChallengerPermissions
): boolean {
  switch (action) {
    case 'view':
      return permissions.canView;
    case 'join-tournament':
      return permissions.canJoinTournament;
    case 'create-challenge':
      return permissions.canCreateChallenge;
    case 'accept-challenge':
      return permissions.canAcceptChallenge;
    default:
      return false;
  }
}

export default useChallengerPermissions;
