import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin, getAuthenticatedOrg, getAuthenticatedUser } from '@/lib/auth';
import { setCsrfCookie } from '@/lib/csrf';

/**
 * GET /api/auth/csrf-token
 * 
 * Returns a fresh CSRF token for authenticated users.
 * This is useful for users who were logged in before CSRF tokens were implemented.
 */
export async function GET(request: NextRequest) {
  try {
    // Check if player, org, or office admin is authenticated
    const userAuth = await getAuthenticatedUser(request);
    const orgAuth = await getAuthenticatedOrg(request);
    const adminAuth = await getAuthenticatedAdmin(request);

    if (!userAuth && !orgAuth && !adminAuth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create response with fresh CSRF token
    const response = NextResponse.json({
      success: true,
      message: 'CSRF token refreshed',
    });

    // Set a new CSRF token cookie
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Error refreshing CSRF token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
