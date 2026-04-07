import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createUser, createSession } from '@/lib/auth';
import { SportType, AbusePattern, AbuseSeverity } from '@prisma/client';
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

// Password validation function
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least 1 special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// FIX: Wrap handler with distributed rate limiting to prevent spam accounts
// Uses 'REGISTER' tier: 5 requests per minute per IP
// With 2 replicas, this rate limit is now distributed via Redis
async function registerHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const startTime = Date.now(); // Track form completion time
    const body = await request.json();
    const { 
      email, 
      phone, 
      password, 
      firstName, 
      lastName, 
      sport,
      city,
      district,
      state,
      phoneVerified,
      referralCode, // Optional referral code from another user
      formStartTime, // Client-side form start time for bot detection
      honeypot, // Honeypot field for bot detection
    } = body;

    // Validation
    const sportType = normalizeSport(sport);
    if (!sportType) {
      return NextResponse.json(
        { error: 'Invalid sport' },
        { status: 400 }
      );
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    // Email format validation
    if (email) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
      
      // Additional check for common typos
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email contains invalid characters or whitespace' },
          { status: 400 }
        );
      }
    }

    // Phone format validation (Indian phone numbers)
    if (phone) {
      // Remove any spaces or dashes
      const cleanPhone = phone.replace(/[\s-]/g, '');
      // Indian phone numbers: 10 digits, optionally starting with +91
      const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number' },
          { status: 400 }
        );
      }
    }

    if (email && !password) {
      return NextResponse.json(
        { error: 'Password is required for email registration' },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { 
            error: 'Password does not meet requirements',
            passwordErrors: passwordValidation.errors 
          },
          { status: 400 }
        );
      }
    }

    // Get client info for abuse detection
    const ipAddress = getClientIpAddress(request);
    const userAgent = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);

    // Calculate form completion time (for bot detection)
    const formCompletionTimeMs = formStartTime ? Date.now() - formStartTime : undefined;

    // === ABUSE DETECTION: Bot Registration ===
    const botCheck = await detectBotRegistration(
      email,
      phone,
      firstName,
      lastName,
      deviceFingerprint,
      formCompletionTimeMs,
      honeypot,
      ipAddress
    );

    if (botCheck.isBot) {
      // Record the abuse event
      await recordAbuseEvent(
        AbusePattern.BOT_REGISTRATION_PATTERN,
        botCheck.riskScore >= 80 ? AbuseSeverity.HIGH : AbuseSeverity.MEDIUM,
        undefined, // No user yet
        undefined, // No device record yet
        ipAddress,
        userAgent,
        {
          indicators: botCheck.indicators,
          riskScore: botCheck.riskScore,
          email: email ? '[REDACTED]' : undefined,
          phone: phone ? '[REDACTED]' : undefined,
          firstName,
          lastName,
        }
      );

      log.warn('Bot registration blocked', {
        indicators: botCheck.indicators,
        riskScore: botCheck.riskScore,
        ipAddress,
      });

      return NextResponse.json(
        { error: 'Registration blocked due to suspicious activity', code: 'BOT_DETECTED' },
        { status: 403 }
      );
    }

    // === ABUSE DETECTION: Multiple Accounts Check ===
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
        }
      );

      log.warn('Registration blocked: too many accounts from device', {
        fingerprint: deviceFingerprint,
        accountCount: multiAccountCheck.metadata?.accountCount,
        ipAddress,
      });

      return NextResponse.json(
        { error: 'Registration limit exceeded for this device', code: 'DEVICE_LIMIT_EXCEEDED' },
        { status: 403 }
      );
    }

    // Check if identity is suspended (cross-sport ban check)
    const suspensionCheck = await checkIdentitySuspended(email, phone);
    if (suspensionCheck.suspended) {
      return NextResponse.json(
        { 
          error: 'This email or phone number has been suspended',
          reason: suspensionCheck.reason,
          type: suspensionCheck.type,
        },
        { status: 403 }
      );
    }

    // Check if user already exists
    // FIX: Check both email and phone before returning to prevent user enumeration
    // Return generic message instead of revealing which identifier exists
    let emailExists = false;
    let phoneExists = false;
    
    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email_sport: { email, sport: sportType } },
        select: { id: true },
      });
      emailExists = !!existingEmail;
    }

    if (phone) {
      const existingPhone = await db.user.findUnique({
        where: { phone_sport: { phone, sport: sportType } },
        select: { id: true },
      });
      phoneExists = !!existingPhone;
    }

    // FIX: Return generic message to prevent user enumeration
    // Attackers shouldn't know which emails/phones are registered
    if (emailExists || phoneExists) {
      return NextResponse.json(
        { 
          error: 'Registration could not be completed. If you already have an account, please try logging in.',
          code: 'REGISTRATION_FAILED' 
        },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser({
      email,
      phone,
      password,
      firstName,
      lastName,
      sport: sportType,
      city,
      district,
      state,
      referredByCode: referralCode, // Pass referral code if provided
    });

    // Store device fingerprint for the new user
    await storeDeviceFingerprint(
      user.id,
      deviceData,
      ipAddress
    );

    // Log registration event
    logRegisterEvent(user.id, sportType, request, {
      email: user.email || undefined,
      phone: user.phone || undefined,
      referralCode: referralCode,
    }).catch(err => log.error('Failed to log registration event', { error: err }));

    // For email registrations, send verification email in background
    // User has 24 hours to verify before account is locked
    const isEmailRegistration = !!email;
    
    if (isEmailRegistration && !phoneVerified) {
      // Mark email as not verified
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: false,
        },
      });
      
      // Send verification email in background (don't await)
      createAndSendVerificationToken(
        user.id,
        email,
        sportType,
        firstName
      ).then(result => {
        if (result.success) {
          console.log(`Verification email sent to ${email}`);
        } else {
          console.error('Failed to send verification email:', result.error);
        }
      }).catch(err => {
        console.error('Error sending verification email:', err);
      });
    }

    // Create session immediately - user has 24 hours to verify email
    const session = await createSession(user.id, sportType);

    const response = NextResponse.json({
      success: true,
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
      // Indicate if email verification is pending (for UI to show reminder)
      emailVerificationPending: isEmailRegistration && !phoneVerified,
    });

    setSessionCookie(response, session.token);

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    // Log detailed error for debugging
    console.error('Registration error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(registerHandler, 'REGISTER');
