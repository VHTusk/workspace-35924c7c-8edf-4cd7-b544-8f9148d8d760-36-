import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sendOtp, normalizePhoneNumber } from '@/lib/sms-service';
import { sendEmail } from '@/lib/email';
import { cache } from '@/lib/cache';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import {
  detectIdentifierType,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';

export const OTP_TTL = 600;
const OTP_CACHE_PREFIX = 'otp';
const OTP_RATE_LIMIT_PREFIX = 'otp-rate';
const OTP_COOLDOWN_PREFIX = 'otp-cooldown';
export const OTP_USED_PREFIX = 'otp-used';
const MAX_OTP_REQUESTS = 3;
const RATE_LIMIT_TTL = 3600;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const otpStore = new Map<string, { otp: string; createdAt: number; expiresAt: Date }>();
export const otpRateLimitStore = new Map<string, { count: number; expiresAt: Date }>();
export const otpCooldownStore = new Map<string, { expiresAt: Date }>();
export const usedOtpStore = new Map<string, { otp: string; expiresAt: Date }>();

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

function buildRateLimitKey(identifier: string): string {
  return `${OTP_RATE_LIMIT_PREFIX}:${identifier}`;
}

function buildCooldownKey(identifier: string): string {
  return `${OTP_COOLDOWN_PREFIX}:${identifier}`;
}

async function getRateLimitCount(identifier: string): Promise<number> {
  const key = buildRateLimitKey(identifier);

  try {
    return (await cache.get<number>(key)) ?? 0;
  } catch {
    const existing = otpRateLimitStore.get(identifier);
    if (existing && existing.expiresAt > new Date()) {
      return existing.count;
    }

    return 0;
  }
}

async function incrementRateLimit(identifier: string, nextCount: number): Promise<void> {
  const key = buildRateLimitKey(identifier);

  try {
    await cache.set(key, nextCount, RATE_LIMIT_TTL);
  } catch {
    otpRateLimitStore.set(identifier, {
      count: nextCount,
      expiresAt: new Date(Date.now() + RATE_LIMIT_TTL * 1000),
    });
  }
}

async function getCooldownRemaining(identifier: string): Promise<number> {
  const key = buildCooldownKey(identifier);

  try {
    const ttl = await cache.getTTL(key);
    return ttl > 0 ? ttl : 0;
  } catch {
    const existing = otpCooldownStore.get(identifier);
    if (!existing || existing.expiresAt <= new Date()) {
      return 0;
    }

    return Math.max(1, Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000));
  }
}

async function setCooldown(identifier: string): Promise<void> {
  const key = buildCooldownKey(identifier);

  try {
    await cache.set(key, true, OTP_RESEND_COOLDOWN_SECONDS);
  } catch {
    otpCooldownStore.set(identifier, {
      expiresAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000),
    });
  }
}

async function storeOtp(identifier: string, otp: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);
  const payload = { otp, createdAt: Date.now() };

  try {
    await cache.set(key, payload, OTP_TTL);
  } catch {
    otpStore.set(identifier, {
      otp,
      createdAt: payload.createdAt,
      expiresAt: new Date(Date.now() + OTP_TTL * 1000),
    });
  }

  otpStore.set(identifier, {
    otp,
    createdAt: payload.createdAt,
    expiresAt: new Date(Date.now() + OTP_TTL * 1000),
  });
}

async function sendEmailOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Your VALORHIVE Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Verify Your Email</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">Your VALORHIVE verification code is:</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #6b7280;">This code will expire in 10 minutes.</p>
            <p style="font-size: 14px; color: #6b7280;">If you didn&apos;t request this code, please ignore this email.</p>
          </div>
        </div>
      `,
      text: `Your VALORHIVE verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    });

    return { success: result.success, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email.',
    };
  }
}

async function sendPhoneOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    const result = await sendOtp(normalizePhoneNumber(phone), otp);
    return {
      success: result.success,
      error: result.error,
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS.',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    const emailValue = normalizeEmail(email);
    const phoneValue = normalizePhone(phone);

    if (!emailValue && !phoneValue) {
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

    const identifierType = emailValue
      ? 'email'
      : phoneValue
        ? 'phone'
        : detectIdentifierType(email || phone);

    if (email && (!emailValue || identifierType !== 'email' || !isValidEmailAddress(emailValue))) {
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

    if (phone && (!phoneValue || identifierType !== 'phone' || !isValidPhoneNumber(phoneValue))) {
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

    const identifier = emailValue ?? phoneValue!;

    const cooldownRemaining = await getCooldownRemaining(identifier);
    if (cooldownRemaining > 0) {
      return authError(
        AUTH_CODES.TOO_MANY_ATTEMPTS,
        `Please wait ${cooldownRemaining} seconds before requesting another code.`,
        429,
        {
          retryAfterSeconds: cooldownRemaining,
        },
      );
    }

    const currentRateCount = await getRateLimitCount(identifier);
    if (currentRateCount >= MAX_OTP_REQUESTS) {
      return authError(
        AUTH_CODES.TOO_MANY_REQUESTS,
        'Too many OTP requests. Please try again later.',
        429,
        {
          retryAfterSeconds: RATE_LIMIT_TTL,
        },
      );
    }

    const otp = generateOtp();
    const sendResult: { success: boolean; error?: string; devOtp?: string } =
      identifierType === 'email'
        ? await sendEmailOtp(identifier, otp)
        : await sendPhoneOtp(identifier, otp);

    if (!sendResult.success) {
      return authError(
        AUTH_CODES.OTP_SEND_FAILED,
        'We could not send the verification code right now. Please try again.',
        500,
      );
    }

    await storeOtp(identifier, otp);
    await setCooldown(identifier);
    await incrementRateLimit(identifier, currentRateCount + 1);

    return authSuccess(AUTH_CODES.OTP_SENT, `OTP sent to your ${identifierType}.`, {
      remainingRequests: Math.max(0, MAX_OTP_REQUESTS - currentRateCount - 1),
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      ...(process.env.NODE_ENV === 'development' && { devOtp: sendResult.devOtp || otp }),
    });
  } catch (error) {
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not send the verification code right now. Please try again.',
      500,
    );
  }
}
