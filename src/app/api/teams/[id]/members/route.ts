import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teams/[id]/members - Get all members of a team
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;

    // Check if user is a member of the team
    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    const members = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            visiblePoints: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: [
        { role: 'desc' }, // CAPTAIN first
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams/[id]/members - Add a new member to the team
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { newMemberId } = body;

    if (!newMemberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get team and verify captain
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        members: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if requester is captain
    const captainMember = team.members.find((m) => m.userId === userId && m.role === 'CAPTAIN');
    if (!captainMember) {
      return NextResponse.json({ error: 'Only team captain can add members' }, { status: 403 });
    }

    // Validate team size
    const maxSize = team.format === 'DOUBLES' ? 2 : team.format === 'TEAM' ? 4 : 1;
    if (team.members.length >= maxSize) {
      return NextResponse.json(
        { error: `Team is full. Maximum ${maxSize} members allowed for ${team.format}` },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = team.members.find((m) => m.userId === newMemberId);
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this team' }, { status: 400 });
    }

    // Verify the new member is a valid user of the same sport
    const newUser = await db.user.findUnique({
      where: { id: newMemberId },
      select: { id: true, sport: true, isActive: true },
    });

    if (!newUser || newUser.sport !== team.sport || !newUser.isActive) {
      return NextResponse.json(
        { error: 'User not found or not eligible for this team' },
        { status: 400 }
      );
    }

    // Add member
    const newMember = await db.teamMember.create({
      data: {
        teamId,
        userId: newMemberId,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            visiblePoints: true,
          },
        },
      },
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/members - Remove a member from the team
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get team
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        members: true,
        tournamentTeams: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if requester is captain or removing themselves
    const requesterMember = team.members.find((m) => m.userId === userId);
    if (!requesterMember) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    const memberToRemove = team.members.find((m) => m.userId === memberId);
    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found in team' }, { status: 404 });
    }

    // Only captain can remove others, or members can remove themselves
    if (requesterMember.role !== 'CAPTAIN' && memberId !== userId) {
      return NextResponse.json({ error: 'Only team captain can remove other members' }, { status: 403 });
    }

    // Cannot remove captain
    if (memberToRemove.role === 'CAPTAIN') {
      return NextResponse.json({ error: 'Cannot remove the team captain. Transfer captaincy first.' }, { status: 400 });
    }

    // Check if team has active tournament registrations
    if (team.tournamentTeams.length > 0) {
      return NextResponse.json(
        { error: 'Cannot modify team members while registered for tournaments' },
        { status: 400 }
      );
    }

    // Remove member
    await db.teamMember.delete({
      where: { id: memberToRemove.id },
    });

    return NextResponse.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}

// PUT /api/teams/[id]/members - Transfer captaincy or update role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { newCaptainId } = body;

    if (!newCaptainId) {
      return NextResponse.json({ error: 'New captain ID is required' }, { status: 400 });
    }

    // Get team
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        members: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if requester is current captain
    const currentCaptain = team.members.find((m) => m.userId === userId && m.role === 'CAPTAIN');
    if (!currentCaptain) {
      return NextResponse.json({ error: 'Only current captain can transfer captaincy' }, { status: 403 });
    }

    // Check if new captain is a member
    const newCaptain = team.members.find((m) => m.userId === newCaptainId);
    if (!newCaptain) {
      return NextResponse.json({ error: 'New captain must be a current team member' }, { status: 400 });
    }

    // Use transaction to update both roles
    await db.$transaction([
      // Demote current captain to member
      db.teamMember.update({
        where: { id: currentCaptain.id },
        data: { role: 'MEMBER' },
      }),
      // Promote new captain
      db.teamMember.update({
        where: { id: newCaptain.id },
        data: { role: 'CAPTAIN' },
      }),
      // Update team's captainId
      db.team.update({
        where: { id: teamId },
        data: { captainId: newCaptainId },
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Captaincy transferred successfully' });
  } catch (error) {
    console.error('Error transferring captaincy:', error);
    return NextResponse.json({ error: 'Failed to transfer captaincy' }, { status: 500 });
  }
}
