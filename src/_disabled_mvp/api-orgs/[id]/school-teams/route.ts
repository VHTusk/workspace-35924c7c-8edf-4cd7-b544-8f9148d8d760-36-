// API: School Teams Management
// GET /api/orgs/[id]/school-teams - List school teams
// POST /api/orgs/[id]/school-teams - Create school team

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orgs/[id]/school-teams - List all school teams
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';
    const status = searchParams.get('status') as string | null;

    // Verify organization exists and is a SCHOOL
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (org.type !== 'SCHOOL') {
      return NextResponse.json(
        { error: 'This API is only for school organizations' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      orgId,
      sport,
    };

    if (status) {
      where.status = status;
    }

    // Fetch school teams
    const teams = await db.schoolTeam.findMany({
      where,
      orderBy: { formedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        status: true,
        formedAt: true,
        matchesPlayed: true,
        wins: true,
        losses: true,
        tournamentsParticipated: true,
        tournamentsWon: true,
        coachId: true,
      },
    });

    // Get member counts for each team
    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await db.academicTeamMember.count({
          where: {
            teamId: team.id,
            teamType: 'SCHOOL',
            isActive: true,
          },
        });

        return {
          ...team,
          playerCount: memberCount,
        };
      })
    );

    return NextResponse.json({
      teams: teamsWithMembers,
    });
  } catch (error) {
    console.error('School teams fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school teams' },
      { status: 500 }
    );
  }
}

// POST /api/orgs/[id]/school-teams - Create new school team
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();

    const { name, description, sport, logoUrl, coachId } = body;

    // Validate required fields
    if (!name || !sport) {
      return NextResponse.json(
        { error: 'Team name and sport are required' },
        { status: 400 }
      );
    }

    // Verify organization exists and is a SCHOOL
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (org.type !== 'SCHOOL') {
      return NextResponse.json(
        { error: 'School teams can only be created by school organizations' },
        { status: 400 }
      );
    }

    // Check if team name already exists for this org and sport
    const existingTeam = await db.schoolTeam.findFirst({
      where: {
        orgId,
        sport,
        name,
      },
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: 'A team with this name already exists for this sport' },
        { status: 400 }
      );
    }

    // Create school team
    const team = await db.schoolTeam.create({
      data: {
        orgId,
        sport,
        name,
        description,
        logoUrl,
        coachId,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      team,
      message: 'School team created successfully',
    });
  } catch (error) {
    console.error('School team creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create school team' },
      { status: 500 }
    );
  }
}
