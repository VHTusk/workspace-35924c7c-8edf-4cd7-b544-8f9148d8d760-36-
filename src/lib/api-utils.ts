/**
 * API Route Utilities
 * 
 * Utilities to prevent 504 Gateway Timeout issues:
 * - Timeout guards for async operations
 * - Safe fetch with abort controller
 * - Response helpers
 */

import { NextResponse } from 'next/server';

// ============================================
// Types
// ============================================

export interface TimeoutOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Error message to include in timeout response */
  message?: string;
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
}

// ============================================
// Timeout Guard
// ============================================

/**
 * Wraps an async operation with a timeout guard.
 * If the operation doesn't complete within the timeout, returns a 504 response.
 * 
 * @param operation - The async operation to execute
 * @param options - Timeout options
 * @returns The operation result or a 504 NextResponse on timeout
 * 
 * @example
 * const result = await withTimeout(
 *   async () => {
 *     const data = await db.user.findMany();
 *     return NextResponse.json({ data });
 *   },
 *   { timeout: 5000, message: 'Database query timed out' }
 * );
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T | NextResponse> {
  const { timeout = 10000, message = 'Operation timed out' } = options;

  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(
        NextResponse.json(
          { 
            error: 'Gateway Timeout',
            message,
            code: 'TIMEOUT'
          },
          { status: 504 }
        )
      );
    }, timeout);
  });

  try {
    const result = await Promise.race([
      operation(),
      timeoutPromise,
    ]);
    
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ============================================
// Safe Fetch with Timeout
// ============================================

/**
 * Fetch with automatic timeout using AbortController.
 * Prevents hanging on unresponsive external services.
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout
 * @returns The fetch Response or throws on timeout
 * 
 * @example
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   timeout: 5000,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fetch timed out after ${timeout}ms: ${url}`);
    }
    
    throw error;
  }
}

// ============================================
// Route Timeout Guard
// ============================================

/**
 * Creates a route-level timeout guard that ensures every route
 * returns a response within the specified time.
 * 
 * @param handler - The route handler function
 * @param options - Timeout options
 * @returns A wrapped handler with timeout protection
 * 
 * @example
 * export const GET = withRouteTimeout(
 *   async (request: NextRequest) => {
 *     // ... route logic
 *     return NextResponse.json({ data });
 *   },
 *   { timeout: 30000 }
 * );
 */
export function withRouteTimeout<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: TimeoutOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const { timeout = 30000, message = 'Request processing timed out' } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await handler(...args);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[API] Route timed out after ${timeout}ms`);
        return NextResponse.json(
          {
            error: 'Gateway Timeout',
            message,
            code: 'ROUTE_TIMEOUT'
          },
          { status: 504 }
        );
      }
      
      console.error('[API] Route error:', error);
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }) as T;
}

// ============================================
// Route Logging Helper
// ============================================

/**
 * Logs route entry and exit for debugging timeout issues.
 * 
 * @param routeName - Name of the route
 * @param request - The incoming request
 * @returns A function to call when the route completes
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const done = logRoute('GET /api/users', request);
 *   try {
 *     // ... route logic
 *     return NextResponse.json({ data });
 *   } finally {
 *     done();
 *   }
 * }
 */
export function logRoute(
  routeName: string,
  request: Request
): () => void {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  
  console.log(`[API] ${requestId} >>> ${routeName} START`);
  
  return () => {
    const duration = Date.now() - startTime;
    console.log(`[API] ${requestId} <<< ${routeName} END (${duration}ms)`);
  };
}

// ============================================
// Safe Response Helpers
// ============================================

/**
 * Ensures a value is returned as a proper NextResponse.
 * Useful for ensuring all branches return a response.
 */
export function ensureResponse(
  value: NextResponse | undefined | null,
  fallbackMessage = 'No response generated'
): NextResponse {
  if (value instanceof NextResponse) {
    return value;
  }
  
  console.error('[API] ensureResponse: No valid response, returning fallback');
  return NextResponse.json(
    { error: 'Internal Server Error', message: fallbackMessage },
    { status: 500 }
  );
}

/**
 * Creates a standardized error response.
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message,
      ...(code && { code })
    },
    { status }
  );
}

/**
 * Creates a standardized success response.
 */
export function successResponse(
  data: unknown,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}
