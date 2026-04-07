/**
 * V1 Auth Check API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/auth/check
 * 
 * Headers:
 * Authorization: Bearer <session_token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "authenticated": true,
 *     "user": { ... },
 *     "session": { ... }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiSuccess({
        authenticated: false,
        user: null,
        session: null,
      });
    }

    const { user, session } = auth;

    const response = NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
          sport: user.sport,
          role: user.role,
        },
        session: {
          sport: session.sport,
          accountType: session.accountType,
          expiresAt: session.expiresAt.toISOString(),
        },
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Auth] Check error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to check authentication',
      undefined,
      500
    );
  }
}
