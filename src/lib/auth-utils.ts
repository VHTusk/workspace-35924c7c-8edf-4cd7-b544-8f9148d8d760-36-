/**
 * Authentication & Authorization Utilities for VALORHIVE
 * 
 * This module provides centralized auth helpers to avoid code duplication
 * across API routes. Includes role checking, session validation, and more.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, OrgAdminRole } from '@prisma/client';
import { validateSession, validateOrgSession } from '@/lib/auth';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie, SESSION_COOKIE_NAME } from '@/lib/session-helpers';

// ============================================
// Types
// ============================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  orgId?: string;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string;
    lastName: string;
    role: Role;
    sport: string;
  };
  org?: {
    id: string;
    name: string;
    type: string;
    sport: string;
  };
  error?: string;
  code?: string;
}

export interface OrgAdminAuthResult extends AuthResult {
  orgAdmin?: {
    id: string;
    orgId: string;
    userId: string;
    role: OrgAdminRole;
  };
}

// ============================================
// Role Checking Utilities
// ============================================

/**
 * Check if user has admin privileges (ADMIN or SUB_ADMIN)
 */
export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUB_ADMIN;
}

/**
 * Check if user is a super admin (ADMIN only)
 */
export function isSuperAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}

/**
 * Check if user is a tournament director
 */
export function isTournamentDirector(role: Role): boolean {
  return role === Role.TOURNAMENT_DIRECTOR;
}

/**
 * Check if org admin role can manage other admins
 */
export function canManageAdmins(role: OrgAdminRole): boolean {
  return role === OrgAdminRole.PRIMARY;
}

/**
 * Check if org admin has full access
 */
export function hasFullOrgAccess(role: OrgAdminRole): boolean {
  return role === OrgAdminRole.PRIMARY || role === OrgAdminRole.ADMIN;
}

/**
 * Check if org admin can manage tournaments
 */
export function canManageTournaments(role: OrgAdminRole): boolean {
  return role === OrgAdminRole.PRIMARY || role === OrgAdminRole.ADMIN;
}

/**
 * Get allowed admin roles for a route
 */
export function getAllowedAdminRoles(): Role[] {
  return [Role.ADMIN, Role.SUB_ADMIN];
}

// ============================================
// Session Validation Helpers
// ============================================

/**
 * Validate player session from request
 */
export async function validatePlayerSession(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return { 
        authenticated: false, 
        error: 'Not authenticated', 
        code: 'AUTH_REQUIRED' 
      };
    }

    const session = await validateSession(token);

    if (!session || !session.user) {
      return { 
        authenticated: false, 
        error: 'Invalid or expired session', 
        code: 'SESSION_INVALID' 
      };
    }

    return {
      authenticated: true,
      userId: session.user.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        phone: session.user.phone,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role as Role,
        sport: session.user.sport,
      },
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { 
      authenticated: false, 
      error: 'Session validation failed', 
      code: 'AUTH_ERROR' 
    };
  }
}

/**
 * Validate organization session from request
 */
export async function validateOrganizationSession(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return { 
        authenticated: false, 
        error: 'Not authenticated', 
        code: 'AUTH_REQUIRED' 
      };
    }

    const session = await validateOrgSession(token);

    if (!session || !session.org) {
      return { 
        authenticated: false, 
        error: 'Invalid or expired organization session', 
        code: 'SESSION_INVALID' 
      };
    }

    return {
      authenticated: true,
      orgId: session.org.id,
      org: {
        id: session.org.id,
        name: session.org.name,
        type: session.org.type,
        sport: session.org.sport,
      },
    };
  } catch (error) {
    console.error('Org session validation error:', error);
    return { 
      authenticated: false, 
      error: 'Session validation failed', 
      code: 'AUTH_ERROR' 
    };
  }
}

/**
 * Validate admin session from request
 */
export async function validateAdminSession(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) {
      return { 
        authenticated: false, 
        error: 'Admin authentication required', 
        code: 'ADMIN_AUTH_REQUIRED' 
      };
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || !session.user) {
      return { 
        authenticated: false, 
        error: 'Invalid admin session', 
        code: 'SESSION_INVALID' 
      };
    }

    if (!isAdmin(session.user.role as Role)) {
      return { 
        authenticated: false, 
        error: 'Admin privileges required', 
        code: 'FORBIDDEN' 
      };
    }

    return {
      authenticated: true,
      userId: session.user.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        phone: session.user.phone,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role as Role,
        sport: session.user.sport,
      },
    };
  } catch (error) {
    console.error('Admin session validation error:', error);
    return { 
      authenticated: false, 
      error: 'Session validation failed', 
      code: 'AUTH_ERROR' 
    };
  }
}

/**
 * Validate org admin with specific role
 */
export async function validateOrgAdminWithRole(
  orgId: string,
  allowedRoles: OrgAdminRole[] = [OrgAdminRole.PRIMARY, OrgAdminRole.ADMIN, OrgAdminRole.STAFF]
): Promise<OrgAdminAuthResult> {
  try {
    const authResult = await validatePlayerSession();
    
    if (!authResult.authenticated || !authResult.userId) {
      return authResult as OrgAdminAuthResult;
    }

    const orgAdmin = await db.orgAdmin.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: authResult.userId,
        },
      },
    });

    if (!orgAdmin || !orgAdmin.isActive) {
      return {
        authenticated: false,
        error: 'Not an admin of this organization',
        code: 'NOT_ORG_ADMIN',
      };
    }

    if (!allowedRoles.includes(orgAdmin.role)) {
      return {
        authenticated: false,
        error: 'Insufficient privileges for this action',
        code: 'INSUFFICIENT_PRIVILEGES',
      };
    }

    return {
      authenticated: true,
      userId: authResult.userId,
      user: authResult.user,
      orgId,
      orgAdmin: {
        id: orgAdmin.id,
        orgId: orgAdmin.orgId,
        userId: orgAdmin.userId,
        role: orgAdmin.role,
      },
    };
  } catch (error) {
    console.error('Org admin validation error:', error);
    return { 
      authenticated: false, 
      error: 'Validation failed', 
      code: 'AUTH_ERROR' 
    };
  }
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message = 'Authentication required', code = 'AUTH_REQUIRED'): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: 401 }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message = 'Access denied', code = 'FORBIDDEN'): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: 403 }
  );
}

/**
 * Create authenticated response with session and CSRF token
 */
export function createAuthResponse(
  data: Record<string, unknown>,
  sessionToken: string,
  isOrg: boolean = false
): NextResponse {
  const response = NextResponse.json({
    success: true,
    ...data,
  });

  // Set session cookie using shared helper for consistency
  setSessionCookie(response, sessionToken);

  // Set CSRF token cookie for double-submit pattern
  setCsrfCookie(response);

  return response;
}

// ============================================
// Auth Middleware Helpers
// ============================================

/**
 * Require player authentication
 * Use at the start of API route handlers
 */
export async function requirePlayerAuth(): Promise<AuthResult> {
  return validatePlayerSession();
}

/**
 * Require admin authentication
 * Use at the start of admin API route handlers
 */
export async function requireAdminAuth(): Promise<AuthResult> {
  return validateAdminSession();
}

/**
 * Require organization authentication
 * Use at the start of org API route handlers
 */
export async function requireOrgAuth(): Promise<AuthResult> {
  return validateOrganizationSession();
}

/**
 * Require any authentication (player or org)
 */
export async function requireAnyAuth(): Promise<AuthResult> {
  // Try player session first
  const playerAuth = await validatePlayerSession();
  if (playerAuth.authenticated) {
    return playerAuth;
  }

  // Try org session
  const orgAuth = await validateOrganizationSession();
  if (orgAuth.authenticated) {
    return orgAuth;
  }

  return {
    authenticated: false,
    error: 'Authentication required',
    code: 'AUTH_REQUIRED',
  };
}
