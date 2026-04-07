/**
 * Search Endpoint Protection System for VALORHIVE
 * 
 * Provides strict rate limiting and abuse prevention for search endpoints.
 * Detects and blocks scraping patterns, bot behavior, and excessive usage.
 * 
 * Rate Limits:
 * - Unauthenticated: 20 searches per minute
 * - Authenticated: 60 searches per minute
 * 
 * Abuse Detection Patterns:
 * - More than 100 searches in 5 minutes = suspicious
 * - Sequential pagination (page 1, 2, 3, 4...) rapidly = scraping
 * - Same search query repeated 10+ times = bot behavior
 * 
 * @module search-protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIdentifier, checkRateLimitAsync } from './rate-limit';
import { securityLog } from './logger';

// ============================================
// Types and Interfaces
// ============================================

export interface SearchHistoryEntry {
  identifier: string;
  query: string;
  endpoint: 'players' | 'orgs' | 'tournaments';
  page: number;
  timestamp: number;
  userAgent?: string;
  userId?: string;
}

export interface AbuseDetectionResult {
  isAbuse: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  searchCount: number;
  timeWindow: number;
  patterns: string[];
}

export interface SearchProtectionConfig {
  unauthenticatedLimit: number;
  authenticatedLimit: number;
  windowMs: number;
  suspiciousThreshold: number;
  suspiciousWindowMs: number;
  sequentialPageThreshold: number;
  sequentialPageWindowMs: number;
  repeatedQueryThreshold: number;
  repeatedQueryWindowMs: number;
  blockDurationMs: number;
}

export interface BlockedUser {
  identifier: string;
  blockedAt: number;
  blockedUntil: number;
  reason: string;
  searchCount: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: SearchProtectionConfig = {
  // Rate limits per minute
  unauthenticatedLimit: 20,
  authenticatedLimit: 60,
  windowMs: 60 * 1000, // 1 minute
  
  // Abuse detection thresholds
  suspiciousThreshold: 100, // More than 100 searches in 5 minutes = suspicious
  suspiciousWindowMs: 5 * 60 * 1000, // 5 minutes
  
  // Sequential pagination detection
  sequentialPageThreshold: 5, // 5+ consecutive pages = scraping
  sequentialPageWindowMs: 30 * 1000, // 30 seconds
  
  // Repeated query detection
  repeatedQueryThreshold: 10, // Same query 10+ times = bot
  repeatedQueryWindowMs: 5 * 60 * 1000, // 5 minutes
  
  // Block duration
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
};

// ============================================
// In-Memory Stores
// ============================================

// Search history store: identifier -> SearchHistoryEntry[]
const searchHistoryStore = new Map<string, SearchHistoryEntry[]>();

// Blocked users store: identifier -> BlockedUser
const blockedUsersStore = new Map<string, BlockedUser>();

// Rate limit cache prefix
const SEARCH_RATE_LIMIT_PREFIX = 'search:rl:';

// ============================================
// SearchRateLimiter Class
// ============================================

export class SearchRateLimiter {
  private config: SearchProtectionConfig;

  constructor(config?: Partial<SearchProtectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get rate limit key for search
   */
  private getRateLimitKey(identifier: string, isAuthenticated: boolean): string {
    const tier = isAuthenticated ? 'auth' : 'anon';
    return `${SEARCH_RATE_LIMIT_PREFIX}${tier}:${identifier}`;
  }

  /**
   * Check if a user is blocked
   */
  isBlocked(identifier: string): BlockedUser | null {
    const blocked = blockedUsersStore.get(identifier);
    if (!blocked) return null;
    
    // Check if block has expired
    if (Date.now() > blocked.blockedUntil) {
      blockedUsersStore.delete(identifier);
      return null;
    }
    
    return blocked;
  }

  /**
   * Check rate limit for search endpoint
   */
  async checkRateLimit(identifier: string, isAuthenticated: boolean): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    limit: number;
  }> {
    const limit = isAuthenticated ? this.config.authenticatedLimit : this.config.unauthenticatedLimit;
    const key = this.getRateLimitKey(identifier, isAuthenticated);
    const now = Date.now();
    
    // Get current rate limit entry from memory store
    const entries = searchHistoryStore.get(identifier) || [];
    const windowStart = now - this.config.windowMs;
    const recentSearches = entries.filter(e => e.timestamp > windowStart);
    const currentCount = recentSearches.length;
    
    if (currentCount >= limit) {
      // Find the oldest entry in the window to calculate reset time
      const oldestInWindow = recentSearches.reduce((oldest, e) => 
        e.timestamp < oldest ? e.timestamp : oldest, now);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + this.config.windowMs,
        limit,
      };
    }
    
    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: now + this.config.windowMs,
      limit,
    };
  }

  /**
   * Track a search query for abuse detection
   */
  trackSearchQuery(
    identifier: string,
    query: string,
    endpoint: 'players' | 'orgs' | 'tournaments',
    page: number,
    userAgent?: string,
    userId?: string
  ): void {
    const entry: SearchHistoryEntry = {
      identifier,
      query: query.toLowerCase().trim(),
      endpoint,
      page,
      timestamp: Date.now(),
      userAgent,
      userId,
    };
    
    // Add to history
    const history = searchHistoryStore.get(identifier) || [];
    history.push(entry);
    
    // Keep only last 1000 entries per user to prevent memory bloat
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    searchHistoryStore.set(identifier, history);
  }

  /**
   * Detect search abuse patterns
   */
  detectSearchAbuse(identifier: string): AbuseDetectionResult {
    const history = searchHistoryStore.get(identifier) || [];
    const now = Date.now();
    const patterns: string[] = [];
    
    // Check for suspicious high volume
    const suspiciousWindow = now - this.config.suspiciousWindowMs;
    const recentSearches = history.filter(e => e.timestamp > suspiciousWindow);
    const isHighVolume = recentSearches.length > this.config.suspiciousThreshold;
    
    if (isHighVolume) {
      patterns.push('HIGH_VOLUME');
    }
    
    // Check for sequential pagination (scraping pattern)
    const sequentialWindow = now - this.config.sequentialPageWindowMs;
    const recentSearchesForSeq = history.filter(e => e.timestamp > sequentialWindow);
    const isSequentialPagination = this.detectSequentialPagination(recentSearchesForSeq);
    
    if (isSequentialPagination) {
      patterns.push('SEQUENTIAL_PAGINATION');
    }
    
    // Check for repeated queries (bot behavior)
    const repeatedWindow = now - this.config.repeatedQueryWindowMs;
    const recentSearchesForRepeat = history.filter(e => e.timestamp > repeatedWindow);
    const repeatedQueries = this.detectRepeatedQueries(recentSearchesForRepeat);
    
    if (repeatedQueries.length > 0) {
      patterns.push('REPEATED_QUERY');
    }
    
    // Determine severity
    let severity: AbuseDetectionResult['severity'] = 'low';
    if (patterns.length >= 3) {
      severity = 'critical';
    } else if (patterns.length >= 2) {
      severity = 'high';
    } else if (patterns.includes('SEQUENTIAL_PAGINATION') || patterns.includes('HIGH_VOLUME')) {
      severity = 'medium';
    }
    
    return {
      isAbuse: patterns.length > 0,
      reason: patterns.length > 0 
        ? `Detected abuse patterns: ${patterns.join(', ')}`
        : 'No abuse detected',
      severity,
      searchCount: recentSearches.length,
      timeWindow: this.config.suspiciousWindowMs,
      patterns,
    };
  }

  /**
   * Detect sequential pagination pattern (page 1, 2, 3, 4... rapidly)
   */
  private detectSequentialPagination(entries: SearchHistoryEntry[]): boolean {
    if (entries.length < this.config.sequentialPageThreshold) {
      return false;
    }
    
    // Sort by timestamp
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    
    // Group by endpoint and query
    const groups = new Map<string, SearchHistoryEntry[]>();
    for (const entry of sorted) {
      const key = `${entry.endpoint}:${entry.query}`;
      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    }
    
    // Check each group for sequential pages
    for (const [, group] of groups) {
      if (group.length < this.config.sequentialPageThreshold) continue;
      
      // Sort by timestamp within group
      const groupSorted = group.sort((a, b) => a.timestamp - b.timestamp);
      
      // Check for sequential pages
      let consecutiveCount = 1;
      for (let i = 1; i < groupSorted.length; i++) {
        const prevPage = groupSorted[i - 1].page;
        const currPage = groupSorted[i].page;
        
        // Check if pages are consecutive (prev + 1 = current)
        if (currPage === prevPage + 1) {
          consecutiveCount++;
          if (consecutiveCount >= this.config.sequentialPageThreshold) {
            return true;
          }
        } else {
          consecutiveCount = 1;
        }
      }
    }
    
    return false;
  }

  /**
   * Detect repeated query patterns
   */
  private detectRepeatedQueries(entries: SearchHistoryEntry[]): string[] {
    const queryCounts = new Map<string, number>();
    
    for (const entry of entries) {
      const key = `${entry.endpoint}:${entry.query}`;
      queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
    }
    
    const repeated: string[] = [];
    for (const [key, count] of queryCounts) {
      if (count >= this.config.repeatedQueryThreshold) {
        repeated.push(key);
      }
    }
    
    return repeated;
  }

  /**
   * Block a user temporarily
   */
  blockSearchAbuser(identifier: string, reason: string): BlockedUser {
    const now = Date.now();
    const history = searchHistoryStore.get(identifier) || [];
    const recentCount = history.filter(e => e.timestamp > now - this.config.suspiciousWindowMs).length;
    
    const blocked: BlockedUser = {
      identifier,
      blockedAt: now,
      blockedUntil: now + this.config.blockDurationMs,
      reason,
      searchCount: recentCount,
    };
    
    blockedUsersStore.set(identifier, blocked);
    
    // Log the block
    securityLog.suspiciousActivity('SEARCH_ABUSE_BLOCKED', {
      identifier,
      reason,
      searchCount: recentCount,
      blockedUntil: new Date(blocked.blockedUntil).toISOString(),
    }, identifier);
    
    return blocked;
  }

  /**
   * Unblock a user
   */
  unblockUser(identifier: string): boolean {
    const deleted = blockedUsersStore.delete(identifier);
    if (deleted) {
      console.log(`[SearchProtection] Unblocked user: ${identifier}`);
    }
    return deleted;
  }

  /**
   * Get search history for an identifier
   */
  getSearchHistory(identifier: string, limit: number = 100): SearchHistoryEntry[] {
    const history = searchHistoryStore.get(identifier) || [];
    return history.slice(-limit);
  }

  /**
   * Clear search history for an identifier
   */
  clearSearchHistory(identifier: string): void {
    searchHistoryStore.delete(identifier);
  }

  /**
   * Get statistics about search protection
   */
  getStats(): {
    totalUsers: number;
    blockedUsers: number;
    config: SearchProtectionConfig;
  } {
    return {
      totalUsers: searchHistoryStore.size,
      blockedUsers: blockedUsersStore.size,
      config: this.config,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let searchRateLimiterInstance: SearchRateLimiter | null = null;

/**
 * Get the singleton SearchRateLimiter instance
 */
export function getSearchRateLimiter(): SearchRateLimiter {
  if (!searchRateLimiterInstance) {
    searchRateLimiterInstance = new SearchRateLimiter();
  }
  return searchRateLimiterInstance;
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Extract authentication info from request
 */
export async function extractAuthInfo(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  userId?: string;
}> {
  // Check for session token in cookie or header
  const sessionToken = request.cookies.get('session_token')?.value ||
                       request.headers.get('x-session-token');
  
  if (!sessionToken) {
    return { isAuthenticated: false };
  }
  
  // In production, validate the session token against database
  // For now, we'll just check if it exists
  return { 
    isAuthenticated: true,
    userId: sessionToken.slice(0, 8), // Partial token for tracking
  };
}

/**
 * Search protection middleware wrapper
 */
export function withSearchProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
  endpoint: 'players' | 'orgs' | 'tournaments'
) {
  return async (request: NextRequest) => {
    const limiter = getSearchRateLimiter();
    const identifier = getClientIdentifier(request);
    const { isAuthenticated, userId } = await extractAuthInfo(request);
    
    // Check if user is blocked
    const blocked = limiter.isBlocked(identifier);
    if (blocked) {
      const retryAfter = Math.ceil((blocked.blockedUntil - Date.now()) / 1000);
      
      securityLog.suspiciousActivity('SEARCH_BLOCKED_ACCESS_ATTEMPT', {
        identifier,
        reason: blocked.reason,
        endpoint,
      }, identifier);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Your access has been temporarily restricted due to suspicious activity.',
          reason: blocked.reason,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '0',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': blocked.blockedUntil.toString(),
            'X-Search-Blocked': 'true',
          },
        }
      );
    }
    
    // Check rate limit
    const rateLimitResult = await limiter.checkRateLimit(identifier, isAuthenticated);
    
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      
      securityLog.rateLimitExceeded(identifier, `/api/search/${endpoint}`, identifier);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Too many search requests. Please slow down.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          },
        }
      );
    }
    
    // Get search params for tracking
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = Math.floor(offset / limit) + 1;
    const userAgent = request.headers.get('user-agent') || undefined;
    
    // Track this search query
    limiter.trackSearchQuery(identifier, query, endpoint, page, userAgent, userId);
    
    // Detect abuse patterns
    const abuseResult = limiter.detectSearchAbuse(identifier);
    
    if (abuseResult.isAbuse && (abuseResult.severity === 'high' || abuseResult.severity === 'critical')) {
      // Block the user
      limiter.blockSearchAbuser(identifier, abuseResult.reason);
      
      securityLog.suspiciousActivity('SEARCH_ABUSE_AUTO_BLOCK', {
        identifier,
        endpoint,
        severity: abuseResult.severity,
        patterns: abuseResult.patterns,
        searchCount: abuseResult.searchCount,
      }, identifier);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Your access has been temporarily restricted due to suspicious activity.',
          reason: abuseResult.reason,
          retryAfter: Math.ceil(DEFAULT_CONFIG.blockDurationMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(DEFAULT_CONFIG.blockDurationMs / 1000).toString(),
            'X-Search-Blocked': 'true',
          },
        }
      );
    }
    
    // Log suspicious patterns (but don't block)
    if (abuseResult.isAbuse) {
      securityLog.suspiciousActivity('SEARCH_SUSPICIOUS_PATTERN', {
        identifier,
        endpoint,
        severity: abuseResult.severity,
        patterns: abuseResult.patterns,
        searchCount: abuseResult.searchCount,
      }, identifier);
    }
    
    // Execute the handler
    const response = await handler(request);
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString());
    
    // Add warning header for suspicious activity
    if (abuseResult.isAbuse) {
      response.headers.set('X-Search-Warning', abuseResult.reason);
    }
    
    return response;
  };
}

// ============================================
// Cleanup Job
// ============================================

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    // Clean up search history
    for (const [identifier, history] of searchHistoryStore.entries()) {
      const filtered = history.filter(e => e.timestamp > now - maxAge);
      if (filtered.length === 0) {
        searchHistoryStore.delete(identifier);
      } else if (filtered.length !== history.length) {
        searchHistoryStore.set(identifier, filtered);
      }
    }
    
    // Clean up expired blocks
    for (const [identifier, blocked] of blockedUsersStore.entries()) {
      if (now > blocked.blockedUntil) {
        blockedUsersStore.delete(identifier);
      }
    }
  }, 5 * 60 * 1000);
}

// ============================================
// Export Convenience Functions
// ============================================

/**
 * Check if an identifier is blocked
 */
export function isSearchBlocked(identifier: string): BlockedUser | null {
  return getSearchRateLimiter().isBlocked(identifier);
}

/**
 * Track a search query
 */
export function trackSearchQuery(
  identifier: string,
  query: string,
  endpoint: 'players' | 'orgs' | 'tournaments',
  page: number,
  userAgent?: string,
  userId?: string
): void {
  getSearchRateLimiter().trackSearchQuery(identifier, query, endpoint, page, userAgent, userId);
}

/**
 * Detect search abuse
 */
export function detectSearchAbuse(identifier: string): AbuseDetectionResult {
  return getSearchRateLimiter().detectSearchAbuse(identifier);
}

/**
 * Block a search abuser
 */
export function blockSearchAbuser(identifier: string, reason: string): BlockedUser {
  return getSearchRateLimiter().blockSearchAbuser(identifier, reason);
}
