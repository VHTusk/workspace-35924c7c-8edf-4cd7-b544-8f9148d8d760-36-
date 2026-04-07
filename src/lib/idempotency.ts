/**
 * VALORHIVE - Idempotency Protection Middleware
 * 
 * Prevents duplicate operations for critical endpoints:
 * - Match score submission
 * - Refund processing
 * - Tournament registration
 * 
 * Usage:
 * 1. Client sends `Idempotency-Key` header with unique request identifier
 * 2. Server checks if key exists:
 *    - If exists: return previous response (cached)
 *    - If not: execute operation and store response with key
 * 3. Keys expire after 24 hours by default
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

// Resource types for idempotency keys
export type IdempotencyResourceType = 'MATCH_RESULT' | 'REFUND' | 'REGISTRATION';

// Default expiration time for idempotency keys (24 hours)
const DEFAULT_EXPIRY_HOURS = 24;

// Idempotency check result
export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  previousResponse?: {
    status: number;
    body: unknown;
  };
  requestBodyHash: string;
}

// Idempotency storage result
export interface IdempotencyStoreResult {
  success: boolean;
  error?: string;
}

/**
 * Generate a SHA-256 hash of the request body for verification
 */
export function hashRequestBody(body: unknown): string {
  const bodyString = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash('sha256').update(bodyString).digest('hex');
}

/**
 * Generate an idempotency key from user ID, action, and parameters
 * This is useful when clients don't provide their own key
 */
export function generateIdempotencyKey(
  userId: string,
  resourceType: IdempotencyResourceType,
  params: Record<string, string | number>
): string {
  const keyData = {
    userId,
    resourceType,
    ...params,
  };
  const keyString = JSON.stringify(keyData);
  return createHash('sha256').update(keyString).digest('hex');
}

/**
 * Check if an idempotency key exists and return previous response if so
 * 
 * @param key - The idempotency key from the client
 * @param requestBodyHash - Hash of the current request body for verification
 * @returns IdempotencyCheckResult with duplicate status and previous response
 */
export async function checkIdempotencyKey(
  key: string,
  requestBodyHash: string
): Promise<IdempotencyCheckResult> {
  try {
    const existingKey = await db.idempotencyKey.findUnique({
      where: { key },
    });

    if (!existingKey) {
      return {
        isDuplicate: false,
        requestBodyHash,
      };
    }

    // Check if the key has expired
    if (existingKey.expiresAt < new Date()) {
      // Clean up expired key
      await db.idempotencyKey.delete({
        where: { key },
      });
      
      return {
        isDuplicate: false,
        requestBodyHash,
      };
    }

    // Verify request body matches (prevents key reuse with different data)
    if (existingKey.requestBody !== requestBodyHash) {
      // Key reuse with different body - this is suspicious
      // Return an error instead of allowing the operation
      return {
        isDuplicate: true,
        requestBodyHash,
        previousResponse: {
          status: 400,
          body: {
            error: 'Idempotency key already used with different request body',
            code: 'IDEMPOTENCY_KEY_MISMATCH',
          },
        },
      };
    }

    // Parse the stored response
    let previousResponseBody: unknown;
    try {
      previousResponseBody = JSON.parse(existingKey.response);
    } catch {
      previousResponseBody = existingKey.response;
    }

    return {
      isDuplicate: true,
      requestBodyHash,
      previousResponse: {
        status: 200,
        body: previousResponseBody,
      },
    };
  } catch (error) {
    console.error('Error checking idempotency key:', error);
    // On error, allow the operation to proceed
    return {
      isDuplicate: false,
      requestBodyHash,
    };
  }
}

/**
 * Store an idempotency key with the response for future duplicate requests
 * 
 * @param key - The idempotency key
 * @param resourceType - Type of resource being created
 * @param resourceId - ID of the created resource
 * @param requestBodyHash - Hash of the request body
 * @param response - The response to cache
 * @param expiryHours - Hours until key expires (default: 24)
 */
export async function storeIdempotencyKey(
  key: string,
  resourceType: IdempotencyResourceType,
  resourceId: string,
  requestBodyHash: string,
  response: unknown,
  expiryHours: number = DEFAULT_EXPIRY_HOURS
): Promise<IdempotencyStoreResult> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    await db.idempotencyKey.create({
      data: {
        key,
        resourceType,
        resourceId,
        requestBody: requestBodyHash,
        response: JSON.stringify(response),
        expiresAt,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error storing idempotency key:', error);
    // If we fail to store, the operation can still succeed
    // but won't be protected against duplicates
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete an idempotency key (used when operation fails after storing)
 */
export async function deleteIdempotencyKey(key: string): Promise<void> {
  try {
    await db.idempotencyKey.delete({
      where: { key },
    });
  } catch (error) {
    console.error('Error deleting idempotency key:', error);
  }
}

/**
 * Clean up expired idempotency keys (should be called by a cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await db.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired idempotency keys:', error);
    return 0;
  }
}

/**
 * Higher-order function that wraps an API handler with idempotency protection
 * 
 * @param resourceType - Type of resource being created
 * @param handler - The original API handler function
 * @param options - Configuration options
 * @returns Wrapped handler with idempotency protection
 * 
 * @example
 * export const PUT = withIdempotency('MATCH_RESULT', async (request, { params }) => {
 *   // Your handler logic here
 *   return NextResponse.json({ success: true });
 * });
 */
export function withIdempotency<TParams extends { id: string }>(
  resourceType: IdempotencyResourceType,
  handler: (
    request: Request,
    context: { params: Promise<TParams> }
  ) => Promise<NextResponse>,
  options: {
    expiryHours?: number;
    keyHeader?: string;
    generateKeyFromParams?: (
      params: TParams,
      body: unknown,
      request: Request
    ) => string | null;
  } = {}
): (
  request: Request,
  context: { params: Promise<TParams> }
) => Promise<NextResponse> {
  const {
    expiryHours = DEFAULT_EXPIRY_HOURS,
    keyHeader = 'x-idempotency-key',
  } = options;

  return async (
    request: Request,
    context: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    // Clone the request to read the body without consuming it
    const clonedRequest = request.clone();
    
    // Get idempotency key from header
    let idempotencyKey = request.headers.get(keyHeader);
    
    // Parse request body
    let body: unknown = {};
    try {
      body = await clonedRequest.json();
    } catch {
      // No JSON body
    }

    const params = await context.params;
    
    // If no key provided, try to generate one from params
    if (!idempotencyKey && options.generateKeyFromParams) {
      idempotencyKey = options.generateKeyFromParams(params, body, request);
    }

    // If still no key, proceed without idempotency protection
    if (!idempotencyKey) {
      return handler(request, context);
    }

    // Hash the request body
    const requestBodyHash = hashRequestBody(body);

    // Check for existing key
    const checkResult = await checkIdempotencyKey(idempotencyKey, requestBodyHash);

    if (checkResult.isDuplicate && checkResult.previousResponse) {
      // Return the cached response
      return NextResponse.json(checkResult.previousResponse.body, {
        status: checkResult.previousResponse.status,
        headers: {
          'X-Idempotent-Replayed': 'true',
        },
      });
    }

    // Execute the original handler
    const response = await handler(request, context);

    // Only store successful responses
    if (response.status >= 200 && response.status < 300) {
      // Clone response to read body
      const responseClone = response.clone();
      let responseBody: unknown;
      
      try {
        responseBody = await responseClone.json();
      } catch {
        // Not JSON response
        responseBody = {};
      }

      // Extract resource ID from response or params
      const resourceId = (responseBody as { id?: string; match?: { id?: string }; registration?: { id?: string } })?.id 
        || (responseBody as { match?: { id?: string } })?.match?.id
        || (responseBody as { registration?: { id?: string } })?.registration?.id
        || params.id;

      // Store the idempotency key
      await storeIdempotencyKey(
        idempotencyKey,
        resourceType,
        resourceId,
        requestBodyHash,
        responseBody,
        expiryHours
      );
    }

    return response;
  };
}

/**
 * Create a standardized idempotency error response
 */
export function createIdempotencyErrorResponse(
  message: string,
  code: string = 'IDEMPOTENCY_ERROR'
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
    },
    { status: 400 }
  );
}

/**
 * Middleware for idempotency protection in API routes
 * Use this when you need more control than the higher-order function
 * 
 * @example
 * export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 *   const idempotencyKey = request.headers.get('x-idempotency-key');
 *   const body = await request.json();
 *   const bodyHash = hashRequestBody(body);
 *   
 *   // Check for duplicate
 *   const check = await checkIdempotencyKey(idempotencyKey, bodyHash);
 *   if (check.isDuplicate) {
 *     return NextResponse.json(check.previousResponse.body, { status: check.previousResponse.status });
 *   }
 *   
 *   // Execute operation...
 *   const result = await performOperation();
 *   
 *   // Store key
 *   await storeIdempotencyKey(idempotencyKey, 'REGISTRATION', result.id, bodyHash, result);
 *   
 *   return NextResponse.json(result);
 * }
 */
export const IdempotencyMiddleware = {
  check: checkIdempotencyKey,
  store: storeIdempotencyKey,
  delete: deleteIdempotencyKey,
  hash: hashRequestBody,
  generate: generateIdempotencyKey,
  cleanup: cleanupExpiredIdempotencyKeys,
};
