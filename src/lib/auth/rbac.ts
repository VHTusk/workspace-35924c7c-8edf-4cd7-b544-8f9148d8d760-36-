/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces role-based permissions across all protected routes
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { Role, SportType } from '@prisma/client';
import { validateSession } from '@/lib/auth';

// Import SportType for tournament access check

// ============================================
// PERMISSION DEFINITIONS
// ============================================

/**
 * Permission matrix defining what each role can do
 */
export const PERMISSIONS: Record<Role, string[]> = {
  PLAYER: [
    'tournament:register',
    'tournament:withdraw',
    'tournament:checkin',
    'match:view',
    'match:submit_score',
    'profile:edit_own',
    'leaderboard:view',
    'subscription:manage_own',
  ],
  ORG_ADMIN: [
    'tournament:create',
    'tournament:edit_own',
    'tournament:view_registrations',
    'roster:manage',
    'org:edit_own',
    'org:view_analytics',
  ],
  SUB_ADMIN: [
    'tournament:approve',
    'tournament:view_all',
    'match:enter_score',
    'player:view',
    'dispute:view',
    'leaderboard:manage',
  ],
  ADMIN: [
    // Admin has all permissions
    '*',
  ],
  TOURNAMENT_DIRECTOR: [
    'tournament:approve',
    'tournament:start',
    'tournament:complete',
    'tournament:cancel',
    'bracket:generate',
    'bracket:edit',
    'match:enter_score',
    'match:edit_score',
    'dispute:resolve',
    'player:view',
    'checkin:manage',
    'schedule:manage',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: string): boolean {
  const rolePermissions = PERMISSIONS[role];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: string[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: string[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

// ============================================
// USER CONTEXT TYPES
// ============================================

export interface UserContext {
  id: string;
  role: Role;
  sport: SportType;
  email: string | null;
  firstName: string;
  lastName: string;
  isSubscribed: boolean;
}

export interface OrgContext {
  id: string;
  name: string;
  sport: SportType;
  planTier: string;
  isSubscribed: boolean;
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Get current player user from session
 */
export async function getPlayerUser(): Promise<UserContext | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) return null;

    const session = await validateSession(sessionToken);

    if (!session?.user) return null;

    const activeSubscription = await db.subscription.findFirst({
      where: {
        userId: session.user.id,
        sport: session.sport,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
      take: 1,
    });

    return {
      id: session.user.id,
      role: session.user.role,
      sport: session.sport,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      isSubscribed: !!activeSubscription,
    };
  } catch {
    return null;
  }
}

/**
 * Get current organization from session
 */
export async function getOrgUser(): Promise<OrgContext | null> {
  try {
    const cookieStore = await cookies();
    const orgToken = cookieStore.get('org_token')?.value;

    if (!orgToken) return null;

    const session = await db.session.findFirst({
      where: {
        token: orgToken,
        accountType: 'ORG',
        expiresAt: { gte: new Date() },
      },
      include: {
        org: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!session?.org) return null;

    return {
      id: session.org.id,
      name: session.org.name,
      sport: session.org.sport,
      planTier: session.org.planTier,
      isSubscribed: !!session.org.subscription && session.org.subscription.status === 'ACTIVE',
    };
  } catch {
    return null;
  }
}

/**
 * Get admin user from session (with role verification)
 */
export async function getAdminUser(): Promise<UserContext | null> {
  const user = await getPlayerUser();
  if (!user) return null;
  
  // Only allow admin roles
  const adminRoles: Role[] = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
  if (!adminRoles.includes(user.role)) return null;
  
  return user;
}

// ============================================
// RBAC MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Require specific role(s) to access a route
 * Returns user context if authorized, or error response if not
 */
export async function requireRole(
  roles: Role[]
): Promise<{ user: UserContext } | { error: NextResponse }> {
  const user = await getPlayerUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  if (!roles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions', required: roles, actual: user.role },
        { status: 403 }
      ),
    };
  }
  
  return { user };
}

/**
 * Require specific permission(s) to access a route
 */
export async function requirePermission(
  permissions: string[]
): Promise<{ user: UserContext } | { error: NextResponse }> {
  const user = await getPlayerUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  const hasAll = hasAllPermissions(user.role, permissions);
  
  if (!hasAll) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions', required: permissions },
        { status: 403 }
      ),
    };
  }
  
  return { user };
}

/**
 * Require player authentication
 */
export async function requirePlayer(): Promise<{ user: UserContext } | { error: NextResponse }> {
  const user = await getPlayerUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  return { user };
}

/**
 * Require admin role (ADMIN, SUB_ADMIN, or TOURNAMENT_DIRECTOR)
 */
export async function requireAdmin(): Promise<{ user: UserContext } | { error: NextResponse }> {
  const user = await getPlayerUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  const adminRoles: Role[] = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
  if (!adminRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      ),
    };
  }
  
  return { user };
}

/**
 * Require organization authentication
 */
export async function requireOrg(): Promise<{ org: OrgContext } | { error: NextResponse }> {
  const org = await getOrgUser();
  
  if (!org) {
    return {
      error: NextResponse.json(
        { error: 'Organization authentication required' },
        { status: 401 }
      ),
    };
  }
  
  return { org };
}

/**
 * Require subscription (player or org)
 */
export async function requireSubscription(): Promise<{ user: UserContext } | { error: NextResponse }> {
  const result = await requirePlayer();
  
  if ('error' in result) return result;
  
  if (!result.user.isSubscribed) {
    return {
      error: NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 403 }
      ),
    };
  }
  
  return result;
}

// ============================================
// RESOURCE OWNERSHIP CHECKS
// ============================================

/**
 * Check if user owns a resource or is an admin
 */
export function canAccessResource(
  user: UserContext,
  resourceOwnerId: string
): boolean {
  // Admins can access any resource
  if (user.role === 'ADMIN') return true;
  
  // User can access their own resources
  return user.id === resourceOwnerId;
}

/**
 * Check if user can manage a tournament
 * Tournament Directors can only manage tournaments they're assigned to
 */
export async function canManageTournament(
  user: UserContext,
  tournamentId: string
): Promise<boolean> {
  // Admins can manage any tournament
  if (user.role === 'ADMIN') return true;
  
  // Tournament Directors can manage assigned tournaments
  if (user.role === 'TOURNAMENT_DIRECTOR' || user.role === 'SUB_ADMIN') {
    const assignment = await db.tournamentStaff.findFirst({
      where: {
        tournamentId,
        userId: user.id,
      },
    });
    return !!assignment;
  }
  
  return false;
}

/**
 * Require tournament management access
 * Returns error if user cannot manage the specific tournament
 */
export async function requireTournamentAccess(
  tournamentId: string
): Promise<{ user: UserContext; tournament: { id: string; name: string; sport: SportType } } | { error: NextResponse }> {
  const result = await requireRole(['ADMIN', 'TOURNAMENT_DIRECTOR', 'SUB_ADMIN']);
  
  if ('error' in result) return result;
  
  // Admin has full access
  if (result.user.role === 'ADMIN') {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, sport: true },
    });
    
    if (!tournament) {
      return {
        error: NextResponse.json({ error: 'Tournament not found' }, { status: 404 }),
      };
    }
    
    return { user: result.user, tournament };
  }
  
  // Tournament Director / Sub Admin must be assigned
  const assignment = await db.tournamentStaff.findFirst({
    where: {
      tournamentId,
      userId: result.user.id,
    },
    include: {
      tournament: {
        select: { id: true, name: true, sport: true },
      },
    },
  });
  
  if (!assignment) {
    return {
      error: NextResponse.json(
        { error: 'You are not assigned to this tournament', code: 'TOURNAMENT_ACCESS_DENIED' },
        { status: 403 }
      ),
    };
  }
  
  return { user: result.user, tournament: assignment.tournament };
}

/**
 * Require match score entry permission for specific tournament
 */
export async function requireScoreEntryAccess(
  tournamentId: string
): Promise<{ user: UserContext } | { error: NextResponse }> {
  const result = await requirePlayer();
  
  if ('error' in result) return result;
  
  const user = result.user;
  
  // Admin always has access
  if (user.role === 'ADMIN') return { user };
  
  // Tournament Director / Sub Admin must be assigned
  if (user.role === 'TOURNAMENT_DIRECTOR' || user.role === 'SUB_ADMIN') {
    const hasAccess = await canManageTournament(user, tournamentId);
    if (hasAccess) return { user };
  }
  
  // Check if tournament allows player self-scoring
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { scoringMode: true },
  });
  
  if (tournament?.scoringMode === 'PLAYER_SELF' || tournament?.scoringMode === 'HYBRID') {
    return { user };
  }
  
  return {
    error: NextResponse.json(
      { error: 'Score entry not permitted', code: 'SCORE_ENTRY_DENIED' },
      { status: 403 }
    ),
  };
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const ROLES = {
  PLAYER: 'PLAYER' as Role,
  ORG_ADMIN: 'ORG_ADMIN' as Role,
  SUB_ADMIN: 'SUB_ADMIN' as Role,
  ADMIN: 'ADMIN' as Role,
  TOURNAMENT_DIRECTOR: 'TOURNAMENT_DIRECTOR' as Role,
};
