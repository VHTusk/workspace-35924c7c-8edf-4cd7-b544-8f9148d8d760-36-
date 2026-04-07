import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TeamInvitationStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';
import { getTeamById, dissolveTeam, updateTeam } from '@/lib/team';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teams/[id] - Get team by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    const { id: teamId } = await params;

    const team = await getTeamById(teamId, userId || undefined);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get pending invitations (only for team members)
    let invitations: Awaited<ReturnType<typeof db.teamInvitation.findMany>> = [];
    if (userId && team.members.some(m => m.userId === userId)) {
      invitations = await db.teamInvitation.findMany({
        where: {
          teamId,
          status: TeamInvitationStatus.PENDING,
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
    }

    // Get tournament registrations
    const tournamentRegistrations = await db.tournamentTeam.findMany({
      where: { teamId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            location: true,
            prizePool: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 10,
    });

    // Get recent matches
    const recentMatches = await db.match.findMany({
      where: {
        OR: [
          { teamAId: teamId },
          { teamBId: teamId },
        ],
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
        teamA: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        teamB: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      team,
      invitations,
      tournamentRegistrations,
      recentMatches,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams/[id] - Update team
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { name } = body;

    const updatedTeam = await updateTeam(teamId, userId, { name });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    console.error('Error updating team:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// DELETE /api/teams/[id] - Dissolve team
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;

    await dissolveTeam(teamId, userId);

    return NextResponse.json({ success: true, message: 'Team dissolved successfully' });
  } catch (error) {
    console.error('Error dissolving team:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to dissolve team' }, { status: 500 });
  }
}
