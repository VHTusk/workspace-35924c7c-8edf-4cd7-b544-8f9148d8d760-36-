/**
 * V1 API: Session Info
 * 
 * Get current session information for the authenticated user.
 * 
 * @version v1
 * @immutable true
 */

import { NextRequest, NextResponse } from 'next/server';
import { addVersionHeaders } from '@/lib/api-versioning';
import { requireAuth } from '@/lib/auth-request';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { user, session } = auth;

    // Get all active sessions for the user
    const activeSessions = await db.session.findMany({
      where: {
        userId: user.id,
        expiresAt: { gte: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        deviceFingerprint: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        currentSession: {
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        },
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          sport: user.sport,
        },
        activeSessions: activeSessions.map(s => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          userAgent: null,
          ipAddress: null,
          deviceFingerprint: s.deviceFingerprint,
          isCurrent: s.id === session.id,
        })),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    addVersionHeaders(response, 'v1');
    return response;
  } catch (error) {
    console.error('[V1 Session] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get session info',
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}

// DELETE - Delete current session (logout)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session } = auth;

    // Delete the current session
    await db.session.delete({
      where: { id: session.id },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        message: 'Session deleted successfully',
        deletedAt: new Date().toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
    
    // Clear session cookie
    response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
    addVersionHeaders(response, 'v1');
    return response;
  } catch (error) {
    console.error('[V1 Session Delete] Error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete session',
    }, { status: 500 });
    addVersionHeaders(response, 'v1');
    return response;
  }
}
