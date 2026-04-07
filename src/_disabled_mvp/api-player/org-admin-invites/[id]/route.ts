import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// DELETE /api/player/org-admin-invites/[id] - Decline org admin invitation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inviteId } = await params;
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Find and verify the invitation belongs to this user
    const invite = await db.orgAdmin.findFirst({
      where: {
        id: inviteId,
        userId: user.id,
        acceptedAt: null,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found or already accepted' },
        { status: 404 }
      );
    }

    // Delete the invitation
    await db.orgAdmin.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation declined',
    });
  } catch (error) {
    console.error('Decline org admin invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
