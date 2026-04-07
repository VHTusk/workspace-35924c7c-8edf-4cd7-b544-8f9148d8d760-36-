/**
 * V1 Auth Logout API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/logout
 * 
 * Headers:
 * Authorization: Bearer <session_token>
 */

import { NextRequest } from 'next/server';
import { deleteSession } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header or custom header
    const authHeader = request.headers.get('authorization');
    const customToken = request.headers.get('x-session-token');
    
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : customToken;

    if (!token) {
      return apiError(
        ApiErrorCodes.TOKEN_INVALID,
        'No session token provided',
        undefined,
        401
      );
    }

    // Delete session
    await deleteSession(token);

    return apiSuccess({ loggedOut: true });
  } catch (error) {
    console.error('[V1 Auth] Logout error:', error);
    return apiSuccess({ loggedOut: true }); // Always return success for logout
  }
}
