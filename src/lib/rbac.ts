/**
 * VALORHIVE Centralized RBAC Module
 * 
 * This module provides centralized Role-Based Access Control for the entire platform.
 * It builds upon the admin hierarchy and adds user-facing permission checks.
 * 
 * Role Hierarchy:
 * SUPER_ADMIN > SPORT_ADMIN > STATE_ADMIN > DISTRICT_ADMIN > TOURNAMENT_DIRECTOR > PLAYER
 * 
 * @module rbac
 */

import { db } from './db';
import {
  AdminRole,
  Role,
  SportType,
  User,
  Organization,
  Tournament,
  TournamentStaff,
} from '@prisma/client';
import {
  checkAdminPermission,
  getRoleLevel,
  DEFAULT_PERMISSIONS,
  type PermissionKey,
  type AdminContext,
  type PermissionCheckResult,
} from './admin-permissions';

// ============================================
// TYPES
// ============================================

export interface UserWithRoles {
  id: string;
  sport: SportType;
  role: Role;
  isActive: boolean;
  adminAssignments?: Array<{
    id: string;
    adminRole: AdminRole;
    sport: SportType | null;
    stateCode: string | null;
    districtName: string | null;
    isActive: boolean;
  }>;
  orgAdminRoles?: Array<{
    id: string;
    orgId: string;
    role: string; // PRIMARY, ADMIN, STAFF
    isActive: boolean;
  }>;
  staffAssignments?: Array<{
    id: string;
    tournamentId: string;
    role: string;
  }>;
}

export interface RBACResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: AdminRole | Role;
  currentRole?: AdminRole | Role;
}

export type ResourceAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'remove';

export type ResourceType =
  | 'tournament'
  | 'match'
  | 'player'
  | 'organization'
  | 'team'
  | 'bracket'
  | 'dispute'
  | 'payment'
  | 'payout'
  | 'admin'
  | 'director'
  | 'audit_log'
  | 'sport_rules'
  | 'feature_flag';

// ============================================
// ROLE HIERARCHY
// ============================================

/**
 * Complete role hierarchy including both admin roles and user roles
 */
export const COMPLETE_ROLE_HIERARCHY = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SPORT_ADMIN,
  AdminRole.STATE_ADMIN,
  AdminRole.DISTRICT_ADMIN,
  AdminRole.TOURNAMENT_DIRECTOR,
  Role.ADMIN,
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.TOURNAMENT_DIRECTOR,
  Role.PLAYER,
] as const;

/**
 * Get the numeric level of a role (lower = higher privilege)
 */
export function getCompleteRoleLevel(role: AdminRole | Role): number {
  const index = COMPLETE_ROLE_HIERARCHY.indexOf(role as any);
  return index === -1 ? 999 : index;
}

/**
 * Check if role A is higher than or equal to role B
 */
export function isRoleAtLeast(roleA: AdminRole | Role, roleB: AdminRole | Role): boolean {
  return getCompleteRoleLevel(roleA) <= getCompleteRoleLevel(roleB);
}

// ============================================
// PERMISSION MAP BY ROLE
// ============================================

/**
 * Permission map defining what each role can do
 * Maps resource types to allowed actions
 */
export const PERMISSION_MAP: Record<string, Record<ResourceType, ResourceAction[]>> = {
  PLAYER: {
    tournament: ['read'],
    match: ['read', 'create'], // Can report own match results
    player: ['read', 'update'], // Can update own profile
    organization: ['read'],
    team: ['create', 'read', 'update', 'delete'],
    bracket: ['read'],
    dispute: ['create', 'read'], // Can create and view own disputes
    payment: ['create', 'read'],
    payout: ['read'], // View own payouts
    admin: [],
    director: [],
    audit_log: [],
    sport_rules: ['read'],
    feature_flag: [],
  },
  TOURNAMENT_DIRECTOR: {
    tournament: ['read', 'update'],
    match: ['read', 'create', 'update'],
    player: ['read'],
    organization: ['read'],
    team: ['read'],
    bracket: ['read', 'create', 'update'],
    dispute: ['read', 'update'],
    payment: ['read'],
    payout: ['read'],
    admin: [],
    director: [],
    audit_log: ['read'],
    sport_rules: ['read'],
    feature_flag: [],
  },
  SUB_ADMIN: {
    tournament: ['read', 'update'],
    match: ['read', 'create', 'update'],
    player: ['read', 'update'],
    organization: ['read'],
    team: ['read', 'update'],
    bracket: ['read', 'create', 'update'],
    dispute: ['read', 'update', 'delete'],
    payment: ['read', 'update'],
    payout: ['read', 'update'],
    admin: [],
    director: [],
    audit_log: ['read'],
    sport_rules: ['read'],
    feature_flag: [],
  },
  ORG_ADMIN: {
    tournament: ['create', 'read', 'update', 'delete'],
    match: ['read', 'create', 'update'],
    player: ['read', 'update'],
    organization: ['read', 'update', 'delete'],
    team: ['create', 'read', 'update', 'delete'],
    bracket: ['read', 'create', 'update'],
    dispute: ['read', 'update'],
    payment: ['read', 'create', 'update'],
    payout: ['read', 'create', 'update'],
    admin: ['read', 'assign', 'remove'],
    director: ['read', 'assign'],
    audit_log: ['read'],
    sport_rules: ['read'],
    feature_flag: [],
  },
  ADMIN: {
    tournament: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    match: ['create', 'read', 'update', 'delete'],
    player: ['read', 'update', 'delete'],
    organization: ['create', 'read', 'update', 'delete', 'approve'],
    team: ['create', 'read', 'update', 'delete'],
    bracket: ['create', 'read', 'update', 'delete'],
    dispute: ['create', 'read', 'update', 'delete'],
    payment: ['create', 'read', 'update', 'delete'],
    payout: ['create', 'read', 'update', 'delete'],
    admin: ['read', 'assign', 'remove'],
    director: ['read', 'assign', 'remove'],
    audit_log: ['read'],
    sport_rules: ['read', 'update'],
    feature_flag: ['read'],
  },
  // Admin hierarchy permissions (inherit from DEFAULT_PERMISSIONS)
  [AdminRole.DISTRICT_ADMIN]: {
    tournament: ['create', 'read', 'update'],
    match: ['read', 'create', 'update'],
    player: ['read'],
    organization: ['read'],
    team: ['read'],
    bracket: ['read', 'create', 'update'],
    dispute: ['read'],
    payment: ['read'],
    payout: ['read'],
    admin: [],
    director: ['read', 'assign'],
    audit_log: ['read'],
    sport_rules: ['read'],
    feature_flag: [],
  },
  [AdminRole.STATE_ADMIN]: {
    tournament: ['create', 'read', 'update', 'delete'],
    match: ['create', 'read', 'update', 'delete'],
    player: ['read', 'update'],
    organization: ['read', 'update'],
    team: ['read', 'update'],
    bracket: ['create', 'read', 'update', 'delete'],
    dispute: ['read', 'update'],
    payment: ['read', 'update'],
    payout: ['read'],
    admin: ['read', 'assign'],
    director: ['read', 'assign', 'remove'],
    audit_log: ['read'],
    sport_rules: ['read'],
    feature_flag: [],
  },
  [AdminRole.SPORT_ADMIN]: {
    tournament: ['create', 'read', 'update', 'delete', 'approve', 'reject', 'manage'],
    match: ['create', 'read', 'update', 'delete', 'manage'],
    player: ['create', 'read', 'update', 'delete', 'manage'],
    organization: ['create', 'read', 'update', 'delete', 'approve', 'manage'],
    team: ['create', 'read', 'update', 'delete', 'manage'],
    bracket: ['create', 'read', 'update', 'delete', 'manage'],
    dispute: ['create', 'read', 'update', 'delete', 'manage'],
    payment: ['create', 'read', 'update', 'delete', 'manage'],
    payout: ['create', 'read', 'update', 'delete', 'manage'],
    admin: ['read', 'assign', 'remove', 'manage'],
    director: ['read', 'assign', 'remove', 'manage'],
    audit_log: ['read'],
    sport_rules: ['create', 'read', 'update', 'delete'],
    feature_flag: ['read', 'update'],
  },
  [AdminRole.SUPER_ADMIN]: {
    tournament: ['create', 'read', 'update', 'delete', 'approve', 'reject', 'manage', 'assign'],
    match: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    player: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    organization: ['create', 'read', 'update', 'delete', 'approve', 'manage', 'assign'],
    team: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    bracket: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    dispute: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    payment: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    payout: ['create', 'read', 'update', 'delete', 'manage', 'assign'],
    admin: ['create', 'read', 'update', 'delete', 'assign', 'remove', 'manage'],
    director: ['create', 'read', 'update', 'delete', 'assign', 'remove', 'manage'],
    audit_log: ['create', 'read', 'update', 'delete'],
    sport_rules: ['create', 'read', 'update', 'delete', 'manage'],
    feature_flag: ['create', 'read', 'update', 'delete', 'manage'],
  },
};

// ============================================
// CORE RBAC FUNCTIONS
// ============================================

/**
 * Require that the user has one of the allowed roles
 * Throws an error if the user doesn't have any of the required roles
 * 
 * @param user - The user to check
 * @param allowedRoles - Array of roles that are allowed
 * @returns RBACResult indicating whether access is allowed
 */
export async function requireRole(
  user: UserWithRoles | User | null,
  allowedRoles: (AdminRole | Role)[]
): Promise<RBACResult> {
  if (!user) {
    return {
      allowed: false,
      reason: 'User not authenticated',
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      reason: 'User account is inactive',
    };
  }

  // Check user's primary role
  if (allowedRoles.includes(user.role)) {
    return { allowed: true };
  }

  // If user has admin assignments, check those roles too
  if ('adminAssignments' in user && user.adminAssignments) {
    const activeAssignments = user.adminAssignments.filter((a) => a.isActive);
    for (const assignment of activeAssignments) {
      if (allowedRoles.includes(assignment.adminRole)) {
        return { allowed: true };
      }
    }
  }

  // Find the highest required role for error message
  const highestRequired = allowedRoles.sort(
    (a, b) => getCompleteRoleLevel(a) - getCompleteRoleLevel(b)
  )[0];

  return {
    allowed: false,
    reason: `Requires role ${highestRequired} or higher`,
    requiredRole: highestRequired,
    currentRole: user.role,
  };
}

/**
 * Require that the user has a specific permission
 * Uses the admin permission system for detailed permission checks
 * 
 * @param user - The user to check
 * @param permission - The permission key to check
 * @param context - The context for the permission check (sport, location, etc.)
 * @returns RBACResult indicating whether access is allowed
 */
export async function requirePermission(
  user: UserWithRoles | User | null,
  permission: PermissionKey,
  context: AdminContext
): Promise<RBACResult> {
  if (!user) {
    return {
      allowed: false,
      reason: 'User not authenticated',
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      reason: 'User account is inactive',
    };
  }

  // Use the admin permission system
  const result = await checkAdminPermission(user.id, permission, context);

  return {
    allowed: result.granted,
    reason: result.reason,
  };
}

/**
 * Check if a user has a specific permission (non-throwing version)
 * 
 * @param user - The user to check
 * @param permission - The permission key to check
 * @param context - The context for the permission check
 * @returns boolean indicating whether the user has the permission
 */
export async function hasPermission(
  user: UserWithRoles | User | null,
  permission: PermissionKey,
  context: AdminContext
): Promise<boolean> {
  const result = await requirePermission(user, permission, context);
  return result.allowed;
}

/**
 * Check if a user can perform an action on a resource
 * 
 * @param user - The user to check
 * @param resourceType - The type of resource
 * @param action - The action to perform
 * @returns boolean indicating whether the action is allowed
 */
export function canPerformAction(
  user: UserWithRoles | User | null,
  resourceType: ResourceType,
  action: ResourceAction
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  // Get permissions for user's role
  const rolePermissions = PERMISSION_MAP[user.role];
  if (rolePermissions && rolePermissions[resourceType]?.includes(action)) {
    return true;
  }

  // Check admin assignments if present
  if ('adminAssignments' in user && user.adminAssignments) {
    for (const assignment of user.adminAssignments.filter((a) => a.isActive)) {
      const adminPermissions = PERMISSION_MAP[assignment.adminRole];
      if (adminPermissions && adminPermissions[resourceType]?.includes(action)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================
// SCOPED ACCESS CHECKING
// ============================================

/**
 * Check if a user has access to a specific resource
 * This considers both role permissions and resource ownership/scoping
 * 
 * @param user - The user to check
 * @param resourceType - The type of resource
 * @param resourceId - The ID of the resource
 * @param action - The action being performed
 * @param context - Additional context for the check
 * @returns RBACResult indicating whether access is allowed
 */
export async function checkResourceAccess(
  user: UserWithRoles | User | null,
  resourceType: ResourceType,
  resourceId: string,
  action: ResourceAction = 'read',
  context?: AdminContext
): Promise<RBACResult> {
  if (!user) {
    return {
      allowed: false,
      reason: 'User not authenticated',
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      reason: 'User account is inactive',
    };
  }

  // First check basic permission
  if (!canPerformAction(user, resourceType, action)) {
    return {
      allowed: false,
      reason: `No permission to ${action} ${resourceType}`,
      currentRole: user.role,
    };
  }

  // Resource-specific access checks
  switch (resourceType) {
    case 'player': {
      // Players can always access their own data
      if (resourceId === user.id) {
        return { allowed: true };
      }
      // Admin check for accessing other players
      if (await hasAdminAccess(user, context)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Can only access own player data',
      };
    }

    case 'tournament': {
      const tournament = await db.tournament.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          sport: true,
          state: true,
          district: true,
          orgId: true,
          createdById: true,
          status: true,
        },
      });

      if (!tournament) {
        return { allowed: false, reason: 'Tournament not found' };
      }

      // Check geographic scope for admins
      if (await hasAdminAccess(user, context)) {
        const adminContext: AdminContext = {
          ...context,
          sport: tournament.sport,
          stateCode: tournament.state || undefined,
          districtName: tournament.district || undefined,
        };

        const permission = getTournamentPermission(action);
        if (permission) {
          const result = await requirePermission(user, permission, adminContext);
          if (result.allowed) {
            return { allowed: true };
          }
        }
      }

      // Check if user created the tournament
      if (tournament.createdById === user.id) {
        return { allowed: true };
      }

      // Check org admin access for intra-org tournaments
      if (tournament.orgId && 'orgAdminRoles' in user) {
        const orgAdmin = user.orgAdminRoles?.find(
          (r) => r.orgId === tournament.orgId && r.isActive
        );
        if (orgAdmin) {
          return { allowed: true };
        }
      }

      // Public tournaments are readable by everyone
      if (action === 'read') {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'No access to this tournament',
      };
    }

    case 'match': {
      const match = await db.match.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          sport: true,
          tournamentId: true,
          playerAId: true,
          playerBId: true,
        },
      });

      if (!match) {
        return { allowed: false, reason: 'Match not found' };
      }

      // Players can access their own matches
      if (match.playerAId === user.id || match.playerBId === user.id) {
        return { allowed: true };
      }

      // Check admin access
      if (await hasAdminAccess(user, context)) {
        return { allowed: true };
      }

      // Check tournament staff
      if (match.tournamentId) {
        const staff = await db.tournamentStaff.findFirst({
          where: {
            tournamentId: match.tournamentId,
            userId: user.id,
          },
        });
        if (staff) {
          return { allowed: true };
        }
      }

      return {
        allowed: false,
        reason: 'No access to this match',
      };
    }

    case 'organization': {
      const org = await db.organization.findUnique({
        where: { id: resourceId },
        select: { id: true, sport: true },
      });

      if (!org) {
        return { allowed: false, reason: 'Organization not found' };
      }

      // Check org admin access
      if ('orgAdminRoles' in user) {
        const orgAdmin = user.orgAdminRoles?.find(
          (r) => r.orgId === resourceId && r.isActive
        );
        if (orgAdmin) {
          return { allowed: true };
        }
      }

      // Check admin access
      if (await hasAdminAccess(user, context)) {
        return { allowed: true };
      }

      // Organizations are readable by everyone
      if (action === 'read') {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'No access to this organization',
      };
    }

    case 'dispute': {
      const dispute = await db.dispute.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          matchId: true,
          raisedById: true,
        },
      });

      if (!dispute) {
        return { allowed: false, reason: 'Dispute not found' };
      }

      // User can access their own disputes
      if (dispute.raisedById === user.id) {
        return { allowed: true };
      }

      // Check admin access for dispute resolution
      if (await hasAdminAccess(user, context)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'No access to this dispute',
      };
    }

    case 'bracket': {
      const bracket = await db.bracket.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          tournamentId: true,
        },
      });

      if (!bracket) {
        return { allowed: false, reason: 'Bracket not found' };
      }

      // Check tournament access
      if (bracket.tournamentId) {
        return checkResourceAccess(
          user,
          'tournament',
          bracket.tournamentId,
          action,
          context
        );
      }

      return { allowed: action === 'read' };
    }

    default:
      // For other resource types, rely on basic permission check
      return { allowed: true };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a user has admin access (any admin role)
 */
async function hasAdminAccess(
  user: UserWithRoles | User | null,
  context?: AdminContext
): Promise<boolean> {
  if (!user) return false;

  // Check primary admin roles
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) {
    return true;
  }

  // Check admin assignments
  if ('adminAssignments' in user && user.adminAssignments) {
    const activeAssignments = user.adminAssignments.filter((a) => a.isActive);
    if (activeAssignments.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get the appropriate permission key for a tournament action
 */
function getTournamentPermission(action: ResourceAction): PermissionKey | null {
  const mapping: Record<ResourceAction, PermissionKey> = {
    create: 'canCreateTournament',
    read: 'canViewPlayers',
    update: 'canEditTournament',
    delete: 'canDeleteTournament',
    manage: 'canEditTournament',
    approve: 'canApproveTournament',
    reject: 'canCancelTournament',
    assign: 'canAssignDirectors',
    remove: 'canAssignDirectors',
  };
  return mapping[action] || null;
}

/**
 * Get all roles that can perform a specific action on a resource
 */
export function getRolesForResourceAction(
  resourceType: ResourceType,
  action: ResourceAction
): (AdminRole | Role)[] {
  const roles: (AdminRole | Role)[] = [];

  for (const [role, permissions] of Object.entries(PERMISSION_MAP)) {
    if (permissions[resourceType]?.includes(action)) {
      roles.push(role as AdminRole | Role);
    }
  }

  // Sort by hierarchy (highest first)
  return roles.sort((a, b) => getCompleteRoleLevel(a) - getCompleteRoleLevel(b));
}

/**
 * Get all allowed actions for a user on a resource type
 */
export function getAllowedActions(
  user: UserWithRoles | User | null,
  resourceType: ResourceType
): ResourceAction[] {
  if (!user || !user.isActive) {
    return [];
  }

  const actions = new Set<ResourceAction>();

  // Get actions from user's primary role
  const rolePermissions = PERMISSION_MAP[user.role];
  if (rolePermissions?.[resourceType]) {
    rolePermissions[resourceType].forEach((a) => actions.add(a));
  }

  // Get actions from admin assignments
  if ('adminAssignments' in user && user.adminAssignments) {
    for (const assignment of user.adminAssignments.filter((a) => a.isActive)) {
      const adminPermissions = PERMISSION_MAP[assignment.adminRole];
      if (adminPermissions?.[resourceType]) {
        adminPermissions[resourceType].forEach((a) => actions.add(a));
      }
    }
  }

  return Array.from(actions);
}

/**
 * Check if a user is an admin of a specific organization
 */
export async function isOrgAdmin(
  userId: string,
  orgId: string
): Promise<boolean> {
  const orgAdmin = await db.orgAdmin.findFirst({
    where: {
      userId,
      orgId,
      isActive: true,
    },
  });

  return !!orgAdmin;
}

/**
 * Check if a user is staff for a specific tournament
 */
export async function isTournamentStaff(
  userId: string,
  tournamentId: string
): Promise<boolean> {
  const staff = await db.tournamentStaff.findFirst({
    where: {
      userId,
      tournamentId,
    },
  });

  return !!staff;
}

/**
 * Get user's highest admin role
 */
export function getHighestAdminRole(user: UserWithRoles): AdminRole | null {
  if ('adminAssignments' in user && user.adminAssignments) {
    const activeAssignments = user.adminAssignments.filter((a) => a.isActive);
    if (activeAssignments.length > 0) {
      return activeAssignments.sort(
        (a, b) => getRoleLevel(a.adminRole) - getRoleLevel(b.adminRole)
      )[0].adminRole;
    }
  }
  return null;
}

/**
 * Enrich a user with role information for RBAC checks
 */
export async function getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      adminAssignments: {
        where: { isActive: true },
      },
      orgAdminRoles: {
        where: { isActive: true },
      },
      staffAssignments: true,
    },
  });

  if (!user) return null;

  return user as UserWithRoles;
}

// Re-export from admin-permissions for convenience
export {
  AdminRole,
  Role,
  checkAdminPermission,
  getRoleLevel,
  DEFAULT_PERMISSIONS,
  type PermissionKey,
  type AdminContext,
  type PermissionCheckResult,
};
