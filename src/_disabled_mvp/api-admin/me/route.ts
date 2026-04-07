import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role } from '@prisma/client';

// Get current admin profile
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    // Fetch rating separately since auth helper doesn't include it
    const userWithRating = await db.user.findUnique({
      where: { id: user.id },
      include: { rating: true },
    });

    // Verify admin role
    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      admin: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        sport: user.sport,
        city: user.city,
        state: user.state,
        rating: userWithRating?.rating ? {
          matchesPlayed: userWithRating.rating.matchesPlayed,
          wins: userWithRating.rating.wins,
          losses: userWithRating.rating.losses,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
