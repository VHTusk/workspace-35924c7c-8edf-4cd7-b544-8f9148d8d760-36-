/**
 * VALORHIVE Request Size Limits
 * 
 * Enforces body size limits to prevent:
 * - Request amplification attacks
 * - Memory exhaustion
 * - DoS via large payloads
 * 
 * @module request-size-limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError, ApiErrorCodes } from '@/lib/api-response';

// ============================================
// Size Limit Configuration
// ============================================

/**
 * Size limits for different request contexts (in bytes)
 */
export const SIZE_LIMITS = {
  // Standard API requests
  api: {
    default: 100 * 1024,        // 100 KB for standard API requests
    max: 500 * 1024,            // 500 KB max for complex requests
  },
  
  // File uploads (handled by file-upload-security.ts)
  upload: {
    profilePhoto: 5 * 1024 * 1024,    // 5 MB
    idDocument: 5 * 1024 * 1024,       // 5 MB
    tournamentGallery: 10 * 1024 * 1024, // 10 MB
    contractPdf: 5 * 1024 * 1024,      // 5 MB
    orgLogo: 2 * 1024 * 1024,          // 2 MB
    default: 5 * 1024 * 1024,          // 5 MB default
  },
  
  // Webhooks (may have larger payloads)
  webhook: {
    razorpay: 64 * 1024,          // 64 KB for payment webhooks
    default: 128 * 1024,          // 128 KB default for webhooks
  },
  
  // Auth endpoints (small payloads)
  auth: {
    login: 4 * 1024,              // 4 KB
    register: 16 * 1024,          // 16 KB
    default: 16 * 1024,           // 16 KB
  },
  
  // Bulk operations
  bulk: {
    import: 10 * 1024 * 1024,     // 10 MB for bulk imports
    export: 1 * 1024 * 1024,      // 1 MB for export requests
  },
} as const;

/**
 * Route-specific size limits mapping
 */
export const ROUTE_SIZE_LIMITS: Record<string, number> = {
  // Auth routes - small limits
  '/api/auth/login': SIZE_LIMITS.auth.login,
  '/api/auth/register': SIZE_LIMITS.auth.register,
  '/api/auth/org/login': SIZE_LIMITS.auth.login,
  '/api/auth/org/register': SIZE_LIMITS.auth.register,
  '/api/v1/auth/login': SIZE_LIMITS.auth.login,
  '/api/v1/auth/register': SIZE_LIMITS.auth.register,
  
  // Upload routes - larger limits
  '/api/upload': SIZE_LIMITS.upload.default,
  '/api/player/profile': SIZE_LIMITS.upload.profilePhoto,
  '/api/org/profile': SIZE_LIMITS.upload.orgLogo,
  
  // Webhook routes - specific limits
  '/api/payments/webhook': SIZE_LIMITS.webhook.razorpay,
  
  // Bulk operations
  '/api/admin/players/import': SIZE_LIMITS.bulk.import,
  '/api/org/roster/import': SIZE_LIMITS.bulk.import,
};

// ============================================
// Types
// ============================================

export interface SizeLimitConfig {
  /** Maximum allowed size in bytes */
  maxSize: number;
  /** Whether to check Content-Length header first */
  checkContentLength: boolean;
  /** Whether to validate actual body size */
  validateBodySize: boolean;
  /** Custom error message */
  errorMessage?: string;
}

export interface SizeCheckResult {
  allowed: boolean;
  size?: number;
  limit?: number;
  error?: string;
}

// ============================================
// Size Limit Functions
// ============================================

/**
 * Get the size limit for a specific route
 */
export function getSizeLimitForRoute(pathname: string): number {
  // Check for exact match
  if (ROUTE_SIZE_LIMITS[pathname]) {
    return ROUTE_SIZE_LIMITS[pathname];
  }
  
  // Check for prefix matches
  for (const [route, limit] of Object.entries(ROUTE_SIZE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return limit;
    }
  }
  
  // Check route patterns
  if (pathname.includes('/upload') || pathname.includes('/media')) {
    return SIZE_LIMITS.upload.default;
  }
  
  if (pathname.includes('/webhook')) {
    return SIZE_LIMITS.webhook.default;
  }
  
  if (pathname.includes('/auth/')) {
    return SIZE_LIMITS.auth.default;
  }
  
  if (pathname.includes('/bulk') || pathname.includes('/import')) {
    return SIZE_LIMITS.bulk.import;
  }
  
  // Default API limit
  return SIZE_LIMITS.api.default;
}

/**
 * Check Content-Length header against size limit
 * Fast check that doesn't require reading the body
 */
export function checkContentLength(
  request: NextRequest,
  maxSize?: number
): SizeCheckResult {
  const contentLength = request.headers.get('content-length');
  
  if (!contentLength) {
    // No Content-Length header - will need to check body
    return { allowed: true };
  }
  
  const size = parseInt(contentLength, 10);
  const limit = maxSize ?? getSizeLimitForRoute(request.nextUrl.pathname);
  
  if (isNaN(size)) {
    return {
      allowed: false,
      error: 'Invalid Content-Length header',
    };
  }
  
  if (size > limit) {
    return {
      allowed: false,
      size,
      limit,
      error: `Request body too large: ${formatSize(size)} exceeds limit of ${formatSize(limit)}`,
    };
  }
  
  return {
    allowed: true,
    size,
    limit,
  };
}

/**
 * Validate request body size by reading it
 * More accurate but slower than Content-Length check
 */
export async function validateBodySize(
  request: NextRequest,
  maxSize?: number
): Promise<SizeCheckResult> {
  const limit = maxSize ?? getSizeLimitForRoute(request.nextUrl.pathname);
  
  try {
    // Clone request to not consume the body
    const clonedRequest = request.clone();
    const body = await clonedRequest.arrayBuffer();
    const size = body.byteLength;
    
    if (size > limit) {
      return {
        allowed: false,
        size,
        limit,
        error: `Request body too large: ${formatSize(size)} exceeds limit of ${formatSize(limit)}`,
      };
    }
    
    return {
      allowed: true,
      size,
      limit,
    };
  } catch (error) {
    return {
      allowed: false,
      error: 'Failed to read request body',
    };
  }
}

/**
 * Check both Content-Length and actual body size
 * Use for critical endpoints
 */
export async function strictSizeCheck(
  request: NextRequest,
  maxSize?: number
): Promise<SizeCheckResult> {
  // First check Content-Length header
  const headerCheck = checkContentLength(request, maxSize);
  
  if (!headerCheck.allowed) {
    return headerCheck;
  }
  
  // Then validate actual body size
  return validateBodySize(request, maxSize);
}

/**
 * Format size for error messages
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Check request size and return error response if exceeded
 * To be used in API middleware chain
 */
export async function checkRequestSize(
  request: NextRequest,
  options?: {
    maxSize?: number;
    strict?: boolean;
  }
): Promise<NextResponse | null> {
  const { maxSize, strict = false } = options || {};
  
  // Only check for methods that have a body
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
    return null;
  }
  
  const result = strict
    ? await strictSizeCheck(request, maxSize)
    : checkContentLength(request, maxSize);
  
  if (!result.allowed) {
    return apiError(
      ApiErrorCodes.VALIDATION_ERROR,
      result.error || 'Request body too large',
      {
        size: result.size,
        limit: result.limit,
        maxSize: result.limit,
      },
      413 // Payload Too Large
    );
  }
  
  return null;
}

/**
 * Get size limit info for a request (for logging/monitoring)
 */
export function getSizeLimitInfo(request: NextRequest): {
  pathname: string;
  limit: number;
  contentLength: number | null;
  method: string;
} {
  const pathname = request.nextUrl.pathname;
  const contentLengthHeader = request.headers.get('content-length');
  
  return {
    pathname,
    limit: getSizeLimitForRoute(pathname),
    contentLength: contentLengthHeader ? parseInt(contentLengthHeader, 10) : null,
    method: request.method,
  };
}

// ============================================
// Export Summary
// ============================================

export const REQUEST_SIZE_LIMITS_SUMMARY = {
  default: {
    api: '100 KB',
    upload: '5 MB',
    webhook: '128 KB',
    auth: '16 KB',
  },
  enforcement: {
    contentLength: 'Fast header-based check',
    bodyValidation: 'Accurate body-based check',
    strict: 'Both checks combined',
  },
  routes: Object.entries(ROUTE_SIZE_LIMITS).map(([route, limit]) => ({
    route,
    limit: formatSize(limit),
  })),
};
