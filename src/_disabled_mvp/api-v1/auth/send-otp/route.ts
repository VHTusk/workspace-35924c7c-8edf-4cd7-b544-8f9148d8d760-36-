/**
 * V1 API: Send OTP
 * 
 * Sends a one-time password to email or phone for verification.
 * Supports both email and SMS delivery.
 * 
 * @version v1
 * @immutable true
 */

import { NextRequest, NextResponse } from 'next/server';
import { addVersionHeaders } from '@/lib/api-versioning';
import { sendOtp, normalizePhoneNumber, isValidIndianPhone } from '@/lib/sms-service';
import { sendEmail } from '@/lib/email';
import { cache } from '@/lib/cache';
import crypto from 'crypto';

// OTP Configuration
const OTP_TTL = 600; // 10 minutes in seconds
const OTP_CACHE_PREFIX = 'otp:v1';
const OTP_RATE_LIMIT_PREFIX = 'otp-rate:v1';
const MAX_OTP_REQUESTS = 3;
const RATE_LIMIT_TTL = 3600; // 1 hour

// In-memory fallback for development
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();
const rateLimitStore = new Map<string, { count: number; expiresAt: Date }>();

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

function buildRateLimitKey(identifier: string): string {
  return `${OTP_RATE_LIMIT_PREFIX}:${identifier}`;
}

function detectIdentifierType(identifier: string): 'email' | 'phone' {
  if (identifier.includes('@')) {
    return 'email';
  }
  return 'phone';
}

async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = buildRateLimitKey(identifier);
  
  try {
    const count = await cache.get<number>(key);
    if (count === null) {
      await cache.set(key, 1, RATE_LIMIT_TTL);
      return { allowed: true, remaining: MAX_OTP_REQUESTS - 1 };
    }
    
    if (count >= MAX_OTP_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    
    await cache.set(key, count + 1, RATE_LIMIT_TTL);
    return { allowed: true, remaining: MAX_OTP_REQUESTS - count - 1 };
  } catch {
    const now = new Date();
    const stored = rateLimitStore.get(identifier);
    
    if (stored && stored.expiresAt > now) {
      if (stored.count >= MAX_OTP_REQUESTS) {
        return { allowed: false, remaining: 0 };
      }
      stored.count++;
      return { allowed: true, remaining: MAX_OTP_REQUESTS - stored.count };
    }
    
    rateLimitStore.set(identifier, { 
      count: 1, 
      expiresAt: new Date(Date.now() + RATE_LIMIT_TTL * 1000) 
    });
    return { allowed: true, remaining: MAX_OTP_REQUESTS - 1 };
  }
}

async function storeOtp(identifier: string, otp: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);
  
  try {
    await cache.set(key, { otp, createdAt: Date.now() }, OTP_TTL);
  } catch {
    otpStore.set(identifier, { otp, expiresAt: new Date(Date.now() + OTP_TTL * 1000) });
  }
  
  // Also store in memory as backup
  otpStore.set(identifier, { otp, expiresAt: new Date(Date.now() + OTP_TTL * 1000) });
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
            <p style="font-size: 16px;">Your verification code is:</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #6b7280;">This code will expire in 10 minutes.</p>
          </div>
        </div>
      `,
      text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('[V1 OTP] Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

async function sendPhoneOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    const result = await sendOtp(normalizedPhone, otp);
    
    const devOtp = process.env.NODE_ENV === 'development' ? otp : undefined;
    
    return { 
      success: result.success, 
      error: result.error,
      devOtp,
    };
  } catch (error) {
    console.error('[V1 OTP] SMS send error:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, type } = body;

    if (!email && !phone) {
      const response = NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email or phone is required',
      }, { status: 400 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    const identifier = email || phone;
    const identifierType = detectIdentifierType(identifier);
    
    // Check rate limit
    const rateLimit = await checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      const response = NextResponse.json({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many OTP requests. Please try again later.',
        details: { retryAfter: RATE_LIMIT_TTL },
      }, { status: 429 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    // Generate OTP
    const otp = generateOtp();
    
    // Store OTP
    await storeOtp(identifier, otp);
    
    // Send OTP based on identifier type
    let sendResult: { success: boolean; error?: string; devOtp?: string };
    
    if (identifierType === 'email') {
      sendResult = await sendEmailOtp(identifier, otp);
    } else {
      sendResult = await sendPhoneOtp(identifier, otp);
    }
    
    if (!sendResult.success) {
      const response = NextResponse.json({
        success: false,
        error: 'SEND_FAILED',
        message: sendResult.error || 'Failed to send OTP',
      }, { status: 500 });
      addVersionHeaders(response, 'v1');
      return response;
    }

    const response = NextResponse.json({
      success: true,
      data: {
        message: `OTP sent to ${identifierType}`,
        identifierType,
        remainingRequests: rateLimit.remaining,
        expiresIn: OTP_TTL,
        // Only in development
        ...(process.env.NODE_ENV === 'development' && { devOtp: sendResult.devOtp || otp }),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    return response;
  } catch (error) {
    console.error('[V1 Send OTP] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to send OTP',
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}

// Export for use in verify route
export { otpStore };
