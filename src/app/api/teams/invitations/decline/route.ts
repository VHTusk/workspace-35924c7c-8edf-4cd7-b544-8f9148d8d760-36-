import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TeamInvitationStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';

// POST /api/teams/invitations/decline - Decline a team invitation
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Get the invitation
    const invitation = await db.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify the invitation is for this user
    if (invitation.inviteeId !== userId) {
      return NextResponse.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    // Check if invitation is still pending
    if (invitation.status !== TeamInvitationStatus.PENDING) {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
    }

    // Update invitation status
    const updatedInvitation = await db.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: TeamInvitationStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Team invitation declined',
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error('Error declining team invitation:', error);
    return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 });
  }
}
