/**
 * Rate Limit Types and Configuration for VALORHIVE
 * 
 * Shared types and configuration for both in-memory and distributed rate limiting.
 * 
 * Production Scaling (v3.80.0):
 * - Stricter limits for sensitive endpoints to prevent abuse
 * - Endpoint-specific limits aligned with production tournament systems
 * - Protects against: database exhaustion, duplicate submissions, brute force
 */

// Rate limit configuration by tier
// Production-tested limits for tournament platforms
export const RATE_LIMITS = {
  // Public endpoints - general browsing
  PUBLIC: {
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests. Please try again later.',
  },
  
  // Authenticated users - normal usage
  AUTHENTICATED: {
    requests: 300,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please slow down.',
  },
  
  // Organization accounts - higher throughput
  ORGANIZATION: {
    requests: 500,
    windowMs: 60 * 1000,
    message: 'Organization rate limit exceeded.',
  },
  
  // Admin operations - highest limit
  ADMIN: {
    requests: 1000,
    windowMs: 60 * 1000,
    message: 'Admin rate limit exceeded.',
  },
  
  // Webhook endpoints - high limit with signature verification
  WEBHOOK: {
    requests: 10000,
    windowMs: 60 * 1000,
    message: 'Webhook rate limit exceeded.',
  },
  
  // ============================================
  // PRODUCTION SCALING: Endpoint-Specific Limits
  // ============================================
  
  // Login - Prevent brute force attacks
  // Production systems: 5 attempts per minute
  LOGIN: {
    requests: 5,
    windowMs: 60 * 1000, // 1 minute (was 15 min)
    message: 'Too many login attempts. Please wait a minute and try again.',
  },
  
  // Registration - Prevent spam accounts
  // Production systems: 5 per minute per IP
  REGISTER: {
    requests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many registration attempts. Please try again later.',
  },
  
  // Tournament Registration - Prevent double-registration spam
  // Production systems: 10 per minute (allows for retries on payment failure)
  TOURNAMENT_JOIN: {
    requests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many tournament registration attempts. Please wait before trying again.',
  },
  
  // Match Score Submission - Prevent duplicate submissions
  // Production systems: 10 per minute per admin
  MATCH_SCORE: {
    requests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many score submissions. Please verify scores carefully.',
  },
  
  // Password Reset - Prevent abuse
  PASSWORD_RESET: {
    requests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many password reset attempts. Please try again later.',
  },
  
  // OTP Sending - Prevent SMS abuse
  OTP_SEND: {
    requests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many OTP requests. Please wait before requesting another.',
  },
  
  // Bracket Generation - Heavy operation
  BRACKET_GENERATE: {
    requests: 3,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many bracket generation requests. Please wait.',
  },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// Route-specific rate limit configurations
// Production Scaling (v3.80.0): More granular endpoint protection
export const ROUTE_RATE_LIMITS: Record<string, RateLimitTier> = {
  // ============================================
  // Authentication Routes - Critical Protection
  // ============================================
  '/api/auth/login': 'LOGIN',
  '/api/auth/register': 'REGISTER',
  '/api/auth/reset-password': 'PASSWORD_RESET',
  '/api/auth/send-otp': 'OTP_SEND',
  '/api/auth/verify-otp': 'OTP_SEND',
  '/api/auth/google': 'LOGIN',
  '/api/auth/google/callback': 'LOGIN',
  '/api/director/login': 'LOGIN',
  '/api/admin/auth/login': 'LOGIN',
  '/api/auth/org/login': 'LOGIN',
  
  // ============================================
  // Tournament Routes - Prevent Spam
  // ============================================
  '/api/tournaments/register': 'TOURNAMENT_JOIN',
  '/api/tournaments/team-register': 'TOURNAMENT_JOIN',
  '/api/tournaments/bracket/generate': 'BRACKET_GENERATE',
  '/api/tournaments/checkin': 'TOURNAMENT_JOIN',
  
  // ============================================
  // Match Routes - Prevent Duplicate Submissions
  // ============================================
  '/api/matches/score': 'MATCH_SCORE',
  '/api/admin/matches/result': 'MATCH_SCORE',
  
  // ============================================
  // Webhook - High limit with signature verification
  // ============================================
  '/api/payments/webhook': 'WEBHOOK',

  // ============================================
  // Public Routes - General Browsing
  // ============================================
  '/api/public/': 'PUBLIC',
  '/api/health': 'PUBLIC',
  '/api/v1/': 'PUBLIC',
  
  // ============================================
  // Admin Routes - High Limit
  // ============================================
  '/api/admin/': 'ADMIN',

  // ============================================
  // Organization Routes - Higher Throughput
  // ============================================
  '/api/org/': 'ORGANIZATION',

  // ============================================
  // Default for Authenticated Routes
  // ============================================
  '/api/': 'AUTHENTICATED',
};

/**
 * Determine rate limit tier for a route
 */
export function getRateLimitTier(pathname: string): RateLimitTier {
  // Check specific routes first
  for (const [route, tier] of Object.entries(ROUTE_RATE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return tier;
    }
  }

  // Default to public
  return 'PUBLIC';
}
