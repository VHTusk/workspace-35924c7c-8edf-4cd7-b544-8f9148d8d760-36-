import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TeamInvitationStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';

// POST /api/teams/invitations/cancel - Cancel a sent team invitation (captain only)
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

    // Get the invitation with team info
    const invitation = await db.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify the user is the captain (inviter) of this invitation
    if (invitation.inviterId !== userId) {
      return NextResponse.json({ error: 'Only the team captain can cancel invitations' }, { status: 403 });
    }

    // Check if invitation is still pending
    if (invitation.status !== TeamInvitationStatus.PENDING) {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
    }

    // Update invitation status
    const updatedInvitation = await db.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: TeamInvitationStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Team invitation cancelled',
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error('Error cancelling team invitation:', error);
    return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
  }
}
