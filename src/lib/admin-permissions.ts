/**
 * VALORHIVE Admin Permission System (v4.15.0)
 * 
 * Central permission checking for the admin hierarchy.
 * 
 * Simplified 5-level hierarchy: SUPER_ADMIN > SPORT_ADMIN > STATE_ADMIN > DISTRICT_ADMIN > TOURNAMENT_DIRECTOR
 * Referee is a separate non-admin role (see RefereeProfile model)
 * 
 * Key features:
 * - Granular per-admin configurable permissions
 * - Geographic scoping (state/district)
 * - Enable/Disable governance with upward escalation
 * - Delegation rules
 */

import { db } from './db';
import { AdminRole, SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  assignmentId?: string;
  escalationRequired?: boolean;
  escalateTo?: AdminRole;
}

export interface AdminContext {
  userId?: string;
  sport?: SportType;
  stateCode?: string;
  districtName?: string;
  city?: string;
  tournamentId?: string;
}

export type PermissionKey = keyof {
  canCreateTournament: boolean;
  canApproveTournament: boolean;
  canPublishTournament: boolean;
  canStartTournament: boolean;
  canPauseTournament: boolean;
  canCancelTournament: boolean;
  canEditTournament: boolean;
  canGenerateBracket: boolean;
  canScoreMatches: boolean;
  canRollbackMatch: boolean;
  canOverrideResult: boolean;
  canViewPlayers: boolean;
  canEditPlayer: boolean;
  canBanPlayer: boolean;
  canAdjustElo: boolean;
  maxEloAdjustment: number;
  canViewRevenue: boolean;
  canProcessRefund: boolean;
  canProcessPayout: boolean;
  canViewDisputes: boolean;
  canResolveDisputes: boolean;
  canApproveOrgs: boolean;
  canSuspendOrgs: boolean;
  canAssignAdmins: boolean;
  canAssignDirectors: boolean;
  canViewAuditLogs: boolean;
  canManageFeatureFlags: boolean;
  canViewAnalytics: boolean;
  canManageSportRules: boolean;
  canAccessHealthDashboard: boolean;
  canManageSectors: boolean;
  canEditCompletedMatch: boolean;
  canDeleteTournament: boolean;
};

// ============================================
// ROLE HIERARCHY
// ============================================

const ROLE_HIERARCHY: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SPORT_ADMIN,
  AdminRole.STATE_ADMIN,
  AdminRole.DISTRICT_ADMIN,
  AdminRole.TOURNAMENT_DIRECTOR,
];

export function getRoleLevel(role: AdminRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function getNextHigherRole(role: AdminRole): AdminRole | null {
  const level = getRoleLevel(role);
  if (level <= 0) return null;
  return ROLE_HIERARCHY[level - 1];
}

// ============================================
// DEFAULT PERMISSION TEMPLATES
// ============================================

export const DEFAULT_PERMISSIONS: Record<AdminRole, Partial<Record<PermissionKey, boolean | number>>> = {
  [AdminRole.SUPER_ADMIN]: {
    canCreateTournament: true,
    canApproveTournament: true,
    canPublishTournament: true,
    canStartTournament: true,
    canPauseTournament: true,
    canCancelTournament: true,
    canEditTournament: true,
    canGenerateBracket: true,
    canScoreMatches: true,
    canRollbackMatch: true,
    canOverrideResult: true,
    canViewPlayers: true,
    canEditPlayer: true,
    canBanPlayer: true,
    canAdjustElo: true,
    maxEloAdjustment: 9999,
    canViewRevenue: true,
    canProcessRefund: true,
    canProcessPayout: true,
    canViewDisputes: true,
    canResolveDisputes: true,
    canApproveOrgs: true,
    canSuspendOrgs: true,
    canAssignAdmins: true,
    canAssignDirectors: true,
    canViewAuditLogs: true,
    canManageFeatureFlags: true,
    canViewAnalytics: true,
    canManageSportRules: true,
    canAccessHealthDashboard: true,
    canManageSectors: true,
    canEditCompletedMatch: true,
    canDeleteTournament: true,
  },

  [AdminRole.SPORT_ADMIN]: {
    canCreateTournament: true,
    canApproveTournament: true,
    canPublishTournament: true,
    canStartTournament: true,
    canPauseTournament: true,
    canCancelTournament: true,
    canEditTournament: true,
    canGenerateBracket: true,
    canScoreMatches: true,
    canRollbackMatch: true,
    canOverrideResult: true,
    canViewPlayers: true,
    canEditPlayer: true,
    canBanPlayer: true,
    canAdjustElo: true,
    maxEloAdjustment: 500,
    canViewRevenue: true,
    canProcessRefund: true,
    canProcessPayout: true,
    canViewDisputes: true,
    canResolveDisputes: true,
    canApproveOrgs: true,
    canSuspendOrgs: true,
    canAssignAdmins: true,
    canAssignDirectors: true,
    canViewAuditLogs: true,
    canViewAnalytics: true,
    canManageSportRules: true,
    canAccessHealthDashboard: true,
    // Cannot do:
    canEditCompletedMatch: false,
    canDeleteTournament: false,
    canManageFeatureFlags: false,
  },

  [AdminRole.STATE_ADMIN]: {
    canCreateTournament: true,
    canApproveTournament: false, // Configurable based on trust
    canPublishTournament: false, // Configurable based on trust
    canStartTournament: true,
    canPauseTournament: true,
    canCancelTournament: true,
    canGenerateBracket: true,
    canScoreMatches: true,
    canRollbackMatch: false, // Earned after trust
    canViewPlayers: true,
    canEditPlayer: false,
    canBanPlayer: false, // Configurable
    canAdjustElo: true,
    maxEloAdjustment: 50,
    canViewRevenue: false,
    canProcessRefund: false, // Configurable
    canViewDisputes: true,
    canResolveDisputes: false, // Configurable
    canAssignDirectors: true,
    canAssignAdmins: false, // Configurable - can assign District Admins
    canViewAnalytics: true,
    // Cannot do:
    canEditCompletedMatch: false,
    canDeleteTournament: false,
    canManageFeatureFlags: false,
    canManageSportRules: false,
    canProcessPayout: false,
    canApproveOrgs: false,
    canSuspendOrgs: false,
    canManageSectors: false,
  },

  [AdminRole.DISTRICT_ADMIN]: {
    canCreateTournament: true,
    canApproveTournament: false, // State approves
    canPublishTournament: false, // State publishes
    canStartTournament: true,
    canScoreMatches: true,
    canViewPlayers: true,
    canViewDisputes: true,
    canAssignDirectors: true,
    // Cannot do:
    canCancelTournament: false,
    canPauseTournament: false,
    canRollbackMatch: false,
    canBanPlayer: false,
    canProcessRefund: false,
    canResolveDisputes: false,
    canEditCompletedMatch: false,
    canDeleteTournament: false,
    canViewRevenue: false,
    canAdjustElo: false,
    maxEloAdjustment: 0,
    canManageFeatureFlags: false,
    canManageSportRules: false,
    canProcessPayout: false,
    canApproveOrgs: false,
    canSuspendOrgs: false,
    canManageSectors: false,
    canAssignAdmins: false,
  },

  [AdminRole.TOURNAMENT_DIRECTOR]: {
    canScoreMatches: true,
    canViewPlayers: true,
    canViewDisputes: true,
    // Cannot do:
    canCreateTournament: false,
    canApproveTournament: false,
    canPublishTournament: false,
    canStartTournament: false,
    canPauseTournament: false,
    canCancelTournament: false,
    canEditTournament: false,
    canGenerateBracket: false,
    canRollbackMatch: false,
    canOverrideResult: false,
    canEditPlayer: false,
    canBanPlayer: false,
    canAdjustElo: false,
    maxEloAdjustment: 0,
    canViewRevenue: false,
    canProcessRefund: false,
    canProcessPayout: false,
    canResolveDisputes: false,
    canApproveOrgs: false,
    canSuspendOrgs: false,
    canAssignAdmins: false,
    canAssignDirectors: false,
    canViewAuditLogs: false,
    canManageFeatureFlags: false,
    canViewAnalytics: false,
    canManageSportRules: false,
    canAccessHealthDashboard: false,
    canManageSectors: false,
    canEditCompletedMatch: false,
    canDeleteTournament: false,
  },
};

// ============================================
// CORE PERMISSION CHECKING
// ============================================

/**
 * Check if a user has a specific permission for a resource
 * 
 * This is the central function that all admin routes should call.
 * 
 * @param userId - The user ID to check
 * @param permission - The permission key to check
 * @param context - The resource context (sport, location, tournament)
 * @returns PermissionCheckResult with granted status and escalation info
 */
export async function checkAdminPermission(
  userId: string,
  permission: PermissionKey,
  context: AdminContext
): Promise<PermissionCheckResult> {
  try {
    // Get all active admin assignments for this user
    const assignments = await db.adminAssignment.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        permissions: true,
      },
    });

    if (assignments.length === 0) {
      return {
        granted: false,
        reason: 'No active admin assignment found',
      };
    }

    // Check each assignment
    for (const assignment of assignments) {
      const result = await checkAssignmentPermission(assignment, permission, context);
      if (result.granted) {
        return result;
      }
    }

    // No assignment granted permission - check if escalation is needed
    const highestAssignment = assignments.sort(
      (a, b) => getRoleLevel(a.adminRole) - getRoleLevel(b.adminRole)
    )[0];

    if (highestAssignment) {
      const nextRole = getNextHigherRole(highestAssignment.adminRole);
      return {
        granted: false,
        reason: `Permission '${permission}' not granted. Escalation required.`,
        assignmentId: highestAssignment.id,
        escalationRequired: true,
        escalateTo: nextRole || undefined,
      };
    }

    return {
      granted: false,
      reason: 'Permission denied',
    };
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return {
      granted: false,
      reason: 'Error checking permission',
    };
  }
}

/**
 * Check a specific assignment's permissions
 */
async function checkAssignmentPermission(
  assignment: {
    id: string;
    adminRole: AdminRole;
    sport: SportType | null;
    stateCode: string | null;
    districtName: string | null;
    permissions: Record<string, unknown> | null;
  },
  permission: PermissionKey,
  context: AdminContext
): Promise<PermissionCheckResult> {
  // Step 1: Super Admin bypasses all checks
  if (assignment.adminRole === AdminRole.SUPER_ADMIN) {
    return {
      granted: true,
      assignmentId: assignment.id,
    };
  }

  // Step 2: Check sport scope
  if (assignment.sport && context.sport && assignment.sport !== context.sport) {
    return {
      granted: false,
      reason: 'Sport mismatch',
    };
  }

  // Step 3: Check geographic scope
  const geoCheck = checkGeographicScope(assignment, context);
  if (!geoCheck.inScope) {
    return {
      granted: false,
      reason: geoCheck.reason,
    };
  }

  // Step 4: Check permission boolean
  const hasPermission = assignment.permissions?.[permission];
  if (hasPermission === true) {
    return {
      granted: true,
      assignmentId: assignment.id,
    };
  }

  // Step 5: For numerical permissions (like maxEloAdjustment)
  if (
    permission === 'canAdjustElo' &&
    typeof assignment.permissions?.maxEloAdjustment === 'number' &&
    assignment.permissions.maxEloAdjustment > 0
  ) {
    return {
      granted: true,
      assignmentId: assignment.id,
    };
  }

  return {
    granted: false,
    reason: `Permission '${permission}' not set for this assignment`,
    assignmentId: assignment.id,
  };
}

/**
 * Check if assignment's geographic scope contains the resource
 */
function checkGeographicScope(
  assignment: {
    adminRole: AdminRole;
    stateCode: string | null;
    districtName: string | null;
  },
  context: AdminContext
): { inScope: boolean; reason?: string } {
  switch (assignment.adminRole) {
    case AdminRole.SUPER_ADMIN:
    case AdminRole.SPORT_ADMIN:
      // No geographic restriction
      return { inScope: true };

    case AdminRole.STATE_ADMIN:
      // State scope
      if (assignment.stateCode && context.stateCode) {
        if (assignment.stateCode === context.stateCode) {
          return { inScope: true };
        }
        return { inScope: false, reason: 'State mismatch' };
      }
      return { inScope: false, reason: 'No state assignment' };

    case AdminRole.DISTRICT_ADMIN:
      // District scope
      if (assignment.stateCode && assignment.districtName) {
        if (
          assignment.stateCode === context.stateCode &&
          assignment.districtName === context.districtName
        ) {
          return { inScope: true };
        }
        return { inScope: false, reason: 'District mismatch' };
      }
      return { inScope: false, reason: 'No district assignment' };

    case AdminRole.TOURNAMENT_DIRECTOR:
      // Tournament scope - check TournamentStaff
      return { inScope: true }; // Handled separately by TournamentStaff model

    default:
      return { inScope: false, reason: 'Unknown role' };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Get all active admins for a geographic scope
 * Used for escalation chain
 */
export async function getActiveAdminsForScope(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<Array<{ userId: string; role: AdminRole; assignmentId: string }>> {
  const admins: Array<{ userId: string; role: AdminRole; assignmentId: string }> = [];

  // Get Super Admins
  const superAdmins = await db.adminAssignment.findMany({
    where: {
      adminRole: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
    select: { userId: true, id: true },
  });
  superAdmins.forEach((a) => admins.push({ userId: a.userId, role: AdminRole.SUPER_ADMIN, assignmentId: a.id }));

  // Get Sport Admins for this sport
  const sportAdmins = await db.adminAssignment.findMany({
    where: {
      adminRole: AdminRole.SPORT_ADMIN,
      sport,
      isActive: true,
    },
    select: { userId: true, id: true },
  });
  sportAdmins.forEach((a) => admins.push({ userId: a.userId, role: AdminRole.SPORT_ADMIN, assignmentId: a.id }));

  if (stateCode) {
    // Get State Admins
    const stateAdmins = await db.adminAssignment.findMany({
      where: {
        adminRole: AdminRole.STATE_ADMIN,
        stateCode,
        sport,
        isActive: true,
      },
      select: { userId: true, id: true },
    });
    stateAdmins.forEach((a) =>
      admins.push({ userId: a.userId, role: AdminRole.STATE_ADMIN, assignmentId: a.id })
    );

    if (districtName) {
      // Get District Admins
      const districtAdmins = await db.adminAssignment.findMany({
        where: {
          adminRole: AdminRole.DISTRICT_ADMIN,
          stateCode,
          districtName,
          sport,
          isActive: true,
        },
        select: { userId: true, id: true },
      });
      districtAdmins.forEach((a) =>
        admins.push({ userId: a.userId, role: AdminRole.DISTRICT_ADMIN, assignmentId: a.id })
      );
    }
  }

  // Sort by hierarchy (lower level first for escalation)
  return admins.sort((a, b) => getRoleLevel(b.role) - getRoleLevel(a.role));
}

/**
 * Find next active admin in escalation chain
 * Implements the upward escalation rule
 */
export async function findNextActiveAdmin(
  sport: SportType,
  currentRole: AdminRole,
  stateCode?: string,
  districtName?: string
): Promise<{ userId: string; role: AdminRole } | null> {
  const nextRole = getNextHigherRole(currentRole);
  if (!nextRole) return null;

  // Get all admins for this scope
  const admins = await getActiveAdminsForScope(sport, stateCode, districtName);

  // Find first active admin at or above next role level
  const nextLevel = getRoleLevel(nextRole);
  for (const admin of admins) {
    if (getRoleLevel(admin.role) <= nextLevel) {
      return { userId: admin.userId, role: admin.role };
    }
  }

  // Fallback to Super Admin
  const superAdmin = admins.find((a) => a.role === AdminRole.SUPER_ADMIN);
  return superAdmin ? { userId: superAdmin.userId, role: AdminRole.SUPER_ADMIN } : null;
}

/**
 * Check if a user can assign another user to a role
 * Implements delegation rules
 */
export async function canAssignRole(
  assignerId: string,
  targetRole: AdminRole,
  context: AdminContext
): Promise<{ canAssign: boolean; reason?: string }> {
  // Get assigner's highest role
  const assignments = await db.adminAssignment.findMany({
    where: {
      userId: assignerId,
      isActive: true,
    },
    include: { permissions: true },
    orderBy: {
      adminRole: 'asc', // Super Admin first
    },
  });

  if (assignments.length === 0) {
    return { canAssign: false, reason: 'Not an admin' };
  }

  const highestAssignment = assignments[0];
  const assignerLevel = getRoleLevel(highestAssignment.adminRole);
  const targetLevel = getRoleLevel(targetRole);

  // Rule 1: Cannot assign someone at or above your level
  if (targetLevel <= assignerLevel) {
    return { canAssign: false, reason: 'Cannot assign at or above your level' };
  }

  // Rule 2: Must have canAssignAdmins permission
  if (!highestAssignment.permissions?.canAssignAdmins) {
    return { canAssign: false, reason: 'No permission to assign admins' };
  }

  // Rule 3: SPORT_ADMIN can assign STATE_ADMINs
  // STATE_ADMIN can assign DISTRICT_ADMINs
  // Geographic scope is checked separately

  return { canAssign: true };
}

/**
 * Create default permissions for a new assignment based on role
 */
export function getDefaultPermissionsForRole(role: AdminRole): Record<string, boolean | number> {
  const defaults = DEFAULT_PERMISSIONS[role];
  const permissions: Record<string, boolean | number> = {};

  // Set all permission fields
  const allPermissions: PermissionKey[] = [
    'canCreateTournament', 'canApproveTournament', 'canPublishTournament',
    'canStartTournament', 'canPauseTournament', 'canCancelTournament',
    'canEditTournament', 'canGenerateBracket', 'canScoreMatches',
    'canRollbackMatch', 'canOverrideResult', 'canViewPlayers',
    'canEditPlayer', 'canBanPlayer', 'canAdjustElo',
    'canViewRevenue', 'canProcessRefund', 'canProcessPayout',
    'canViewDisputes', 'canResolveDisputes', 'canApproveOrgs',
    'canSuspendOrgs', 'canAssignAdmins', 'canAssignDirectors',
    'canViewAuditLogs', 'canManageFeatureFlags', 'canViewAnalytics',
    'canManageSportRules', 'canAccessHealthDashboard', 'canManageSectors',
    'canEditCompletedMatch', 'canDeleteTournament',
  ];

  for (const perm of allPermissions) {
    permissions[perm] = defaults[perm] ?? false;
  }

  // Handle numerical values
  if (defaults.maxEloAdjustment !== undefined) {
    permissions.maxEloAdjustment = defaults.maxEloAdjustment as number;
  }

  return permissions;
}
