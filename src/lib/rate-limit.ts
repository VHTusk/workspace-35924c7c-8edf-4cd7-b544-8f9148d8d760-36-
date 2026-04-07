/**
 * Tiered Rate Limiting System for VALORHIVE
 * 
 * Rate limit tiers:
 * - PUBLIC: 100 requests/minute (for unauthenticated requests)
 * - AUTHENTICATED: 300 requests/minute (for logged-in users)
 * - ORGANIZATION: 500 requests/minute (for org accounts)
 * - ADMIN: 1000 requests/minute (for admin operations)
 * - WEBHOOK: Unlimited with signature verification
 * 
 * Security Note: Admin bypass is gated exclusively on validated server-side sessions.
 * Headers are NEVER trusted for privilege decisions.
 * 
 * This module now uses distributed rate limiting with Redis support.
 * Falls back to in-memory when Redis is not available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, SportType, AuditAction } from '@prisma/client';
import { hashToken } from '@/lib/auth';

// Re-export types and configuration from shared module
export { 
  RATE_LIMITS, 
  ROUTE_RATE_LIMITS, 
  getRateLimitTier 
} from './rate-limit-types';
export type { RateLimitTier, RateLimitResult } from './rate-limit-types';

// Import types and configuration
import { 
  RATE_LIMITS, 
  RateLimitTier, 
  RateLimitResult 
} from './rate-limit-types';

// Import distributed rate limiter
import { 
  getDistributedRateLimiter,
  initializeDistributedRateLimiter,
  DistributedRateLimiter
} from './distributed-rate-limit';

// Re-export distributed rate limiter
export { 
  getDistributedRateLimiter,
  initializeDistributedRateLimiter,
  DistributedRateLimiter
};

// ============================================
// Legacy In-Memory Store (for backward compatibility)
// ============================================

// In-memory store for rate limits (used as fallback in distributed rate limiter)
// Structure: Map<key, { count: number, resetAt: number }>
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000);
}

// ============================================
// Rate Limit Functions
// ============================================

/**
 * Check rate limit for a given key and tier
 * 
 * Uses distributed rate limiter with Redis support (when available).
 * Falls back to in-memory when Redis is not available.
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'PUBLIC'
): RateLimitResult {
  const config = RATE_LIMITS[tier];
  const now = Date.now();
  const key = `${tier}:${identifier}`;

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt < now) {
    // Start new window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: now + config.windowMs,
      limit: config.requests,
    };
  }

  if (current.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      limit: config.requests,
    };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: config.requests - current.count,
    resetAt: current.resetAt,
    limit: config.requests,
  };
}

/**
 * Async version of checkRateLimit using distributed rate limiter
 * 
 * This is the preferred method for production use as it supports Redis.
 */
export async function checkRateLimitAsync(
  identifier: string,
  tier: RateLimitTier = 'PUBLIC'
): Promise<RateLimitResult> {
  const limiter = getDistributedRateLimiter();
  return limiter.check(identifier, tier);
}

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user agent + some randomness
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `ua:${userAgent.slice(0, 50)}`;
}

/**
 * Extract session token from request (cookie or bearer header)
 */
function extractSessionToken(request: NextRequest): string | null {
  // First, check for Bearer token (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // Check for custom header set by middleware (for Bearer tokens)
  const customToken = request.headers.get('x-session-token');
  if (customToken) {
    return customToken;
  }

  // Fall back to cookie (web browsers)
  const cookieToken = request.cookies.get('session_token')?.value || 
                      request.cookies.get('org_session')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Result of admin session validation
 */
export interface AdminSessionValidationResult {
  isValid: boolean;
  userId?: string;
  sport?: SportType;
  reason?: string;
}

/**
 * Validate admin session from database
 * 
 * SECURITY: This function is the ONLY way to verify admin privileges for rate limit bypass.
 * Headers are NEVER trusted for privilege decisions.
 * 
 * @param request - The NextRequest object
 * @returns AdminSessionValidationResult with validation status and user info
 */
export async function validateAdminSession(request: NextRequest): Promise<AdminSessionValidationResult> {
  try {
    // Extract session token from cookie or bearer header
    const token = extractSessionToken(request);
    
    if (!token) {
      return { 
        isValid: false, 
        reason: 'NO_SESSION_TOKEN' 
      };
    }

    // FIX: Hash the token before lookup - sessions are stored with hashed tokens
    // This matches the behavior in lib/auth.ts validateSession()
    const tokenHash = await hashToken(token);

    // Query database to validate session using hashed token
    const session = await db.session.findUnique({
      where: { token: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            sport: true,
            isActive: true,
          },
        },
      },
    });

    // Check if session exists
    if (!session) {
      return { 
        isValid: false, 
        reason: 'SESSION_NOT_FOUND' 
      };
    }

    // Check if session has a user (not an org session)
    if (!session.user) {
      return { 
        isValid: false, 
        reason: 'NOT_USER_SESSION' 
      };
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { token: tokenHash } }).catch(() => {});
      return { 
        isValid: false, 
        reason: 'SESSION_EXPIRED' 
      };
    }

    // Check if user is active
    if (!session.user.isActive) {
      return { 
        isValid: false, 
        reason: 'USER_INACTIVE' 
      };
    }

    // Check if user has ADMIN role
    if (session.user.role !== Role.ADMIN) {
      return { 
        isValid: false, 
        reason: 'NOT_ADMIN_ROLE',
        userId: session.user.id,
        sport: session.user.sport,
      };
    }

    // Update last activity only if more than 5 minutes have passed
    // This reduces database writes from potentially every request to at most once per 5 minutes
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
      db.session.update({
        where: { token: tokenHash },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }

    return {
      isValid: true,
      userId: session.user.id,
      sport: session.user.sport,
    };
  } catch (error) {
    console.error('[Rate Limit] Error validating admin session:', error);
    return { 
      isValid: false, 
      reason: 'VALIDATION_ERROR' 
    };
  }
}

/**
 * Log bypass attempt to AuditLog table
 */
async function logBypassAttempt(
  request: NextRequest,
  validation: AdminSessionValidationResult,
  success: boolean
): Promise<void> {
  try {
    const pathname = request.nextUrl.pathname;
    const method = request.method;
    const ip = getClientIdentifier(request);

    // Only log if we have a user ID (either from successful validation or from failed admin check)
    if (validation.userId) {
      await db.auditLog.create({
        data: {
          sport: validation.sport || SportType.CORNHOLE, // Default sport if not available
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: validation.userId,
          actorRole: Role.ADMIN,
          targetType: 'rate_limit_bypass',
          targetId: 'rate_limit',
          reason: success 
            ? `Rate limit bypass granted for ${method} ${pathname}`
            : `Rate limit bypass denied: ${validation.reason}`,
          metadata: JSON.stringify({
            method,
            pathname,
            ip,
            success,
            reason: validation.reason,
          }),
          ipAddress: ip,
        },
      });
    } else {
      // Log anonymous bypass attempt (potential attack)
      console.warn(`[Rate Limit] Anonymous bypass attempt on ${method} ${pathname} from ${ip}`);
    }
  } catch (error) {
    console.error('[Rate Limit] Failed to log bypass attempt:', error);
  }
}

/**
 * Rate limit middleware wrapper with secure admin bypass
 * 
 * Super Admin Bypass (SECURE):
 * - ADMIN role users can bypass rate limits for emergency operations
 * - Bypass is validated against the DATABASE SESSION, not headers
 * - Headers are NEVER trusted for privilege decisions
 * - All bypass attempts are logged to AuditLog for accountability
 * 
 * Now uses distributed rate limiting with Redis support.
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  tier: RateLimitTier = 'PUBLIC',
  options?: { allowAdminBypass?: boolean }
) {
  return async (request: NextRequest, context?: any) => {
    // Check for admin bypass - SECURE: validate against database session
    if (options?.allowAdminBypass !== false) {
      const validation = await validateAdminSession(request);
      
      if (validation.isValid) {
        // Log successful bypass to audit log
        await logBypassAttempt(request, validation, true);
        
        console.log(`[Rate Limit] Admin bypass granted to user ${validation.userId} for ${request.nextUrl.pathname}`);
        
        // Proceed without rate limit
        const response = await handler(request, context);
        response.headers.set('X-RateLimit-Bypassed', 'true');
        return response;
      } else if (validation.userId && validation.reason === 'NOT_ADMIN_ROLE') {
        // Log failed bypass attempt (user tried but doesn't have admin role)
        await logBypassAttempt(request, validation, false);
      }
    }

    // Use distributed rate limiter
    const identifier = getClientIdentifier(request);
    const result = await checkRateLimitAsync(identifier, tier);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toString(),
    };

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: RATE_LIMITS[tier].message,
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const response = await handler(request, context);

    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// ============================================
// Initialization
// ============================================

// Initialize distributed rate limiter on startup (non-blocking)
if (typeof process !== 'undefined' && process.env.REDIS_URL) {
  initializeDistributedRateLimiter().then((success) => {
    if (success) {
      console.log('[Rate Limit] Initialized with Redis support');
    } else {
      console.log('[Rate Limit] Initialized with in-memory fallback');
    }
  }).catch((error) => {
    console.error('[Rate Limit] Failed to initialize:', error);
  });
}
