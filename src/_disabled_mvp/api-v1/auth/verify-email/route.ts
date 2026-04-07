/**
 * V1 Auth Verify Email API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/verify-email
 * 
 * Request body:
 * {
 *   "token": "verification_token"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Email verified successfully",
 *     "user": { id, email, sport }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';
import { addVersionHeaders } from '@/lib/api-versioning';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

/**
 * POST /api/v1/auth/verify-email
 * Verify email with token (for mobile apps)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return apiError(
        ApiErrorCodes.MISSING_REQUIRED_FIELD,
        'Verification token is required',
        { required: ['token'] }
      );
    }

    const result = await verifyEmailToken(token);

    if (!result.success) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        result.error || 'Email verification failed',
        undefined,
        400
      );
    }

    const response = NextResponse.json({
      success: true,
      data: {
        message: 'Email verified successfully',
        user: {
          id: result.userId,
          email: result.email,
          sport: result.sport,
        },
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Auth] Email verification error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'An error occurred during verification',
      undefined,
      500
    );
  }
}

/**
 * GET /api/v1/auth/verify-email?token=xxx
 * Verify email with token (redirect-based, for web links from emails)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    const response = NextResponse.json({
      success: false,
      error: 'MISSING_TOKEN',
      message: 'Verification token is missing. Please request a new verification email.',
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    }, { status: 400 });
    addVersionHeaders(response, 'v1');
    return response;
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    const response = NextResponse.json({
      success: false,
      error: 'VERIFICATION_FAILED',
      message: result.error || 'Email verification failed. Please try again.',
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    }, { status: 400 });
    addVersionHeaders(response, 'v1');
    return response;
  }

  console.log(`[V1 Auth] Email verification successful for user ${result.userId}`);

  const response = NextResponse.json({
    success: true,
    data: {
      message: 'Your email has been verified successfully! You can now log in.',
      user: {
        id: result.userId,
        email: result.email,
        sport: result.sport,
      },
    },
    meta: {
      version: 'v1',
      timestamp: new Date().toISOString(),
    },
  });
  addVersionHeaders(response, 'v1');
  response.headers.set('X-API-Immutable', 'true');
  return response;
}
