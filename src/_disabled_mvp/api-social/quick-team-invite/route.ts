import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

/**
 * GET /api/social/quick-team-invite
 * 
 * Get pending team invites for current user
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sport = session.user.sport as SportType;
    const userId = session.user.id;

    // Get pending invites received
    const pendingInvites = await db.quickTeamInvite.findMany({
      where: {
        receiverId: userId,
        sport,
        status: 'PENDING',
        expiresAt: { gte: new Date() },
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            profileImage: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get invites sent by user
    const sentInvites = await db.quickTeamInvite.findMany({
      where: {
        senderId: userId,
        sport,
        status: 'PENDING',
      },
      include: {
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      pendingInvites,
      sentInvites,
    });

  } catch (error) {
    console.error('Error fetching team invites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/social/quick-team-invite
 * 
 * Send a quick team invite to a friend
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, tournamentId, teamName } = body;

    const sport = session.user.sport as SportType;
    const senderId = session.user.id;

    // Check if they are friends
    const friendship = await db.userFollow.findFirst({
      where: {
        OR: [
          { followerId: senderId, followingId: receiverId },
          { followerId: receiverId, followingId: senderId },
        ],
        sport,
      },
    });

    if (!friendship) {
      return NextResponse.json({ 
        error: 'You can only invite friends to form a team' 
      }, { status: 400 });
    }

    // Check for existing pending invite
    const existingInvite = await db.quickTeamInvite.findFirst({
      where: {
        senderId,
        receiverId,
        sport,
        status: 'PENDING',
        expiresAt: { gte: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json({ 
        error: 'You already have a pending invite to this player' 
      }, { status: 400 });
    }

    // Create invite
    const invite = await db.quickTeamInvite.create({
      data: {
        senderId,
        receiverId,
        sport,
        tournamentId,
        teamName,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true },
        },
        receiver: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    // Create notification for receiver
    await db.notification.create({
      data: {
        userId: receiverId,
        sport,
        type: 'TOURNAMENT_REGISTERED' as any, // Using existing type
        title: 'Team Invite! 🎯',
        message: `${session.user.firstName} ${session.user.lastName} invited you to form a team!`,
        link: '/activity',
      },
    });

    return NextResponse.json({
      success: true,
      invite,
      message: `Team invite sent to ${invite.receiver.firstName}!`,
    });

  } catch (error) {
    console.error('Error creating team invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/social/quick-team-invite
 * 
 * Accept or decline a team invite
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteId, action } = body; // action: 'accept' or 'decline'

    const userId = session.user.id;

    // Get invite
    const invite = await db.quickTeamInvite.findFirst({
      where: {
        id: inviteId,
        receiverId: userId,
        status: 'PENDING',
        expiresAt: { gte: new Date() },
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ 
        error: 'Invite not found or expired' 
      }, { status: 404 });
    }

    if (action === 'decline') {
      await db.quickTeamInvite.update({
        where: { id: inviteId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Team invite declined',
      });
    }

    // Accept - create team
    const sport = invite.sport as SportType;
    
    const team = await db.team.create({
      data: {
        name: invite.teamName || `${invite.sender.firstName} & ${session.user.firstName}'s Team`,
        sport,
        captainId: invite.senderId,
        format: 'DOUBLES',
        status: 'ACTIVE',
      },
    });

    // Add members
    await db.teamMember.createMany({
      data: [
        { teamId: team.id, userId: invite.senderId, role: 'CAPTAIN' },
        { teamId: team.id, userId: userId, role: 'MEMBER' },
      ],
    });

    // Update invite
    await db.quickTeamInvite.update({
      where: { id: inviteId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        teamId: team.id,
      },
    });

    // Notify sender
    await db.notification.create({
      data: {
        userId: invite.senderId,
        sport,
        type: 'TOURNAMENT_REGISTERED' as any,
        title: 'Team Formed! 🎉',
        message: `${session.user.firstName} accepted your team invite!`,
        link: `/teams/${team.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      team,
      message: `Team formed with ${invite.sender.firstName}!`,
    });

  } catch (error) {
    console.error('Error responding to team invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
