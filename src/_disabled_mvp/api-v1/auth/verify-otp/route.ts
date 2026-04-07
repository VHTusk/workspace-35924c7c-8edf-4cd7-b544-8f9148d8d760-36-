/**
 * V1 API: Verify OTP
 * 
 * Verifies a one-time password sent to email or phone.
 * 
 * @version v1
 * @immutable true
 */

import { NextRequest, NextResponse } from 'next/server';
import { addVersionHeaders } from '@/lib/api-versioning';
import { otpStore } from '../send-otp/route';
import { cache } from '@/lib/cache';

const OTP_CACHE_PREFIX = 'otp:v1';
const MAX_OTP_ATTEMPTS = 5;
const OTP_ATTEMPTS_TTL = 600;

function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

function buildAttemptsKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:attempts:${identifier}`;
}

async function getOtp(identifier: string): Promise<{ otp: string; createdAt: number } | null> {
  const key = buildOtpCacheKey(identifier);
  
  try {
    const cachedOtp = await cache.get<{ otp: string; createdAt: number }>(key);
    if (cachedOtp) {
      return cachedOtp;
    }
  } catch {
    // Cache failed, continue to memory fallback
  }
  
  const storedData = otpStore.get(identifier);
  if (storedData && storedData.expiresAt > new Date()) {
    return { otp: storedData.otp, createdAt: storedData.expiresAt.getTime() - 600000 };
  }
  
  return null;
}

async function deleteOtp(identifier: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);
  
  try {
    await cache.delete(key);
  } catch {
    // Cache failed, continue to memory fallback
  }
  
  otpStore.delete(identifier);
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
  } catch {
    // Ignore cache errors
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, otp } = body;

    if (!email && !phone) {
      const response = NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email or phone is required',
      }, { status: 400 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    if (!otp || otp.length !== 6) {
      const response = NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Valid 6-digit OTP is required',
      }, { status: 400 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    const identifier = email || phone;
    
    // Check attempt limit
    const attemptCheck = await checkAndIncrementAttempts(identifier);
    if (!attemptCheck.allowed) {
      const response = NextResponse.json({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many failed attempts. Please request a new OTP.',
        details: { retryAfter: OTP_ATTEMPTS_TTL },
      }, { status: 429 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    // Get stored OTP
    const storedData = await getOtp(identifier);

    if (!storedData) {
      const response = NextResponse.json({
        success: false,
        error: 'OTP_NOT_FOUND',
        message: 'OTP not found or expired. Please request a new one.',
      }, { status: 400 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      const response = NextResponse.json({
        success: false,
        error: 'INVALID_OTP',
        message: 'Invalid OTP. Please try again.',
        details: { remainingAttempts: attemptCheck.remaining },
      }, { status: 400 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    // OTP verified, clean up
    await deleteOtp(identifier);
    await resetAttempts(identifier);

    const response = NextResponse.json({
      success: true,
      data: {
        verified: true,
        identifier,
        identifierType: email ? 'email' : 'phone',
        verifiedAt: new Date().toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    return response;
  } catch (error) {
    console.error('[V1 Verify OTP] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify OTP',
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}
