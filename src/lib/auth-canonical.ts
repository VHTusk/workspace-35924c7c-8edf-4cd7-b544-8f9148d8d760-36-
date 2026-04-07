/**
 * CANONICAL AUTHENTICATION MODULE FOR VALORHIVE
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  THIS IS THE SINGLE SOURCE OF TRUTH FOR SESSION AUTHENTICATION  ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This module provides the SINGLE SOURCE OF TRUTH for all session
 * validation operations across HTTP API routes and WebSocket services.
 * 
 * For user creation, password management, and ELO calculations, see `auth.ts`.
 * For convenient request helpers, see `auth-request.ts`.
 * 
 * IMPORTANT: All session tokens are stored SHA-256 hashed in the database.
 * This module handles hashing transparently - consumers should NEVER
 * hash tokens before calling these functions.
 * 
 * Supports:
 * - Cookie-based auth (web browsers)
 * - Bearer token auth (mobile apps)
 * - Admin session cookies
 * - Organization session cookies
 * - WebSocket handshake auth
 */

import { NextRequest } from 'next/server';
import { Socket } from 'socket.io';
import { db } from '@/lib/db';
import { Role, SportType } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  sport: SportType;
  isActive: boolean;
}

export interface SessionWithUser {
  id: string;
  token: string;
  userId: string | null;
  orgId: string | null;
  sport: SportType;
  accountType: 'PLAYER' | 'ORG';
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date | null;
  user: SessionUser | null;
}

export interface AdminSessionResult {
  isValid: boolean;
  userId?: string;
  sport?: SportType;
  role?: Role;
  reason?: string;
}

export interface WebSocketAuthResult {
  isValid: boolean;
  userId?: string;
  orgId?: string;
  role?: string;
  reason?: string;
}

// ============================================
// Token Hashing (SHA-256)
// ============================================

/**
 * Hash a token using SHA-256 for secure storage/lookup
 * 
 * Sessions are stored with SHA-256 hashed tokens. This function
 * must be used before any database lookup by token.
 * 
 * @param token - The plaintext session token
 * @returns SHA-256 hex-encoded hash
 */
export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Alias for consistency with auth.ts naming
export const hashToken = hashSessionToken;

// ============================================
// Session Validation
// ============================================

/**
 * Validate a session token by hashing it and looking up in the database
 * 
 * @param token - The plaintext session token (will be hashed internally)
 * @returns Session with user data if valid, null otherwise
 */
export async function validateSessionToken(token: string): Promise<SessionWithUser | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    // CRITICAL: Hash the token before lookup
    const tokenHash = await hashSessionToken(token);
    
    const session = await db.session.findUnique({
      where: { token: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            role: true,
            sport: true,
            isActive: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { token: tokenHash } }).catch(() => {});
      return null;
    }

    // Update last activity atomically (only if more than 5 minutes have passed)
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      void db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }

    return {
      ...session,
      accountType: session.accountType as 'PLAYER' | 'ORG',
      user: session.user ? {
        ...session.user,
        role: session.user.role as Role,
      } : null,
    };
  } catch (error) {
    console.error('[Auth] Session validation error:', error);
    return null;
  }
}

/**
 * Validate an admin session
 * 
 * @param token - The plaintext session token
 * @returns Admin session result with validation status
 */
export async function validateAdminSessionToken(token: string): Promise<AdminSessionResult> {
  try {
    const session = await validateSessionToken(token);
    
    if (!session) {
      return { isValid: false, reason: 'SESSION_NOT_FOUND' };
    }

    if (!session.user) {
      return { isValid: false, reason: 'NOT_USER_SESSION' };
    }

    if (!session.user.isActive) {
      return { isValid: false, reason: 'USER_INACTIVE' };
    }

    // Check admin role
    const adminRoles: Role[] = ['ADMIN', 'SUB_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
      return { 
        isValid: false, 
        reason: 'NOT_ADMIN_ROLE',
        userId: session.user.id,
        sport: session.user.sport,
        role: session.user.role,
      };
    }

    return {
      isValid: true,
      userId: session.user.id,
      sport: session.user.sport,
      role: session.user.role,
    };
  } catch (error) {
    console.error('[Auth] Admin session validation error:', error);
    return { isValid: false, reason: 'VALIDATION_ERROR' };
  }
}

// ============================================
// Token Extraction
// ============================================

/**
 * Extract session token from HTTP request
 * Supports both cookie (web) and Bearer header (mobile)
 * 
 * @param request - NextRequest object
 * @returns Session token if found, null otherwise
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // 1. Check for Bearer token (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 2. Check for custom header set by middleware
  const customToken = request.headers.get('x-session-token');
  if (customToken) {
    return customToken;
  }

  // 3. Check for admin session cookie (takes priority for admin routes)
  const adminToken = request.cookies.get('admin_session')?.value;
  if (adminToken) {
    return adminToken;
  }

  // 4. Fall back to regular session cookie
  const sessionToken = request.cookies.get('session_token')?.value;
  if (sessionToken) {
    return sessionToken;
  }

  // 5. Check for org session cookie
  const orgToken = request.cookies.get('org_session')?.value;
  if (orgToken) {
    return orgToken;
  }

  return null;
}

/**
 * Extract session token from WebSocket handshake
 * 
 * @param socket - Socket.IO socket object
 * @returns Session token if found, null otherwise
 */
export function extractTokenFromSocketHandshake(socket: Socket): string | null {
  // 1. Check auth object (preferred for Socket.IO)
  const authSessionToken = socket.handshake.auth.sessionToken ||
                           socket.handshake.auth.token;
  if (authSessionToken && typeof authSessionToken === 'string') {
    return authSessionToken;
  }

  // 2. Check custom header
  const headerToken = socket.handshake.headers['x-session-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // 3. Check Authorization header
  const authHeader = socket.handshake.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 4. Parse cookie header
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith('session_token=')) {
        return trimmed.split('=')[1];
      }
      if (trimmed.startsWith('admin_session=')) {
        return trimmed.split('=')[1];
      }
      if (trimmed.startsWith('org_session=')) {
        return trimmed.split('=')[1];
      }
    }
  }

  return null;
}

// ============================================
// Convenience Functions for API Routes
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

    const adminRoles: Role[] = ['ADMIN', 'SUB_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('[Auth] getAuthenticatedAdminFromRequest error:', error);
    return null;
  }
}

// ============================================
// Organization Session Validation
// ============================================

export interface SessionOrg {
  id: string;
  name: string;
  type: string;
  sport: SportType;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

export interface SessionWithOrg {
  id: string;
  token: string;
  userId: string | null;
  orgId: string | null;
  sport: SportType;
  accountType: 'PLAYER' | 'ORG';
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date | null;
  org: SessionOrg | null;
}

/**
 * Validate an organization session token
 * 
 * @param token - The plaintext session token (will be hashed internally)
 * @returns Session with org data if valid, null otherwise
 */
export async function validateOrgSessionToken(token: string): Promise<SessionWithOrg | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const tokenHash = await hashSessionToken(token);
    
    const session = await db.session.findUnique({
      where: { token: tokenHash },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            type: true,
            sport: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!session || !session.org) {
      return null;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { token: tokenHash } }).catch(() => {});
      return null;
    }

    // Update last activity atomically (only if more than 5 minutes have passed)
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      void db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }

    return {
      ...session,
      accountType: session.accountType as 'PLAYER' | 'ORG',
      org: {
        ...session.org,
        type: session.org.type as string,
      },
    };
  } catch (error) {
    console.error('[Auth] Org session validation error:', error);
    return null;
  }
}

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

// ============================================
// WebSocket Authentication
// ============================================

/**
 * Validate WebSocket connection
 * 
 * @param socket - Socket.IO socket object
 * @returns WebSocket auth result with user info if valid
 */
export async function validateWebSocketAuth(socket: Socket): Promise<WebSocketAuthResult> {
  try {
    const token = extractTokenFromSocketHandshake(socket);
    
    if (!token) {
      return { isValid: false, reason: 'NO_TOKEN' };
    }

    const session = await validateSessionToken(token);
    
    if (!session) {
      return { isValid: false, reason: 'INVALID_SESSION' };
    }

    return {
      isValid: true,
      userId: session.userId || undefined,
      orgId: session.orgId || undefined,
      role: session.user?.role || 'PLAYER',
    };
  } catch (error) {
    console.error('[Auth] validateWebSocketAuth error:', error);
    return { isValid: false, reason: 'VALIDATION_ERROR' };
  }
}
