import { NextRequest, NextResponse } from 'next/server';
import { AbusePattern, AbuseSeverity } from '@prisma/client';
import { db } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth';
import { log } from '@/lib/logger';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { logLoginEvent } from '@/lib/audit-logger';
import { withRateLimit } from '@/lib/rate-limit';
import {
  detectDeviceFingerprint,
  generateDeviceFingerprint,
  storeDeviceFingerprint,
  detectCredentialStuffing,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
  getAbuseRiskScore,
} from '@/lib/abuse-detection';
import { normalizeSport } from '@/lib/sports';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import {
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

async function loginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, password, sport, otpLogin } = body;

    const ipAddress = getClientIpAddress(request);
    const userAgent = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const trimmedPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail && !normalizedPhone) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Please enter your email address or mobile number.',
        400,
        {
          field: 'identifier',
          fieldErrors: { email: 'Email or mobile number is required.', phone: 'Email or mobile number is required.' },
        },
      );
    }

    if (email && !normalizedEmail) {
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

    if (phone && !normalizedPhone) {
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

    if (normalizedEmail && !isValidEmailAddress(normalizedEmail)) {
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

    if (normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
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

    if (!otpLogin && !trimmedPassword) {
      return authError(AUTH_CODES.PASSWORD_REQUIRED, 'Password is required.', 400, {
        field: 'password',
        fieldErrors: { password: 'Password is required.' },
      });
    }

    if (trimmedPassword.length > 128) {
      return authError(
        AUTH_CODES.PASSWORD_TOO_WEAK,
        'Password is too long.',
        400,
        {
          field: 'password',
          fieldErrors: { password: 'Password is too long.' },
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
      const stuffingCheck = await detectCredentialStuffing(
        normalizedEmail || normalizedPhone || '',
        ipAddress || 'unknown',
        deviceFingerprint,
        sportType,
      );

      if (stuffingCheck.detected) {
        await recordAbuseEvent(
          AbusePattern.CREDENTIAL_STUFFING,
          stuffingCheck.severity || AbuseSeverity.HIGH,
          undefined,
          undefined,
          ipAddress,
          userAgent,
          stuffingCheck.metadata || {},
        );
      }

      return authError(
        AUTH_CODES.USER_NOT_FOUND,
        normalizedEmail
          ? 'No account found with this email address.'
          : 'No account found with this mobile number.',
        401,
      );
    }

    if (!user.isActive) {
      const code =
        user.deactivationReason?.toLowerCase().includes('blocked')
          ? AUTH_CODES.ACCOUNT_BLOCKED
          : AUTH_CODES.ACCOUNT_SUSPENDED;
      const message =
        code === AUTH_CODES.ACCOUNT_BLOCKED
          ? 'Your account has been blocked. Please contact support.'
          : 'Your account is currently suspended. Please contact support.';

      return authError(code, message, 403);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const riskScore = await getAbuseRiskScore(user.id, deviceFingerprint, ipAddress);
      if (riskScore.overallScore >= 70) {
        await recordAbuseEvent(
          AbusePattern.CREDENTIAL_STUFFING,
          AbuseSeverity.HIGH,
          user.id,
          undefined,
          ipAddress,
          userAgent,
          { riskScore: riskScore.overallScore },
        );
      }

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000),
      );

      return authError(
        AUTH_CODES.TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Please try again later.',
        429,
        { retryAfterSeconds },
      );
    }

    if (otpLogin) {
      if (normalizedEmail && !user.emailVerified) {
        return authError(
          AUTH_CODES.EMAIL_NOT_VERIFIED,
          'Your email is not verified yet. Please verify your email first.',
          403,
          {
            email: user.email || undefined,
            canResendVerification: true,
            requiresVerification: true,
          },
        );
      }

      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      await storeDeviceFingerprint(user.id, deviceData, ipAddress);

      try {
        await db.session.deleteMany({ where: { userId: user.id } });
      } catch {}

      let session;
      try {
        session = await createSession(user.id, sportType);
      } catch (error) {
        log.error('Failed to create session after OTP login', { error, userId: user.id });
        return authError(
          AUTH_CODES.SESSION_CREATE_FAILED,
          'We verified your credentials, but could not start your session. Please try again.',
          500,
        );
      }

      logLoginEvent(user.id, sportType, request, {
        role: user.role,
        loginMethod: 'otp',
        success: true,
      }).catch((error) => log.error('Failed to log login event', { error }));

      const response = authSuccess(AUTH_CODES.LOGIN_SUCCESS, 'Login successful.', {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          sport: user.sport,
          role: user.role,
          tier:
            user.hiddenElo >= 1900
              ? 'DIAMOND'
              : user.hiddenElo >= 1700
                ? 'PLATINUM'
                : user.hiddenElo >= 1500
                  ? 'GOLD'
                  : user.hiddenElo >= 1300
                    ? 'SILVER'
                    : 'BRONZE',
          points: user.visiblePoints,
        },
      });

      setSessionCookie(response, session.token);
      setCsrfCookie(response);
      return response;
    }

    if (normalizedEmail && !user.emailVerified) {
      return authError(
        AUTH_CODES.EMAIL_NOT_VERIFIED,
        'Your email is not verified yet.',
        403,
        {
          email: user.email || undefined,
          canResendVerification: true,
          requiresVerification: true,
        },
      );
    }

    if (normalizedPhone && user.verified === false) {
      return authError(
        AUTH_CODES.PHONE_NOT_VERIFIED,
        'Your mobile number is not verified yet. Please verify it first.',
        403,
        {
          phone: user.phone || undefined,
          requiresVerification: true,
        },
      );
    }

    if (!user.password) {
      if (user.googleId) {
        return authError(
          AUTH_CODES.SOCIAL_LOGIN_REQUIRED,
          'This account uses Google login. Please continue with Google.',
          401,
        );
      }

      return authError(
        AUTH_CODES.PASSWORD_LOGIN_NOT_ENABLED,
        'Password login is not enabled for this account. Please continue with OTP login.',
        401,
      );
    }

    const isValidPassword = await verifyPassword(trimmedPassword, user.password);
    if (!isValidPassword) {
      const attempts = user.failedLoginAttempts + 1;
      const lockUntil =
        attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: lockUntil,
        },
      });

      logLoginEvent(user.id, sportType, request, {
        role: user.role,
        loginMethod: 'password',
        success: false,
      }).catch((error) => log.error('Failed to log login event', { error }));

      if (lockUntil) {
        return authError(
          AUTH_CODES.TOO_MANY_ATTEMPTS,
          'Too many failed attempts. Please try again later.',
          429,
          {
            retryAfterSeconds: Math.ceil(LOCK_DURATION_MS / 1000),
          },
        );
      }

      return authError(AUTH_CODES.WRONG_PASSWORD, 'Incorrect password.', 401, {
        field: 'password',
        fieldErrors: { password: 'Incorrect password.' },
      });
    }

    try {
      await db.session.deleteMany({ where: { userId: user.id } });
    } catch {}

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await storeDeviceFingerprint(user.id, deviceData, ipAddress);

    let session;
    try {
      session = await createSession(user.id, sportType);
    } catch (error) {
      log.error('Failed to create session after password login', { error, userId: user.id });
      return authError(
        AUTH_CODES.SESSION_CREATE_FAILED,
        'We verified your credentials, but could not start your session. Please try again.',
        500,
      );
    }

    logLoginEvent(user.id, sportType, request, {
      role: user.role,
      loginMethod: 'password',
      success: true,
    }).catch((error) => log.error('Failed to log login event', { error }));

    const response = authSuccess(AUTH_CODES.LOGIN_SUCCESS, 'Login successful.', {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        sport: user.sport,
        role: user.role,
        tier:
          user.hiddenElo >= 1900
            ? 'DIAMOND'
            : user.hiddenElo >= 1700
              ? 'PLATINUM'
              : user.hiddenElo >= 1500
                ? 'GOLD'
                : user.hiddenElo >= 1300
                  ? 'SILVER'
                  : 'BRONZE',
        points: user.visiblePoints,
      },
    });

    setSessionCookie(response, session.token);
    setCsrfCookie(response);
    return response;
  } catch (error) {
    log.errorWithStack('Login error', error instanceof Error ? error : new Error(String(error)));
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not sign you in right now. Please try again.',
      500,
    );
  }
}

export const POST = withRateLimit(loginHandler, 'LOGIN');
