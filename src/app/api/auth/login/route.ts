import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { SportType, AbusePattern, AbuseSeverity } from '@prisma/client';
import { log, authLog } from '@/lib/logger';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { logLoginEvent, AuditEventType } from '@/lib/audit-logger';
import { withRateLimit } from '@/lib/rate-limit';
import {
  detectDeviceFingerprint,
  generateDeviceFingerprint,
  storeDeviceFingerprint,
  detectCredentialStuffing,
  detectImpossibleTravel,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
  getAbuseRiskScore,
} from '@/lib/abuse-detection';

// Input validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validatePhone(phone: string): boolean {
  // Indian phone numbers: 10 digits, optionally starting with +91
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
  return phoneRegex.test(cleanPhone);
}

function sanitizeInput(input: string): string {
  return input.toLowerCase().trim();
}

// FIX: Wrap handler with distributed rate limiting to prevent brute force attacks
// Uses 'LOGIN' tier: 5 requests per minute per IP
// With 2 replicas, this rate limit is now distributed via Redis
async function loginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, password, sport, otpLogin } = body;

    // Get client info for abuse detection
    const ipAddress = getClientIpAddress(request);
    const userAgent = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);

    // Sport validation
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Invalid sport', code: 'INVALID_SPORT' },
        { status: 400 }
      );
    }

    const sportType = sport as SportType;

    // Validate email format if provided
    if (email) {
      if (!validateEmail(email)) {
        return NextResponse.json(
          { error: 'Invalid email format', code: 'INVALID_EMAIL' },
          { status: 400 }
        );
      }
    }

    // Validate phone format if provided
    if (phone) {
      if (!validatePhone(phone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number', code: 'INVALID_PHONE' },
          { status: 400 }
        );
      }
    }

    // Validate password length if provided
    if (password && password.length > 128) {
      return NextResponse.json(
        { error: 'Password is too long', code: 'PASSWORD_TOO_LONG' },
        { status: 400 }
      );
    }

    // Find user by email or phone
    let user;
    const normalizedEmail = email ? sanitizeInput(email) : null;
    const normalizedPhone = phone ? phone.replace(/[\s-]/g, '').replace(/^\+91/, '') : null;
    
    if (normalizedEmail) {
      user = await db.user.findUnique({
        where: { email_sport: { email: normalizedEmail, sport: sportType } },
      });
    } else if (normalizedPhone) {
      user = await db.user.findUnique({
        where: { phone_sport: { phone: normalizedPhone, sport: sportType } },
      });
    } else {
      return NextResponse.json(
        { error: 'Email or phone is required', code: 'IDENTIFIER_REQUIRED' },
        { status: 400 }
      );
    }

    if (!user) {
      // FIX: Use generic message to prevent user enumeration
      // Log the attempt for security monitoring but don't reveal if email exists
      const stuffingCheck = await detectCredentialStuffing(
        email || phone || '',
        ipAddress || 'unknown',
        deviceFingerprint,
        sportType
      );
      
      if (stuffingCheck.detected) {
        await recordAbuseEvent(
          AbusePattern.CREDENTIAL_STUFFING,
          stuffingCheck.severity || AbuseSeverity.HIGH,
          undefined,
          undefined,
          ipAddress,
          userAgent,
          stuffingCheck.metadata || {}
        );
      }
      
      // FIX: Return generic "Invalid credentials" message
      // This prevents attackers from knowing which emails are registered
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // Check if account is locked due to unverified email (24-hour window expired)
    if (!user.isActive && user.deactivationReason?.includes('Email not verified')) {
      return NextResponse.json(
        {
          error: 'Your account has been locked because your email was not verified within 24 hours. Please contact support to unlock your account.',
          code: 'ACCOUNT_LOCKED_UNVERIFIED',
          canContactSupport: true,
        },
        { status: 403 }
      );
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Check device risk score for additional security
      const riskScore = await getAbuseRiskScore(user.id, deviceFingerprint, ipAddress);
      if (riskScore.overallScore >= 70) {
        await recordAbuseEvent(
          AbusePattern.CREDENTIAL_STUFFING,
          AbuseSeverity.HIGH,
          user.id,
          undefined,
          ipAddress,
          userAgent,
          { riskScore: riskScore.overallScore }
        );
      }
      
      return NextResponse.json(
        { error: 'Account is temporarily locked. Please try again later.' },
        { status: 423 }
      );
    }

    // If OTP login, skip password verification (OTP was already verified)
    if (otpLogin) {
      // For email-based OTP logins, check email verification
      // Phone-based OTP logins are considered verified via OTP
      if (user.email && !user.phone && !user.emailVerified) {
        return NextResponse.json(
          { 
            error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
            code: 'EMAIL_NOT_VERIFIED',
            email: user.email,
            canResendVerification: true,
          },
          { status: 403 }
        );
      }
      
      // Reset failed attempts on successful login
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      // Store device fingerprint for this login
      await storeDeviceFingerprint(user.id, deviceData, ipAddress);

      // SECURITY: Session Fixation Prevention
      // Delete any existing sessions for this user before creating a new one
      try {
        await db.session.deleteMany({
          where: { userId: user.id }
        });
      } catch {
        // Ignore errors - session might not exist
      }

      // Create session
      const session = await createSession(user.id, sportType);

      // Log successful login
      logLoginEvent(user.id, sportType, request, {
        role: user.role,
        loginMethod: 'otp',
        success: true,
      }).catch(err => log.error('Failed to log login event', { error: err }));

      // Set cookie
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
          tier: user.hiddenElo >= 1900 ? 'DIAMOND' : 
               user.hiddenElo >= 1700 ? 'PLATINUM' :
               user.hiddenElo >= 1500 ? 'GOLD' :
               user.hiddenElo >= 1300 ? 'SILVER' : 'BRONZE',
          points: user.visiblePoints,
        },
      });

      setSessionCookie(response, session.token);

      // Set CSRF token cookie for subsequent requests
      setCsrfCookie(response);

      return response;
    }

    // Verify password
    if (password && user.password) {
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        // Increment failed attempts
        const attempts = user.failedLoginAttempts + 1;
        const updates: Record<string, unknown> = { failedLoginAttempts: attempts };
        
        if (attempts >= 5) {
          updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
          
          // Update user with lock info
          await db.user.update({
            where: { id: user.id },
            data: updates,
          });
          
          // Log failed login with account lock
          logLoginEvent(user.id, sportType, request, {
            role: user.role,
            loginMethod: 'password',
            success: false,
          }).catch(err => log.error('Failed to log login event', { error: err }));
          
          return NextResponse.json(
            { error: 'Account locked due to too many failed attempts. Please try again in 30 minutes.', code: 'ACCOUNT_LOCKED' },
            { status: 423 }
          );
        }

        await db.user.update({
          where: { id: user.id },
          data: updates,
        });

        // Log failed login attempt
        logLoginEvent(user.id, sportType, request, {
          role: user.role,
          loginMethod: 'password',
          success: false,
        }).catch(err => log.error('Failed to log login event', { error: err }));

        // FIX: Return generic "Invalid credentials" to prevent user enumeration
        // Don't reveal remaining attempts to prevent brute force optimization
        return NextResponse.json(
          { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
          { status: 401 }
        );
      }
    } else if (!user.password) {
      // User registered with Google OAuth, no password set
      return NextResponse.json(
        { error: 'This account was created with Google. Please sign in with Google.', code: 'USE_GOOGLE' },
        { status: 401 }
      );
    } else if (!password) {
      return NextResponse.json(
        { error: 'Password is required', code: 'PASSWORD_REQUIRED' },
        { status: 400 }
      );
    }

    // SECURITY: Session Fixation Prevention
    // Delete any existing sessions for this user before creating a new one
    // This ensures the user always gets a fresh session on login
    try {
      await db.session.deleteMany({
        where: { userId: user.id }
      });
    } catch {
      // Ignore errors - session might not exist
    }

    // Check email verification for email-based accounts
    // DISABLED FOR TESTING - User has 24 hours to verify after registration
    // After 24 hours, account will be locked by cron job if not verified
    // if (user.email && !user.emailVerified) {
    //   console.log(`Login blocked for user ${user.id}: email not verified`);
    //   return NextResponse.json(
    //     { 
    //       error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
    //       code: 'EMAIL_NOT_VERIFIED',
    //       email: user.email,
    //       canResendVerification: true,
    //     },
    //     { status: 403 }
    //   );
    // }

    // Reset failed attempts on successful login
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // Store device fingerprint for this login
    await storeDeviceFingerprint(user.id, deviceData, ipAddress);

    // Create session
    const session = await createSession(user.id, sportType);

    // Log successful login
    logLoginEvent(user.id, sportType, request, {
      role: user.role,
      loginMethod: 'password',
      success: true,
    }).catch(err => log.error('Failed to log login event', { error: err }));

    // Set cookie
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
        tier: user.hiddenElo >= 1900 ? 'DIAMOND' : 
             user.hiddenElo >= 1700 ? 'PLATINUM' :
             user.hiddenElo >= 1500 ? 'GOLD' :
             user.hiddenElo >= 1300 ? 'SILVER' : 'BRONZE',
        points: user.visiblePoints,
      },
    });

    setSessionCookie(response, session.token);

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    log.errorWithStack('Login error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(loginHandler, 'LOGIN');
