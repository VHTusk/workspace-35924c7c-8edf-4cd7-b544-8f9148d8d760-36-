/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 * 
 * Allows users to request a new verification email if:
 * - Their email is not yet verified
 * - They haven't requested one in the last 60 seconds (rate limiting)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { 
  createAndSendVerificationToken, 
  canResendVerification 
} from '@/lib/email-verification';
import { normalizeSport } from '@/lib/sports';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, sport } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', code: 'EMAIL_REQUIRED' },
        { status: 400 }
      );
    }

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return NextResponse.json(
        { error: 'Invalid sport', code: 'INVALID_SPORT' },
        { status: 400 }
      );
    }

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

    if (!user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If this email is registered and not verified, a new verification email has been sent.',
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'This email is already verified. You can log in.',
        alreadyVerified: true,
      });
    }

    // Check rate limiting
    const resendCheck = await canResendVerification(user.id);
    if (!resendCheck.canResend && resendCheck.waitTimeSeconds) {
      return NextResponse.json(
        {
          error: `Please wait ${resendCheck.waitTimeSeconds} seconds before requesting another verification email.`,
          code: 'RATE_LIMITED',
          waitTimeSeconds: resendCheck.waitTimeSeconds,
        },
        { status: 429 }
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
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.', code: 'SEND_FAILED' },
        { status: 500 }
      );
    }

    console.log(`Verification email resent to ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
