/**
 * Unified API Middleware Wrapper for VALORHIVE
 * 
 * This module provides a consistent middleware wrapper for all API routes,
 * ensuring that authorization, rate limiting, CSRF protection, and input validation
 * are applied consistently across both /api/... and /api/v1/... route trees.
 * 
 * @module api-middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitTier,
  RATE_LIMITS,
  RateLimitTier,
  validateAdminSession,
} from '@/lib/rate-limit';
import {
  requiresCsrfProtection,
  isCsrfExempt,
  validateCsrfToken,
} from '@/lib/csrf';
import { validateSession, validateOrgSession } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { addVersionHeaders, extractVersion, API_VERSIONS } from '@/lib/api-versioning';
import { checkContentLength, getSizeLimitForRoute } from '@/lib/request-size-limits';

// ============================================================================
// Types
// ============================================================================

export interface ApiHandlerOptions {
  /** Require authentication (player or org) */
  auth?: boolean;
  /** Require player authentication specifically */
  authPlayer?: boolean;
  /** Require organization authentication specifically */
  authOrg?: boolean;
  /** Require admin authentication */
  authAdmin?: boolean;
  /** Rate limit tier to apply */
  rateLimit?: RateLimitTier;
  /** Enable CSRF protection for state-changing methods */
  csrf?: boolean;
  /** Custom validation function */
  validate?: (request: NextRequest, body: unknown) => Promise<ValidationResult | null>;
  /** Skip rate limiting (for webhooks, health checks, etc.) */
  skipRateLimit?: boolean;
  /** Skip all middleware (dangerous, use with caution) */
  skipAll?: boolean;
  /** Maximum request body size in bytes */
  maxBodySize?: number;
  /** Skip body size check (for special cases like uploads) */
  skipBodySizeCheck?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface AuthContext {
  userId?: string;
  orgId?: string;
  sport?: string;
  role?: string;
  accountType: 'PLAYER' | 'ORG' | 'ADMIN';
}

export interface ApiRequestContext {
  auth: AuthContext | null;
  version: string;
  requestId: string;
}

export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: ApiRequestContext
) => Promise<NextResponse<T>>;

// ============================================================================
// Request ID Generation
// ============================================================================

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Extract session token from request (cookie or Bearer header)
 */
function extractSessionToken(
  request: NextRequest
): { token: string | null; source: 'cookie' | 'bearer' } {
  // First, check for Bearer token (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return { token: parts[1], source: 'bearer' };
    }
  }

  // Check for custom header set by middleware (for Bearer tokens)
  const customToken = request.headers.get('x-session-token');
  if (customToken) {
    return { token: customToken, source: 'bearer' };
  }

  // Fall back to cookies (web browsers)
  const playerToken = request.cookies.get('session_token')?.value;
  if (playerToken) {
    return { token: playerToken, source: 'cookie' };
  }

  const orgToken = request.cookies.get('org_session')?.value;
  if (orgToken) {
    return { token: orgToken, source: 'cookie' };
  }

  return { token: null, source: 'cookie' };
}

/**
 * Validate authentication based on options
 */
async function validateAuth(
  request: NextRequest,
  options: ApiHandlerOptions
): Promise<{ valid: boolean; context: AuthContext | null; error?: string }> {
  const { token } = extractSessionToken(request);

  if (!token) {
    return { valid: false, context: null, error: 'NO_TOKEN' };
  }

  // Check for admin auth
  if (options.authAdmin) {
    const adminValidation = await validateAdminSession(request);
    if (!adminValidation.isValid) {
      return { valid: false, context: null, error: adminValidation.reason };
    }
    return {
      valid: true,
      context: {
        userId: adminValidation.userId,
        sport: adminValidation.sport,
        role: 'ADMIN',
        accountType: 'ADMIN',
      },
    };
  }

  // Check for organization auth specifically
  if (options.authOrg) {
    const session = await validateOrgSession(token);
    if (!session || !session.org) {
      return { valid: false, context: null, error: 'INVALID_ORG_SESSION' };
    }
    return {
      valid: true,
      context: {
        orgId: session.org.id,
        sport: session.sport,
        accountType: 'ORG',
      },
    };
  }

  // Check for player auth specifically
  if (options.authPlayer) {
    const session = await validateSession(token);
    if (!session || !session.user) {
      return { valid: false, context: null, error: 'INVALID_PLAYER_SESSION' };
    }
    return {
      valid: true,
      context: {
        userId: session.user.id,
        sport: session.sport,
        role: session.user.role,
        accountType: 'PLAYER',
      },
    };
  }

  // General auth check (either player or org)
  if (options.auth) {
    // Try player session first
    const playerSession = await validateSession(token);
    if (playerSession && playerSession.user) {
      return {
        valid: true,
        context: {
          userId: playerSession.user.id,
          sport: playerSession.sport,
          role: playerSession.user.role,
          accountType: 'PLAYER',
        },
      };
    }

    // Try org session
    const orgSession = await validateOrgSession(token);
    if (orgSession && orgSession.org) {
      return {
        valid: true,
        context: {
          orgId: orgSession.org.id,
          sport: orgSession.sport,
          accountType: 'ORG',
        },
      };
    }

    return { valid: false, context: null, error: 'INVALID_SESSION' };
  }

  return { valid: true, context: null };
}

// ============================================================================
// Rate Limiting Helper
// ============================================================================

/**
 * Apply rate limiting to request
 */
function applyRateLimit(
  request: NextRequest,
  tier: RateLimitTier
): { allowed: boolean; result: ReturnType<typeof checkRateLimit> } {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(identifier, tier);
  return { allowed: result.allowed, result };
}

// ============================================================================
// Main Middleware Wrapper
// ============================================================================

/**
 * Wrap an API handler with consistent middleware
 * 
 * @example
 * ```ts
 * // In /api/tournaments/route.ts
 * import { withApiHandler } from '@/lib/api-middleware';
 * 
 * export const GET = withApiHandler(
 *   async (request, context) => {
 *     // context.auth contains authenticated user info
 *     // context.version contains API version
 *     // context.requestId for tracing
 *     return apiSuccess({ tournaments: [] });
 *   },
 *   { auth: true, rateLimit: 'AUTHENTICATED' }
 * );
 * ```
 */
export function withApiHandler<T = unknown>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  const {
    auth = false,
    authPlayer = false,
    authOrg = false,
    authAdmin = false,
    rateLimit,
    csrf = true,
    validate,
    skipRateLimit = false,
    skipAll = false,
    maxBodySize,
    skipBodySizeCheck = false,
  } = options;

  return async (request: NextRequest) => {
    const pathname = request.nextUrl.pathname;
    const requestId = generateRequestId();
    const version = extractVersion(request);

    // Skip all middleware if requested (dangerous!)
    if (skipAll) {
      const context: ApiRequestContext = {
        auth: null,
        version,
        requestId,
      };
      return handler(request, context);
    }

    // =====================================================
    // 1. CSRF Protection
    // =====================================================
    if (csrf && requiresCsrfProtection(request.method) && !isCsrfExempt(pathname)) {
      if (!validateCsrfToken(request)) {
        console.warn(`[API] CSRF validation failed for ${pathname} (requestId: ${requestId})`);
        return apiError(
          ApiErrorCodes.FORBIDDEN,
          'CSRF token validation failed. Please refresh and try again.',
          { code: 'CSRF_INVALID' },
          403
        );
      }
    }

    // =====================================================
    // 1.5. Request Body Size Check
    // =====================================================
    if (!skipBodySizeCheck && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const effectiveMaxSize = maxBodySize ?? getSizeLimitForRoute(pathname);
      const sizeCheck = checkContentLength(request, effectiveMaxSize);
      
      if (!sizeCheck.allowed) {
        console.warn(
          `[API] Request body too large for ${pathname}: ${sizeCheck.size} > ${sizeCheck.limit} (requestId: ${requestId})`
        );
        return apiError(
          ApiErrorCodes.VALIDATION_ERROR,
          sizeCheck.error || 'Request body too large',
          {
            size: sizeCheck.size,
            limit: sizeCheck.limit,
          },
          413 // Payload Too Large
        );
      }
    }

    // =====================================================
    // 2. Rate Limiting
    // =====================================================
    const effectiveTier = rateLimit || getRateLimitTier(pathname);

    if (!skipRateLimit) {
      // Check for admin bypass
      if (authAdmin) {
        const adminValidation = await validateAdminSession(request);
        if (adminValidation.isValid) {
          // Admin bypass - log and skip rate limit
          console.log(
            `[API] Admin rate limit bypass for ${adminValidation.userId} on ${pathname} (requestId: ${requestId})`
          );
        } else {
          // Apply rate limit
          const { allowed, result } = applyRateLimit(request, effectiveTier);
          if (!allowed) {
            console.warn(
              `[API] Rate limit exceeded for ${pathname} (requestId: ${requestId})`
            );
            const response = apiError(
              ApiErrorCodes.RATE_LIMITED,
              RATE_LIMITS[effectiveTier].message,
              { retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) },
              429
            );
            response.headers.set('X-RateLimit-Limit', result.limit.toString());
            response.headers.set('X-RateLimit-Remaining', '0');
            response.headers.set('X-RateLimit-Reset', result.resetAt.toString());
            response.headers.set('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
            return response;
          }
        }
      } else {
        // Standard rate limit check
        const { allowed, result } = applyRateLimit(request, effectiveTier);
        if (!allowed) {
          console.warn(
            `[API] Rate limit exceeded for ${pathname} (requestId: ${requestId})`
          );
          const response = apiError(
            ApiErrorCodes.RATE_LIMITED,
            RATE_LIMITS[effectiveTier].message,
            { retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) },
            429
          );
          response.headers.set('X-RateLimit-Limit', result.limit.toString());
          response.headers.set('X-RateLimit-Remaining', '0');
          response.headers.set('X-RateLimit-Reset', result.resetAt.toString());
          response.headers.set('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
          return response;
        }
      }
    }

    // =====================================================
    // 3. Authentication
    // =====================================================
    let authContext: AuthContext | null = null;

    if (auth || authPlayer || authOrg || authAdmin) {
      const authResult = await validateAuth(request, {
        auth,
        authPlayer,
        authOrg,
        authAdmin,
      });

      if (!authResult.valid) {
        console.warn(
          `[API] Auth failed for ${pathname}: ${authResult.error} (requestId: ${requestId})`
        );
        return apiError(
          ApiErrorCodes.UNAUTHORIZED,
          'Authentication required',
          { reason: authResult.error },
          401
        );
      }

      authContext = authResult.context;
    }

    // =====================================================
    // 4. Input Validation
    // =====================================================
    if (validate && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const body = await request.clone().json();
        const validationResult = await validate(request, body);

        if (validationResult && !validationResult.valid) {
          console.warn(
            `[API] Validation failed for ${pathname} (requestId: ${requestId})`
          );
          return apiError(
            ApiErrorCodes.VALIDATION_ERROR,
            'Validation failed',
            { errors: validationResult.errors },
            400
          );
        }
      } catch {
        // No JSON body or validation not applicable
      }
    }

    // =====================================================
    // 5. Execute Handler
    // =====================================================
    const context: ApiRequestContext = {
      auth: authContext,
      version,
      requestId,
    };

    try {
      const response = await handler(request, context);

      // Add standard headers
      addVersionHeaders(response, version as any);
      response.headers.set('X-Request-Id', requestId);

      // Add rate limit headers if not skipped
      if (!skipRateLimit && effectiveTier) {
        const identifier = getClientIdentifier(request);
        const result = checkRateLimit(identifier, effectiveTier);
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetAt.toString());
      }

      return response;
    } catch (error) {
      console.error(
        `[API] Handler error for ${pathname} (requestId: ${requestId}):`,
        error
      );
      return apiError(
        ApiErrorCodes.INTERNAL_ERROR,
        'An internal server error occurred',
        { requestId },
        500
      );
    }
  };
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Create a public API handler (no auth, public rate limit)
 */
export function publicApi<T = unknown>(
  handler: ApiHandler<T>,
  options: Omit<ApiHandlerOptions, 'auth'> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withApiHandler(handler, { ...options, rateLimit: options.rateLimit || 'PUBLIC' });
}

/**
 * Create an authenticated API handler
 */
export function authenticatedApi<T = unknown>(
  handler: ApiHandler<T>,
  options: Omit<ApiHandlerOptions, 'auth'> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withApiHandler(handler, {
    ...options,
    auth: true,
    rateLimit: options.rateLimit || 'AUTHENTICATED',
  });
}

/**
 * Create an admin-only API handler
 */
export function adminApi<T = unknown>(
  handler: ApiHandler<T>,
  options: Omit<ApiHandlerOptions, 'authAdmin'> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withApiHandler(handler, {
    ...options,
    authAdmin: true,
    rateLimit: options.rateLimit || 'ADMIN',
  });
}

/**
 * Create an organization API handler
 */
export function orgApi<T = unknown>(
  handler: ApiHandler<T>,
  options: Omit<ApiHandlerOptions, 'authOrg'> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withApiHandler(handler, {
    ...options,
    authOrg: true,
    rateLimit: options.rateLimit || 'ORGANIZATION',
  });
}

/**
 * Create a webhook API handler (skips rate limit, no CSRF)
 */
export function webhookApi<T = unknown>(
  handler: ApiHandler<T>,
  options: Omit<ApiHandlerOptions, 'skipRateLimit' | 'csrf'> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withApiHandler(handler, {
    ...options,
    skipRateLimit: true,
    csrf: false,
  });
}

// ============================================================================
// Middleware Chain Documentation
// ============================================================================

/**
 * MIDDLEWARE CHAIN DOCUMENTATION
 * 
 * The middleware is applied in the following order:
 * 
 * 1. EXCLUDED ROUTES CHECK
 *    - /_next/*, /static/*, /favicon.ico
 *    - /api/health, /api/v1/health
 * 
 * 2. CSRF PROTECTION (for POST, PUT, DELETE, PATCH)
 *    - Validates X-CSRF-Token header against csrf_token cookie
 *    - Exempt routes: login, register, webhooks, public APIs
 * 
 * 3. REQUEST BODY SIZE CHECK (for POST, PUT, PATCH)
 *    - Checks Content-Length header against route-specific limits
 *    - Default API limit: 100 KB
 *    - Upload limits: 2-10 MB depending on context
 *    - Returns 413 Payload Too Large if exceeded
 * 
 * 4. RATE LIMITING
 *    - Tiers: PUBLIC (100/min), AUTHENTICATED (300/min), 
 *      ORGANIZATION (500/min), ADMIN (1000/min)
 *    - Admin bypass available with database session validation
 *    - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * 
 * 5. AUTHENTICATION
 *    - Session token from cookie (session_token, org_session)
 *    - Or Bearer token from Authorization header
 *    - Validates against database session
 * 
 * 6. INPUT VALIDATION (optional, per-route)
 *    - Custom validation function
 *    - JSON body parsing
 * 
 * ROUTE TREE PARITY:
 * - /api/* routes: Apply standard middleware chain
 * - /api/v1/* routes: Apply same middleware chain with version headers
 * 
 * Both route trees receive:
 * - Rate limiting (same tiers and limits)
 * - CSRF protection (same exempt routes)
 * - Request body size limits
 * - Authentication (same session validation)
 * - Version headers (X-API-Version)
 */

export const MIDDLEWARE_DOCUMENTATION = {
  excludedRoutes: [
    '/_next/',
    '/static/',
    '/favicon.ico',
    '/api/health',
    '/api/v1/health',
  ],
  csrfExemptRoutes: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/org/login',
    '/api/auth/org/register',
    '/api/auth/google',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/payments/webhook',
    '/api/public/',
  ],
  rateLimitTiers: {
    PUBLIC: { requests: 100, windowMs: 60000 },
    AUTHENTICATED: { requests: 300, windowMs: 60000 },
    ORGANIZATION: { requests: 500, windowMs: 60000 },
    ADMIN: { requests: 1000, windowMs: 60000 },
    WEBHOOK: { requests: 10000, windowMs: 60000 },
    LOGIN: { requests: 10, windowMs: 900000 },
    PASSWORD_RESET: { requests: 3, windowMs: 3600000 },
  },
  bodySizeLimits: {
    api: { default: '100 KB', max: '500 KB' },
    upload: { default: '5 MB', profilePhoto: '5 MB', tournamentGallery: '10 MB' },
    auth: { default: '16 KB', login: '4 KB' },
    webhook: { default: '128 KB' },
  },
  routePatterns: {
    '/api/auth/login': { tier: 'LOGIN', csrf: false, auth: false, maxBodySize: '4 KB' },
    '/api/auth/register': { tier: 'PUBLIC', csrf: false, auth: false, maxBodySize: '16 KB' },
    '/api/admin/': { tier: 'ADMIN', csrf: true, auth: true, maxBodySize: '100 KB' },
    '/api/org/': { tier: 'ORGANIZATION', csrf: true, auth: true, maxBodySize: '100 KB' },
    '/api/public/': { tier: 'PUBLIC', csrf: false, auth: false, maxBodySize: '100 KB' },
    '/api/v1/': { tier: 'AUTHENTICATED', csrf: true, auth: false, maxBodySize: '100 KB' },
    '/api/upload': { tier: 'AUTHENTICATED', csrf: true, auth: true, maxBodySize: '5 MB' },
  },
};
