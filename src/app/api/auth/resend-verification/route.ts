/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 * 
 * Allows users to request a new verification email if:
 * - Their email is not yet verified
 * - They haven't requested one in the last 60 seconds (rate limiting)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { 
  createAndSendVerificationToken, 
  canResendVerification 
} from '@/lib/email-verification';
import { normalizeSport } from '@/lib/sports';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import { isValidEmailAddress, normalizeEmail } from '@/lib/auth-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, sport } = body;
    const normalizedEmail = normalizeEmail(email);

    // Validate required fields
    if (!normalizedEmail) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Email is required.',
        400,
        {
          field: 'email',
          fieldErrors: { email: 'Email is required.' },
        },
      );
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      return authError(
        AUTH_CODES.INVALID_EMAIL_FORMAT,
        'Please enter a valid email address.',
        400,
        {
          field: 'email',
          fieldErrors: { email: 'Please enter a valid email address.' },
        },
      );
    }

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { 
        email_sport: { 
          email: normalizedEmail, 
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

    if (!user) {
      // Don't reveal if email exists or not for security
      return authSuccess(
        AUTH_CODES.EMAIL_VERIFICATION_SENT,
        'If this email is registered and not verified, a new verification email has been sent.',
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return authSuccess(AUTH_CODES.EMAIL_ALREADY_VERIFIED, 'This email is already verified. You can log in.', {
        alreadyVerified: true,
      });
    }

    // Check rate limiting
    const resendCheck = await canResendVerification(user.id);
    if (!resendCheck.canResend && resendCheck.waitTimeSeconds) {
      return authError(
        AUTH_CODES.TOO_MANY_ATTEMPTS,
        `Please wait ${resendCheck.waitTimeSeconds} seconds before requesting another verification email.`,
        429,
        {
          retryAfterSeconds: resendCheck.waitTimeSeconds,
        },
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
      console.error('Failed to resend verification email:', result.error);
      return authError(
        AUTH_CODES.PROVIDER_ERROR,
        'We could not send the verification email right now. Please try again.',
        500,
      );
    }

    console.log(`Verification email resent to ${user.email}`);

    return authSuccess(
      AUTH_CODES.EMAIL_VERIFICATION_SENT,
      'Verification email sent successfully. Please check your inbox.',
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not resend the verification email right now. Please try again.',
      500,
    );
  }
}
