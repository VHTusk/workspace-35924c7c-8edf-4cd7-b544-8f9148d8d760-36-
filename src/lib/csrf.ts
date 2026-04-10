/**
 * CSRF (Cross-Site Request Forgery) Protection for VALORHIVE
 * 
 * Implements double-submit cookie pattern for CSRF protection.
 * This is suitable for stateless APIs and works well with mobile apps.
 * 
 * Uses Web Crypto API for Edge Runtime compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';

// CSRF token length in bytes (256 bits)
const CSRF_TOKEN_LENGTH = 32;

// Token expiry time (1 hour)
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Routes exempt from CSRF protection
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/org/login',
  '/api/auth/org/register',
  '/api/org/login',
  '/api/auth/google-onetap',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/whatsapp/send-otp',
  '/api/auth/whatsapp/verify-otp',
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
  '/api/auth/captcha',
  '/api/auth/csrf-token', // Endpoint to get/refresh CSRF token
  '/api/payments/webhook', // Webhooks have their own signature verification
  '/api/health',
  '/api/public/', // Public APIs don't need CSRF
  '/api/cron/', // Cron endpoints use Bearer auth from internal service
  '/api/director/login', // Director login uses Bearer auth
  '/api/upload', // File uploads use multipart/form-data
];

/**
 * Generate a cryptographically secure CSRF token
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64url');
}

/**
 * Get CSRF token from request
 * Checks both X-CSRF-Token header and csrf_token cookie
 */
export function getCsrfTokenFromRequest(request: NextRequest): string | null {
  // Check header first
  const headerToken = request.headers.get('X-CSRF-Token');
  if (headerToken) return headerToken;
  
  // Fallback to cookie
  const cookieToken = request.cookies.get('csrf_token')?.value;
  return cookieToken || null;
}

/**
 * Validate CSRF token
 * Compares the token from header against the cookie
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get('X-CSRF-Token');
  const cookieToken = request.cookies.get('csrf_token')?.value;
  
  if (!headerToken || !cookieToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(headerToken, cookieToken);
}

/**
 * Timing-safe string comparison using Node.js crypto
 * Prevents timing attacks when comparing tokens
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Convert strings to buffers
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  
  // If lengths differ, pad to same length to maintain constant time
  // This prevents early-exit timing attacks
  const maxLen = Math.max(aBuffer.length, bBuffer.length);
  
  // Create padded buffers
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuffer.copy(aPadded);
  bBuffer.copy(bPadded);
  
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < maxLen; i++) {
    mismatch |= aPadded[i] ^ bPadded[i];
  }

  return mismatch === 0;
}

/**
 * Check if route is exempt from CSRF protection
 */
export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => pathname === route || pathname.startsWith(route));
}

/**
 * Check if method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  return PROTECTED_METHODS.includes(method.toUpperCase());
}

/**
 * CSRF middleware wrapper
 * Use this to wrap API handlers that need CSRF protection
 */
export function withCsrfProtection(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const pathname = request.nextUrl.pathname;
    
    // Skip CSRF for exempt routes
    if (isCsrfExempt(pathname)) {
      return handler(request, context);
    }
    
    // Only check CSRF for state-changing methods
    if (!requiresCsrfProtection(request.method)) {
      return handler(request, context);
    }
    
    // Validate CSRF token
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { 
          error: 'CSRF token validation failed', 
          code: 'CSRF_INVALID' 
        },
        { status: 403 }
      );
    }
    
    return handler(request, context);
  };
}

/**
 * Generate and set CSRF token cookie
 * Call this on authenticated pages that need CSRF protection
 * 
 * NOTE: httpOnly is set to false because the double-submit cookie pattern
 * requires client-side JavaScript to read the cookie and send it as a header.
 * This is safe because:
 * 1. The token is a random value with no sensitive data
 * 2. The token is validated against the same value sent in the header
 * 3. sameSite: 'strict' prevents CSRF from other sites
 */
export function setCsrfCookie(response: NextResponse): string {
  const token = generateCsrfToken();
  
  response.cookies.set('csrf_token', token, {
    httpOnly: false, // Required for double-submit pattern - JS needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000, // Convert to seconds
    path: '/',
  });
  
  return token;
}

/**
 * Get CSRF token for client-side use
 * Returns the token from cookie for double-submit pattern
 */
export function getCsrfTokenForClient(request: NextRequest): string | null {
  return request.cookies.get('csrf_token')?.value || null;
}
