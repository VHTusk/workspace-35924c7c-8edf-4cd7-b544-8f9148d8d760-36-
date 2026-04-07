import { NextRequest } from 'next/server';
import { cache } from '@/lib/cache';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import {
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';
import { OTP_TTL, otpStore, usedOtpStore, OTP_USED_PREFIX } from '../send-otp/route';

const OTP_CACHE_PREFIX = 'otp';
const MAX_OTP_ATTEMPTS = 5;
const OTP_ATTEMPTS_TTL = 600;

function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

function buildAttemptsKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:attempts:${identifier}`;
}

function buildUsedOtpKey(identifier: string): string {
  return `${OTP_USED_PREFIX}:${identifier}`;
}

async function getOtp(identifier: string): Promise<{ otp: string; createdAt: number } | null> {
  const key = buildOtpCacheKey(identifier);

  try {
    const cachedOtp = await cache.get<{ otp: string; createdAt: number }>(key);
    if (cachedOtp) {
      return cachedOtp;
    }
  } catch {}

  const storedData = otpStore.get(identifier);
  if (storedData && storedData.expiresAt > new Date()) {
    return { otp: storedData.otp, createdAt: storedData.createdAt };
  }

  return null;
}

async function deleteOtp(identifier: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);

  try {
    await cache.delete(key);
  } catch {}

  otpStore.delete(identifier);
}

async function getUsedOtp(identifier: string): Promise<string | null> {
  const key = buildUsedOtpKey(identifier);

  try {
    const cached = await cache.get<{ otp: string }>(key);
    if (cached?.otp) {
      return cached.otp;
    }
  } catch {}

  const used = usedOtpStore.get(identifier);
  if (used && used.expiresAt > new Date()) {
    return used.otp;
  }

  return null;
}

async function markOtpUsed(identifier: string, otp: string): Promise<void> {
  const key = buildUsedOtpKey(identifier);

  try {
    await cache.set(key, { otp }, OTP_TTL);
  } catch {}

  usedOtpStore.set(identifier, {
    otp,
    expiresAt: new Date(Date.now() + OTP_TTL * 1000),
  });
}

async function checkAndIncrementAttempts(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = buildAttemptsKey(identifier);

  try {
    const attempts = await cache.get<number>(key);

    if (attempts === null) {
      await cache.set(key, 1, OTP_ATTEMPTS_TTL);
      return { allowed: true, remaining: MAX_OTP_ATTEMPTS - 1 };
    }

    if (attempts >= MAX_OTP_ATTEMPTS) {
      return { allowed: false, remaining: 0 };
    }

    await cache.set(key, attempts + 1, OTP_ATTEMPTS_TTL);
    return { allowed: true, remaining: MAX_OTP_ATTEMPTS - attempts - 1 };
  } catch {
    return { allowed: true, remaining: MAX_OTP_ATTEMPTS };
  }
}

async function resetAttempts(identifier: string): Promise<void> {
  const key = buildAttemptsKey(identifier);

  try {
    await cache.delete(key);
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, otp } = body;

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

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return authError(AUTH_CODES.INVALID_OTP, 'Please enter a valid 6-digit OTP.', 400, {
        field: 'otp',
        fieldErrors: { otp: 'Please enter a valid 6-digit OTP.' },
      });
    }

    const identifier = normalizedEmail ?? normalizedPhone!;
    const attemptCheck = await checkAndIncrementAttempts(identifier);

    if (!attemptCheck.allowed) {
      return authError(
        AUTH_CODES.TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Please request a new OTP.',
        429,
        {
          retryAfterSeconds: OTP_ATTEMPTS_TTL,
        },
      );
    }

    const storedData = await getOtp(identifier);
    const usedOtp = await getUsedOtp(identifier);

    if (!storedData) {
      if (usedOtp === otp) {
        return authError(
          AUTH_CODES.OTP_ALREADY_USED,
          'This OTP has already been used. Please request a new one.',
          400,
          {
            field: 'otp',
            fieldErrors: { otp: 'This OTP has already been used. Please request a new one.' },
          },
        );
      }

      return authError(
        AUTH_CODES.OTP_EXPIRED,
        'OTP expired. Please request a new one.',
        400,
        {
          field: 'otp',
          fieldErrors: { otp: 'OTP expired. Please request a new one.' },
        },
      );
    }

    const otpAgeMs = Date.now() - storedData.createdAt;
    if (otpAgeMs > OTP_TTL * 1000) {
      await deleteOtp(identifier);
      return authError(
        AUTH_CODES.OTP_EXPIRED,
        'OTP expired. Please request a new one.',
        400,
        {
          field: 'otp',
          fieldErrors: { otp: 'OTP expired. Please request a new one.' },
        },
      );
    }

    if (storedData.otp !== otp) {
      return authError(AUTH_CODES.INVALID_OTP, 'Invalid OTP. Please try again.', 400, {
        field: 'otp',
        fieldErrors: { otp: 'Invalid OTP. Please try again.' },
        retryAfterSeconds: attemptCheck.remaining > 0 ? undefined : OTP_ATTEMPTS_TTL,
      });
    }

    await deleteOtp(identifier);
    await markOtpUsed(identifier, otp);
    await resetAttempts(identifier);

    return authSuccess(AUTH_CODES.OTP_VERIFIED, 'OTP verified successfully.');
  } catch {
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not verify the OTP right now. Please try again.',
      500,
    );
  }
}
