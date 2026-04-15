import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createOrgSession, createOrganization, validatePassword } from '@/lib/auth';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { withRateLimit } from '@/lib/rate-limit';
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

async function orgRegisterHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      email,
      phone,
      password,
      confirmPassword,
      city,
      district,
      state,
      pinCode,
      sport,
      tosAccepted,
      privacyAccepted,
    } = body;

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    const normalizedName = sanitizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedName) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Organization name is required.',
        400,
        {
          field: 'name',
          fieldErrors: { name: 'Organization name is required.' },
        },
      );
    }

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

    if (!password) {
      return authError(AUTH_CODES.PASSWORD_REQUIRED, 'Password is required.', 400, {
        field: 'password',
        fieldErrors: { password: 'Password is required.' },
      });
    }

    if (confirmPassword === undefined || confirmPassword === null || confirmPassword === '') {
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

    if (confirmPassword !== undefined && password !== confirmPassword) {
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

    const passwordValidation = validatePassword(password);
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

    if (normalizedEmail) {
      const existingOrg = await db.organization.findFirst({
        where: { email: normalizedEmail, sport: sportType },
      });

      if (existingOrg) {
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
    }

    if (normalizedPhone) {
      const existingPhone = await db.organization.findFirst({
        where: { phone: normalizedPhone, sport: sportType },
      });

      if (existingPhone) {
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

    const org = await createOrganization({
      name: normalizedName,
      type,
      email: normalizedEmail ?? undefined,
      phone: normalizedPhone ?? undefined,
      password,
      city,
      district,
      state,
      pinCode,
      sport: sportType,
      tosAccepted,
      privacyAccepted,
    });

    let session;
    try {
      session = await createOrgSession(org.id, sportType);
    } catch {
      return authError(
        AUTH_CODES.SESSION_CREATE_FAILED,
        'The organization account was created, but we could not sign you in automatically. Please log in.',
        500,
      );
    }

    const response = authSuccess(AUTH_CODES.REGISTRATION_SUCCESS, 'Organization account created successfully.', {
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        email: org.email,
        phone: org.phone,
        city: org.city,
        state: org.state,
        sport: org.sport,
        planTier: org.planTier,
      },
    });

    setSessionCookie(response, session.token);
    setCsrfCookie(response);

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return authError(
        AUTH_CODES.ACCOUNT_ALREADY_REGISTERED,
        'An organization with these details is already registered. Please log in.',
        409,
      );
    }

    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not complete the organization registration right now. Please try again.',
      500,
    );
  }
}

export const POST = withRateLimit(orgRegisterHandler, 'REGISTER');
