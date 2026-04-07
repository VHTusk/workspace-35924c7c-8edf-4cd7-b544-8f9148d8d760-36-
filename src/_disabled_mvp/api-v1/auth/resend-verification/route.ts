/**
 * V1 Auth Resend Verification API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/resend-verification
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "sport": "CORNHOLE" | "DARTS"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Verification email sent successfully..."
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { 
  createAndSendVerificationToken, 
  canResendVerification 
} from '@/lib/email-verification';
import { addVersionHeaders } from '@/lib/api-versioning';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, sport } = body;

    // Validate required fields
    if (!email) {
      return apiError(
        ApiErrorCodes.MISSING_REQUIRED_FIELD,
        'Email is required',
        { required: ['email'] }
      );
    }

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Invalid sport. Must be CORNHOLE or DARTS',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    const sportType = sport as SportType;

    // Find the user
    const user = await db.user.findUnique({
      where: { 
        email_sport: { 
          email: email.toLowerCase().trim(), 
          sport: sportType 
        } 
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        sport: true,
        emailVerified: true,
      },
    });

    // Don't reveal if email exists or not for security
    if (!user) {
      return apiSuccess({
        message: 'If this email is registered and not verified, a new verification email has been sent.',
        alreadyVerified: false,
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      const response = NextResponse.json({
        success: true,
        data: {
          message: 'This email is already verified. You can log in.',
          alreadyVerified: true,
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

    // Check rate limiting
    const resendCheck = await canResendVerification(user.id);
    if (!resendCheck.canResend && resendCheck.waitTimeSeconds) {
      return apiError(
        ApiErrorCodes.RATE_LIMITED,
        `Please wait ${resendCheck.waitTimeSeconds} seconds before requesting another verification email.`,
        { waitTimeSeconds: resendCheck.waitTimeSeconds },
        429
      );
    }

    // Send new verification email
    const result = await createAndSendVerificationToken(
      user.id,
      user.email!,
      user.sport,
      user.firstName
    );

    if (!result.success) {
      console.error('[V1 Auth] Failed to resend verification email:', result.error);
      return apiError(
        ApiErrorCodes.INTERNAL_ERROR,
        'Failed to send verification email. Please try again later.',
        undefined,
        500
      );
    }

    console.log(`[V1 Auth] Verification email resent to ${user.email}`);

    const response = NextResponse.json({
      success: true,
      data: {
        message: 'Verification email sent successfully. Please check your inbox.',
        alreadyVerified: false,
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
    console.error('[V1 Auth] Resend verification error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'An error occurred while resending verification email',
      undefined,
      500
    );
  }
}
