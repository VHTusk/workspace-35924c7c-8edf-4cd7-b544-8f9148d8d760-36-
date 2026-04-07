import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { sendOtp, normalizePhoneNumber, isValidPhone } from '@/lib/sms-service';
import { cache } from '@/lib/cache';
import crypto from 'crypto';

/**
 * Phone Verification API
 * 
 * POST /api/verify-phone - Send OTP to phone number
 * PUT /api/verify-phone - Verify OTP and update phoneVerified status
 * 
 * This API handles phone number verification for authenticated users.
 * It updates the phoneVerified field on successful verification.
 */

// OTP Configuration
const PHONE_OTP_TTL = 600; // 10 minutes in seconds
const PHONE_OTP_CACHE_PREFIX = 'phone-verify';
const MAX_OTP_REQUESTS = 3;
const RATE_LIMIT_TTL = 3600; // 1 hour

// Generate 6-digit OTP using cryptographic randomness
function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// Build cache key for phone verification OTP
function buildOtpCacheKey(userId: string): string {
  return `${PHONE_OTP_CACHE_PREFIX}:${userId}`;
}

// Build cache key for rate limiting
function buildRateLimitKey(phone: string): string {
  return `${PHONE_OTP_CACHE_PREFIX}:rate:${phone}`;
}

/**
 * POST - Send OTP to user's phone number
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { user } = auth;
    
    // Get user's phone number
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { phone: true, phoneVerified: true },
    });
    
    if (!userData || !userData.phone) {
      return NextResponse.json(
        { error: 'Phone number not found. Please add a phone number to your profile.' },
        { status: 400 }
      );
    }
    
    // Check if already verified
    if (userData.phoneVerified) {
      return NextResponse.json({
        success: true,
        message: 'Phone number is already verified',
        alreadyVerified: true,
      });
    }
    
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(userData.phone);
    
    // Validate phone number
    if (!isValidPhone(userData.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }
    
    // Check rate limit
    const rateLimitKey = buildRateLimitKey(normalizedPhone);
    try {
      const requestCount = await cache.get<number>(rateLimitKey);
      if (requestCount !== null && requestCount >= MAX_OTP_REQUESTS) {
        return NextResponse.json(
          { error: 'Too many OTP requests. Please try again later.' },
          { status: 429 }
        );
      }
    } catch {
      // Cache unavailable, continue
    }
    
    // Generate OTP
    const otp = generateOtp();
    
    // Store OTP in cache
    const otpKey = buildOtpCacheKey(user.id);
    try {
      await cache.set(otpKey, { otp, phone: normalizedPhone, createdAt: Date.now() }, PHONE_OTP_TTL);
    } catch {
      // If cache fails, store in user record temporarily
      await db.user.update({
        where: { id: user.id },
        data: { 
          phoneVerificationOtp: otp,
          phoneVerificationSentAt: new Date(),
        },
      });
    }
    
    // Increment rate limit
    try {
      const currentCount = await cache.get<number>(rateLimitKey);
      await cache.set(rateLimitKey, (currentCount || 0) + 1, RATE_LIMIT_TTL);
    } catch {
      // Cache unavailable, continue
    }
    
    // Send OTP via SMS
    const result = await sendOtp(normalizedPhone, otp);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send OTP' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone number',
      // Only return OTP in development
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    });
  } catch (error) {
    console.error('[Phone Verification] Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Verify OTP and update phoneVerified status
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { user } = auth;
    const body = await request.json();
    const { otp } = body;
    
    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit OTP is required' },
        { status: 400 }
      );
    }
    
    // Get user data
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { 
        phone: true, 
        phoneVerified: true,
        phoneVerificationOtp: true,
        phoneVerificationSentAt: true,
      },
    });
    
    if (!userData || !userData.phone) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 400 }
      );
    }
    
    // Check if already verified
    if (userData.phoneVerified) {
      return NextResponse.json({
        success: true,
        message: 'Phone number is already verified',
        alreadyVerified: true,
      });
    }
    
    // Get stored OTP from cache
    const otpKey = buildOtpCacheKey(user.id);
    let storedOtp: { otp: string; phone: string; createdAt: number } | null = null;
    
    try {
      storedOtp = await cache.get<{ otp: string; phone: string; createdAt: number }>(otpKey);
    } catch {
      // Cache unavailable, try database fallback
    }
    
    // Fallback to database OTP
    if (!storedOtp && userData.phoneVerificationOtp) {
      // Check if OTP has expired (10 minutes)
      if (userData.phoneVerificationSentAt) {
        const otpAge = Date.now() - userData.phoneVerificationSentAt.getTime();
        if (otpAge <= PHONE_OTP_TTL * 1000) {
          storedOtp = {
            otp: userData.phoneVerificationOtp,
            phone: normalizePhoneNumber(userData.phone),
            createdAt: userData.phoneVerificationSentAt.getTime(),
          };
        }
      }
    }
    
    if (!storedOtp) {
      return NextResponse.json(
        { error: 'OTP not found or expired. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // Verify OTP
    if (storedOtp.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP. Please try again.' },
        { status: 400 }
      );
    }
    
    // OTP verified - update user
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        phoneVerificationOtp: null,
        phoneVerificationSentAt: null,
      },
    });
    
    // Clean up cache
    try {
      await cache.delete(otpKey);
    } catch {
      // Cache unavailable, ignore
    }
    
    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneVerified: true,
    });
  } catch (error) {
    console.error('[Phone Verification] Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Check phone verification status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { user } = auth;
    
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        phone: true,
        phoneVerified: true,
        phoneVerifiedAt: true,
      },
    });
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      phone: userData.phone,
      phoneVerified: userData.phoneVerified,
      phoneVerifiedAt: userData.phoneVerifiedAt,
    });
  } catch (error) {
    console.error('[Phone Verification] Status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
