import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createOrgSession } from '@/lib/auth';
import { SportType } from '@prisma/client';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { withRateLimit } from '@/lib/rate-limit';

// FIX: Wrap handler with distributed rate limiting
// Uses 'LOGIN' tier: 5 requests per minute per IP
async function orgLoginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, password, sport } = body;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Invalid sport' },
        { status: 400 }
      );
    }

    const sportType = sport as SportType;

    // Find organization by email or phone
    let org;
    if (email) {
      org = await db.organization.findFirst({
        where: { email, sport: sportType },
        include: {
          subscription: true,
          orgAdmins: {
            where: { isActive: true },
            include: { user: true },
            take: 1,
          },
        },
      });
    } else if (phone) {
      org = await db.organization.findFirst({
        where: { phone, sport: sportType },
        include: {
          subscription: true,
          orgAdmins: {
            where: { isActive: true },
            include: { user: true },
            take: 1,
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 401 }
      );
    }

    // Verify password
    if (!password || !org.password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, org.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    // Create session
    const session = await createOrgSession(org.id, sportType);

    // Get roster count
    const rosterCount = await db.orgRosterPlayer.count({
      where: { orgId: org.id, isActive: true },
    });

    // Set cookie and return response
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
        subscription: org.subscription ? {
          status: org.subscription.status,
          endDate: org.subscription.endDate,
        } : null,
        memberCount: rosterCount,
      },
    });

    setSessionCookie(response, session.token);

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Org login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the rate-limited handler
export const POST = withRateLimit(orgLoginHandler, 'LOGIN');
