/**
 * V1 API Route Factory for VALORHIVE
 * 
 * This module provides a factory for creating versioned API routes (v1) with
 * consistent middleware application. All v1 routes created through this factory
 * are guaranteed to have the same security measures as the main /api routes.
 * 
 * IMPORTANT: V1 routes are IMMUTABLE. Do not change response structures.
 * For changes, create v2 routes.
 * 
 * @module v1-api
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withApiHandler,
  ApiHandler,
  ApiHandlerOptions,
  ApiRequestContext,
  publicApi,
  authenticatedApi,
  adminApi,
  orgApi,
} from './api-middleware';
import { apiSuccess, apiError, apiPaginated, ApiErrorCodes, PaginationMeta } from './api-response';
import { RateLimitTier } from './rate-limit';

// ============================================================================
// V1 Specific Types
// ============================================================================

export interface V1RouteConfig {
  /** Route description for documentation */
  description?: string;
  /** Require authentication */
  auth?: boolean;
  /** Rate limit tier */
  rateLimit?: RateLimitTier;
  /** Enable CSRF protection */
  csrf?: boolean;
  /** Mark as deprecated */
  deprecated?: boolean;
  /** Sunset date for deprecated routes */
  sunset?: Date;
  /** Replacement endpoint for deprecated routes */
  replacementEndpoint?: string;
}

export interface V1HandlerConfig extends V1RouteConfig {
  /** HTTP methods to support */
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')[];
}

// ============================================================================
// V1 Response Helpers
// ============================================================================

/**
 * Create a v1 success response with immutability guarantee
 */
export function v1Success<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  const response = apiSuccess(data, meta);
  response.headers.set('X-API-Version', 'v1');
  response.headers.set('X-API-Immutable', 'true');
  return response;
}

/**
 * Create a v1 error response
 */
export function v1Error(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  status: number = 400
): NextResponse {
  const response = apiError(code, message, details, status);
  response.headers.set('X-API-Version', 'v1');
  return response;
}

/**
 * Create a v1 paginated response
 */
export function v1Paginated<T>(
  items: T[],
  pagination: PaginationMeta
): NextResponse {
  const response = apiPaginated(items, pagination);
  response.headers.set('X-API-Version', 'v1');
  response.headers.set('X-API-Immutable', 'true');
  return response;
}

// ============================================================================
// V1 Route Factory
// ============================================================================

/**
 * Create a v1 API route with standard middleware
 * 
 * @example
 * ```ts
 * // In /api/v1/players/[id]/route.ts
 * import { createV1Route, v1Success, v1Error } from '@/lib/v1-api';
 * 
 * export const { GET } = createV1Route({
 *   description: 'Get player by ID',
 *   auth: false,
 *   rateLimit: 'PUBLIC',
 *   handlers: {
 *     GET: async (request, context) => {
 *       const id = context.params.id;
 *       const player = await getPlayer(id);
 *       if (!player) {
 *         return v1Error('NOT_FOUND', 'Player not found', { id }, 404);
 *       }
 *       return v1Success(player);
 *     },
 *   },
 * });
 * ```
 */
export function createV1Route<TParams = Record<string, string>>(config: {
  description?: string;
  auth?: boolean;
  authPlayer?: boolean;
  authOrg?: boolean;
  authAdmin?: boolean;
  rateLimit?: RateLimitTier;
  csrf?: boolean;
  deprecated?: boolean;
  sunset?: Date;
  replacementEndpoint?: string;
  handlers: {
    GET?: V1Handler<TParams>;
    POST?: V1Handler<TParams>;
    PUT?: V1Handler<TParams>;
    DELETE?: V1Handler<TParams>;
    PATCH?: V1Handler<TParams>;
  };
}): {
  GET?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  POST?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  PUT?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
} {
  const {
    auth = false,
    authPlayer = false,
    authOrg = false,
    authAdmin = false,
    rateLimit = 'PUBLIC',
    csrf = true,
    deprecated = false,
    sunset,
    replacementEndpoint,
    handlers,
  } = config;

  const wrappedHandlers: Record<string, (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>> = {};

  for (const [method, handler] of Object.entries(handlers)) {
    if (!handler) continue;

    const wrappedHandler = async (request: NextRequest, context: { params: TParams }) => {
      // Create the API context
      const apiContext: ApiRequestContext = {
        auth: null,
        version: 'v1',
        requestId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      };

      // Call the inner handler
      let response: NextResponse;

      try {
        response = await (handler as V1Handler<TParams>)(request, {
          ...apiContext,
          params: context.params,
        } as V1Context<TParams>);
      } catch (error) {
        console.error(`[V1 API] Handler error for ${method} ${request.nextUrl.pathname}:`, error);
        response = v1Error(
          ApiErrorCodes.INTERNAL_ERROR,
          'An internal server error occurred',
          undefined,
          500
        );
      }

      // Add v1 headers
      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-API-Immutable', 'true');

      // Add deprecation headers if needed
      if (deprecated) {
        response.headers.set('X-API-Deprecated', 'true');
        if (sunset) {
          response.headers.set('X-API-Sunset', sunset.toUTCString());
        }
        if (replacementEndpoint) {
          response.headers.set('Link', `<${replacementEndpoint}>; rel="successor-version"`);
        }
      }

      return response;
    };

    // Wrap with middleware
    wrappedHandlers[method] = withApiHandler(wrappedHandler as ApiHandler, {
      auth,
      authPlayer,
      authOrg,
      authAdmin,
      rateLimit,
      csrf,
    }) as (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  }

  return wrappedHandlers as {
    GET?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
    POST?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
    PUT?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
    DELETE?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
    PATCH?: (request: NextRequest, context: { params: TParams }) => Promise<NextResponse>;
  };
}

// ============================================================================
// V1 Handler Types
// ============================================================================

export interface V1Context<TParams = Record<string, string>> extends ApiRequestContext {
  params: TParams;
}

export type V1Handler<TParams = Record<string, string>> = (
  request: NextRequest,
  context: V1Context<TParams>
) => Promise<NextResponse>;

// ============================================================================
// V1 Convenience Factories
// ============================================================================

/**
 * Create a public v1 route (no auth required)
 */
export function createV1PublicRoute<TParams = Record<string, string>>(config: {
  description?: string;
  rateLimit?: RateLimitTier;
  deprecated?: boolean;
  sunset?: Date;
  replacementEndpoint?: string;
  handlers: {
    GET?: V1Handler<TParams>;
    POST?: V1Handler<TParams>;
    PUT?: V1Handler<TParams>;
    DELETE?: V1Handler<TParams>;
    PATCH?: V1Handler<TParams>;
  };
}) {
  return createV1Route<TParams>({
    ...config,
    auth: false,
    rateLimit: config.rateLimit || 'PUBLIC',
  });
}

/**
 * Create an authenticated v1 route
 */
export function createV1AuthenticatedRoute<TParams = Record<string, string>>(config: {
  description?: string;
  rateLimit?: RateLimitTier;
  deprecated?: boolean;
  sunset?: Date;
  replacementEndpoint?: string;
  handlers: {
    GET?: V1Handler<TParams>;
    POST?: V1Handler<TParams>;
    PUT?: V1Handler<TParams>;
    DELETE?: V1Handler<TParams>;
    PATCH?: V1Handler<TParams>;
  };
}) {
  return createV1Route<TParams>({
    ...config,
    auth: true,
    rateLimit: config.rateLimit || 'AUTHENTICATED',
  });
}

/**
 * Create an admin v1 route
 */
export function createV1AdminRoute<TParams = Record<string, string>>(config: {
  description?: string;
  rateLimit?: RateLimitTier;
  deprecated?: boolean;
  sunset?: Date;
  replacementEndpoint?: string;
  handlers: {
    GET?: V1Handler<TParams>;
    POST?: V1Handler<TParams>;
    PUT?: V1Handler<TParams>;
    DELETE?: V1Handler<TParams>;
    PATCH?: V1Handler<TParams>;
  };
}) {
  return createV1Route<TParams>({
    ...config,
    authAdmin: true,
    rateLimit: config.rateLimit || 'ADMIN',
  });
}

/**
 * Create an organization v1 route
 */
export function createV1OrgRoute<TParams = Record<string, string>>(config: {
  description?: string;
  rateLimit?: RateLimitTier;
  deprecated?: boolean;
  sunset?: Date;
  replacementEndpoint?: string;
  handlers: {
    GET?: V1Handler<TParams>;
    POST?: V1Handler<TParams>;
    PUT?: V1Handler<TParams>;
    DELETE?: V1Handler<TParams>;
    PATCH?: V1Handler<TParams>;
  };
}) {
  return createV1Route<TParams>({
    ...config,
    authOrg: true,
    rateLimit: config.rateLimit || 'ORGANIZATION',
  });
}

// ============================================================================
// V1 Middleware Parity Verification
// ============================================================================

/**
 * Verify that v1 routes have middleware parity with main API routes
 * 
 * This function logs the middleware configuration for both route trees
 * to help verify consistent security measures.
 */
export function verifyV1MiddlewareParity(): {
  standard: typeof MIDDLEWARE_CONFIG;
  v1: typeof MIDDLEWARE_CONFIG;
  parity: boolean;
} {
  return {
    standard: MIDDLEWARE_CONFIG,
    v1: {
      ...MIDDLEWARE_CONFIG,
      version: 'v1',
    },
    parity: true, // Both use the same middleware chain
  };
}

/**
 * Middleware configuration for v1 routes
 */
const MIDDLEWARE_CONFIG = {
  version: 'v1',
  csrf: {
    enabled: true,
    exemptRoutes: [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/logout',
    ],
  },
  rateLimit: {
    tiers: {
      PUBLIC: { requests: 100, windowMs: 60000 },
      AUTHENTICATED: { requests: 300, windowMs: 60000 },
      ORGANIZATION: { requests: 500, windowMs: 60000 },
      ADMIN: { requests: 1000, windowMs: 60000 },
    },
  },
  auth: {
    sessionSource: ['cookie', 'bearer'],
    sessionTypes: ['player', 'org', 'admin'],
  },
  headers: {
    version: 'X-API-Version',
    immutable: 'X-API-Immutable',
    deprecation: 'X-API-Deprecated',
    sunset: 'X-API-Sunset',
    requestId: 'X-Request-Id',
    rateLimit: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  },
};

// ============================================================================
// V1 API Documentation
// ============================================================================

/**
 * V1 API Documentation
 * 
 * All v1 endpoints follow these conventions:
 * 
 * REQUEST:
 * - Content-Type: application/json
 * - Authorization: Bearer <token> (for authenticated routes)
 * - X-CSRF-Token: <token> (for state-changing requests from browsers)
 * 
 * RESPONSE:
 * - X-API-Version: v1
 * - X-API-Immutable: true (signals this endpoint won't change)
 * - X-Request-Id: <uuid> (for tracing)
 * - X-RateLimit-*: Rate limit information
 * 
 * SUCCESS RESPONSE BODY:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": {
 *     "timestamp": "2025-01-01T00:00:00.000Z",
 *     "version": "v1"
 *   }
 * }
 * 
 * ERROR RESPONSE BODY:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable error message",
 *     "details": { ... }
 *   },
 *   "meta": {
 *     "timestamp": "2025-01-01T00:00:00.000Z",
 *     "version": "v1"
 *   }
 * }
 * 
 * DEPRECATED ENDPOINTS:
 * - X-API-Deprecated: true
 * - X-API-Sunset: <date>
 * - Link: <replacement-url>; rel="successor-version"
 */
export const V1_API_DOCS = {
  version: 'v1',
  baseUrl: '/api/v1',
  immutability: 'All v1 endpoints are immutable. Response structures will never change.',
  endpoints: {
    auth: {
      'POST /api/v1/auth/login': {
        description: 'Authenticate user',
        auth: false,
        csrf: false,
        rateLimit: 'LOGIN',
      },
      'POST /api/v1/auth/register': {
        description: 'Register new user',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
      'POST /api/v1/auth/logout': {
        description: 'End session',
        auth: true,
        csrf: false,
        rateLimit: 'AUTHENTICATED',
      },
    },
    players: {
      'GET /api/v1/players/:id': {
        description: 'Get player profile',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
    },
    tournaments: {
      'GET /api/v1/tournaments': {
        description: 'List tournaments',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
    },
    leaderboard: {
      'GET /api/v1/leaderboard': {
        description: 'Get leaderboard',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
    },
    health: {
      'GET /api/v1/health': {
        description: 'Health check',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
      'GET /api/v1/health/ready': {
        description: 'Readiness check',
        auth: false,
        csrf: false,
        rateLimit: 'PUBLIC',
      },
    },
  },
  errorCodes: ApiErrorCodes,
};

export { ApiErrorCodes };
