/**
 * College Teams API
 * GET: List all college teams for an organization
 * POST: Create a new college team
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - List all college teams for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';
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

    const teams = await db.academicTeam.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { 
            players: true,
            tournamentRegistrations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      logoUrl: team.logoUrl,
      status: team.status,
      formedAt: team.createdAt.toISOString(),
      // NOTE: These are placeholder values - MUST be calculated from actual match data before production
      // Requires: Match model queries for teamId, aggregate wins/losses by outcome
      wins: 0, // IMPLEMENT: Count matches where team won
      losses: 0, // IMPLEMENT: Count matches where team lost
      matchesPlayed: 0, // IMPLEMENT: Count total matches
      tournamentsParticipated: team._count.tournamentRegistrations,
      tournamentsWon: 0, // IMPLEMENT: Count tournament results where team placed first
      playerCount: team._count.players,
    }));

    // Get stats
    const stats = {
      totalTeams: teams.length,
      activeTeams: teams.filter(t => t.status === 'ACTIVE').length,
      totalPlayers: teams.reduce((sum, t) => sum + (t._count.players || 0), 0),
      activeRegistrations: teams.reduce((sum, t) => sum + (t._count.tournamentRegistrations || 0), 0),
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
    if (!session || session.orgId !== orgId) {
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
    const existing = await db.academicTeam.findFirst({
      where: {
        orgId,
        sport: sport as 'CORNHOLE' | 'DARTS',
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
    const team = await db.academicTeam.create({
      data: {
        orgId,
        sport: sport as 'CORNHOLE' | 'DARTS',
        name,
        description,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        status: team.status,
        formedAt: team.createdAt.toISOString(),
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
