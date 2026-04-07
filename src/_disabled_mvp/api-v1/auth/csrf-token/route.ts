/**
 * V1 Auth CSRF Token API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/auth/csrf-token
 * 
 * Headers:
 * Authorization: Bearer <session_token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "csrfToken": "token_here"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { setCsrfCookie, generateCsrfToken } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    // Generate new CSRF token
    const csrfToken = generateCsrfToken();

    const response = NextResponse.json({
      success: true,
      data: {
        csrfToken,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    // Set CSRF cookie
    setCsrfCookie(response);
    
    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Auth] CSRF token error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to generate CSRF token',
      undefined,
      500
    );
  }
}
