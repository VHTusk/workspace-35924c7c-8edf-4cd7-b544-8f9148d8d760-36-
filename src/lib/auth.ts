// Authentication utilities for VALORHIVE
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  SportType,
  Role,
  AccountType,
  AccountType as AccountTypeEnum,
  ReferralType,
  UserSportEnrollmentSource,
} from '@prisma/client';
import { NextRequest } from 'next/server';
import { ensureUserSportEnrollment } from '@/lib/user-sport';
import { toNameCase } from '@/lib/name-format';

// Type for ReadonlyRequestCookies (from next/headers)
type ReadonlyRequestCookies = {
  get(name: string): { name: string; value: string } | undefined;
  [Symbol.iterator](): Iterator<{ name: string; value: string }>;
};

const SALT_ROUNDS = 12;

// Password validation rules (per spec section 3.4)
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128, // FIX: Added max length to prevent CPU exhaustion attacks
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password against security requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  
  // FIX: Check max length to prevent CPU exhaustion (PBKDF2 on megabytes)
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be at most ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (
    PASSWORD_REQUIREMENTS.requireSpecialChar &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)
  ) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Use Web Crypto API for password hashing (works without external dependencies)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate a salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash
  const combined = new Uint8Array(salt.length + derivedBits.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), salt.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Decode the stored hash
    const combined = new Uint8Array(
      atob(hashedPassword).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract salt and stored hash
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // Import password as key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive bits using same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    
    // Constant-time comparison to prevent timing attacks
    // XOR all bytes together - result will be 0 only if all bytes match
    const newHash = new Uint8Array(derivedBits);
    
    // If lengths differ, still do a comparison to maintain constant time
    // Use the stored hash length as the comparison basis
    const result = new Uint8Array(storedHash.length);
    for (let i = 0; i < storedHash.length; i++) {
      // XOR with corresponding byte from newHash (or 0 if newHash is shorter)
      result[i] = storedHash[i] ^ (newHash[i] ?? 0);
    }
    
    // Check if all XOR results are 0 (meaning hashes match)
    // AND check if lengths match (for proper validation)
    let allZero = 0;
    for (let i = 0; i < result.length; i++) {
      allZero |= result[i];
    }
    
    // Return true only if all bytes matched AND lengths are equal
    return allZero === 0 && newHash.length === storedHash.length;
  } catch {
    return false;
  }
}

export async function createUser(data: {
  email?: string;
  phone?: string;
  password?: string;
  firstName: string;
  lastName: string;
  sport: SportType;
  city?: string;
  district?: string;
  state?: string;
  referredByCode?: string; // Optional referral code from another user
}) {
  const normalizedFirstName = toNameCase(data.firstName);
  const normalizedLastName = toNameCase(data.lastName);
  const hashedPassword = data.password ? await hashPassword(data.password) : null;
  
  // Generate unique referral code
  let referralCode = generateReferralCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.user.findUnique({
      where: { referralCode },
    });
    if (!existing) break;
    referralCode = generateReferralCode();
    attempts++;
  }
  
  // Check if referred by someone
  let referrerId: string | undefined;
  if (data.referredByCode) {
    const referrer = await db.user.findUnique({
      where: { referralCode: data.referredByCode },
    });
    if (referrer) {
      referrerId = referrer.id;
    }
  }
  
  // Wrap all operations in a transaction for data consistency
  const result = await db.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        sport: data.sport,
        city: data.city,
        district: data.district,
        state: data.state,
        role: Role.PLAYER,
        referralCode,
        // accountTier defaults to FAN in schema
        verified: data.phone ? true : false, // Auto-verify phone OTP users
      },
    });

    // Create initial player rating
    await tx.playerRating.create({
      data: {
        userId: user.id,
        sport: data.sport,
      },
    });

    await ensureUserSportEnrollment(
      tx,
      user.id,
      data.sport,
      UserSportEnrollmentSource.ACCOUNT_REGISTRATION,
    );

    // Create notification preferences
    await tx.notificationPreference.create({
      data: {
        userId: user.id,
      },
    });
    
    // Track referral if applicable
    if (referrerId) {
      await tx.referral.create({
        data: {
          referrerId,
          refereeId: user.id,
          sport: data.sport,
          referralType: ReferralType.SPORT_SPECIFIC,
          code: data.referredByCode!,
        },
      });
    }

    return user;
  });

  return result;
}

/**
 * Generate a unique referral code for a user
 * Format: VH-{8 alphanumeric characters}
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map(b => chars[b % chars.length])
    .join('');
  return `VH-${code}`;
}

/**
 * Generate a cryptographically secure session token
 * Uses Web Crypto API (works in Edge Runtime)
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a token using SHA-256 for secure storage
 * Prevents session hijacking if database is compromised
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(userId: string, sport: SportType) {
  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await db.session.create({
    data: {
      token: tokenHash, // Store hash, not plaintext
      userId,
      sport,
      accountType: AccountType.PLAYER,
      expiresAt,
    },
  });

  // Return the plaintext token (only time it's available)
  return { ...session, token };
}

export async function validateSession(token: string) {
  const tokenHash = await hashToken(token);
  
  const session = await db.session.findUnique({
    where: { token: tokenHash },
    include: {
      user: true,
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { token: tokenHash } });
    return null;
  }

  // Update last activity atomically - only if more than 5 minutes have passed
  // This prevents race conditions where multiple requests all try to update simultaneously
  // The WHERE clause ensures only one update succeeds even with concurrent requests
  const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
  void db.$executeRaw`
    UPDATE Session 
    SET lastActivityAt = ${new Date()} 
    WHERE token = ${tokenHash} 
    AND (lastActivityAt IS NULL OR lastActivityAt < ${FIVE_MINUTES_AGO})
  `.catch((err) => {
    // Log but don't fail - this is a non-critical update
    if (process.env.NODE_ENV === 'development') {
      console.error('[Session] Failed to update lastActivityAt:', err.message);
    }
  });

  return session;
}

export async function deleteSession(token: string) {
  try {
    const tokenHash = await hashToken(token);
    await db.session.delete({ where: { token: tokenHash } });
  } catch {
    // Session might not exist
  }
}

// Organization session management
export async function createOrgSession(orgId: string, sport: SportType) {
  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await db.session.create({
    data: {
      token: tokenHash, // Store hash, not plaintext
      orgId,
      sport,
      accountType: AccountType.ORG,
      expiresAt,
    },
  });

  // Return the plaintext token (only time it's available)
  return { ...session, token };
}

export async function validateOrgSession(token: string) {
  const tokenHash = await hashToken(token);
  
  const session = await db.session.findUnique({
    where: { token: tokenHash },
    include: {
      org: {
        include: {
          subscription: true,
        },
      },
    },
  });

  if (!session || !session.org) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { token: tokenHash } });
    return null;
  }

  // Update last activity atomically - only if more than 5 minutes have passed
  // This prevents race conditions where multiple requests all try to update simultaneously
  const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
  db.$executeRaw`
    UPDATE Session 
    SET lastActivityAt = ${new Date()} 
    WHERE token = ${tokenHash} 
    AND (lastActivityAt IS NULL OR lastActivityAt < ${FIVE_MINUTES_AGO})
  `.catch((err) => {
    // Log but don't fail - this is a non-critical update
    if (process.env.NODE_ENV === 'development') {
      console.error('[OrgSession] Failed to update lastActivityAt:', err.message);
    }
  });

  return session;
}

// Create organization
export async function createOrganization(data: {
  name: string;
  type?: string;
  email?: string;
  phone?: string;
  password: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  sport: SportType;
  tosAccepted?: boolean;
  privacyAccepted?: boolean;
}) {
  const normalizedName = toNameCase(data.name);
  const hashedPassword = await hashPassword(data.password);

  // Wrap organization and subscription creation in a transaction
  const org = await db.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: normalizedName,
        type: (data.type || 'CLUB') as 'CLUB' | 'SCHOOL' | 'CORPORATE' | 'ACADEMY',
        email: data.email || undefined,
        phone: data.phone || undefined,
        password: hashedPassword,
        city: data.city || undefined,
        district: data.district || undefined,
        state: data.state || undefined,
        pinCode: data.pinCode || undefined,
        sport: data.sport,
        tosAcceptedAt: data.tosAccepted ? new Date() : undefined,
        privacyAcceptedAt: data.privacyAccepted ? new Date() : undefined,
      },
    });

    // Create default subscription (trial period)
    await tx.orgSubscription.create({
      data: {
        orgId: newOrg.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
        amount: 0,
      },
    });

    return newOrg;
  });

  return org;
}

export async function getUserByEmail(email: string, sport: SportType) {
  return db.user.findUnique({
    where: {
      email_sport: { email, sport },
    },
  });
}

export async function getUserByPhone(phone: string, sport: SportType) {
  return db.user.findUnique({
    where: {
      phone_sport: { phone, sport },
    },
  });
}

export function getEloTier(elo: number, matchCount: number): string {
  if (matchCount < 30) return 'UNRANKED';
  if (elo >= 1900) return 'DIAMOND';
  if (elo >= 1700) return 'PLATINUM';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1300) return 'SILVER';
  return 'BRONZE';
}

export function calculateEloChange(
  eloA: number,
  eloB: number,
  actualA: number,
  matchCountA: number,
  matchCountB: number
): { eloChangeA: number; eloChangeB: number } {
  // K-factor based on match count
  let K = 32;
  if (matchCountA >= 100 || matchCountB >= 100) K = 16;
  else if (matchCountA >= 30 || matchCountB >= 30) K = 24;

  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const eloChangeA = Math.round(K * (actualA - expectedA));

  return {
    eloChangeA,
    eloChangeB: -eloChangeA,
  };
}

/**
 * Extract session token from request (cookie or Bearer header)
 * Supports both web browsers (cookies) and mobile apps (Bearer token)
 * 
 * @param requestOrCookies - NextRequest object or cookie store
 * @returns Session token if found, null otherwise
 */
export function extractSessionToken(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): string | null {
  // Check for Bearer token (mobile apps) - only if it's a NextRequest
  if ('headers' in requestOrCookies) {
    const authHeader = requestOrCookies.headers.get('authorization');
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }

    // Check for custom header set by middleware (for Bearer tokens)
    const customToken = requestOrCookies.headers.get('x-session-token');
    if (customToken) {
      return customToken;
    }
  }

  // Fall back to cookies (web browsers)
  if ('cookies' in requestOrCookies) {
    // It's a NextRequest
    const token = requestOrCookies.cookies.get('session_token')?.value;
    if (token) return token;
  } else {
    // It's a cookie store
    const token = requestOrCookies.get('session_token')?.value;
    if (token) return token;
  }

  return null;
}

/**
 * Get authenticated user from request cookies
 * This is the SINGLE SOURCE OF TRUTH for user authentication in API routes.
 * Always use this helper instead of direct session lookup.
 * 
 * @param request - NextRequest object or cookie store
 * @returns User object if authenticated, null otherwise
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedUser(cookieStore: ReadonlyRequestCookies): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedUser(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null> {
  try {
    const token = extractSessionToken(requestOrCookies);

    if (!token) {
      return null;
    }

    // Always hash the token before lookup - NEVER store or lookup raw tokens
    const session = await validateSession(token);

    if (!session?.user) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('getAuthenticatedUser error:', error);
    return null;
  }
}

/**
 * Get authenticated organization from request cookies
 * This is the SINGLE SOURCE OF TRUTH for org authentication in API routes.
 * 
 * @param request - NextRequest object or cookie store
 * @returns Organization object if authenticated, null otherwise
 */
export async function getAuthenticatedOrg(request: NextRequest): Promise<{
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null>;

export async function getAuthenticatedOrg(cookieStore: ReadonlyRequestCookies): Promise<{
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null>;

export async function getAuthenticatedOrg(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): Promise<{
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null> {
  try {
    const token = extractSessionToken(requestOrCookies);

    if (!token) {
      return null;
    }

    // Always hash the token before lookup - NEVER store or lookup raw tokens
    const session = await validateOrgSession(token);

    if (!session?.org) {
      return null;
    }

    return { org: session.org, session };
  } catch (error) {
    console.error('getAuthenticatedOrg error:', error);
    return null;
  }
}

/**
 * Extract admin session token from request (cookie or Bearer header)
 * Checks admin_session cookie first, then falls back to standard session_token
 * 
 * @param requestOrCookies - NextRequest object or cookie store
 * @returns Session token if found, null otherwise
 */
export function extractAdminToken(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): string | null {
  // Check for Bearer token (mobile apps) - only if it's a NextRequest
  if ('headers' in requestOrCookies) {
    const authHeader = requestOrCookies.headers.get('authorization');
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }

    // Check for custom header set by middleware (for Bearer tokens)
    const customToken = requestOrCookies.headers.get('x-session-token');
    if (customToken) {
      return customToken;
    }

    // Check admin_session cookie first
    const adminToken = requestOrCookies.cookies.get('admin_session')?.value;
    if (adminToken) return adminToken;

    // Fall back to session_token
    const sessionToken = requestOrCookies.cookies.get('session_token')?.value;
    if (sessionToken) return sessionToken;
  } else {
    // It's a cookie store
    const adminToken = requestOrCookies.get('admin_session')?.value;
    if (adminToken) return adminToken;

    const sessionToken = requestOrCookies.get('session_token')?.value;
    if (sessionToken) return sessionToken;
  }

  return null;
}

/**
 * Get authenticated admin from request cookies
 * This handles the admin_session cookie for admin panel routes.
 * 
 * @param request - NextRequest object or cookie store
 * @returns User object if authenticated as admin, null otherwise
 */
export async function getAuthenticatedAdmin(request: NextRequest): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedAdmin(cookieStore: ReadonlyRequestCookies): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedAdmin(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null> {
  try {
    const token = extractAdminToken(requestOrCookies);

    if (!token) {
      return null;
    }

    // Always hash the token before lookup - NEVER store or lookup raw tokens
    const session = await validateSession(token);

    if (!session?.user) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('getAuthenticatedAdmin error:', error);
    return null;
  }
}

/**
 * Get authenticated director from request cookies
 * This handles both session_token and admin_session cookies for director routes.
 * Tries user session first, then falls back to admin session.
 * 
 * @param request - NextRequest object or cookie store
 * @returns User object if authenticated, null otherwise
 */
export async function getAuthenticatedDirector(request: NextRequest): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedDirector(cookieStore: ReadonlyRequestCookies): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null>;

export async function getAuthenticatedDirector(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): Promise<{
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | null> {
  try {
    // Use extractAdminToken which checks admin_session first, then session_token
    const token = extractAdminToken(requestOrCookies);

    if (!token) {
      return null;
    }

    // Always hash the token before lookup - NEVER store or lookup raw tokens
    const session = await validateSession(token);

    if (!session?.user) {
      return null;
    }

    return { user: session.user, session };
  } catch (error) {
    console.error('getAuthenticatedDirector error:', error);
    return null;
  }
}

/**
 * Get either authenticated user or organization (for routes that support both)
 * 
 * @param request - NextRequest object or cookie store
 * @returns User or Organization if authenticated, null otherwise
 */
export async function getAuthenticatedEntity(request: NextRequest): Promise<{
  type: 'user';
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | {
  type: 'org';
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null>;

export async function getAuthenticatedEntity(cookieStore: ReadonlyRequestCookies): Promise<{
  type: 'user';
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | {
  type: 'org';
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null>;

export async function getAuthenticatedEntity(
  requestOrCookies: NextRequest | ReadonlyRequestCookies
): Promise<{
  type: 'user';
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof validateSession>>>['user']>;
  session: NonNullable<Awaited<ReturnType<typeof validateSession>>>;
} | {
  type: 'org';
  org: NonNullable<NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>['org']>;
  session: NonNullable<Awaited<ReturnType<typeof validateOrgSession>>>;
} | null> {
  // Try user session first
  const userResult = await getAuthenticatedUser(requestOrCookies as any);
  if (userResult) {
    return { type: 'user', ...userResult };
  }

  // Try org session
  const orgResult = await getAuthenticatedOrg(requestOrCookies as any);
  if (orgResult) {
    return { type: 'org', ...orgResult };
  }

  return null;
}

// Type for ReadonlyRequestCookies is defined at the top of the file

export { hashPassword, verifyPassword };

// ============================================
// BACKWARD COMPATIBILITY ALIASES
// These aliases support legacy code that uses different naming
// ============================================

/**
 * @deprecated Use getAuthenticatedAdmin instead
 * Legacy alias - wraps getAuthenticatedAdmin
 */
export async function validateAdminSession(requestOrCookies?: NextRequest | ReadonlyRequestCookies) {
  if (!requestOrCookies) {
    console.warn('validateAdminSession called without request');
    return null;
  }
  return getAuthenticatedAdmin(requestOrCookies as any);
}

/**
 * @deprecated Use getAuthenticatedUser instead
 * Legacy alias - wraps getAuthenticatedUser
 */
export async function verifyAuth(requestOrCookies: NextRequest | ReadonlyRequestCookies) {
  const userResult = await getAuthenticatedUser(requestOrCookies as any);
  if (userResult) {
    return { user: userResult.user, session: userResult.session };
  }
  
  const orgResult = await getAuthenticatedOrg(requestOrCookies as any);
  if (orgResult) {
    return { org: orgResult.org, session: orgResult.session };
  }
  
  return null;
}

/**
 * @deprecated Use extractSessionToken instead
 * Legacy alias - extracts token from headers
 */
export function getTokenFromHeaders(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }
  return null;
}

/**
 * @deprecated Use validateSession instead
 * Legacy alias - validates a player session token
 */
export async function validatePlayerSession(token: string) {
  return validateSession(token);
}

/**
 * @deprecated Use getAuthenticatedUser instead
 * Legacy alias - gets session from request/cookies
 */
export async function getSession(requestOrCookies?: NextRequest | ReadonlyRequestCookies) {
  if (!requestOrCookies) {
    console.warn('getSession called without request - use getAuthenticatedUser instead');
    return null;
  }
  const result = await getAuthenticatedUser(requestOrCookies as any);
  return result?.session || null;
}

/**
 * Convert a spectator (FAN tier) account to a full player account
 * This allows spectators to register for tournaments
 * 
 * @param userId - The user ID to convert
 * @returns Success status and optional error message
 */
export async function convertSpectatorToFull(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Update user account tier from FAN to PLAYER
    const user = await db.user.update({
      where: { id: userId },
      data: {
        accountTier: 'PLAYER' as any, // AccountTier.PLAYER
      },
      select: {
        id: true,
        accountTier: true,
      },
    });

    // Ensure player rating exists (might not exist for spectators)
    const existingRating = await db.playerRating.findUnique({
      where: { userId: userId },
    });

    if (!existingRating) {
      // Get user's sport to create rating
      const fullUser = await db.user.findUnique({
        where: { id: userId },
        select: { sport: true },
      });

      if (fullUser) {
        await db.playerRating.create({
          data: {
            userId: userId,
            sport: fullUser.sport,
          },
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[Auth] Error converting spectator to full:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to upgrade account' 
    };
  }
}
