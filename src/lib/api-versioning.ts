/**
 * API Versioning System for VALORHIVE
 * 
 * Versioning Strategy:
 * - URL-based versioning: /api/v1/..., /api/v2/...
 * - Current version: v1
 * - Legacy support: Unversioned routes map to current version
 * - Deprecation notices via headers
 */

import { NextRequest, NextResponse } from 'next/server';

export const API_VERSIONS = {
  CURRENT: 'v1',
  SUPPORTED: ['v1'],
  DEPRECATED: [] as string[],
} as const;

export type ApiVersion = typeof API_VERSIONS.CURRENT;

/**
 * API Version header names
 */
export const VERSION_HEADERS = {
  API_VERSION: 'X-API-Version',
  DEPRECATION: 'X-API-Deprecation',
  SUNSET: 'X-API-Sunset',
  LINK: 'Link',
} as const;

/**
 * Add version headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion = API_VERSIONS.CURRENT
): NextResponse {
  response.headers.set(VERSION_HEADERS.API_VERSION, version);
  return response;
}

/**
 * Add deprecation headers to response
 */
export function addDeprecationHeaders(
  response: NextResponse,
  sunsetDate: Date,
  replacementEndpoint?: string
): NextResponse {
  response.headers.set(VERSION_HEADERS.DEPRECATION, 'true');
  response.headers.set(VERSION_HEADERS.SUNSET, sunsetDate.toUTCString());

  if (replacementEndpoint) {
    response.headers.set(
      VERSION_HEADERS.LINK,
      `<${replacementEndpoint}>; rel="successor-version"`
    );
  }

  return response;
}

/**
 * Extract API version from request
 */
export function extractVersion(request: NextRequest): ApiVersion {
  const pathname = request.nextUrl.pathname;

  // Check for version in path
  const versionMatch = pathname.match(/\/api\/(v\d+)\//);
  if (versionMatch && API_VERSIONS.SUPPORTED.includes(versionMatch[1] as any)) {
    return versionMatch[1] as ApiVersion;
  }

  // Default to current version for unversioned routes
  return API_VERSIONS.CURRENT;
}

/**
 * Version-aware response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    version: ApiVersion;
    timestamp: string;
    deprecated?: boolean;
    sunset?: string;
  };
}

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
  data: T,
  options: {
    deprecated?: boolean;
    sunset?: Date;
    replacementEndpoint?: string;
  } = {}
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      version: API_VERSIONS.CURRENT,
      timestamp: new Date().toISOString(),
    },
  };

  if (options.deprecated) {
    response.meta!.deprecated = true;
  }

  if (options.sunset) {
    response.meta!.sunset = options.sunset.toISOString();
  }

  const nextResponse = NextResponse.json(response);
  addVersionHeaders(nextResponse);

  if (options.deprecated && options.sunset) {
    addDeprecationHeaders(nextResponse, options.sunset, options.replacementEndpoint);
  }

  return nextResponse;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 400,
  code?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      version: API_VERSIONS.CURRENT,
      timestamp: new Date().toISOString(),
    },
  };

  const nextResponse = NextResponse.json(response, { status: statusCode });
  addVersionHeaders(nextResponse);

  return nextResponse;
}

/**
 * API route version handler
 */
export function createVersionedHandler<T extends { GET?: any; POST?: any; PUT?: any; DELETE?: any; PATCH?: any }>(
  handlers: T,
  options: {
    deprecated?: boolean;
    sunset?: Date;
    replacementEndpoint?: string;
  } = {}
): T {
  const wrappedHandlers = {} as T;

  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
    if (handlers[method]) {
      wrappedHandlers[method] = async (request: NextRequest, context: any) => {
        const result = await handlers[method]!(request, context);

        // Add version headers to all responses
        if (result instanceof NextResponse) {
          addVersionHeaders(result);

          if (options.deprecated && options.sunset) {
            addDeprecationHeaders(result, options.sunset, options.replacementEndpoint);
          }
        }

        return result;
      };
    }
  }

  return wrappedHandlers;
}

/**
 * Version router - route requests to appropriate version handler
 */
export class ApiVersionRouter {
  private handlers: Map<string, Map<string, any>> = new Map();

  register(version: ApiVersion, path: string, handler: any): void {
    if (!this.handlers.has(version)) {
      this.handlers.set(version, new Map());
    }
    this.handlers.get(version)!.set(path, handler);
  }

  getHandler(version: ApiVersion, path: string): any {
    const versionHandlers = this.handlers.get(version);
    return versionHandlers?.get(path);
  }
}

/**
 * Documentation helper - generate OpenAPI-style version info
 */
export function getVersionInfo(): {
  current: ApiVersion;
  supported: readonly ApiVersion[];
  deprecated: readonly string[];
  endpoints: Record<string, string[]>;
} {
  return {
    current: API_VERSIONS.CURRENT,
    supported: API_VERSIONS.SUPPORTED,
    deprecated: API_VERSIONS.DEPRECATED,
    endpoints: {
      v1: [
        'GET /api/v1/players',
        'GET /api/v1/players/:id',
        'GET /api/v1/tournaments',
        'GET /api/v1/tournaments/:id',
        'GET /api/v1/leaderboard',
        'GET /api/v1/matches',
        // ... more endpoints
      ],
    },
  };
}

/**
 * Migration helper for version transitions
 */
export function migrateRequestPath(path: string, fromVersion: string, toVersion: string): string {
  return path.replace(`/api/${fromVersion}/`, `/api/${toVersion}/`);
}
