import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createOrganization, createOrgSession } from '@/lib/auth';
import { SportType } from '@prisma/client';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { withRateLimit } from '@/lib/rate-limit';

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

// FIX: Wrap handler with distributed rate limiting
// Uses 'REGISTER' tier: 5 requests per minute per IP
async function orgRegisterHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      name,
      type,
      email,
      phone,
      password,
      city,
      district,
      state,
      pinCode,
      sport,
      tosAccepted,
      privacyAccepted,
    } = body;

    // Validation
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Invalid sport' },
        { status: 400 }
      );
    }

    // Name is required
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Email OR Phone is required (at least one)
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone number is required' },
        { status: 400 }
      );
    }

    // Password is required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Password strength validation
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

    const sportType = sport as SportType;

    // Check if organization already exists by email
    if (email) {
      const existingOrg = await db.organization.findFirst({
        where: { email, sport: sportType },
      });

      if (existingOrg) {
        return NextResponse.json(
          { error: 'Organization with this email already exists for this sport' },
          { status: 409 }
        );
      }
    }

    // Check if organization already exists by phone
    if (phone) {
      const existingPhone = await db.organization.findFirst({
        where: { phone, sport: sportType },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: 'Organization with this phone already exists for this sport' },
          { status: 409 }
        );
      }
    }

    // Create organization
    const org = await createOrganization({
      name,
      type,
      email,
      phone,
      password,
      city,
      district,
      state,
      pinCode,
      sport: sportType,
      tosAccepted,
      privacyAccepted,
    });

    // Create session
    const session = await createOrgSession(org.id, sportType);

    const response = NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        email: org.email,
        phone: org.phone,
        city: org.city,
        state: org.state,
        sport: org.sport,
        planTier: org.planTier,
      },
    });

    setSessionCookie(response, session.token);

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Organization registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(orgRegisterHandler, 'REGISTER');
