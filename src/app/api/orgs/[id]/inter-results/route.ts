/**
 * Inter-Org Results API
 * Returns tournament results for organization teams (corporate squads or school teams)
 * Works for both CORPORATE and SCHOOL organization types
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const sport = request.nextUrl.searchParams.get('sport');
    const type = request.nextUrl.searchParams.get('type') || 'CORPORATE'; // CORPORATE or SCHOOL

    // Validate org session
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || (session.orgId !== orgId && session.org?.id !== orgId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Verify organization exists
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let teams: { id: string; name: string }[] = [];
    let results: any[] = [];

    if (org.type === 'SCHOOL' || type === 'SCHOOL') {
      // Get school teams
      const schoolTeams = await db.schoolTeam.findMany({
        where: {
          orgId,
          sport: sport as any,
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
      });
      teams = schoolTeams;

      // Get academic team registrations for inter-school tournaments
      const teamRegistrations = await db.academicTeamRegistration.findMany({
        where: {
          teamId: { in: teams.map((t) => t.id) },
          tournament: {
            type: 'INTER_ORG',
            sport: sport as any,
            status: 'COMPLETED',
          },
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              scope: true,
              startDate: true,
              location: true,
              city: true,
            },
          },
        },
      });

      // Build results
      results = teamRegistrations.map((reg) => {
        const team = teams.find((t) => t.id === reg.teamId);
        return {
          id: reg.id,
          tournamentId: reg.tournament.id,
          tournamentName: reg.tournament.name,
          tournamentScope: reg.tournament.scope,
          completedAt: reg.tournament.startDate.toISOString(),
          teamId: reg.teamId,
          teamName: team?.name || 'Unknown Team',
          position: reg.finalRank || 0,
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          points: reg.prizeWon || 0,
          medal:
            reg.finalRank === 1
              ? 'GOLD'
              : reg.finalRank === 2
                ? 'SILVER'
                : reg.finalRank === 3
                  ? 'BRONZE'
                  : undefined,
        };
      });
    } else {
      // Get rep squads for corporate
      const repSquads = await db.repSquad.findMany({
        where: {
          orgId,
          sport: sport as any,
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
      });
      teams = repSquads;

      // Get tournament registrations
      const tournamentRegistrations = await db.orgTournamentRegistration.findMany({
        where: {
          orgId,
          tournament: {
            type: 'INTER_ORG',
            sport: sport as any,
            status: 'COMPLETED',
          },
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              scope: true,
              startDate: true,
              location: true,
              city: true,
            },
          },
        },
      });

      // Build results
      results = tournamentRegistrations.map((reg) => {
        return {
          id: reg.id,
          tournamentId: reg.tournament.id,
          tournamentName: reg.tournament.name,
          tournamentScope: reg.tournament.scope,
          completedAt: reg.tournament.startDate.toISOString(),
          teamId: reg.orgId,
          teamName: org.name,
          position: 0,
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          points: 0,
          medal: undefined,
        };
      });
    }

    // Sort by date descending
    results.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error fetching inter-org results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
