import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedEntity } from '@/lib/auth';

// DELETE - Revoke all other sessions (keep current)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth || auth.type !== 'user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = auth.user;
    const sessionToken = request.cookies.get('session_token')?.value;

    // Delete all sessions except current
    await db.session.deleteMany({
      where: {
        userId: user.id,
        NOT: {
          token: sessionToken
        }
      }
    });

    return NextResponse.json({ success: true, message: 'All other sessions revoked' });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
