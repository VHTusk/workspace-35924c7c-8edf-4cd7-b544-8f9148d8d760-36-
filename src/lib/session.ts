/**
 * Session utilities for VALORHIVE
 * Supports both cookie-based (web) and Bearer token (mobile) authentication
 * 
 * CRITICAL: Each sport is a SEPARATE platform. A user registered for CORNHOLE
 * cannot access DARTS pages without registering for DARTS separately.
 */

import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db';

interface SessionData {
  userId?: string;
  orgId?: string;
  sport?: string;
  accountType?: string;
  role?: string;
  isAuthenticated: boolean;
  sportMismatch?: boolean;  // True if session sport doesn't match expected sport
  sessionSport?: string;    // The sport stored in the session
}

/**
 * Hash a token using SHA-256 (must match auth.ts implementation)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get session token from either cookie or Bearer header
 * This is the primary entry point for API routes to get authentication
 */
export async function getSessionToken(): Promise<{ token: string | null; source: 'cookie' | 'bearer' }> {
  const cookieStore = await cookies();
  const headersList = await headers();

  // Check for Bearer token header (set by middleware from Authorization header)
  const bearerToken = headersList.get('x-session-token');
  if (bearerToken) {
    return { token: bearerToken, source: 'bearer' };
  }

  // Fall back to cookie
  const cookieToken = cookieStore.get('session_token')?.value || 
                      cookieStore.get('org_session')?.value;
  
  return { 
    token: cookieToken || null, 
    source: cookieToken ? 'cookie' : 'bearer' 
  };
}

/**
 * Validate session and return user/org data
 * Works for both web (cookie) and Bearer token (mobile) authentication
 * 
 * @param expectedSport - If provided, validates that session sport matches.
 *                         Each sport is a separate platform - users must register separately.
 * @returns SessionData with authentication status and user/org info
 */
export async function validateSession(expectedSport?: string): Promise<SessionData> {
  const { token } = await getSessionToken();
  
  if (!token) {
    return { isAuthenticated: false };
  }

  try {
    // Hash the token to look up in database
    const tokenHash = await hashToken(token);
    
    const session = await db.session.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gte: new Date() },
      },
      include: {
        user: { select: { id: true, role: true } },
        org: { select: { id: true } },
      },
    });

    if (!session) {
      return { isAuthenticated: false };
    }

    // CRITICAL: Validate sport if provided
    // Each sport is a SEPARATE platform - user must register separately for each
    if (expectedSport && session.sport !== expectedSport.toUpperCase()) {
      console.log(`[Session] Sport mismatch: session has ${session.sport}, expected ${expectedSport.toUpperCase()}`);
      return { 
        isAuthenticated: false, 
        sportMismatch: true,
        sessionSport: session.sport || undefined,
      };
    }

    // Update last activity only if more than 5 minutes have passed
    // This reduces database writes from potentially every request to at most once per 5 minutes
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch((err) => {
        console.error('[Session] Failed to update lastActivityAt:', err.message || err);
      });
    }

    return {
      userId: session.userId || undefined,
      orgId: session.orgId || undefined,
      sport: session.sport || undefined,
      accountType: session.accountType || undefined,
      role: session.user?.role || undefined,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isAuthenticated: false };
  }
}

/**
 * Get authenticated user ID
 * Convenience function for API routes
 * @param expectedSport - Optional sport to validate against
 */
export async function getAuthenticatedUserId(expectedSport?: string): Promise<string | null> {
  const session = await validateSession(expectedSport);
  return session.userId || null;
}

/**
 * Get authenticated org ID
 * Convenience function for API routes
 * @param expectedSport - Optional sport to validate against
 */
export async function getAuthenticatedOrgId(expectedSport?: string): Promise<string | null> {
  const session = await validateSession(expectedSport);
  return session.orgId || null;
}

/**
 * Check if request is from mobile app (Bearer token)
 */
export async function isMobileRequest(): Promise<boolean> {
  const { source } = await getSessionToken();
  return source === 'bearer';
}

/**
 * Require authentication - throws error if not authenticated
 * Use in API routes that require authentication
 * @param expectedSport - Optional sport to validate against
 */
export async function requireAuth(expectedSport?: string): Promise<{ userId: string; sport: string }> {
  const session = await validateSession(expectedSport);
  
  if (!session.isAuthenticated || !session.userId) {
    if (session.sportMismatch) {
      throw new Error(`Unauthorized: Not registered for this sport. You are registered for ${session.sessionSport}`);
    }
    throw new Error('Unauthorized: Authentication required');
  }
  
  return { userId: session.userId, sport: session.sport || '' };
}

/**
 * Require org authentication - throws error if not authenticated as org
 * @param expectedSport - Optional sport to validate against
 */
export async function requireOrgAuth(expectedSport?: string): Promise<{ orgId: string; sport: string }> {
  const session = await validateSession(expectedSport);
  
  if (!session.isAuthenticated || !session.orgId) {
    if (session.sportMismatch) {
      throw new Error(`Unauthorized: Not registered for this sport. Your organization is registered for ${session.sessionSport}`);
    }
    throw new Error('Unauthorized: Organization authentication required');
  }
  
  return { orgId: session.orgId, sport: session.sport || '' };
}

/**
 * Validate session for a specific sport and return appropriate error response
 * Use this in API routes to return proper error codes for sport mismatch
 */
export async function validateSessionForSport(
  expectedSport: string
): Promise<{ 
  valid: boolean; 
  session?: SessionData; 
  error?: { message: string; code: string; sessionSport?: string } 
}> {
  const session = await validateSession(expectedSport);
  
  if (!session.isAuthenticated) {
    if (session.sportMismatch) {
      return {
        valid: false,
        error: {
          message: `You are not registered for ${expectedSport.toUpperCase()}. Please register for this sport.`,
          code: 'SPORT_MISMATCH',
          sessionSport: session.sessionSport,
        },
      };
    }
    return {
      valid: false,
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
    };
  }
  
  return { valid: true, session };
}
