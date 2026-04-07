import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, validatePassword, hashToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email/service';
import { SportType } from '@prisma/client';
import { withRateLimit } from '@/lib/rate-limit';
import { buildAppUrl } from '@/lib/app-url';

/**
 * Password Reset Flow:
 * 
 * Step 1: Request reset token
 * POST /api/auth/reset-password
 * Body: { email, sport, action: 'request' }
 * - Generates a reset token (valid for 1 hour)
 * - Sends token via email (for production)
 * - Returns success message (in dev, also returns token for testing)
 * 
 * Step 2: Verify and reset
 * POST /api/auth/reset-password
 * Body: { email, sport, action: 'reset', token, newPassword }
 * - Validates token
 * - Updates password
 * - Invalidates all existing sessions
 */

// Password reset token expiry (1 hour)
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000;

// Generate a secure reset token
function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// FIX: Wrap handler with distributed rate limiting to prevent abuse
// Uses 'PASSWORD_RESET' tier: 3 requests per hour per IP
// This is more restrictive due to the sensitive nature of password resets
async function resetPasswordHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, sport, action, token, newPassword } = body;

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    const sportType = sport as SportType;

    // =========================================
    // ACTION: REQUEST RESET TOKEN
    // =========================================
    if (action === 'request') {
      if (!email && !phone) {
        return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 });
      }

      // Find user
      const user = email
        ? await db.user.findUnique({
            where: { email_sport: { email, sport: sportType } }
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: phone!, sport: sportType } }
          });

      if (!user) {
        // Don't reveal whether user exists or not (security)
        return NextResponse.json({
          success: true,
          message: 'If an account exists with this email/phone, a reset token has been sent.'
        });
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY);

      // SECURITY: Hash the token before storage to prevent misuse if database is compromised
      // The plaintext token is only sent via email and never stored
      const hashedResetToken = await hashToken(resetToken);

      // Store hashed token in user record
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken: hashedResetToken, // Store hashed token, NOT plaintext
          emailVerifyExpiry: resetTokenExpiry,
        }
      });

      // In production, send email with reset link
      // For development, log to console only - NEVER return token in response
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (user.email) {
        const resetUrl = buildAppUrl(
          `/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}&sport=${sport}`
        );
        
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
          // Don't fail the request - user can still request another reset
        }
      }
      
      // Log for phone-based users (would need SMS integration)
      if (!user.email && user.phone) {
        // SECURITY: Only log in development, never expose in production
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Password Reset - DEV ONLY] Token for ${user.phone}: ${resetToken}`);
        }
        // FUTURE: Integrate with SMS provider for phone-based reset
      }

      // SECURITY: Never return the token in the HTTP response
      // In development, log to console for testing - but don't expose via API
      if (process.env.NODE_ENV === 'development') {
        const devIdentifier = email || phone || 'unknown';
        console.log(`[Password Reset - DEV ONLY] Token for ${devIdentifier}: ${resetToken}`);
      }

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email/phone, a reset token has been sent.',
        // DO NOT return devToken - this is a security risk
        // Testing should be done via console logs or email inbox
      });
    }

    // =========================================
    // ACTION: RESET PASSWORD WITH TOKEN
    // =========================================
    if (action === 'reset') {
      if (!email && !phone) {
        return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 });
      }

      if (!token) {
        return NextResponse.json({ error: 'Reset token is required' }, { status: 400 });
      }

      if (!newPassword) {
        return NextResponse.json({ error: 'New password is required' }, { status: 400 });
      }

      // Validate password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return NextResponse.json({ 
          error: 'Password does not meet requirements', 
          details: passwordValidation.errors 
        }, { status: 400 });
      }

      // Find user
      const user = email
        ? await db.user.findUnique({
            where: { email_sport: { email, sport: sportType } }
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: phone!, sport: sportType } }
          });

      if (!user) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
      }

      // Validate token - compare hashed value
      // SECURITY: Hash the provided token and compare with stored hash
      const hashedProvidedToken = await hashToken(token);
      if (user.emailVerifyToken !== hashedProvidedToken) {
        return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
      }

      // Check token expiry
      if (!user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) {
        return NextResponse.json({ error: 'Reset token has expired. Please request a new one.' }, { status: 400 });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token in transaction
      await db.$transaction([
        // Update password and clear token
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
        // Invalidate all existing sessions (force re-login)
        db.session.deleteMany({
          where: { userId: user.id }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    }

    // Invalid action
    return NextResponse.json({ 
      error: 'Invalid action. Use "request" to get a reset token or "reset" to set new password.' 
    }, { status: 400 });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(resetPasswordHandler, 'PASSWORD_RESET');
