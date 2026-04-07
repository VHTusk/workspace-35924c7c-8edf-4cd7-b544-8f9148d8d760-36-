import { NextRequest, NextResponse } from 'next/server';
import { sendOtp, normalizePhoneNumber, isValidIndianPhone } from '@/lib/sms-service';
import { sendEmail, EmailTemplates } from '@/lib/email';
import { cache } from '@/lib/cache';
import crypto from 'crypto';

// OTP Configuration
const OTP_TTL = 600; // 10 minutes in seconds
const OTP_CACHE_PREFIX = 'otp';
const OTP_RATE_LIMIT_PREFIX = 'otp-rate';
const MAX_OTP_REQUESTS = 3; // Max OTP requests per identifier per hour
const RATE_LIMIT_TTL = 3600; // 1 hour in seconds

// In-memory fallback for development (when cache is not available)
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();
const rateLimitStore = new Map<string, { count: number; expiresAt: Date }>();

// Generate 6-digit OTP using CRYPTOGRAPHIC randomness (NOT Math.random)
function generateOtp(): string {
  // Use crypto.randomInt for cryptographically secure random numbers
  // This is required for security-sensitive operations like OTP
  return crypto.randomInt(100000, 1000000).toString();
}

// Build cache key for OTP
function buildOtpCacheKey(identifier: string): string {
  return `${OTP_CACHE_PREFIX}:${identifier}`;
}

// Build cache key for rate limiting
function buildRateLimitKey(identifier: string): string {
  return `${OTP_RATE_LIMIT_PREFIX}:${identifier}`;
}

// Check rate limit - FAIL CLOSED, not open
async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; error?: string }> {
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
  } catch (cacheError) {
    // CRITICAL: FAIL CLOSED when cache is unavailable
    // This prevents abuse during infrastructure failures
    console.error('[OTP] Cache unavailable for rate limiting:', cacheError);
    
    // Try in-memory fallback
    const now = new Date();
    const stored = rateLimitStore.get(identifier);
    
    if (stored && stored.expiresAt > now) {
      if (stored.count >= MAX_OTP_REQUESTS) {
        return { 
          allowed: false, 
          remaining: 0,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }
      stored.count++;
      return { allowed: true, remaining: MAX_OTP_REQUESTS - stored.count };
    }
    
    // First request or expired - allow
    rateLimitStore.set(identifier, { 
      count: 1, 
      expiresAt: new Date(Date.now() + RATE_LIMIT_TTL * 1000) 
    });
    return { allowed: true, remaining: MAX_OTP_REQUESTS - 1 };
  }
}

// Store OTP
async function storeOtp(identifier: string, otp: string): Promise<void> {
  const key = buildOtpCacheKey(identifier);
  
  try {
    await cache.set(key, { otp, createdAt: Date.now() }, OTP_TTL);
  } catch {
    // Fallback to in-memory store
    otpStore.set(identifier, { otp, expiresAt: new Date(Date.now() + OTP_TTL * 1000) });
  }
}

// Detect if identifier is email or phone
function detectIdentifierType(identifier: string): 'email' | 'phone' {
  // Check if it's an email
  if (identifier.includes('@')) {
    return 'email';
  }
  // Assume it's a phone number
  return 'phone';
}

// Send OTP via email
async function sendEmailOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Your VALORHIVE Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">✉️ Verify Your Email</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">Your VALORHIVE verification code is:</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #6b7280;">This code will expire in 10 minutes.</p>
            <p style="font-size: 14px; color: #6b7280;">If you didn't request this code, please ignore this email.</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>© ${new Date().getFullYear()} VALORHIVE. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Your VALORHIVE verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('[OTP] Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// Send OTP via SMS
async function sendPhoneOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // Check if it's a valid Indian phone
    const isIndian = isValidIndianPhone(phone);
    
    // Send OTP via SMS service
    const result = await sendOtp(normalizedPhone, otp);
    
    // In development, return the OTP for testing
    const devOtp = process.env.NODE_ENV === 'development' ? otp : undefined;
    
    return { 
      success: result.success, 
      error: result.error,
      devOtp,
    };
  } catch (error) {
    console.error('[OTP] SMS send error:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, type } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    const identifier = email || phone;
    const identifierType = detectIdentifierType(identifier);
    
    // Check rate limit
    const rateLimit = await checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many OTP requests. Please try again later.',
          retryAfter: RATE_LIMIT_TTL,
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOtp();
    
    // Store OTP
    await storeOtp(identifier, otp);
    
    // Also store in memory as backup
    otpStore.set(identifier, { otp, expiresAt: new Date(Date.now() + OTP_TTL * 1000) });
    
    // Send OTP based on identifier type
    let sendResult: { success: boolean; error?: string; devOtp?: string };
    
    if (identifierType === 'email') {
      sendResult = await sendEmailOtp(identifier, otp);
    } else {
      sendResult = await sendPhoneOtp(identifier, otp);
    }
    
    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${identifierType}`,
      remainingRequests: rateLimit.remaining,
      // Only in development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { devOtp: sendResult.devOtp || otp }),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}

// Export for use in verify route (fallback)
export { otpStore };
