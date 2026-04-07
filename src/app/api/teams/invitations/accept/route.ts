import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TeamInvitationStatus, TeamStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';

// POST /api/teams/invitations/accept - Accept a team invitation
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
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify the invitation is for this user
    if (invitation.inviteeId !== userId) {
      return NextResponse.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    // Check if invitation is still valid
    if (invitation.status !== TeamInvitationStatus.PENDING) {
      return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      await db.teamInvitation.update({
        where: { id: invitationId },
        data: { status: TeamInvitationStatus.EXPIRED },
      });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Check if user already has a team for this sport
    const existingTeam = await db.teamMember.findFirst({
      where: {
        userId,
        team: {
          sport: invitation.team.sport,
          status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
        },
      },
    });

    if (existingTeam) {
      return NextResponse.json({ error: 'You are already in a team for this sport' }, { status: 400 });
    }

    // Check if team already has 2 members
    if (invitation.team.members.length >= 2) {
      return NextResponse.json({ error: 'Team is already full' }, { status: 400 });
    }

    // Accept invitation and add user to team
    const [updatedInvitation, _] = await db.$transaction([
      // Update invitation status
      db.teamInvitation.update({
        where: { id: invitationId },
        data: {
          status: TeamInvitationStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      }),
      // Add user to team
      db.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          role: 'MEMBER',
        },
      }),
    ]);

    // Update team status to ACTIVE
    await db.team.update({
      where: { id: invitation.teamId },
      data: { status: TeamStatus.ACTIVE },
    });

    // Cancel any other pending invitations for this team
    await db.teamInvitation.updateMany({
      where: {
        teamId: invitation.teamId,
        status: TeamInvitationStatus.PENDING,
        id: { not: invitationId },
      },
      data: { status: TeamInvitationStatus.CANCELLED },
    });

    // Get updated team with all members
    const team = await db.team.findUnique({
      where: { id: invitation.teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
          },
        },
        captain: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Team invitation accepted',
      team,
    });
  } catch (error) {
    console.error('Error accepting team invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
