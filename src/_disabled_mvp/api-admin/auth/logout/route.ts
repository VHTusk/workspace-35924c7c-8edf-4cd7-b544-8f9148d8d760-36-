import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditAction, Role } from '@prisma/client';
import { getAuthenticatedAdmin, deleteSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth) {
      const { user, session } = auth;

      // Log audit
      await db.auditLog.create({
        data: {
          sport: session?.sport || user.sport || 'CORNHOLE',
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'ADMIN_SESSION',
          targetId: user.id,
          metadata: JSON.stringify({ action: 'LOGOUT' }),
        },
      });

      // Delete session using the secure deleteSession function
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_session')?.value;
      if (token) {
        await deleteSession(token);
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
