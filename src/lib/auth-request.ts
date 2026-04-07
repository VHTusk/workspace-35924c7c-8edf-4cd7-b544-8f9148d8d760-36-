/**
 * AUTHENTICATION REQUEST HELPER
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯  USE THIS MODULE FOR ALL API ROUTE AUTHENTICATION  🎯
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A simple wrapper around the canonical auth module that provides
 * convenient functions for API route authentication.
 * 
 * This module makes it easy to migrate routes that use direct cookie access
 * to the canonical auth system.
 * 
 * Supports:
 * - Cookie-based auth (web browsers)
 * - Bearer token auth (mobile apps)
 * - Admin session cookies
 * - Organization session cookies
 * - Entity authentication (user OR org)
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
 * 
 * @example
 * // Entity authentication (user or org)
 * const auth = await requireEntity(request);
 * if (auth instanceof NextResponse) return auth;
 * if (auth.type === 'user') { /* handle user *\/ }
 * else { /* handle org (auth.type === 'org') *\/ }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedFromRequest,
  getAuthenticatedAdminFromRequest,
  getAuthenticatedOrgFromRequest,
  getAuthenticatedEntityFromRequest,
  SessionUser,
  SessionWithUser,
  SessionOrg,
  SessionWithOrg,
} from './auth-canonical';

// ============================================
// Types
// ============================================

export interface AuthResult {
  user: SessionUser;
  session: SessionWithUser;
}

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
// Authentication Helpers
// ============================================

/**
 * Get the authenticated user from a request
 * 
 * Use this when you want to handle unauthorized cases yourself.
 * Returns null if not authenticated.
 * 
 * @param request - NextRequest object
 * @returns AuthResult with user and session, or null if not authenticated
 * 
 * @example
 * const auth = await getAuthUser(request);
 * if (!auth) return unauthorizedResponse();
 * // auth.user is now available
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
 * 
 * @example
 * const auth = await requireAuth(request);
 * if (auth instanceof NextResponse) return auth;
 * // auth.user is now available
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
 * 
 * @example
 * const auth = await getAuthAdmin(request);
 * if (!auth) return unauthorizedResponse(); // or forbiddenResponse()
 * // auth.user is now available as admin
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
 * 
 * @example
 * const auth = await requireAdmin(request);
 * if (auth instanceof NextResponse) return auth;
 * // auth.user is now available as admin
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

export interface OrgAuthResult {
  org: SessionOrg;
  session: SessionWithOrg;
}

/**
 * Get the authenticated organization from a request
 * 
 * Use this when you want to handle unauthorized cases yourself.
 * Returns null if not authenticated or not an org session.
 * 
 * @param request - NextRequest object
 * @returns OrgAuthResult with org and session, or null if not org session
 * 
 * @example
 * const auth = await getAuthOrg(request);
 * if (!auth) return unauthorizedResponse();
 * // auth.org is now available
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
 * 
 * @example
 * const auth = await requireOrg(request);
 * if (auth instanceof NextResponse) return auth;
 * // auth.org is now available
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

/**
 * Get the authenticated entity (user or org) from a request
 * 
 * Use this for routes that accept both user and organization authentication.
 * Returns null if neither is authenticated.
 * 
 * @param request - NextRequest object
 * @returns EntityAuthResult with type 'user' or 'org', or null if not authenticated
 * 
 * @example
 * const auth = await getAuthEntity(request);
 * if (!auth) return unauthorizedResponse();
 * if (auth.type === 'user') {
 *   // auth.user is available
 * } else {
 *   // auth.org is available (auth.type === 'org')
 * }
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
 * 
 * @example
 * const auth = await requireEntity(request);
 * if (auth instanceof NextResponse) return auth;
 * if (auth.type === 'user') {
 *   // auth.user is available
 * } else {
 *   // auth.org is available (auth.type === 'org')
 * }
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

// ============================================
// Convenience re-exports
// ============================================

// Re-export types for convenience
export type { SessionUser, SessionWithUser, SessionOrg, SessionWithOrg } from './auth-canonical';
