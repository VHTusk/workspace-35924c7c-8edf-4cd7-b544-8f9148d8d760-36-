import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createOrgSession, verifyPassword } from '@/lib/auth';
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
} from '@/lib/auth-validation';

async function orgLoginHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, sport } = body;

    const sportType = normalizeSport(sport);
    if (!sportType) {
      return authError(AUTH_CODES.INVALID_SPORT, 'Please choose a valid sport.', 400, {
        field: 'sport',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

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

    if (!password) {
      return authError(AUTH_CODES.PASSWORD_REQUIRED, 'Password is required.', 400, {
        field: 'password',
        fieldErrors: { password: 'Password is required.' },
      });
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

    const org = normalizedEmail
      ? await db.organization.findFirst({
          where: { email: normalizedEmail, sport: sportType },
          include: {
            subscription: true,
            orgAdmins: {
              where: { isActive: true },
              include: { user: true },
              take: 1,
            },
          },
        })
      : await db.organization.findFirst({
          where: { phone: normalizedPhone!, sport: sportType },
          include: {
            subscription: true,
            orgAdmins: {
              where: { isActive: true },
              include: { user: true },
              take: 1,
            },
          },
        });

    if (!org) {
      return authError(
        AUTH_CODES.USER_NOT_FOUND,
        normalizedEmail
          ? 'No organization account found with this email address.'
          : 'No organization account found with this mobile number.',
        401,
      );
    }

    if (!org.password) {
      return authError(
        AUTH_CODES.PASSWORD_LOGIN_NOT_ENABLED,
        'Password login is not enabled for this organization account.',
        401,
      );
    }

    const isValid = await verifyPassword(password, org.password);
    if (!isValid) {
      return authError(AUTH_CODES.WRONG_PASSWORD, 'Incorrect password.', 401, {
        field: 'password',
        fieldErrors: { password: 'Incorrect password.' },
      });
    }

    let session;
    try {
      session = await createOrgSession(org.id, sportType);
    } catch {
      return authError(
        AUTH_CODES.SESSION_CREATE_FAILED,
        'We verified your credentials, but could not start your session. Please try again.',
        500,
      );
    }

    const rosterCount = await db.orgRosterPlayer.count({
      where: { orgId: org.id, isActive: true },
    });

    const response = authSuccess(AUTH_CODES.LOGIN_SUCCESS, 'Login successful.', {
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
        subscription: org.subscription
          ? {
              status: org.subscription.status,
              endDate: org.subscription.endDate,
            }
          : null,
        memberCount: rosterCount,
      },
    });

    setSessionCookie(response, session.token);
    setCsrfCookie(response);

    return response;
  } catch {
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not sign you in right now. Please try again.',
      500,
    );
  }
}

export const POST = withRateLimit(orgLoginHandler, 'LOGIN');
