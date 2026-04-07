import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, TournamentFormat, TeamStatus, TeamInvitationStatus } from '@prisma/client';
import { getAuthenticatedUserId, validateSession } from '@/lib/session';

// GET /api/teams - List teams for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const format = searchParams.get('format') as TournamentFormat | null;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      sport,
      status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      members: {
        some: {
          userId: session.userId,
        },
      },
    };

    if (format) {
      where.format = format;
    }

    const teams = await db.team.findMany({
      where,
      include: {
        members: {
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
        },
        invitations: {
          where: { status: TeamInvitationStatus.PENDING },
          include: {
            invitee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
              },
            },
          },
        },
        _count: {
          select: { tournamentTeams: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      teams: teams.map((team) => ({
        ...team,
        tournamentCount: team._count.tournamentTeams,
        pendingInvitations: team.invitations,
      })),
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams - Create a new team (with invitation to partner)
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, sport, format, partnerId, message } = body;

    // Validate required fields
    if (!name || !sport || !partnerId) {
      return NextResponse.json({ error: 'Team name, sport, and partner are required' }, { status: 400 });
    }

    if (!['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Get current user info
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { sport: true, isActive: true },
    });

    if (!currentUser || currentUser.sport !== sport) {
      return NextResponse.json({ error: 'Sport mismatch with your account' }, { status: 400 });
    }

    // Check if user already has a team for this sport
    const existingTeam = await db.teamMember.findFirst({
      where: {
        userId,
        team: {
          sport: sport as SportType,
          status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
        },
      },
    });

    if (existingTeam) {
      return NextResponse.json({ error: 'You already have a team for this sport. One team per sport allowed.' }, { status: 400 });
    }

    // Check if team name already exists for this sport
    const existingTeamName = await db.team.findUnique({
      where: {
        name_sport: { name, sport: sport as SportType },
      },
    });

    if (existingTeamName) {
      return NextResponse.json({ error: 'Team name already exists for this sport' }, { status: 400 });
    }

    // Verify partner exists and is of the same sport
    const partner = await db.user.findUnique({
      where: { id: partnerId },
      select: { id: true, sport: true, isActive: true, firstName: true, lastName: true },
    });

    if (!partner || !partner.isActive) {
      return NextResponse.json({ error: 'Partner not found or inactive' }, { status: 404 });
    }

    if (partner.sport !== sport) {
      return NextResponse.json({ error: 'Partner is from a different sport' }, { status: 400 });
    }

    // Check if partner already has a team for this sport
    const partnerExistingTeam = await db.teamMember.findFirst({
      where: {
        userId: partnerId,
        team: {
          sport: sport as SportType,
          status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
        },
      },
    });

    if (partnerExistingTeam) {
      return NextResponse.json({ error: 'Partner already has a team for this sport' }, { status: 400 });
    }

    const teamFormat = (format || 'DOUBLES') as TournamentFormat;

    // Create team with captain and send invitation to partner
    // Team starts as PENDING until partner accepts
    const team = await db.team.create({
      data: {
        name,
        sport: sport as SportType,
        format: teamFormat,
        captainId: userId,
        status: TeamStatus.PENDING,
        members: {
          create: [
            {
              userId,
              role: 'CAPTAIN',
            },
          ],
        },
      },
      include: {
        members: {
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
        },
      },
    });

    // Create invitation with 48-hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const invitation = await db.teamInvitation.create({
      data: {
        teamId: team.id,
        inviterId: userId,
        inviteeId: partnerId,
        message,
        expiresAt,
      },
      include: {
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
          },
        },
      },
    });

    // Create notification for partner
    await db.notification.create({
      data: {
        userId: partnerId,
        sport: sport as SportType,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Team Invitation',
        message: `You've been invited to join team "${name}"`,
        link: `/${sport.toLowerCase()}/teams`,
      },
    });

    return NextResponse.json({ 
      team,
      invitation,
      message: 'Team created! Waiting for partner to accept invitation.' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

// PUT /api/teams - Update a team
export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, name } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Check if user is the captain of the team
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const member = team.members[0];
    if (!member || member.role !== 'CAPTAIN') {
      return NextResponse.json({ error: 'Only team captain can update the team' }, { status: 403 });
    }

    // If changing name, check for duplicates
    if (name && name !== team.name) {
      const existingTeam = await db.team.findUnique({
        where: {
          name_sport: { name, sport: team.sport },
        },
      });

      if (existingTeam) {
        return NextResponse.json({ error: 'Team name already exists' }, { status: 400 });
      }
    }

    const updatedTeam = await db.team.update({
      where: { id: teamId },
      data: {
        ...(name && { name }),
      },
      include: {
        members: {
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
        },
      },
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// DELETE /api/teams - Dissolve/delete a team (captain only)
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Check if user is the captain of the team
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { userId },
        },
        tournamentTeams: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const member = team.members[0];
    if (!member || member.role !== 'CAPTAIN') {
      return NextResponse.json({ error: 'Only team captain can dissolve the team' }, { status: 403 });
    }

    // Check if team has active tournament registrations
    if (team.tournamentTeams.length > 0) {
      return NextResponse.json(
        { error: 'Cannot dissolve team with active tournament registrations' },
        { status: 400 }
      );
    }

    // Cancel any pending invitations
    await db.teamInvitation.updateMany({
      where: {
        teamId,
        status: TeamInvitationStatus.PENDING,
      },
      data: { status: TeamInvitationStatus.CANCELLED },
    });

    // Mark team as inactive
    await db.team.update({
      where: { id: teamId },
      data: { status: TeamStatus.INACTIVE },
    });

    return NextResponse.json({ success: true, message: 'Team dissolved successfully' });
  } catch (error) {
    console.error('Error dissolving team:', error);
    return NextResponse.json({ error: 'Failed to dissolve team' }, { status: 500 });
  }
}
