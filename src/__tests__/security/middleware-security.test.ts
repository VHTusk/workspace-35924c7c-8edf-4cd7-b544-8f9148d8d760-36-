/**
 * Middleware Security Tests
 *
 * Tests for:
 * - W3C Traceparent parsing and generation
 * - Rate limit tier assignment
 * - CSRF route parity between /api/* and /api/v1/*
 * - Request ID generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Test Helpers - Mirroring middleware.ts logic
// ============================================

/**
 * Generate a random hex string for trace IDs (32 hex chars = 16 bytes)
 * Uses Web Crypto API (Edge Runtime compatible)
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random hex string for span IDs (16 hex chars = 8 bytes)
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse W3C traceparent header
 * Format: {version}-{trace-id}-{parent-id}-{flags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
interface TraceParent {
  traceId: string;
  parentId: string;
  flags: string;
  valid: boolean;
}

function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) return null;
  
  const parts = header.split('-');
  if (parts.length !== 4) return null;
  
  const [version, traceId, parentId, flags] = parts;
  
  // Validate version (must be "00")
  if (version !== '00') return null;
  
  // Validate trace-id (32 hex chars)
  if (!/^[0-9a-f]{32}$/i.test(traceId)) return null;
  
  // Validate parent-id (16 hex chars)
  if (!/^[0-9a-f]{16}$/i.test(parentId)) return null;
  
  // Validate flags (2 hex chars)
  if (!/^[0-9a-f]{2}$/i.test(flags)) return null;
  
  return { traceId, parentId, flags, valid: true };
}

/**
 * Create a W3C traceparent header
 */
function createTraceParent(traceId: string, spanId: string, sampled: boolean = true): string {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Extract trace context from incoming request
 * Returns trace context to propagate to downstream services
 */
function extractTraceContext(incomingTraceParent: string | null): {
  traceId: string;
  spanId: string;
  traceparent: string;
  sampled: boolean;
} {
  const parsed = parseTraceParent(incomingTraceParent);
  
  if (parsed) {
    // Continue existing trace - create a new span ID for this request
    const newSpanId = generateSpanId();
    return {
      traceId: parsed.traceId,
      spanId: newSpanId,
      traceparent: createTraceParent(parsed.traceId, newSpanId, parsed.flags === '01'),
      sampled: parsed.flags === '01',
    };
  }
  
  // Start a new trace
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  return {
    traceId,
    spanId,
    traceparent: createTraceParent(traceId, spanId, true),
    sampled: true,
  };
}

// ============================================
// Rate Limit Configuration (mirroring middleware.ts)
// ============================================

type RateLimitTier = 'PUBLIC' | 'AUTHENTICATED' | 'ORGANIZATION' | 'ADMIN' | 'WEBHOOK' | 'PASSWORD_RESET' | 'LOGIN';

const ROUTE_RATE_LIMITS: Record<string, RateLimitTier> = {
  '/api/auth/login': 'LOGIN',
  '/api/auth/register': 'PUBLIC',
  '/api/auth/reset-password': 'PASSWORD_RESET',
  '/api/auth/send-otp': 'PUBLIC',
  '/api/payments/webhook': 'WEBHOOK',
  '/api/public/': 'PUBLIC',
  '/api/health': 'PUBLIC',
  '/api/admin/': 'ADMIN',
  '/api/org/': 'ORGANIZATION',
  '/api/': 'AUTHENTICATED',
};

/**
 * Determine rate limit tier for a route
 */
function getRateLimitTier(pathname: string): RateLimitTier {
  for (const [route, tier] of Object.entries(ROUTE_RATE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return tier;
    }
  }
  return 'PUBLIC';
}

/**
 * Get the equivalent standard route path for a v1 route
 */
function getStandardRoutePath(pathname: string): string {
  if (pathname.startsWith('/api/v1/')) {
    return pathname.replace('/api/v1/', '/api/');
  }
  return pathname;
}

// ============================================
// CSRF Exempt Patterns (mirroring middleware.ts)
// ============================================

const CSRF_EXEMPT_PATTERNS = [
  // Auth routes (login/register need to work without CSRF)
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/auth\/org\/login$/,
  /^\/api\/auth\/org\/register$/,
  /^\/api\/auth\/google$/,
  /^\/api\/auth\/send-otp$/,
  /^\/api\/auth\/verify-otp$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/captcha$/,
  // V1 auth routes (mirrored)
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/register$/,
  /^\/api\/v1\/auth\/logout$/,
  // Webhooks (have their own signature verification)
  /^\/api\/payments\/webhook$/,
  // Public API routes
  /^\/api\/public\//,
  /^\/api\/v1\/public\//,
  // Health checks
  /^\/api\/health/,
  /^\/api\/v1\/health/,
  // Cron endpoints (called by internal cron service with Bearer auth)
  /^\/api\/cron\//,
  // Director login (uses Bearer auth)
  /^\/api\/director\/login$/,
  // File uploads (use multipart/form-data)
  /^\/api\/upload$/,
];

/**
 * Check if a route is CSRF-exempt using pattern matching
 */
function isRouteCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATTERNS.some((pattern) => pattern.test(pathname));
}

// ============================================
// Request ID Generation (mirroring middleware.ts)
// ============================================

/**
 * Generate a unique request ID for tracing (16 hex chars = 8 bytes)
 */
function generateRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================
// Tests
// ============================================

describe('Middleware Security', () => {
  describe('W3C Traceparent Parsing', () => {
    describe('Valid traceparent parsing', () => {
      it('should parse valid traceparent header with sampled flag', () => {
        const validHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const result = parseTraceParent(validHeader);
        
        expect(result).not.toBeNull();
        expect(result?.valid).toBe(true);
        expect(result?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
        expect(result?.parentId).toBe('00f067aa0ba902b7');
        expect(result?.flags).toBe('01');
      });

      it('should parse valid traceparent header without sampled flag', () => {
        const validHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00';
        const result = parseTraceParent(validHeader);
        
        expect(result).not.toBeNull();
        expect(result?.valid).toBe(true);
        expect(result?.flags).toBe('00');
      });

      it('should accept uppercase hex characters', () => {
        const validHeader = '00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01';
        const result = parseTraceParent(validHeader);
        
        expect(result).not.toBeNull();
        expect(result?.valid).toBe(true);
      });

      it('should accept mixed case hex characters', () => {
        const validHeader = '00-4Bf92F3577b34Da6A3cE929D0e0E4736-00F067aA0bA902B7-01';
        const result = parseTraceParent(validHeader);
        
        expect(result).not.toBeNull();
        expect(result?.valid).toBe(true);
      });
    });

    describe('Generating new trace IDs', () => {
      it('should generate 32-character hex trace ID', () => {
        const traceId = generateTraceId();
        
        expect(traceId.length).toBe(32);
        expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
      });

      it('should generate unique trace IDs', () => {
        const traceIds = new Set<string>();
        
        for (let i = 0; i < 100; i++) {
          traceIds.add(generateTraceId());
        }
        
        expect(traceIds.size).toBe(100);
      });

      it('should generate cryptographically random trace IDs', () => {
        const traceIds = Array.from({ length: 10 }, () => generateTraceId());
        
        // Check for distribution in first characters
        const firstChars = traceIds.map(id => id[0]);
        const uniqueFirstChars = new Set(firstChars);
        
        expect(uniqueFirstChars.size).toBeGreaterThan(1);
      });
    });

    describe('Continuing existing traces', () => {
      it('should continue existing trace with new span ID', () => {
        const existingTraceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const context = extractTraceContext(existingTraceParent);
        
        // Trace ID should be preserved
        expect(context.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
        
        // Span ID should be new (different from parent)
        expect(context.spanId).not.toBe('00f067aa0ba902b7');
        
        // Should be sampled
        expect(context.sampled).toBe(true);
      });

      it('should preserve sampled flag when continuing trace', () => {
        const sampledHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const notSampledHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00';
        
        const sampledContext = extractTraceContext(sampledHeader);
        const notSampledContext = extractTraceContext(notSampledHeader);
        
        expect(sampledContext.sampled).toBe(true);
        expect(notSampledContext.sampled).toBe(false);
      });

      it('should generate valid traceparent when continuing', () => {
        const existingTraceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const context = extractTraceContext(existingTraceParent);
        
        // Verify the generated traceparent is valid
        const parsed = parseTraceParent(context.traceparent);
        expect(parsed).not.toBeNull();
        expect(parsed?.valid).toBe(true);
        expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      });
    });

    describe('Invalid traceparent formats', () => {
      it('should return null for null input', () => {
        const result = parseTraceParent(null);
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = parseTraceParent('');
        expect(result).toBeNull();
      });

      it('should reject wrong version', () => {
        const invalidHeader = '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const result = parseTraceParent(invalidHeader);
        expect(result).toBeNull();
      });

      it('should reject trace ID with wrong length', () => {
        const tooShort = '00-4bf92f3577b34da6-00f067aa0ba902b7-01';
        const tooLong = '00-4bf92f3577b34da6a3ce929d0e0e4736deadbeef-00f067aa0ba902b7-01';
        
        expect(parseTraceParent(tooShort)).toBeNull();
        expect(parseTraceParent(tooLong)).toBeNull();
      });

      it('should reject parent ID with wrong length', () => {
        const tooShort = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa-01';
        const tooLong = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7dead-01';
        
        expect(parseTraceParent(tooShort)).toBeNull();
        expect(parseTraceParent(tooLong)).toBeNull();
      });

      it('should reject flags with wrong length', () => {
        const tooShort = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-1';
        const tooLong = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-001';
        
        expect(parseTraceParent(tooShort)).toBeNull();
        expect(parseTraceParent(tooLong)).toBeNull();
      });

      it('should reject non-hex characters', () => {
        const invalidTraceId = '00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01';
        const invalidParentId = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902bX-01';
        const invalidFlags = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-gg';
        
        expect(parseTraceParent(invalidTraceId)).toBeNull();
        expect(parseTraceParent(invalidParentId)).toBeNull();
        expect(parseTraceParent(invalidFlags)).toBeNull();
      });

      it('should reject missing parts', () => {
        const missingFlags = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7';
        const missingParentId = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';
        const missingTraceId = '00-00f067aa0ba902b7-01';
        
        expect(parseTraceParent(missingFlags)).toBeNull();
        expect(parseTraceParent(missingParentId)).toBeNull();
        expect(parseTraceParent(missingTraceId)).toBeNull();
      });

      it('should reject extra parts', () => {
        const extraPart = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra';
        expect(parseTraceParent(extraPart)).toBeNull();
      });

      it('should reject malformed input', () => {
        const malformedInputs = [
          'not-a-traceparent',
          '00-',
          '-00-',
          '00-4bf92f3577b34da6a3ce929d0e0e4736',
          'random string',
        ];
        
        malformedInputs.forEach(input => {
          expect(parseTraceParent(input)).toBeNull();
        });
      });
    });
  });

  describe('W3C Traceparent Generation', () => {
    describe('Format compliance', () => {
      it('should generate traceparent in correct format', () => {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        const traceparent = createTraceParent(traceId, spanId);
        
        // Should match format: 00-{32 hex}-{16 hex}-{2 hex}
        expect(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(traceparent)).toBe(true);
      });

      it('should generate sampled traceparent by default', () => {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        const traceparent = createTraceParent(traceId, spanId);
        
        const parts = traceparent.split('-');
        expect(parts[3]).toBe('01'); // sampled flag
      });

      it('should generate not-sampled traceparent when sampled is false', () => {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        const traceparent = createTraceParent(traceId, spanId, false);
        
        const parts = traceparent.split('-');
        expect(parts[3]).toBe('00'); // not sampled flag
      });

      it('should always use version 00', () => {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        const traceparent = createTraceParent(traceId, spanId);
        
        expect(traceparent.startsWith('00-')).toBe(true);
      });
    });

    describe('Trace ID uniqueness', () => {
      it('should generate unique trace IDs', () => {
        const traceIds = new Set<string>();
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
          traceIds.add(generateTraceId());
        }
        
        expect(traceIds.size).toBe(iterations);
      });

      it('should generate trace IDs with good entropy distribution', () => {
        const traceIds = Array.from({ length: 100 }, () => generateTraceId());
        
        // Check byte distribution at position 0
        const firstBytes = traceIds.map(id => parseInt(id.substring(0, 2), 16));
        const uniqueFirstBytes = new Set(firstBytes);
        
        // With good randomness, we should see many different values
        expect(uniqueFirstBytes.size).toBeGreaterThan(20);
      });

      it('should not generate all-zeros trace ID', () => {
        for (let i = 0; i < 100; i++) {
          const traceId = generateTraceId();
          expect(traceId).not.toBe('00000000000000000000000000000000');
        }
      });
    });

    describe('Span ID uniqueness', () => {
      it('should generate unique span IDs', () => {
        const spanIds = new Set<string>();
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
          spanIds.add(generateSpanId());
        }
        
        expect(spanIds.size).toBe(iterations);
      });

      it('should generate span IDs with good entropy distribution', () => {
        const spanIds = Array.from({ length: 100 }, () => generateSpanId());
        
        const firstBytes = spanIds.map(id => parseInt(id.substring(0, 2), 16));
        const uniqueFirstBytes = new Set(firstBytes);
        
        expect(uniqueFirstBytes.size).toBeGreaterThan(20);
      });

      it('should not generate all-zeros span ID', () => {
        for (let i = 0; i < 100; i++) {
          const spanId = generateSpanId();
          expect(spanId).not.toBe('0000000000000000');
        }
      });

      it('should generate 16-character hex span IDs', () => {
        const spanId = generateSpanId();
        expect(spanId.length).toBe(16);
        expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
      });
    });
  });

  describe('Rate Limit Tier Assignment', () => {
    describe('LOGIN tier for /api/auth/login', () => {
      it('should assign LOGIN tier to /api/auth/login', () => {
        expect(getRateLimitTier('/api/auth/login')).toBe('LOGIN');
      });

      it('should assign LOGIN tier to /api/v1/auth/login via standard path conversion', () => {
        const standardPath = getStandardRoutePath('/api/v1/auth/login');
        expect(getRateLimitTier(standardPath)).toBe('LOGIN');
      });

      it('should use prefix matching for LOGIN tier', () => {
        // Note: getRateLimitTier uses startsWith, so /api/auth/login/something matches
        expect(getRateLimitTier('/api/auth/login/something')).toBe('LOGIN');
        
        // /api/auth/logintest also matches because 'logintest' starts with 'login'
        expect(getRateLimitTier('/api/auth/logintest')).toBe('LOGIN');
        
        // But this does NOT match because it's auth/logi... not auth/login
        expect(getRateLimitTier('/api/auth/logi')).toBe('AUTHENTICATED');
      });
    });

    describe('PUBLIC tier for /api/public/*', () => {
      it('should assign PUBLIC tier to /api/public/ routes', () => {
        expect(getRateLimitTier('/api/public/')).toBe('PUBLIC');
        expect(getRateLimitTier('/api/public/events')).toBe('PUBLIC');
        expect(getRateLimitTier('/api/public/health')).toBe('PUBLIC');
      });

      it('should assign PUBLIC tier to /api/v1/public/* via standard path conversion', () => {
        expect(getRateLimitTier(getStandardRoutePath('/api/v1/public/events'))).toBe('PUBLIC');
      });

      it('should assign PUBLIC tier to /api/auth/register', () => {
        expect(getRateLimitTier('/api/auth/register')).toBe('PUBLIC');
      });

      it('should assign PUBLIC tier to /api/auth/send-otp', () => {
        expect(getRateLimitTier('/api/auth/send-otp')).toBe('PUBLIC');
      });

      it('should assign PUBLIC tier to /api/health', () => {
        expect(getRateLimitTier('/api/health')).toBe('PUBLIC');
      });
    });

    describe('ADMIN tier for /api/admin/*', () => {
      it('should assign ADMIN tier to /api/admin/ routes', () => {
        expect(getRateLimitTier('/api/admin/')).toBe('ADMIN');
        expect(getRateLimitTier('/api/admin/users')).toBe('ADMIN');
        expect(getRateLimitTier('/api/admin/settings')).toBe('ADMIN');
      });

      it('should assign ADMIN tier to /api/v1/admin/* via standard path conversion', () => {
        expect(getRateLimitTier(getStandardRoutePath('/api/v1/admin/users'))).toBe('ADMIN');
      });
    });

    describe('ORGANIZATION tier for /api/org/*', () => {
      it('should assign ORGANIZATION tier to /api/org/ routes', () => {
        expect(getRateLimitTier('/api/org/')).toBe('ORGANIZATION');
        expect(getRateLimitTier('/api/org/dashboard')).toBe('ORGANIZATION');
        expect(getRateLimitTier('/api/org/tournaments')).toBe('ORGANIZATION');
      });

      it('should assign ORGANIZATION tier to /api/v1/org/* via standard path conversion', () => {
        expect(getRateLimitTier(getStandardRoutePath('/api/v1/org/dashboard'))).toBe('ORGANIZATION');
      });
    });

    describe('AUTHENTICATED tier as default', () => {
      it('should assign AUTHENTICATED tier to /api/ routes by default', () => {
        expect(getRateLimitTier('/api/')).toBe('AUTHENTICATED');
        expect(getRateLimitTier('/api/users')).toBe('AUTHENTICATED');
        expect(getRateLimitTier('/api/tournaments')).toBe('AUTHENTICATED');
      });

      it('should assign AUTHENTICATED tier to /api/v1/* routes by default', () => {
        expect(getRateLimitTier(getStandardRoutePath('/api/v1/users'))).toBe('AUTHENTICATED');
        expect(getRateLimitTier(getStandardRoutePath('/api/v1/profile'))).toBe('AUTHENTICATED');
      });

      it('should assign PUBLIC tier to unknown routes outside /api/', () => {
        expect(getRateLimitTier('/unknown/route')).toBe('PUBLIC');
        expect(getRateLimitTier('/')).toBe('PUBLIC');
      });
    });

    describe('Special tiers', () => {
      it('should assign WEBHOOK tier to /api/payments/webhook', () => {
        expect(getRateLimitTier('/api/payments/webhook')).toBe('WEBHOOK');
      });

      it('should assign PASSWORD_RESET tier to /api/auth/reset-password', () => {
        expect(getRateLimitTier('/api/auth/reset-password')).toBe('PASSWORD_RESET');
      });
    });

    describe('Route matching order', () => {
      it('should match most specific route first', () => {
        // /api/auth/login should match before /api/
        expect(getRateLimitTier('/api/auth/login')).toBe('LOGIN');
        
        // /api/admin/users should match ADMIN, not AUTHENTICATED
        expect(getRateLimitTier('/api/admin/users')).toBe('ADMIN');
        
        // /api/public/events should match PUBLIC
        expect(getRateLimitTier('/api/public/events')).toBe('PUBLIC');
      });
    });
  });

  describe('CSRF Route Parity between /api/* and /api/v1/*', () => {
    describe('Auth route parity', () => {
      it('should exempt /api/auth/login and /api/v1/auth/login', () => {
        expect(isRouteCsrfExempt('/api/auth/login')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/auth/login')).toBe(true);
      });

      it('should exempt /api/auth/register and /api/v1/auth/register', () => {
        expect(isRouteCsrfExempt('/api/auth/register')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/auth/register')).toBe(true);
      });

      it('should exempt /api/auth/logout and /api/v1/auth/logout', () => {
        expect(isRouteCsrfExempt('/api/auth/logout')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/auth/logout')).toBe(true);
      });
    });

    describe('Public route parity', () => {
      it('should exempt /api/public/* and /api/v1/public/*', () => {
        expect(isRouteCsrfExempt('/api/public/events')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/public/events')).toBe(true);
        expect(isRouteCsrfExempt('/api/public/')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/public/')).toBe(true);
      });
    });

    describe('Health check parity', () => {
      it('should exempt /api/health/* and /api/v1/health/*', () => {
        expect(isRouteCsrfExempt('/api/health')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/health')).toBe(true);
        expect(isRouteCsrfExempt('/api/health/ready')).toBe(true);
        expect(isRouteCsrfExempt('/api/v1/health/ready')).toBe(true);
      });
    });

    describe('Pattern matching consistency', () => {
      it('should have matching exempt patterns for both route trees', () => {
        // Define routes that should have parity
        const routePairs = [
          ['/api/auth/login', '/api/v1/auth/login'],
          ['/api/auth/register', '/api/v1/auth/register'],
          ['/api/auth/logout', '/api/v1/auth/logout'],
          ['/api/public/test', '/api/v1/public/test'],
          ['/api/health', '/api/v1/health'],
        ];
        
        routePairs.forEach(([standardRoute, v1Route]) => {
          expect(isRouteCsrfExempt(standardRoute)).toBe(isRouteCsrfExempt(v1Route));
        });
      });

      it('should NOT exempt routes that are not in exempt list', () => {
        expect(isRouteCsrfExempt('/api/users')).toBe(false);
        expect(isRouteCsrfExempt('/api/v1/users')).toBe(false);
        expect(isRouteCsrfExempt('/api/tournaments')).toBe(false);
        expect(isRouteCsrfExempt('/api/v1/tournaments')).toBe(false);
      });
    });

    describe('Webhook exemption', () => {
      it('should exempt /api/payments/webhook', () => {
        expect(isRouteCsrfExempt('/api/payments/webhook')).toBe(true);
      });
    });

    describe('Cron endpoint exemption', () => {
      it('should exempt /api/cron/* routes', () => {
        expect(isRouteCsrfExempt('/api/cron/cleanup')).toBe(true);
        expect(isRouteCsrfExempt('/api/cron/sync')).toBe(true);
      });
    });

    describe('Director login exemption', () => {
      it('should exempt /api/director/login', () => {
        expect(isRouteCsrfExempt('/api/director/login')).toBe(true);
      });
    });

    describe('Upload endpoint exemption', () => {
      it('should exempt /api/upload', () => {
        expect(isRouteCsrfExempt('/api/upload')).toBe(true);
      });
    });
  });

  describe('Request ID Generation', () => {
    describe('Uniqueness', () => {
      it('should generate unique request IDs', () => {
        const requestIds = new Set<string>();
        const iterations = 10000;
        
        for (let i = 0; i < iterations; i++) {
          requestIds.add(generateRequestId());
        }
        
        expect(requestIds.size).toBe(iterations);
      });

      it('should generate request IDs with good entropy', () => {
        const requestIds = Array.from({ length: 100 }, () => generateRequestId());
        
        const firstBytes = requestIds.map(id => parseInt(id.substring(0, 2), 16));
        const uniqueFirstBytes = new Set(firstBytes);
        
        expect(uniqueFirstBytes.size).toBeGreaterThan(20);
      });

      it('should not generate predictable IDs', () => {
        const ids = Array.from({ length: 10 }, () => generateRequestId());
        
        // No two IDs should be the same
        expect(new Set(ids).size).toBe(10);
        
        // IDs should not be sequential
        const asNumbers = ids.map(id => parseInt(id, 16));
        for (let i = 1; i < asNumbers.length; i++) {
          expect(Math.abs(asNumbers[i] - asNumbers[i - 1])).toBeGreaterThan(1);
        }
      });
    });

    describe('Format validation', () => {
      it('should generate 16-character hex string', () => {
        const requestId = generateRequestId();
        
        expect(requestId.length).toBe(16);
        expect(/^[0-9a-f]{16}$/.test(requestId)).toBe(true);
      });

      it('should only contain lowercase hex characters', () => {
        for (let i = 0; i < 100; i++) {
          const requestId = generateRequestId();
          expect(/^[0-9a-f]+$/.test(requestId)).toBe(true);
        }
      });

      it('should not contain uppercase letters', () => {
        for (let i = 0; i < 100; i++) {
          const requestId = generateRequestId();
          expect(/[A-F]/.test(requestId)).toBe(false);
        }
      });

      it('should not contain non-hex characters', () => {
        for (let i = 0; i < 100; i++) {
          const requestId = generateRequestId();
          expect(/[^0-9a-f]/.test(requestId)).toBe(false);
        }
      });
    });

    describe('Statistical properties', () => {
      it('should have uniform distribution across hex values', () => {
        const ids = Array.from({ length: 1000 }, () => generateRequestId());
        const allChars = ids.join('');
        
        // Count each hex digit
        const counts: Record<string, number> = {};
        for (const char of allChars) {
          counts[char] = (counts[char] || 0) + 1;
        }
        
        // Each digit should appear roughly 1/16 of the time
        // With 1000 IDs of 16 chars = 16000 chars
        // Expected count per digit = 1000
        // Allow significant variance (400-1600)
        for (const digit of '0123456789abcdef') {
          expect(counts[digit] || 0).toBeGreaterThan(300);
          expect(counts[digit] || 0).toBeLessThan(1700);
        }
      });
    });
  });

  describe('End-to-End Middleware Security Scenarios', () => {
    describe('Full trace context flow', () => {
      it('should create new trace when no traceparent provided', () => {
        const context = extractTraceContext(null);
        
        expect(context.traceId).toBeDefined();
        expect(context.spanId).toBeDefined();
        expect(context.traceparent).toBeDefined();
        expect(context.sampled).toBe(true);
        
        // Verify the traceparent is valid
        const parsed = parseTraceParent(context.traceparent);
        expect(parsed).not.toBeNull();
        expect(parsed?.traceId).toBe(context.traceId);
      });

      it('should continue trace when valid traceparent provided', () => {
        const incomingTraceParent = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';
        const context = extractTraceContext(incomingTraceParent);
        
        expect(context.traceId).toBe('abcdef1234567890abcdef1234567890');
        expect(context.sampled).toBe(true);
        
        // Span ID should be different from the incoming parent ID
        expect(context.spanId).not.toBe('1234567890abcdef');
      });

      it('should create new trace for invalid traceparent', () => {
        const invalidTraceParents = [
          'invalid',
          '00-invalid-invalid-00',
          '01-abcdef1234567890abcdef1234567890-1234567890abcdef-01', // wrong version
        ];
        
        invalidTraceParents.forEach(invalid => {
          const context = extractTraceContext(invalid);
          
          // Should create a new valid trace
          expect(context.traceId).toBeDefined();
          expect(context.traceId.length).toBe(32);
          expect(context.sampled).toBe(true);
        });
      });
    });

    describe('Rate limiting with route parity', () => {
      it('should apply same rate limits to /api/* and /api/v1/* routes', () => {
        const routePairs = [
          ['/api/auth/login', '/api/v1/auth/login', 'LOGIN'],
          ['/api/auth/register', '/api/v1/auth/register', 'PUBLIC'],
          ['/api/admin/users', '/api/v1/admin/users', 'ADMIN'],
          ['/api/org/settings', '/api/v1/org/settings', 'ORGANIZATION'],
          ['/api/public/data', '/api/v1/public/data', 'PUBLIC'],
        ];
        
        routePairs.forEach(([standardRoute, v1Route, expectedTier]) => {
          const standardTier = getRateLimitTier(getStandardRoutePath(standardRoute));
          const v1Tier = getRateLimitTier(getStandardRoutePath(v1Route));
          
          expect(standardTier).toBe(expectedTier);
          expect(v1Tier).toBe(expectedTier);
          expect(standardTier).toBe(v1Tier);
        });
      });
    });

    describe('CSRF protection with route parity', () => {
      it('should have identical CSRF protection for /api/* and /api/v1/* routes', () => {
        const testRoutes = [
          // Routes that should be exempt
          { path: '/api/auth/login', v1Path: '/api/v1/auth/login', exempt: true },
          { path: '/api/auth/register', v1Path: '/api/v1/auth/register', exempt: true },
          { path: '/api/public/test', v1Path: '/api/v1/public/test', exempt: true },
          { path: '/api/health', v1Path: '/api/v1/health', exempt: true },
          
          // Routes that should NOT be exempt
          { path: '/api/users', v1Path: '/api/v1/users', exempt: false },
          { path: '/api/tournaments', v1Path: '/api/v1/tournaments', exempt: false },
          { path: '/api/profile', v1Path: '/api/v1/profile', exempt: false },
        ];
        
        testRoutes.forEach(({ path, v1Path, exempt }) => {
          const standardExempt = isRouteCsrfExempt(path);
          const v1Exempt = isRouteCsrfExempt(v1Path);
          
          expect(standardExempt).toBe(exempt);
          expect(v1Exempt).toBe(exempt);
          expect(standardExempt).toBe(v1Exempt);
        });
      });
    });
  });
});
