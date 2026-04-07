import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TeamStatus, TeamInvitationStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';

// POST /api/teams/[id]/leave - Leave a team (non-captain only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if user is a member of this team
    const team = await db.team.findUnique({
      where: { id },
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

    const memberRecord = team.members.find(m => m.userId === userId);
    if (!memberRecord) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Captain cannot leave - they must dissolve the team
    if (memberRecord.role === 'CAPTAIN') {
      return NextResponse.json({ 
        error: 'Team captain cannot leave. Dissolve the team instead or transfer captaincy first.' 
      }, { status: 400 });
    }

    // Check if team has active tournament registrations
    if (team.tournamentTeams.length > 0) {
      return NextResponse.json(
        { error: 'Cannot leave team with active tournament registrations' },
        { status: 400 }
      );
    }

    // Remove member from team
    await db.teamMember.delete({
      where: { id: memberRecord.id },
    });

    // Recalculate team ELO (average of remaining members)
    const remainingMembers = team.members.filter(m => m.id !== memberRecord.id);
    
    // Get ELO of remaining members
    const memberElos = await db.user.findMany({
      where: { id: { in: remainingMembers.map(m => m.userId) } },
      select: { hiddenElo: true },
    });

    if (memberElos.length > 0) {
      const avgElo = memberElos.reduce((sum, m) => sum + m.hiddenElo, 0) / memberElos.length;
      await db.team.update({
        where: { id },
        data: { teamElo: avgElo },
      });
    }

    // If team is now below minimum members, set status to PENDING
    const minMembers = team.format === 'DOUBLES' ? 2 : 3;
    if (remainingMembers.length < minMembers) {
      await db.team.update({
        where: { id },
        data: { status: TeamStatus.PENDING },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'You have left the team successfully' 
    });
  } catch (error) {
    console.error('Error leaving team:', error);
    return NextResponse.json({ error: 'Failed to leave team' }, { status: 500 });
  }
}
