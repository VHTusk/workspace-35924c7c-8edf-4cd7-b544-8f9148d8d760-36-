import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { buildAppUrl } from '@/lib/app-url';
import { hashPassword, hashToken, validatePassword, verifyPassword } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email/service';
import { normalizeSport } from '@/lib/sports';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import {
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';

const RESET_TOKEN_EXPIRY = 60 * 60 * 1000;

function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function resetPasswordHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, sport, action, token, newPassword } = body;

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (action === 'request') {
      if (!normalizedEmail && !normalizedPhone) {
        return authError(
          AUTH_CODES.REQUIRED_FIELD_MISSING,
          'Please enter your email address or mobile number.',
          400,
          {
            field: 'identifier',
            fieldErrors: { email: 'Email or phone is required.', phone: 'Email or phone is required.' },
          },
        );
      }

      if (email && (!normalizedEmail || !isValidEmailAddress(normalizedEmail))) {
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

      if (phone && (!normalizedPhone || !isValidPhoneNumber(normalizedPhone))) {
        return authError(
          AUTH_CODES.INVALID_PHONE_FORMAT,
          'Please enter a valid 10-digit mobile number.',
          400,
          {
            field: 'phone',
            fieldErrors: { phone: 'Please enter a valid 10-digit mobile number.' },
          },
        );
      }

      const user = normalizedEmail
        ? await db.user.findUnique({
            where: { email_sport: { email: normalizedEmail, sport: sportType } },
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: normalizedPhone!, sport: sportType } },
          });

      if (!user) {
        return authSuccess(
          AUTH_CODES.PASSWORD_RESET_REQUESTED,
          'If an account exists with that email or mobile number, a reset link has been sent.',
        );
      }

      if (normalizedEmail && !user.emailVerified) {
        return authError(
          AUTH_CODES.EMAIL_NOT_VERIFIED,
          'Your email is not verified yet. Please verify it before resetting your password.',
          403,
          {
            email: user.email || undefined,
            requiresVerification: true,
          },
        );
      }

      if (normalizedPhone && user.verified === false) {
        return authError(
          AUTH_CODES.PHONE_NOT_VERIFIED,
          'Your mobile number is not verified yet. Please verify it before resetting your password.',
          403,
          {
            phone: user.phone || undefined,
            requiresVerification: true,
          },
        );
      }

      const resetToken = generateResetToken();
      const hashedResetToken = await hashToken(resetToken);
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY);

      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken: hashedResetToken,
          emailVerifyExpiry: resetTokenExpiry,
        },
      });

      if (user.email) {
        const resetUrl = buildAppUrl(
          `/${sportType.toLowerCase()}/forgot-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`,
        );

        try {
          await sendPasswordResetEmail({
            to: user.email,
            sport: sportType,
            playerName: user.firstName,
            resetUrl,
            expiresIn: '1 hour',
          });
        } catch {
          return authError(
            AUTH_CODES.PROVIDER_ERROR,
            'We could not send the password reset email right now. Please try again.',
            500,
          );
        }
      }

      if (!user.email && process.env.NODE_ENV === 'development') {
        console.log(`[Password Reset - DEV ONLY] Token for ${user.phone}: ${resetToken}`);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Password Reset - DEV ONLY] Token for ${normalizedEmail || normalizedPhone || 'unknown'}: ${resetToken}`,
        );
      }

      return authSuccess(
        AUTH_CODES.PASSWORD_RESET_REQUESTED,
        'If an account exists with that email or mobile number, a reset link has been sent.',
      );
    }

    if (action === 'reset') {
      if (!normalizedEmail && !normalizedPhone) {
        return authError(
          AUTH_CODES.REQUIRED_FIELD_MISSING,
          'Please enter your email address or mobile number.',
          400,
          {
            field: 'identifier',
            fieldErrors: { email: 'Email or phone is required.', phone: 'Email or phone is required.' },
          },
        );
      }

      if (!token) {
        return authError(AUTH_CODES.INVALID_RESET_TOKEN, 'Reset token is required.', 400, {
          field: 'token',
          fieldErrors: { token: 'Reset token is required.' },
        });
      }

      if (!newPassword) {
        return authError(AUTH_CODES.PASSWORD_REQUIRED, 'New password is required.', 400, {
          field: 'password',
          fieldErrors: { password: 'New password is required.' },
        });
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return authError(
          AUTH_CODES.PASSWORD_TOO_WEAK,
          passwordValidation.errors[0] || 'Password does not meet the requirements.',
          400,
          {
            field: 'password',
            fieldErrors: {
              password: passwordValidation.errors[0] || 'Password does not meet the requirements.',
            },
          },
        );
      }

      const user = normalizedEmail
        ? await db.user.findUnique({
            where: { email_sport: { email: normalizedEmail, sport: sportType } },
          })
        : await db.user.findUnique({
            where: { phone_sport: { phone: normalizedPhone!, sport: sportType } },
          });

      if (!user) {
        return authError(
          AUTH_CODES.INVALID_RESET_TOKEN,
          'Invalid reset token.',
          400,
          {
            field: 'token',
            fieldErrors: { token: 'Invalid reset token.' },
          },
        );
      }

      const hashedProvidedToken = await hashToken(token);
      if (user.emailVerifyToken !== hashedProvidedToken) {
        return authError(
          AUTH_CODES.INVALID_RESET_TOKEN,
          'Invalid reset token.',
          400,
          {
            field: 'token',
            fieldErrors: { token: 'Invalid reset token.' },
          },
        );
      }

      if (!user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) {
        return authError(
          AUTH_CODES.RESET_LINK_EXPIRED,
          'Reset link expired. Please request a new one.',
          400,
          {
            field: 'token',
            fieldErrors: { token: 'Reset link expired. Please request a new one.' },
          },
        );
      }

      if (user.password && (await verifyPassword(newPassword, user.password))) {
        return authError(
          AUTH_CODES.PASSWORD_REUSE_NOT_ALLOWED,
          'Please choose a new password different from your current one.',
          400,
          {
            field: 'password',
            fieldErrors: { password: 'Please choose a new password different from your current one.' },
          },
        );
      }

      const hashedPassword = await hashPassword(newPassword);

      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            emailVerifyToken: null,
            emailVerifyExpiry: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }),
        db.session.deleteMany({
          where: { userId: user.id },
        }),
      ]);

      return authSuccess(
        AUTH_CODES.PASSWORD_RESET_SUCCESS,
        'Password reset successfully. Please log in with your new password.',
      );
    }

    return authError(
      AUTH_CODES.VALIDATION_ERROR,
      'Invalid reset password action.',
      400,
    );
  } catch {
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not process the password reset right now. Please try again.',
      500,
    );
  }
}

export const POST = withRateLimit(resetPasswordHandler, 'PASSWORD_RESET');
