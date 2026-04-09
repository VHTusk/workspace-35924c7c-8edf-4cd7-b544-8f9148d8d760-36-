import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// Accept an org admin invitation
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { session, user } = auth;

    const body = await request.json();
    const { inviteId } = body;

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 });
    }

    // Find the pending invitation
    const invite = await db.orgAdmin.findFirst({
      where: {
        id: inviteId,
        userId: user.id,
        acceptedAt: null,
      },
      include: { org: true },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found or already accepted' }, { status: 404 });
    }

    // Accept the invitation
    const updatedAdmin = await db.orgAdmin.update({
      where: { id: inviteId },
      data: { acceptedAt: new Date() },
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: user.id,
        sport: user.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Admin Role Activated',
        message: `You are now an admin for ${invite.org.name}. Role: ${invite.role}`,
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: updatedAdmin.id,
        orgId: invite.orgId,
        orgName: invite.org.name,
        role: updatedAdmin.role,
        acceptedAt: updatedAdmin.acceptedAt,
      },
    });
  } catch (error) {
    console.error('Accept org admin invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
