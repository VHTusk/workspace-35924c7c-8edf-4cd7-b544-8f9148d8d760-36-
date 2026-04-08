/**
 * Session Authentication Helper for API Routes
 * 
 * This module provides a unified authentication helper that correctly
 * hashes session tokens before database lookup.
 * 
 * IMPORTANT: All API routes must use these helpers instead of direct
 * db.session.findUnique() calls to prevent security vulnerabilities.
 * 
 * CANONICAL COOKIE CONTRACT:
 * - name: 'session_token' (single canonical name for all sessions)
 * - httpOnly: true (prevents JavaScript access - XSS protection)
 * - secure: true in production, false in development (HTTPS protection)
 * - sameSite: 'strict' (maximum CSRF protection)
 * - maxAge: 604800 (7 days in seconds)
 * - path: '/' (available across entire site)
 * 
 * OVERRIDES:
 * Only routes that truly need cross-site callback support should override
 * sameSite to 'lax'. Google One Tap does not require that override because
 * it completes on the same site via an XHR request.
 * 
 * NOTE: Both user and org authentication use 'session_token' cookie.
 * The validateSession vs validateOrgSession functions differentiate the session type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, validateOrgSession, hashToken } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Canonical cookie name for session tokens.
 * Used for both user and organization authentication.
 * 
 * IMPORTANT: Do not use alternative cookie names like 'org_session_token'.
 * All authenticated sessions use this single cookie name.
 */
export const SESSION_COOKIE_NAME = 'session_token' as const;

type SessionCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax';
  maxAge: number;
  path: string;
};

/**
 * Canonical cookie options for setting session cookies.
 * 
 * COOKIE CONTRACT (Production-Safe):
 * - name: 'session_token'
 * - httpOnly: true (prevents JavaScript access - XSS protection)
 * - secure: process.env.NODE_ENV === 'production' (HTTPS only in production)
 * - sameSite: 'strict' (maximum CSRF protection - cookie never sent cross-site)
 * - maxAge: 604800 (7 days in seconds)
 * - path: '/' (available across entire site)
 * 
 * SECURITY RATIONALE:
 * - sameSite: 'strict' provides the strongest CSRF protection by never sending
 *   the cookie with cross-site requests, including top-level navigations.
 * - This means if a user clicks a link from an external site (email, social media),
 *   they will need to re-authenticate. This is an acceptable security trade-off.
 * 
 * CROSS-SITE CALLBACK EXCEPTION:
 * Reserve sameSite: 'lax' only for routes that must survive a true cross-site
 * callback. Same-site auth flows such as Google One Tap should keep 'strict'.
 */
export const SESSION_COOKIE_OPTIONS: SessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days = 604800 seconds
  path: '/',
};

/**
 * Cookie options for clearing/deleting session cookies.
 * 
 * MUST match the path and sameSite from SESSION_COOKIE_OPTIONS for deletion to work.
 * The secure attribute is not required for deletion but included for consistency.
 */
export const SESSION_COOKIE_CLEAR_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

// ============================================
// SESSION COOKIE HELPERS
// ============================================

/**
 * Set the session cookie on a NextResponse object.
 * 
 * IMPORTANT: Use this helper for ALL session cookie setting to ensure consistency.
 * 
 * @param response - The NextResponse object to set the cookie on
 * @param token - The session token value
 * @param options - Optional overrides for cookie options
 * 
 * @example
 * const response = NextResponse.json({ success: true, user });
 * setSessionCookie(response, session.token);
 * return response;
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  options?: Partial<SessionCookieOptions>
): void {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    token,
    {
      ...SESSION_COOKIE_OPTIONS,
      ...options,
    }
  );
}

/**
 * Clear/delete the session cookie from a NextResponse object.
 * 
 * IMPORTANT: Must use matching path for deletion to work correctly.
 * This helper ensures the cookie is deleted with the same settings used to set it.
 * 
 * @param response - The NextResponse object to clear the cookie from
 * 
 * @example
 * const response = NextResponse.json({ success: true });
 * clearSessionCookie(response);
 * return response;
 */
export function clearSessionCookie(response: NextResponse): void {
  // Delete by setting maxAge to 0 or using the delete method
  // Both path and name must match for deletion to work
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_CLEAR_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Clear/delete session cookie from cookies() store (for server components).
 * 
 * IMPORTANT: Use this in server actions or server components where you have
 * access to the cookies() store from next/headers.
 * 
 * @example
 * import { cookies } from 'next/headers';
 * const cookieStore = await cookies();
 * clearSessionCookieFromStore(cookieStore);
 */
export function clearSessionCookieFromStore(
  cookieStore: {
    delete: (name: string) => unknown;
  }
): void {
  // The delete method requires matching path
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Type for cookies
type CookieStore = {
  get(name: string): { name: string; value: string } | undefined;
};

/**
 * Result type for authentication
 */
export type AuthResult = 
  | { success: true; userId: string; user: { id: string; role: string; sport: string; [key: string]: unknown } }
  | { success: false; error: NextResponse };

export type OrgAuthResult = 
  | { success: true; orgId: string; org: { id: string; name: string; type: string; [key: string]: unknown } }
  | { success: false; error: NextResponse };

/**
 * Helper to get session token from request or cookie store.
 * Uses the canonical SESSION_COOKIE_NAME constant.
 */
export function getSessionToken(
  requestOrCookies: NextRequest | CookieStore
): string | undefined {
  return 'cookies' in requestOrCookies
    ? requestOrCookies.cookies.get(SESSION_COOKIE_NAME)?.value
    : requestOrCookies.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Get authenticated user from request (using session_token cookie)
 */
export async function getSessionUser(request: NextRequest): Promise<AuthResult>;
export async function getSessionUser(cookieStore: CookieStore): Promise<AuthResult>;
export async function getSessionUser(
  requestOrCookies: NextRequest | CookieStore
): Promise<AuthResult> {
  try {
    const token = getSessionToken(requestOrCookies);

    if (!token) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Not authenticated' },
          { status: 401 }
        ),
      };
    }

    const session = await validateSession(token);

    if (!session?.user) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid or expired session' },
          { status: 401 }
        ),
      };
    }

    return {
      success: true,
      userId: session.user.id,
      user: session.user as any,
    };
  } catch (error) {
    console.error('getSessionUser error:', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Get authenticated admin from request (using admin_session cookie)
 */
export async function getAdminUser(request: NextRequest): Promise<AuthResult>;
export async function getAdminUser(cookieStore: CookieStore): Promise<AuthResult>;
export async function getAdminUser(
  requestOrCookies: NextRequest | CookieStore
): Promise<AuthResult> {
  try {
    const token = 'cookies' in requestOrCookies
      ? requestOrCookies.cookies.get('admin_session')?.value
        || requestOrCookies.cookies.get('admin_session_token')?.value
        || requestOrCookies.cookies.get('session_token')?.value
      : requestOrCookies.get('admin_session')?.value
        || requestOrCookies.get('admin_session_token')?.value
        || requestOrCookies.get('session_token')?.value;

    if (!token) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Admin authentication required' },
          { status: 401 }
        ),
      };
    }

    const session = await validateSession(token);

    if (!session?.user) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid admin session' },
          { status: 401 }
        ),
      };
    }

    // Verify admin role
    const adminRole = String(session.user.role);
    if (adminRole !== 'ADMIN' && adminRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Forbidden', message: 'Admin access required' },
          { status: 403 }
        ),
      };
    }

    return {
      success: true,
      userId: session.user.id,
      user: session.user as any,
    };
  } catch (error) {
    console.error('getAdminUser error:', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Get authenticated organization from request (using session_token cookie)
 * 
 * IMPORTANT: This uses the canonical 'session_token' cookie name.
 * Do not use 'org_session_token' or any other variant.
 */
export async function getOrgAuth(request: NextRequest): Promise<OrgAuthResult>;
export async function getOrgAuth(cookieStore: CookieStore): Promise<OrgAuthResult>;
export async function getOrgAuth(
  requestOrCookies: NextRequest | CookieStore
): Promise<OrgAuthResult> {
  try {
    const token = getSessionToken(requestOrCookies);

    if (!token) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Not authenticated' },
          { status: 401 }
        ),
      };
    }

    const session = await validateOrgSession(token);

    if (!session?.org) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid organization session' },
          { status: 401 }
        ),
      };
    }

    return {
      success: true,
      orgId: session.org.id,
      org: session.org as any,
    };
  } catch (error) {
    console.error('getOrgAuth error:', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Get authenticated user OR organization (for routes supporting both)
 */
export async function getAnyAuth(request: NextRequest): Promise<
  | { success: true; type: 'user'; userId: string; user: Record<string, unknown> }
  | { success: true; type: 'org'; orgId: string; org: Record<string, unknown> }
  | { success: false; error: NextResponse }
> {
  // Try user session first
  const userResult = await getSessionUser(request);
  if (userResult.success) {
    return { ...userResult, type: 'user' as const };
  }

  // Try org session
  const orgResult = await getOrgAuth(request);
  if (orgResult.success) {
    return { ...orgResult, type: 'org' as const };
  }

  // Return error
  return {
    success: false,
    error: NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    ),
  };
}

/**
 * Delete a session by token (with proper hashing)
 */
export async function deleteSessionByToken(token: string): Promise<void> {
  try {
    const tokenHash = await hashToken(token);
    await db.session.delete({ where: { token: tokenHash } });
  } catch {
    // Session might not exist
  }
}

/**
 * Get session by token (with proper hashing) - for special cases
 */
export async function getSessionByToken(token: string) {
  try {
    const tokenHash = await hashToken(token);
    return db.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });
  } catch {
    return null;
  }
}

/**
 * Get admin session by token (with proper hashing)
 */
export async function getAdminSessionByToken(token: string) {
  try {
    const tokenHash = await hashToken(token);
    const session = await db.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session?.user) return null;

    // Verify admin role
    const adminRole = String(session.user.role);
    if (adminRole !== 'ADMIN' && adminRole !== 'SUPER_ADMIN') {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Result type for org route authorization
 */
export type OrgRouteAuthResult = 
  | { success: true; orgId: string; org: { id: string; name: string; type: string; [key: string]: unknown } }
  | { success: false; error: NextResponse };

/**
 * Authorize org-scoped route access.
 * 
 * This helper validates:
 * 1. The request has a valid org session (401 if not)
 * 2. The authenticated org matches the route param `id` (403 if not)
 * 
 * IMPORTANT: Use this for all /api/orgs/[id] routes to prevent
 * cross-org access attacks.
 * 
 * @param request - NextRequest object
 * @param routeOrgId - The org ID from the route params
 * @returns OrgRouteAuthResult with org data or error response
 * 
 * @example
 * export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 *   const { id } = await params;
 *   const auth = await authorizeOrgRoute(request, id);
 *   if (!auth.success) return auth.error;
 *   // auth.orgId is guaranteed to match route param
 *   // ... proceed with authorized logic
 * }
 */
export async function authorizeOrgRoute(
  request: NextRequest,
  routeOrgId: string
): Promise<OrgRouteAuthResult> {
  // Get org authentication
  const orgAuth = await getOrgAuth(request);

  if (!orgAuth.success) {
    return orgAuth; // Return 401 error
  }

  // Verify org matches route param
  if (orgAuth.orgId !== routeOrgId) {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this organization' },
        { status: 403 }
      ),
    };
  }

  return orgAuth;
}
