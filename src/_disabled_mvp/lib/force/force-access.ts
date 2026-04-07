/**
 * VALORHIVE v3.41.0 - Force Access Control
 * Security layer for force/organization data access
 * 
 * CRITICAL: Force leaderboards are PRIVATE - only accessible to:
 * 1. Force members (players belonging to the force)
 * 2. Force admins
 * 3. Platform admins
 * 
 * This ensures security identity data remains confidential.
 */

import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { hashToken } from './auth';

// ============================================
// TYPES
// ============================================

export interface ForceAccessResult {
  hasAccess: boolean;
  reason?: string;
  isMember: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  userId?: string;
  forceId?: string;
  unitId?: string;
  zoneId?: string;
  sectorId?: string;
}

export interface ForceAdminCheck {
  isAdmin: boolean;
  role?: string;
  forceId?: string;
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Get current authenticated user from session cookie
 */
export async function getCurrentUser(): Promise<{
  id: string;
  sport: string;
  role: string;
  forceId: string | null;
  unitId: string | null;
  zoneId: string | null;
  sectorId: string | null;
} | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return null;
    }

    const tokenHash = await hashToken(sessionToken);
    
    const session = await db.session.findUnique({
      where: { token: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            sport: true,
            role: true,
            forceId: true,
            unitId: true,
            zoneId: true,
            sectorId: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.user || !session.user.isActive) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      return null;
    }

    return {
      id: session.user.id,
      sport: session.user.sport,
      role: session.user.role,
      forceId: session.user.forceId,
      unitId: session.user.unitId,
      zoneId: session.user.zoneId,
      sectorId: session.user.sectorId,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is a platform admin
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'ADMIN';
  } catch {
    return false;
  }
}

// ============================================
// FORCE ACCESS CONTROL
// ============================================

/**
 * Check if a user has access to view force data
 * 
 * Access Rules:
 * 1. Platform ADMIN role - Full access to all forces
 * 2. Force member - Access to their own force only
 * 3. Force admin - Access to their administered force
 * 4. Non-members - NO access (security identity data is private)
 */
export async function checkForceAccess(
  forceCode: string,
  user: {
    id: string;
    role: string;
    forceId: string | null;
  } | null
): Promise<ForceAccessResult> {
  // Default: no access
  const defaultResult: ForceAccessResult = {
    hasAccess: false,
    reason: 'Authentication required',
    isMember: false,
    isAdmin: false,
    isPlatformAdmin: false,
  };

  // No user = no access
  if (!user) {
    return {
      ...defaultResult,
      reason: 'Please log in to access force data',
    };
  }

  // Get the force
  const force = await db.force.findUnique({
    where: { code: forceCode.toUpperCase() },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!force) {
    return {
      ...defaultResult,
      reason: 'Force not found',
    };
  }

  // Platform admins have full access
  if (user.role === 'ADMIN') {
    return {
      hasAccess: true,
      isMember: false,
      isAdmin: true,
      isPlatformAdmin: true,
      userId: user.id,
      forceId: force.id,
    };
  }

  // Check if user is a force admin
  const forceAdmin = await db.forceAdmin.findFirst({
    where: {
      forceId: force.id,
      userId: user.id,
      isActive: true,
    },
    select: { role: true },
  });

  if (forceAdmin) {
    return {
      hasAccess: true,
      isMember: user.forceId === force.id,
      isAdmin: true,
      isPlatformAdmin: false,
      userId: user.id,
      forceId: force.id,
    };
  }

  // Check if user is a member of this force
  if (user.forceId === force.id) {
    // Get user's unit/zone/sector for scope-specific access
    const userDetails = await db.user.findUnique({
      where: { id: user.id },
      select: {
        unitId: true,
        zoneId: true,
        sectorId: true,
      },
    });

    return {
      hasAccess: true,
      isMember: true,
      isAdmin: false,
      isPlatformAdmin: false,
      userId: user.id,
      forceId: force.id,
      unitId: userDetails?.unitId ?? undefined,
      zoneId: userDetails?.zoneId ?? undefined,
      sectorId: userDetails?.sectorId ?? undefined,
    };
  }

  // User is not a member of this force
  return {
    ...defaultResult,
    reason: 'Access denied. You are not a member of this force.',
    isMember: false,
    isAdmin: false,
    isPlatformAdmin: false,
  };
}

/**
 * Check access for specific scope (unit, zone, sector, force)
 */
export async function checkForceScopeAccess(
  forceCode: string,
  scope: 'unit' | 'zone' | 'sector' | 'force',
  scopeId: string | null,
  user: {
    id: string;
    role: string;
    forceId: string | null;
    unitId?: string | null;
    zoneId?: string | null;
    sectorId?: string | null;
  } | null
): Promise<ForceAccessResult> {
  // First check basic force access
  const baseAccess = await checkForceAccess(forceCode, user);

  if (!baseAccess.hasAccess) {
    return baseAccess;
  }

  // Platform admins and force admins have full scope access
  if (baseAccess.isPlatformAdmin || baseAccess.isAdmin) {
    return baseAccess;
  }

  // For members, check if they can access the specific scope
  if (scope === 'unit' && scopeId) {
    // Members can only view their own unit leaderboard
    if (user?.unitId !== scopeId) {
      return {
        hasAccess: false,
        reason: 'You can only view your own unit leaderboard',
        isMember: baseAccess.isMember,
        isAdmin: false,
        isPlatformAdmin: false,
      };
    }
  }

  if (scope === 'zone' && scopeId) {
    // Members can only view their own zone leaderboard
    if (user?.zoneId !== scopeId) {
      return {
        hasAccess: false,
        reason: 'You can only view your own zone leaderboard',
        isMember: baseAccess.isMember,
        isAdmin: false,
        isPlatformAdmin: false,
      };
    }
  }

  if (scope === 'sector' && scopeId) {
    // Members can only view their own sector leaderboard
    if (user?.sectorId !== scopeId) {
      return {
        hasAccess: false,
        reason: 'You can only view your own sector leaderboard',
        isMember: baseAccess.isMember,
        isAdmin: false,
        isPlatformAdmin: false,
      };
    }
  }

  // Force-level leaderboard is accessible to all members
  return baseAccess;
}

// ============================================
// FORCE ADMIN MANAGEMENT
// ============================================

/**
 * Check if user can manage force settings
 * Only force admins and platform admins can manage
 */
export async function canManageForce(
  forceCode: string,
  userId: string
): Promise<boolean> {
  try {
    // Check platform admin
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') {
      return true;
    }

    // Check force admin
    const force = await db.force.findUnique({
      where: { code: forceCode.toUpperCase() },
      select: { id: true },
    });

    if (!force) return false;

    const forceAdmin = await db.forceAdmin.findFirst({
      where: {
        forceId: force.id,
        userId,
        isActive: true,
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      },
    });

    return !!forceAdmin;
  } catch {
    return false;
  }
}

/**
 * Get all forces a user has access to
 */
export async function getUserAccessibleForces(userId: string): Promise<{
  memberOf: string[];
  adminOf: string[];
}> {
  try {
    const [user, adminRoles] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { forceId: true },
      }),
      db.forceAdmin.findMany({
        where: { userId, isActive: true },
        select: { forceId: true },
      }),
    ]);

    return {
      memberOf: user?.forceId ? [user.forceId] : [],
      adminOf: adminRoles.map((r) => r.forceId),
    };
  } catch {
    return { memberOf: [], adminOf: [] };
  }
}

// ============================================
// EXPORTS
// ============================================

export const ForceAccess = {
  getCurrentUser,
  isPlatformAdmin,
  checkForceAccess,
  checkForceScopeAccess,
  canManageForce,
  getUserAccessibleForces,
};
