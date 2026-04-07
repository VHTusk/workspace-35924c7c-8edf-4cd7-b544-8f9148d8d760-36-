/**
 * API Versioning - V1 Response Wrapper
 * 
 * All v1 API responses use this consistent format.
 * Mobile apps can rely on this structure NEVER changing.
 * 
 * DO NOT BREAK THIS CONTRACT - v1 is immutable.
 * For changes, create v2 routes.
 */

import { NextResponse } from 'next/server';

// API Version constants
export const API_VERSION = 'v1' as const;
export const API_VERSION_DATE = '2025-01-01' as const;

// Standard API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    version: typeof API_VERSION;
    requestId?: string;
  };
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// Success response helper
export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      ...meta,
    },
  });
}

// Error response helper
export function apiError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: API_VERSION,
      },
    },
    { status }
  );
}

// Paginated response helper
export function apiPaginated<T>(
  items: T[],
  pagination: PaginationMeta
): NextResponse<ApiResponse<{ items: T[]; pagination: PaginationMeta }>> {
  return apiSuccess(
    { items, pagination },
    { totalPages: pagination.totalPages }
  );
}

// Error codes enum - these codes should NEVER change in v1
export const ApiErrorCodes = {
  // Authentication errors (1xxx)
  UNAUTHORIZED: 'AUTH_001',
  SESSION_EXPIRED: 'AUTH_002',
  INVALID_CREDENTIALS: 'AUTH_003',
  ACCOUNT_NOT_FOUND: 'AUTH_004',
  TOKEN_INVALID: 'AUTH_005',
  
  // Validation errors (2xxx)
  VALIDATION_ERROR: 'VAL_001',
  MISSING_FIELD: 'VAL_002',
  MISSING_REQUIRED_FIELD: 'VAL_002',
  INVALID_FORMAT: 'VAL_003',
  VALUE_OUT_OF_RANGE: 'VAL_004',
  
  // Resource errors (3xxx)
  NOT_FOUND: 'RES_001',
  PLAYER_NOT_FOUND: 'RES_001',
  TOURNAMENT_NOT_FOUND: 'RES_001',
  ALREADY_EXISTS: 'RES_002',
  CONFLICT: 'RES_003',
  
  // Permission errors (4xxx)
  FORBIDDEN: 'PERM_001',
  INSUFFICIENT_PRIVILEGES: 'PERM_002',
  
  // Rate limiting (5xxx)
  RATE_LIMITED: 'RATE_001',
  
  // Server errors (9xxx)
  INTERNAL_ERROR: 'SRV_001',
  SERVICE_UNAVAILABLE: 'SRV_002',
} as const;

// Rate limit headers to include in v1 responses
export const RATE_LIMIT_HEADERS = {
  limit: 'X-RateLimit-Limit',
  remaining: 'X-RateLimit-Remaining',
  reset: 'X-RateLimit-Reset',
};

// Add rate limit headers to response
export function withRateLimitHeaders<T>(
  response: NextResponse<ApiResponse<T>>,
  limit: number,
  remaining: number,
  resetAt: number
): NextResponse<ApiResponse<T>> {
  response.headers.set(RATE_LIMIT_HEADERS.limit, limit.toString());
  response.headers.set(RATE_LIMIT_HEADERS.remaining, remaining.toString());
  response.headers.set(RATE_LIMIT_HEADERS.reset, resetAt.toString());
  return response;
}

// ============================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================

/**
 * @deprecated Use apiSuccess instead
 */
export const apiResponse = apiSuccess;
