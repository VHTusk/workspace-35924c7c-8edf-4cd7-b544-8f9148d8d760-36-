import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createUser, createSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

/**
 * Spectator Registration Endpoint
 * Simplified registration for free spectator accounts:
 * - Name, email/phone only
 * - No password required (can set later when upgrading)
 * - No OTP verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      phone, 
      firstName, 
      lastName, 
      sport,
    } = body;

    // Validation
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
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

    const sportType = sport as SportType;

    // Check if user already exists
    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email_sport: { email, sport: sportType } },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already registered for this sport' },
          { status: 409 }
        );
      }
    }

    if (phone) {
      const existingPhone = await db.user.findUnique({
        where: { phone_sport: { phone, sport: sportType } },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: 'Phone already registered for this sport' },
          { status: 409 }
        );
      }
    }

    // Create spectator user (no password required)
    const user = await createUser({
      email,
      phone,
      password: undefined, // No password for spectator accounts
      firstName,
      lastName,
      sport: sportType,
    });

    // Create session
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
        accountTier: user.accountTier,
      },
      isSpectator: true,
      message: 'Welcome! You can now browse tournaments, follow players, and view leaderboards.',
    });

    response.cookies.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Spectator registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
