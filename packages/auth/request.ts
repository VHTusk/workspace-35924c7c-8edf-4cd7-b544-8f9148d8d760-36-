/**
 * @valorhive/auth - Request Helpers
 * 
 * Convenient request-level authentication functions for API routes.
 * Wraps the session validation functions with Next.js Request handling.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯  USE THIS MODULE FOR ALL API ROUTE AUTHENTICATION  🎯
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * // Simple pattern (returns response if unauthorized)
 * const auth = await requireAuth(request);
 * if (auth instanceof NextResponse) return auth;
 * // auth.user is now available
 * 
 * @example
 * // Null-check pattern (for custom error handling)
 * const auth = await getAuthUser(request);
 * if (!auth) return unauthorizedResponse();
 * // auth.user is now available
 * 
 * @example
 * // Organization authentication
 * const auth = await requireOrg(request);
 * if (auth instanceof NextResponse) return auth;
 * // auth.org is now available
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSessionToken,
  validateOrgSessionToken,
  SessionUser,
  SessionWithUser,
  SessionOrg,
  SessionWithOrg,
} from './session';
import { extractTokenFromRequest } from './tokens';

// ============================================
// Types
// ============================================

export interface AuthResult {
  user: SessionUser;
  session: SessionWithUser;
}

export interface OrgAuthResult {
  org: SessionOrg;
  session: SessionWithOrg;
}

export interface EntityAuthResultUser {
  type: 'user';
  user: SessionUser;
  session: SessionWithUser;
}

export interface EntityAuthResultOrg {
  type: 'org';
  org: SessionOrg;
  session: SessionWithOrg;
}

export type EntityAuthResult = EntityAuthResultUser | EntityAuthResultOrg;

// ============================================
// Response Helpers
// ============================================

/**
 * Returns a 401 Unauthorized JSON response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Returns a 403 Forbidden JSON response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

// ============================================
// User Authentication Helpers
// ============================================

/**
 * Get authenticated user from request
 * This is the PRIMARY authentication function for all API routes
 * 
 * @param request - NextRequest object
 * @returns User and session if authenticated, null otherwise
 */
export async function getAuthenticatedFromRequest(request: NextRequest): Promise<{
  user: SessionUser;
  session: SessionWithUser;
} | null> {
  try {
    const token = extractTokenFromRequest(request);

    if (!token) {
      return null;
    }

    const session = await validateSessionToken(token);

    if (!session?.user) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('[Auth] getAuthenticatedFromRequest error:', error);
    return null;
  }
}

/**
 * Get authenticated admin from request
 * 
 * @param request - NextRequest object
 * @returns Admin user and session if authenticated as admin, null otherwise
 */
export async function getAuthenticatedAdminFromRequest(request: NextRequest): Promise<{
  user: SessionUser;
  session: SessionWithUser;
} | null> {
  try {
    const token = extractTokenFromRequest(request);

    if (!token) {
      return null;
    }

    const session = await validateSessionToken(token);

    if (!session?.user) {
      return null;
    }

    const adminRoles: SessionUser['role'][] = ['ADMIN', 'SUB_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('[Auth] getAuthenticatedAdminFromRequest error:', error);
    return null;
  }
}

/**
 * Get the authenticated user from a request
 * 
 * Use this when you want to handle unauthorized cases yourself.
 * Returns null if not authenticated.
 * 
 * @param request - NextRequest object
 * @returns AuthResult with user and session, or null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult | null> {
  return getAuthenticatedFromRequest(request);
}

/**
 * Require authentication for a route
 * 
 * Use this for a simple pattern that returns a 401 response if not authenticated.
 * Returns either the auth result or a NextResponse (which should be returned immediately).
 * 
 * @param request - NextRequest object
 * @returns AuthResult if authenticated, or NextResponse with 401 if not
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const result = await getAuthenticatedFromRequest(request);

  if (!result) {
    return unauthorizedResponse();
  }

  return result;
}

/**
 * Get the authenticated admin from a request
 * 
 * Use this when you want to handle unauthorized/forbidden cases yourself.
 * Returns null if not authenticated or not an admin.
 * 
 * @param request - NextRequest object
 * @returns AuthResult with admin user and session, or null if not admin
 */
export async function getAuthAdmin(request: NextRequest): Promise<AuthResult | null> {
  return getAuthenticatedAdminFromRequest(request);
}

/**
 * Require admin authentication for a route
 * 
 * Use this for a simple pattern that returns appropriate error responses.
 * Returns 401 if not authenticated, 403 if authenticated but not admin.
 * 
 * @param request - NextRequest object
 * @returns AuthResult if admin, or NextResponse with 401/403 if not
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  // First check if user is authenticated at all
  const authResult = await getAuthenticatedFromRequest(request);

  if (!authResult) {
    return unauthorizedResponse();
  }

  // Then check if they have admin role
  const adminResult = await getAuthenticatedAdminFromRequest(request);

  if (!adminResult) {
    // User is authenticated but not an admin
    return forbiddenResponse('Admin access required');
  }

  return adminResult;
}

// ============================================
// Organization Authentication Helpers
// ============================================

/**
 * Get authenticated organization from request
 * 
 * @param request - NextRequest object
 * @returns Organization and session if authenticated, null otherwise
 */
export async function getAuthenticatedOrgFromRequest(request: NextRequest): Promise<{
  org: SessionOrg;
  session: SessionWithOrg;
} | null> {
  try {
    const token = extractTokenFromRequest(request);

    if (!token) {
      return null;
    }

    const session = await validateOrgSessionToken(token);

    if (!session?.org) {
      return null;
    }

    return { org: session.org, session };
  } catch (error) {
    console.error('[Auth] getAuthenticatedOrgFromRequest error:', error);
    return null;
  }
}

/**
 * Get the authenticated organization from a request
 * 
 * Use this when you want to handle unauthorized cases yourself.
 * Returns null if not authenticated or not an org session.
 * 
 * @param request - NextRequest object
 * @returns OrgAuthResult with org and session, or null if not org session
 */
export async function getAuthOrg(request: NextRequest): Promise<OrgAuthResult | null> {
  return getAuthenticatedOrgFromRequest(request);
}

/**
 * Require organization authentication for a route
 * 
 * Use this for a simple pattern that returns a 401 response if not authenticated
 * as an organization.
 * 
 * @param request - NextRequest object
 * @returns OrgAuthResult if org authenticated, or NextResponse with 401 if not
 */
export async function requireOrg(
  request: NextRequest
): Promise<OrgAuthResult | NextResponse> {
  const result = await getAuthenticatedOrgFromRequest(request);

  if (!result) {
    return unauthorizedResponse('Organization authentication required');
  }

  return result;
}

// ============================================
// Entity Authentication Helpers (User OR Org)
// ============================================

/**
 * Get authenticated entity (user or org) from request
 * Use for routes that support both user and org authentication
 * 
 * @param request - NextRequest object
 * @returns User or Organization if authenticated, null otherwise
 */
export async function getAuthenticatedEntityFromRequest(request: NextRequest): Promise<{
  type: 'user';
  user: SessionUser;
  session: SessionWithUser;
} | {
  type: 'org';
  org: SessionOrg;
  session: SessionWithOrg;
} | null> {
  // Try user session first
  const userResult = await getAuthenticatedFromRequest(request);
  if (userResult) {
    return { type: 'user', ...userResult };
  }

  // Try org session
  const orgResult = await getAuthenticatedOrgFromRequest(request);
  if (orgResult) {
    return { type: 'org', ...orgResult };
  }

  return null;
}

/**
 * Get the authenticated entity (user or org) from a request
 * 
 * Use this for routes that accept both user and organization authentication.
 * Returns null if neither is authenticated.
 * 
 * @param request - NextRequest object
 * @returns EntityAuthResult with type 'user' or 'org', or null if not authenticated
 */
export async function getAuthEntity(request: NextRequest): Promise<EntityAuthResult | null> {
  return getAuthenticatedEntityFromRequest(request);
}

/**
 * Require entity authentication (user or org) for a route
 * 
 * Use this for a simple pattern that returns a 401 response if neither
 * user nor organization is authenticated.
 * 
 * @param request - NextRequest object
 * @returns EntityAuthResult if authenticated, or NextResponse with 401 if not
 */
export async function requireEntity(
  request: NextRequest
): Promise<EntityAuthResult | NextResponse> {
  const result = await getAuthenticatedEntityFromRequest(request);

  if (!result) {
    return unauthorizedResponse('Authentication required');
  }

  return result;
}
