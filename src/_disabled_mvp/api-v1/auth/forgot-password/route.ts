/**
 * V1 Auth Forgot Password API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/forgot-password
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "phone": "+919876543210",
 *   "sport": "CORNHOLE" | "DARTS",
 *   "action": "request" | "reset",
 *   "token": "reset_token (for reset action)",
 *   "newPassword": "new_password (for reset action)"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "If an account exists..."
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email/service';
import { SportType } from '@prisma/client';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { withRateLimit } from '@/lib/rate-limit';

// Password reset token expiry (1 hour)
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000;

// Generate a secure reset token
function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function forgotPasswordHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, sport, action, token, newPassword } = body;

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Invalid sport. Must be CORNHOLE or DARTS',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    const sportType = sport as SportType;

    // =========================================
    // ACTION: REQUEST RESET TOKEN
    // =========================================
    if (action === 'request') {
      if (!email && !phone) {
        return apiError(
          ApiErrorCodes.MISSING_REQUIRED_FIELD,
          'Email or phone is required',
          { required: ['email', 'phone'] }
        );
      }

      // Find user
      const user = email
        ? await db.user.findUnique({
            where: { email_sport: { email: email.toLowerCase().trim(), sport: sportType } }
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: phone!.replace(/[\s-]/g, '').replace(/^\+91/, ''), sport: sportType } }
          });

      // Don't reveal whether user exists or not (security)
      if (!user) {
        return apiSuccess({
          message: 'If an account exists with this email/phone, a reset token has been sent.'
        });
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY);

      // Store token in user record
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken: resetToken,
          emailVerifyExpiry: resetTokenExpiry,
        }
      });

      // Send email with reset link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      if (user.email) {
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}&sport=${sport}`;
        
        try {
          await sendPasswordResetEmail({
            to: user.email,
            sport: sportType,
            playerName: user.firstName,
            resetUrl,
            expiresIn: '1 hour',
          });
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
        }
      }

      const response = NextResponse.json({
        success: true,
        data: {
          message: 'If an account exists with this email/phone, a reset token has been sent.'
        },
        meta: {
          version: 'v1',
          timestamp: new Date().toISOString(),
        }
      });

      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-API-Immutable', 'true');
      return response;
    }

    // =========================================
    // ACTION: RESET PASSWORD WITH TOKEN
    // =========================================
    if (action === 'reset') {
      if (!email && !phone) {
        return apiError(
          ApiErrorCodes.MISSING_REQUIRED_FIELD,
          'Email or phone is required',
          { required: ['email', 'phone'] }
        );
      }

      if (!token) {
        return apiError(
          ApiErrorCodes.MISSING_REQUIRED_FIELD,
          'Reset token is required',
          { required: ['token'] }
        );
      }

      if (!newPassword) {
        return apiError(
          ApiErrorCodes.MISSING_REQUIRED_FIELD,
          'New password is required',
          { required: ['newPassword'] }
        );
      }

      // Validate password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return apiError(
          ApiErrorCodes.VALIDATION_ERROR,
          'Password does not meet requirements',
          { errors: passwordValidation.errors }
        );
      }

      // Find user
      const user = email
        ? await db.user.findUnique({
            where: { email_sport: { email: email.toLowerCase().trim(), sport: sportType } }
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: phone!.replace(/[\s-]/g, '').replace(/^\+91/, ''), sport: sportType } }
          });

      if (!user) {
        return apiError(
          ApiErrorCodes.VALIDATION_ERROR,
          'Invalid or expired reset token',
          undefined,
          400
        );
      }

      // Validate token
      if (user.emailVerifyToken !== token) {
        return apiError(
          ApiErrorCodes.VALIDATION_ERROR,
          'Invalid reset token',
          undefined,
          400
        );
      }

      // Check token expiry
      if (!user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) {
        return apiError(
          ApiErrorCodes.VALIDATION_ERROR,
          'Reset token has expired. Please request a new one.',
          undefined,
          400
        );
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token in transaction
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            emailVerifyToken: null,
            emailVerifyExpiry: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
          }
        }),
        db.session.deleteMany({
          where: { userId: user.id }
        })
      ]);

      const response = NextResponse.json({
        success: true,
        data: {
          message: 'Password reset successfully. Please login with your new password.'
        },
        meta: {
          version: 'v1',
          timestamp: new Date().toISOString(),
        }
      });

      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-API-Immutable', 'true');
      return response;
    }

    // Invalid action
    return apiError(
      ApiErrorCodes.VALIDATION_ERROR,
      'Invalid action. Use "request" to get a reset token or "reset" to set new password.',
      { allowed: ['request', 'reset'] }
    );

  } catch (error) {
    console.error('[V1 Auth] Forgot password error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'An error occurred during password reset',
      undefined,
      500
    );
  }
}

export const POST = withRateLimit(forgotPasswordHandler, 'PASSWORD_RESET');
