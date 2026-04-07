import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, TeamInvitationStatus, TeamStatus } from '@prisma/client';
import { getAuthenticatedUserId, validateSession } from '@/lib/session';

// GET /api/teams/invitations - Get user's team invitations
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'received'; // 'received' or 'sent'
    const sport = searchParams.get('sport') as SportType;

    if (type === 'sent') {
      // Get invitations sent by the user
      const invitations = await db.teamInvitation.findMany({
        where: {
          inviterId: session.userId,
          status: TeamInvitationStatus.PENDING,
          ...(sport && { team: { sport } }),
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              sport: true,
              status: true,
            },
          },
          invitee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              hiddenElo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ invitations });
    } else {
      // Get invitations received by the user
      const invitations = await db.teamInvitation.findMany({
        where: {
          inviteeId: session.userId,
          status: TeamInvitationStatus.PENDING,
          expiresAt: { gte: new Date() },
          ...(sport && { team: { sport } }),
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              sport: true,
              teamElo: true,
              captain: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  hiddenElo: true,
                },
              },
            },
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check if user already has a team in each sport
      const userTeams = await db.teamMember.findMany({
        where: {
          userId: session.userId,
          team: { status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] } },
        },
        include: { team: { select: { sport: true } } },
      });

      const sportsWithTeam = new Set(userTeams.map(tm => tm.team.sport));

      const formattedInvitations = invitations.map(inv => ({
        ...inv,
        canAccept: !sportsWithTeam.has(inv.team.sport),
      }));

      return NextResponse.json({ invitations: formattedInvitations });
    }
  } catch (error) {
    console.error('Error fetching team invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams/invitations - Send a team invitation
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, inviteeId, message } = body;

    if (!teamId || !inviteeId) {
      return NextResponse.json({ error: 'Team ID and invitee ID are required' }, { status: 400 });
    }

    // Verify the user is the captain of the team
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        invitations: {
          where: { status: TeamInvitationStatus.PENDING },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.captainId !== userId) {
      return NextResponse.json({ error: 'Only team captain can send invitations' }, { status: 403 });
    }

    // Check if team already has 2 members (for doubles)
    if (team.members.length >= 2) {
      return NextResponse.json({ error: 'Team already has 2 members' }, { status: 400 });
    }

    // Check if there's already a pending invitation for this user
    const existingInvitation = team.invitations.find(inv => inv.inviteeId === inviteeId);
    if (existingInvitation) {
      return NextResponse.json({ error: 'An invitation is already pending for this player' }, { status: 400 });
    }

    // Verify invitee exists and is of the same sport
    const invitee = await db.user.findUnique({
      where: { id: inviteeId },
      select: { id: true, sport: true, isActive: true },
    });

    if (!invitee || !invitee.isActive) {
      return NextResponse.json({ error: 'Player not found or inactive' }, { status: 404 });
    }

    if (invitee.sport !== team.sport) {
      return NextResponse.json({ error: 'Player is from a different sport' }, { status: 400 });
    }

    // Check if invitee is already in a team for this sport
    const inviteeTeam = await db.teamMember.findFirst({
      where: {
        userId: inviteeId,
        team: {
          sport: team.sport,
          status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
        },
      },
    });

    if (inviteeTeam) {
      return NextResponse.json({ error: 'Player is already in a team for this sport' }, { status: 400 });
    }

    // Create invitation with 48-hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const invitation = await db.teamInvitation.create({
      data: {
        teamId,
        inviterId: userId,
        inviteeId,
        message,
        expiresAt,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            sport: true,
          },
        },
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create notification for invitee
    await db.notification.create({
      data: {
        userId: inviteeId,
        sport: team.sport,
        type: 'TOURNAMENT_REGISTERED', // We might need a new type for team invites
        title: 'Team Invitation',
        message: `You've been invited to join team "${team.name}"`,
        link: `/${team.sport.toLowerCase()}/teams/invitations`,
      },
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error('Error creating team invitation:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
