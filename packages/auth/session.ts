/**
 * @valorhive/auth - Session Validation
 * 
 * Session validation functions for VALORHIVE authentication.
 * Handles user sessions, admin sessions, and organization sessions.
 */

import { Socket } from 'socket.io';
import { db } from '@valorhive/db';
import { Role, SportType } from '@prisma/client';
import {
  hashSessionToken,
  extractTokenFromSocketHandshake,
} from './tokens';

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
  orgId: string;
  sport: SportType;
  accountType: 'PLAYER' | 'ORG';
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date | null;
  org: SessionOrg | null;
}

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
      await db.session.delete({ where: { token: tokenHash } }).catch(() => { });
      return null;
    }

    // Update last activity atomically (only if more than 5 minutes have passed)
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      void db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch(() => { });
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
      await db.session.delete({ where: { token: tokenHash } }).catch(() => { });
      return null;
    }

    // Update last activity atomically (only if more than 5 minutes have passed)
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      void db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch(() => { });
    }

    return {
      ...session,
      orgId: session.orgId!,
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
