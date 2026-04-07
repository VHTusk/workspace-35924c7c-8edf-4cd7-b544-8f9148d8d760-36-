/**
 * Rate Limiting with Redis Support
 * 
 * Supports:
 * - Upstash Redis (HTTP-based, serverless-friendly)
 * - Standard Redis (TCP connection)
 * - In-memory fallback for development
 * 
 * Namespacing:
 * - All keys are prefixed with 'valorhive:ratelimit:'
 * - Supports multiple rate limit types per identifier
 */

import { NextResponse } from 'next/server';

// ============================================
// TYPES
// ============================================

export type RateLimitType = 'AUTH' | 'OTP' | 'READ' | 'WRITE' | 'PAYMENT' | 'API';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

// ============================================
// CONFIGURATION
// ============================================

const RATE_LIMITS: Record<RateLimitType, RateLimitConfig> = {
  AUTH: { windowMs: 60000, maxRequests: 5, keyPrefix: 'auth' },      // 5/min
  OTP: { windowMs: 3600000, maxRequests: 5, keyPrefix: 'otp' },      // 5/hour
  READ: { windowMs: 60000, maxRequests: 60, keyPrefix: 'read' },     // 60/min
  WRITE: { windowMs: 60000, maxRequests: 30, keyPrefix: 'write' },   // 30/min
  PAYMENT: { windowMs: 60000, maxRequests: 10, keyPrefix: 'payment' }, // 10/min
  API: { windowMs: 60000, maxRequests: 100, keyPrefix: 'api' },      // 100/min
};

// Redis namespace prefix
const NAMESPACE = 'valorhive:ratelimit:';

// ============================================
// IN-MEMORY FALLBACK
// ============================================

// Simple in-memory store for development
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMemoryStore, 60000);
}

// ============================================
// UPSTASH REDIS (HTTP)
// ============================================

async function checkRateLimitUpstash(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type];
  const key = `${NAMESPACE}${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const resetAt = new Date(now + config.windowMs);

  // Upstash Redis REST API
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Fallback to memory store
    return checkRateLimitMemory(identifier, type);
  }

  try {
    // Use Lua script for atomic increment with TTL
    const script = `
      local key = KEYS[1]
      local window = tonumber(ARGV[1])
      local max = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local current = redis.call('GET', key)
      if current == false then
        redis.call('SET', key, 1, 'PX', window)
        return {1, max - 1, now + window}
      end
      
      current = tonumber(current)
      if current >= max then
        local ttl = redis.call('PTTL', key)
        return {current, 0, now + ttl}
      end
      
      local newCount = redis.call('INCR', key)
      return {newCount, max - newCount, now + redis.call('PTTL', key)}
    `;

    const response = await fetch(`${url}/eval/${encodeURIComponent(script)}/1/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([config.windowMs, config.maxRequests, now]),
    });

    if (!response.ok) {
      console.error('Upstash rate limit error:', await response.text());
      return checkRateLimitMemory(identifier, type);
    }

    const data = await response.json();
    const [count, remaining, resetTime] = data.result;

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, remaining),
      resetAt: new Date(resetTime),
      retryAfter: count > config.maxRequests ? Math.ceil((resetTime - now) / 1000) : undefined,
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    return checkRateLimitMemory(identifier, type);
  }
}

// ============================================
// IN-MEMORY IMPLEMENTATION
// ============================================

function checkRateLimitMemory(
  identifier: string,
  type: RateLimitType
): RateLimitResult {
  const config = RATE_LIMITS[type];
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const resetAt = now + config.windowMs;

  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(resetAt),
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.resetAt),
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetAt: new Date(existing.resetAt),
  };
}

// ============================================
// MAIN EXPORTS
// ============================================

/**
 * Check rate limit for an identifier
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  // Use Upstash if configured
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return checkRateLimitUpstash(identifier, type);
  }

  // Fallback to memory
  return checkRateLimitMemory(identifier, type);
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Try real IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (should not happen in production)
  return 'unknown';
}

/**
 * Rate limit middleware for API routes
 */
export async function withRateLimit(
  request: Request,
  type: RateLimitType,
  identifier?: string
): Promise<NextResponse | null> {
  const clientId = identifier || getClientIdentifier(request);
  const result = await checkRateLimit(clientId, type);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toISOString(),
        },
      }
    );
  }

  // Return null to indicate allowed (no error response)
  return null;
}

/**
 * Rate limit for specific identifier (e.g., phone number for OTP)
 */
export async function checkRateLimitByIdentifier(
  identifier: string,
  type: RateLimitType
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const result = await checkRateLimit(identifier, type);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfter: result.retryAfter,
  };
}

/**
 * Reset rate limit for an identifier (admin use)
 */
export async function resetRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<void> {
  const config = RATE_LIMITS[type];
  const key = `${NAMESPACE}${config.keyPrefix}:${identifier}`;

  // Memory store
  memoryStore.delete(`${config.keyPrefix}:${identifier}`);

  // Redis (if configured)
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      await fetch(`${url}/del/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Failed to reset rate limit in Redis:', error);
    }
  }
}
