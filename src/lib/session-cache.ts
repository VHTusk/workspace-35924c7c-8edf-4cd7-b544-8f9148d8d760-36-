/**
 * Redis Session Cache Layer for VALORHIVE
 * 
 * Provides session caching on top of database sessions:
 * - Reduces database lookups for frequently accessed sessions
 * - Short TTL (5 minutes) with automatic refresh
 * - Automatic invalidation on logout/session update
 * - Graceful fallback when Redis unavailable
 * 
 * Flow:
 * 1. Check Redis cache first
 * 2. If cache miss, query database
 * 3. Cache the result for future requests
 * 4. Invalidate on changes
 */

import { SportType, AccountType, User, Organization, Session } from '@prisma/client';
import { CacheService, CACHE_TTL, CACHE_KEYS } from './cache';

// ============================================
// Types and Interfaces
// ============================================

export interface CachedSession {
  id: string;
  userId: string | null;
  orgId?: string | null;
  sport: SportType;
  accountType: AccountType;
  token: string; // Hashed token for verification
  expiresAt: string;
  createdAt: string;
  lastActivityAt?: string | null;
}

export interface CachedUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  sport: SportType;
  city: string | null;
  district: string | null;
  state: string | null;
  verified: boolean;
  hiddenElo: number;
  visiblePoints: number;
  referralCode: string | null;
  accountTier: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedOrg {
  id: string;
  name: string;
  type: string;
  planTier: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pinCode: string | null;
  sport: SportType;
  createdAt: string;
  updatedAt: string;
}

export interface CachedSessionWithUser {
  session: CachedSession;
  user: CachedUser;
}

export interface CachedSessionWithOrg {
  session: CachedSession;
  org: CachedOrg;
}

// ============================================
// Session Cache TTL
// ============================================

// Sessions are cached for 5 minutes with refresh on activity
const SESSION_CACHE_TTL = 300; // 5 minutes

// ============================================
// Cache Key Generation
// ============================================

/**
 * Generate session cache key from hashed token
 */
function getSessionCacheKey(tokenHash: string): string {
  return `${CACHE_KEYS.LEADERBOARD}:session:${tokenHash}`;
}

/**
 * Generate user data cache key
 */
function getUserCacheKey(userId: string, sport: SportType): string {
  return `${CACHE_KEYS.LEADERBOARD}:user:${sport}:${userId}`;
}

/**
 * Generate org data cache key
 */
function getOrgCacheKey(orgId: string, sport: SportType): string {
  return `${CACHE_KEYS.LEADERBOARD}:org:${sport}:${orgId}`;
}

// ============================================
// Session Cache Service
// ============================================

class SessionCacheService extends CacheService {
  constructor() {
    super('session');
  }

  /**
   * Get cached session with user data
   */
  async getSessionWithUser(tokenHash: string): Promise<CachedSessionWithUser | null> {
    const key = getSessionCacheKey(tokenHash);
    return this.get<CachedSessionWithUser>(key);
  }

  /**
   * Cache session with user data
   */
  async setSessionWithUser(
    tokenHash: string,
    data: CachedSessionWithUser
  ): Promise<void> {
    const key = getSessionCacheKey(tokenHash);
    await this.set(key, data, SESSION_CACHE_TTL);
  }

  /**
   * Get cached session with org data
   */
  async getSessionWithOrg(tokenHash: string): Promise<CachedSessionWithOrg | null> {
    const key = getSessionCacheKey(tokenHash);
    return this.get<CachedSessionWithOrg>(key);
  }

  /**
   * Cache session with org data
   */
  async setSessionWithOrg(
    tokenHash: string,
    data: CachedSessionWithOrg
  ): Promise<void> {
    const key = getSessionCacheKey(tokenHash);
    await this.set(key, data, SESSION_CACHE_TTL);
  }

  /**
   * Invalidate session cache
   */
  async invalidateSession(tokenHash: string): Promise<void> {
    const key = getSessionCacheKey(tokenHash);
    await this.delete(key);
  }

  /**
   * Refresh session TTL (extend on activity)
   */
  async refreshSession(tokenHash: string): Promise<boolean> {
    const key = getSessionCacheKey(tokenHash);
    return this.refreshTTL(key, SESSION_CACHE_TTL);
  }

  /**
   * Invalidate all sessions for a user
   * Used when user data changes or password is updated
   */
  async invalidateUserSessions(userId: string, sport: SportType): Promise<void> {
    // Delete user cache
    await this.delete(getUserCacheKey(userId, sport));
    
    // Note: We can't easily invalidate all sessions for a user without
    // tracking session tokens. For now, sessions will naturally expire.
    // In a more complex setup, we'd maintain a user->sessions mapping.
  }

  /**
   * Invalidate all sessions for an organization
   */
  async invalidateOrgSessions(orgId: string, sport: SportType): Promise<void> {
    await this.delete(getOrgCacheKey(orgId, sport));
  }
}

// ============================================
// Export singleton instance
// ============================================

export const sessionCache = new SessionCacheService();

// ============================================
// Helper functions for integration with auth.ts
// ============================================

/**
 * Serialize Prisma session for caching
 * Removes non-serializable fields and converts dates to strings
 */
export function serializeSessionForCache(
  session: Pick<Session, 'id' | 'userId' | 'orgId' | 'sport' | 'accountType' | 'token' | 'expiresAt' | 'createdAt' | 'lastActivityAt'>
): CachedSession {
  return {
    id: session.id,
    userId: session.userId,
    orgId: session.orgId ?? undefined,
    sport: session.sport,
    accountType: session.accountType,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt?.toISOString() || null,
  };
}

/**
 * Serialize Prisma user for caching
 */
export function serializeUserForCache(
  user: Pick<User, 'id' | 'email' | 'phone' | 'firstName' | 'lastName' | 'role' | 'sport' | 'city' | 'district' | 'state' | 'verified' | 'hiddenElo' | 'visiblePoints' | 'referralCode' | 'accountTier' | 'createdAt' | 'updatedAt'>
): CachedUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    sport: user.sport,
    city: user.city,
    district: user.district,
    state: user.state,
    verified: user.verified,
    hiddenElo: user.hiddenElo,
    visiblePoints: user.visiblePoints,
    referralCode: user.referralCode,
    accountTier: user.accountTier,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Serialize Prisma organization for caching
 */
export function serializeOrgForCache(
  org: Pick<Organization, 'id' | 'name' | 'type' | 'planTier' | 'email' | 'phone' | 'city' | 'district' | 'state' | 'pinCode' | 'sport' | 'createdAt' | 'updatedAt'>
): CachedOrg {
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    planTier: org.planTier,
    email: org.email,
    phone: org.phone,
    city: org.city,
    district: org.district,
    state: org.state,
    pinCode: org.pinCode,
    sport: org.sport,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

/**
 * Deserialize cached session back to expected format
 */
export function deserializeCachedSession(
  cached: CachedSession
): Omit<CachedSession, 'expiresAt' | 'createdAt' | 'lastActivityAt'> & {
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date | null;
} {
  return {
    ...cached,
    expiresAt: new Date(cached.expiresAt),
    createdAt: new Date(cached.createdAt),
    lastActivityAt: cached.lastActivityAt ? new Date(cached.lastActivityAt) : null,
  };
}

/**
 * Deserialize cached user back to expected format
 */
export function deserializeCachedUser(
  cached: CachedUser
): Omit<CachedUser, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date } {
  return {
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}

/**
 * Deserialize cached org back to expected format
 */
export function deserializeCachedOrg(
  cached: CachedOrg
): Omit<CachedOrg, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date } {
  return {
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}
