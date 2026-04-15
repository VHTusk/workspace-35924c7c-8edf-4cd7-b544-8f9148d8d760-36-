import { NextRequest, NextResponse } from 'next/server';
import { Prisma, SportType, AbusePattern, AbuseSeverity } from '@prisma/client';
import { db } from '@/lib/db';
import { createSession, createUser, validatePassword } from '@/lib/auth';
import { checkIdentitySuspended } from '@/lib/suspended-identity';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { logRegisterEvent } from '@/lib/audit-logger';
import { log } from '@/lib/logger';
import { createAndSendVerificationToken } from '@/lib/email-verification';
import { withRateLimit } from '@/lib/rate-limit';
import {
  detectDeviceFingerprint,
  generateDeviceFingerprint,
  storeDeviceFingerprint,
  checkMultipleAccounts,
  detectBotRegistration,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
  shouldBlockAction,
} from '@/lib/abuse-detection';
import { normalizeSport } from '@/lib/sports';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import {
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhone,
  sanitizeName,
} from '@/lib/auth-validation';

async function registerHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      email,
      phone,
      password,
      confirmPassword,
      firstName,
      lastName,
      sport,
      city,
      district,
      state,
      phoneVerified,
      referralCode,
      formStartTime,
      honeypot,
    } = body;

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    const normalizedFirstName = sanitizeName(firstName);
    const normalizedLastName = sanitizeName(lastName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const trimmedPassword = typeof password === 'string' ? password : '';
    const trimmedConfirmPassword =
      typeof confirmPassword === 'string' ? confirmPassword : undefined;

    if (!normalizedFirstName) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'First name is required.',
        400,
        {
          field: 'firstName',
          fieldErrors: { firstName: 'First name is required.' },
        },
      );
    }

    if (!normalizedLastName) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Last name is required.',
        400,
        {
          field: 'lastName',
          fieldErrors: { lastName: 'Last name is required.' },
        },
      );
    }

    if (!normalizedEmail && !normalizedPhone) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Please enter an email address or mobile number.',
        400,
        {
          field: 'emailOrPhone',
          fieldErrors: { email: 'Email or phone is required.', phone: 'Email or phone is required.' },
        },
      );
    }

    if (email && !normalizedEmail) {
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

    if (phone && !normalizedPhone) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Mobile number is required.',
        400,
        {
          field: 'phone',
          fieldErrors: { phone: 'Mobile number is required.' },
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

    if (normalizedEmail && !trimmedPassword) {
      return authError(
        AUTH_CODES.PASSWORD_REQUIRED,
        'Password is required for email registration.',
        400,
        {
          field: 'password',
          fieldErrors: { password: 'Password is required for email registration.' },
        },
      );
    }

    if (trimmedPassword && trimmedConfirmPassword === undefined) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Please re-enter your password.',
        400,
        {
          field: 'confirmPassword',
          fieldErrors: { confirmPassword: 'Please re-enter your password.' },
        },
      );
    }

    if (trimmedConfirmPassword !== undefined && trimmedPassword !== trimmedConfirmPassword) {
      return authError(
        AUTH_CODES.PASSWORD_MISMATCH,
        'Password and confirm password do not match.',
        400,
        {
          field: 'confirmPassword',
          fieldErrors: { confirmPassword: 'Password and confirm password do not match.' },
        },
      );
    }

    if (trimmedPassword) {
      const passwordValidation = validatePassword(trimmedPassword);
      if (!passwordValidation.valid) {
        return authError(
          AUTH_CODES.PASSWORD_TOO_WEAK,
          passwordValidation.errors[0] || 'Password does not meet the requirements.',
          400,
          {
            field: 'password',
            fieldErrors: { password: passwordValidation.errors[0] || 'Password does not meet the requirements.' },
          },
        );
      }
    }

    const ipAddress = getClientIpAddress(request);
    const userAgent = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);
    const formCompletionTimeMs = formStartTime ? Date.now() - formStartTime : undefined;

    const botCheck = await detectBotRegistration(
      normalizedEmail ?? undefined,
      normalizedPhone ?? undefined,
      normalizedFirstName,
      normalizedLastName,
      deviceFingerprint,
      formCompletionTimeMs,
      honeypot,
      ipAddress,
    );

    if (botCheck.isBot) {
      await recordAbuseEvent(
        AbusePattern.BOT_REGISTRATION_PATTERN,
        botCheck.riskScore >= 80 ? AbuseSeverity.HIGH : AbuseSeverity.MEDIUM,
        undefined,
        undefined,
        ipAddress,
        userAgent,
        {
          indicators: botCheck.indicators,
          riskScore: botCheck.riskScore,
          email: normalizedEmail ? '[REDACTED]' : undefined,
          phone: normalizedPhone ? '[REDACTED]' : undefined,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        },
      );

      return authError(
        AUTH_CODES.TOO_MANY_REQUESTS,
        'We could not complete your registration right now. Please try again later.',
        403,
      );
    }

    const multiAccountCheck = await checkMultipleAccounts(deviceFingerprint);
    if (shouldBlockAction(multiAccountCheck.riskScore, multiAccountCheck.severity)) {
      await recordAbuseEvent(
        AbusePattern.MULTIPLE_ACCOUNTS_SAME_DEVICE,
        multiAccountCheck.severity || AbuseSeverity.HIGH,
        undefined,
        undefined,
        ipAddress,
        userAgent,
        {
          accountCount: (multiAccountCheck.metadata?.accountCount as number) || 0,
          riskScore: multiAccountCheck.riskScore,
        },
      );

      return authError(
        AUTH_CODES.TOO_MANY_REQUESTS,
        'Too many registrations have been attempted from this device. Please contact support if you need help.',
        403,
      );
    }

    const suspensionCheck = await checkIdentitySuspended(normalizedEmail ?? undefined, normalizedPhone ?? undefined);
    if (suspensionCheck.suspended) {
      return authError(
        AUTH_CODES.ACCOUNT_SUSPENDED,
        'This email or mobile number has been suspended. Please contact support.',
        403,
      );
    }

    const [existingEmailUser, existingPhoneUser] = await Promise.all([
      normalizedEmail
        ? db.user.findUnique({
            where: { email_sport: { email: normalizedEmail, sport: sportType } },
            select: {
              id: true,
              emailVerified: true,
              phone: true,
              email: true,
            },
          })
        : Promise.resolve(null),
      normalizedPhone
        ? db.user.findUnique({
            where: { phone_sport: { phone: normalizedPhone, sport: sportType } },
            select: {
              id: true,
              emailVerified: true,
              phone: true,
              email: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (existingEmailUser && existingPhoneUser) {
      const sameUser = existingEmailUser.id === existingPhoneUser.id;
      if (
        sameUser &&
        ((existingEmailUser.email && !existingEmailUser.emailVerified) ||
          (existingPhoneUser.phone && !phoneVerified))
      ) {
        return authError(
          AUTH_CODES.PARTIAL_REGISTRATION_EXISTS,
          'Your account is not fully verified yet. Please complete verification or log in.',
          409,
        );
      }

      return authError(
        AUTH_CODES.ACCOUNT_ALREADY_REGISTERED,
        'This email and mobile number are already linked to an existing account. Please log in.',
        409,
      );
    }

    if (existingEmailUser) {
      return authError(
        existingEmailUser.emailVerified
          ? AUTH_CODES.EMAIL_ALREADY_REGISTERED
          : AUTH_CODES.PARTIAL_REGISTRATION_EXISTS,
        existingEmailUser.emailVerified
          ? 'This email is already registered. Please log in.'
          : 'Your account is not fully verified yet. Please complete verification.',
        409,
        {
          field: 'email',
          fieldErrors: {
            email: existingEmailUser.emailVerified
              ? 'This email is already registered. Please log in.'
              : 'Your account is not fully verified yet. Please complete verification.',
          },
        },
      );
    }

    if (existingPhoneUser) {
      return authError(
        AUTH_CODES.PHONE_ALREADY_REGISTERED,
        'This mobile number is already registered. Please log in.',
        409,
        {
          field: 'phone',
          fieldErrors: { phone: 'This mobile number is already registered. Please log in.' },
        },
      );
    }

    const user = await createUser({
      email: normalizedEmail ?? undefined,
      phone: normalizedPhone ?? undefined,
      password: trimmedPassword || undefined,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      sport: sportType,
      city,
      district,
      state,
      referredByCode: referralCode,
    });

    await storeDeviceFingerprint(user.id, deviceData, ipAddress);

    logRegisterEvent(user.id, sportType, request, {
      email: user.email || undefined,
      phone: user.phone || undefined,
      referralCode,
    }).catch((error) => log.error('Failed to log registration event', { error }));

    const isEmailRegistration = Boolean(normalizedEmail);

    if (isEmailRegistration && !phoneVerified) {
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: false,
        },
      });

      createAndSendVerificationToken(user.id, normalizedEmail!, sportType, normalizedFirstName)
        .then((result) => {
          if (!result.success) {
            log.error('Failed to send verification email after registration', {
              userId: user.id,
              error: result.error,
            });
          }
        })
        .catch((error) => {
          log.error('Unexpected verification email error after registration', { error, userId: user.id });
        });
    }

    let session;
    try {
      session = await createSession(user.id, sportType);
    } catch (error) {
      log.error('Failed to create session after registration', { error, userId: user.id });
      return authError(
        AUTH_CODES.SESSION_CREATE_FAILED,
        'Your account was created, but we could not sign you in automatically. Please log in.',
        500,
      );
    }

    const response = authSuccess(
      AUTH_CODES.REGISTRATION_SUCCESS,
      isEmailRegistration
        ? 'Account created successfully. Please verify your email within 24 hours.'
        : 'Account created successfully.',
      {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          sport: user.sport,
          role: user.role,
          referralCode: user.referralCode,
        },
        emailVerificationPending: isEmailRegistration && !phoneVerified,
      },
    );

    setSessionCookie(response, session.token);
    setCsrfCookie(response);

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(',') : String(error.meta?.target ?? '');

      if (target.includes('email')) {
        return authError(
          AUTH_CODES.EMAIL_ALREADY_REGISTERED,
          'This email is already registered. Please log in.',
          409,
          {
            field: 'email',
            fieldErrors: { email: 'This email is already registered. Please log in.' },
          },
        );
      }

      if (target.includes('phone')) {
        return authError(
          AUTH_CODES.PHONE_ALREADY_REGISTERED,
          'This mobile number is already registered. Please log in.',
          409,
          {
            field: 'phone',
            fieldErrors: { phone: 'This mobile number is already registered. Please log in.' },
          },
        );
      }
    }

    log.errorWithStack('Registration error', error instanceof Error ? error : new Error(String(error)));
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not complete your registration right now. Please try again.',
      500,
    );
  }
}

export const POST = withRateLimit(registerHandler, 'REGISTER');
