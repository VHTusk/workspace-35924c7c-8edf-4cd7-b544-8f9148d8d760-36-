import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedEntity } from '@/lib/auth';

// DELETE - Revoke a specific session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth || auth.type !== 'user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = auth.user;
    const sessionToken = request.cookies.get('session_token')?.value;

    // Find the session
    const session = await db.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Don't allow revoking current session
    if (session.token === sessionToken) {
      return NextResponse.json({ error: 'Cannot revoke current session. Use logout instead.' }, { status: 400 });
    }

    // Delete the session
    await db.session.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
