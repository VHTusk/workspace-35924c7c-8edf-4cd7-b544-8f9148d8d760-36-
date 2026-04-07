/**
 * V1 Auth Token Refresh API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/refresh
 * 
 * Headers:
 * Authorization: Bearer <session_token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "token": "new_session_token",
 *     "expiresAt": "2025-01-15T00:00:00.000Z"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function POST(request: NextRequest) {
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

    const { user, session } = auth;

    // Check if session is close to expiry (within 1 day)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    
    if (expiresAt.getTime() - now.getTime() < oneDayMs) {
      // Create a new session
      const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const newSession = await db.session.create({
        data: {
          userId: user.id,
          token: crypto.randomUUID(),
          sport: session.sport,
          accountType: session.accountType,
          expiresAt: newExpiresAt,
        },
      });

      // Delete old session
      await db.session.delete({
        where: { id: session.id },
      });

      const response = NextResponse.json({
        success: true,
        data: {
          token: newSession.token,
          expiresAt: newSession.expiresAt.toISOString(),
        },
        meta: {
          version: 'v1',
          timestamp: new Date().toISOString(),
        },
      });

      // Set new session cookie
      response.cookies.set('session_token', newSession.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-API-Immutable', 'true');

      return response;
    }

    // Session still valid, return current session info
    return apiSuccess({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      refreshed: false,
    });
  } catch (error) {
    console.error('[V1 Auth] Refresh error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to refresh session',
      undefined,
      500
    );
  }
}
