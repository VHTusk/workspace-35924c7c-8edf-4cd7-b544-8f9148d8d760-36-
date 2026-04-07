import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '../send-otp/route';
import { cache } from '@/lib/cache';

// OTP Configuration
const OTP_CACHE_PREFIX = 'otp';
const MAX_OTP_ATTEMPTS = 5;
const OTP_ATTEMPTS_TTL = 600; // 10 minutes in seconds

// Build cache key for OTP
function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

// Build cache key for attempt tracking
function buildAttemptsKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:attempts:${identifier}`;
}

// Get OTP from cache or memory
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
  
  // Fallback to in-memory store
  const storedData = otpStore.get(identifier);
  if (storedData && storedData.expiresAt > new Date()) {
    return { otp: storedData.otp, createdAt: storedData.expiresAt.getTime() - 600000 };
  }
  
  return null;
}

// Delete OTP from cache and memory
async function deleteOtp(identifier: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);
  
  try {
    await cache.delete(key);
  } catch {
    // Cache failed, continue to memory fallback
  }
  
  otpStore.delete(identifier);
}

// Check and increment OTP attempts
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
    // If cache fails, allow the verification
    return { allowed: true, remaining: MAX_OTP_ATTEMPTS };
  }
}

// Reset attempts after successful verification
async function resetAttempts(identifier: string): Promise<void> {
  const key = buildAttemptsKey(identifier);
  
  try {
    await cache.delete(key);
  } catch {
    // Cache failed, ignore
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, otp } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit OTP is required' },
        { status: 400 }
      );
    }

    const identifier = email || phone;
    
    // Check attempt limit
    const attemptCheck = await checkAndIncrementAttempts(identifier);
    if (!attemptCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many failed attempts. Please request a new OTP.',
          retryAfter: OTP_ATTEMPTS_TTL,
        },
        { status: 429 }
      );
    }

    // Get stored OTP
    const storedData = await getOtp(identifier);

    if (!storedData) {
      return NextResponse.json(
        { error: 'OTP not found or expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return NextResponse.json(
        { 
          error: 'Invalid OTP. Please try again.',
          remainingAttempts: attemptCheck.remaining,
        },
        { status: 400 }
      );
    }

    // OTP verified, clean up
    await deleteOtp(identifier);
    await resetAttempts(identifier);

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
