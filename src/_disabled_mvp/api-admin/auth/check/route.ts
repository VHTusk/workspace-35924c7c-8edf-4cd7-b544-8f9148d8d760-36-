import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { getAuthenticatedAdmin, hashToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json(
        { authenticated: false, error: 'No session found' },
        { status: 401 }
      );
    }
    const { user, session } = auth;

    // Check if user has admin role
    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json(
        { authenticated: false, error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { authenticated: false, error: 'Account deactivated' },
        { status: 403 }
      );
    }

    // Update last activity only if more than 5 minutes have passed
    // This reduces database writes from potentially every request to at most once per 5 minutes
    if (session) {
      const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
      if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
        const tokenHash = await hashToken(request.cookies.get('admin_session')?.value || '');
        db.session.update({
          where: { token: tokenHash },
          data: { lastActivityAt: new Date() },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        sport: user.sport,
      },
    });
  } catch (error) {
    console.error('Admin auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
