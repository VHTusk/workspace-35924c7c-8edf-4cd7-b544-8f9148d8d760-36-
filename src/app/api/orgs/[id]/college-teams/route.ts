/**
 * College Teams API
 * GET: List all college teams for an organization
 * POST: Create a new college team
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { AcademicTeamStatus, SportType } from '@prisma/client';

// GET - List all college teams for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = (searchParams.get('sport') as SportType) || SportType.CORNHOLE;
    const status = searchParams.get('status');

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json(
        { error: 'Not a college organization' },
        { status: 400 }
      );
    }

    // Get all college teams
    const whereClause: Record<string, unknown> = {
      orgId,
      sport,
    };

    if (status) {
      whereClause.status = status;
    }

    const teams = await db.collegeTeam.findMany({
      where: whereClause,
      orderBy: { formedAt: 'desc' },
    });

    const teamIds = teams.map((team) => team.id);
    const [members, registrations] = await Promise.all([
      db.academicTeamMember.findMany({
        where: {
          teamType: 'COLLEGE',
          teamId: { in: teamIds },
          isActive: true,
        },
        select: { id: true, teamId: true },
      }),
      db.academicTeamRegistration.findMany({
        where: {
          teamType: 'COLLEGE',
          teamId: { in: teamIds },
        },
        select: { id: true, teamId: true, finalRank: true },
      }),
    ]);

    const formattedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      logoUrl: team.logoUrl,
      status: team.status,
      formedAt: team.formedAt.toISOString(),
      wins: team.wins,
      losses: team.losses,
      matchesPlayed: team.matchesPlayed,
      tournamentsParticipated: registrations.filter((registration) => registration.teamId === team.id).length,
      tournamentsWon: registrations.filter(
        (registration) => registration.teamId === team.id && registration.finalRank === 1
      ).length,
      playerCount: members.filter((member) => member.teamId === team.id).length,
    }));

    // Get stats
    const stats = {
      totalTeams: teams.length,
      activeTeams: teams.filter(t => t.status === 'ACTIVE').length,
      totalPlayers: members.length,
      activeRegistrations: registrations.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        teams: formattedTeams,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching college teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST - Create a new college team
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const { name, description, sport = 'CORNHOLE' } = body;

    // Validate session
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || ((!session.orgId || session.orgId !== orgId) && session.org?.id !== orgId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    if (!name) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json(
        { error: 'Not a college organization' },
        { status: 400 }
      );
    }

    // Check if team with same name already exists
    const existing = await db.collegeTeam.findFirst({
      where: {
        orgId,
        sport: sport as SportType,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Team with this name already exists' },
        { status: 400 }
      );
    }

    // Create team
    const team = await db.collegeTeam.create({
      data: {
        orgId,
        sport: sport as SportType,
        name,
        description,
        status: AcademicTeamStatus.ACTIVE,
      },
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        status: team.status,
        formedAt: team.formedAt.toISOString(),
        playerCount: 0,
      },
    });
  } catch (error) {
    console.error('Error creating college team:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
