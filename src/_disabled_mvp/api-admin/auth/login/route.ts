import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, hashToken } from '@/lib/auth';
import { Role, AccountType } from '@prisma/client';
import { isMfaRequiredForRole, getMfaStatus, checkMfaRequirement } from '@/lib/mfa';
import { withRateLimit } from '@/lib/rate-limit';

/**
 * Generate a cryptographically secure session token
 * Uses Web Crypto API (works in Node.js runtime)
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Admin login handler - works across all sports (platform-wide access)
// FIX: Wrapped with rate limiting to prevent brute force attacks
// Uses 'LOGIN' tier: 5 requests per minute per IP
async function adminLoginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password, mfaCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin user by email (check both sports)
    const adminUser = await db.user.findFirst({
      where: {
        email,
        role: { in: [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR] },
      },
    });

    // FIX: Use generic error message to prevent user enumeration
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: 'Account is temporarily locked. Please try again later.' },
        { status: 423 }
      );
    }

    // Check if account is active
    if (!adminUser.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Contact super admin.' },
        { status: 403 }
      );
    }

    // Verify password
    if (!adminUser.password) {
      return NextResponse.json(
        { error: 'Password not set. Please reset your password.' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, adminUser.password);
    if (!isValid) {
      // Increment failed attempts
      const attempts = adminUser.failedLoginAttempts + 1;
      const updates: Record<string, unknown> = { failedLoginAttempts: attempts };
      
      if (attempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      }

      await db.user.update({
        where: { id: adminUser.id },
        data: updates,
      });

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if MFA is required for this role
    const mfaRequired = isMfaRequiredForRole(adminUser.role);
    
    if (mfaRequired) {
      const mfaStatus = await getMfaStatus(adminUser.id);
      
      // If MFA is enabled, require verification
      if (mfaStatus.enabled) {
        if (!mfaCode) {
          // Return response indicating MFA is required
          return NextResponse.json({
            success: false,
            requireMfa: true,
            message: 'MFA verification required',
            userId: adminUser.id,
            email: adminUser.email,
          });
        }

        // Verify MFA code
        const { verifyMfaLogin } = await import('@/lib/mfa');
        const mfaResult = await verifyMfaLogin(adminUser.id, mfaCode);
        
        if (!mfaResult.success) {
          return NextResponse.json(
            { error: mfaResult.error || 'Invalid MFA code', requireMfa: true },
            { status: 401 }
          );
        }
      } else if (mfaRequired && !mfaStatus.setup) {
        // MFA is required but not set up - allow login but flag for MFA setup
        // This allows first-time setup
        // Continue with login but add a flag
      }
    }

    // Reset failed attempts on successful login
    await db.user.update({
      where: { id: adminUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // FIX: Create admin session with properly hashed token
    // This matches the validateSession() function which hashes tokens before lookup
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours for admin

    await db.session.create({
      data: {
        token: tokenHash, // Store hashed token, NOT plaintext
        userId: adminUser.id,
        sport: adminUser.sport,
        accountType: AccountType.PLAYER, // Admin uses player account type
        expiresAt,
      },
    });

    // Get MFA status to return
    const mfaStatus = await getMfaStatus(adminUser.id);

    // Log audit
    await db.auditLog.create({
      data: {
        sport: adminUser.sport,
        action: 'ADMIN_OVERRIDE',
        actorId: adminUser.id,
        actorRole: adminUser.role,
        targetType: 'ADMIN_SESSION',
        targetId: adminUser.id,
        metadata: JSON.stringify({ action: 'LOGIN', mfaUsed: mfaRequired && mfaStatus.enabled }),
      },
    });

    // Set cookie and return response
    const response = NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
        sport: adminUser.sport,
      },
      mfaStatus: {
        required: mfaRequired,
        enabled: mfaStatus.enabled,
        setup: mfaStatus.setup,
      },
    });

    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(adminLoginHandler, 'LOGIN');
