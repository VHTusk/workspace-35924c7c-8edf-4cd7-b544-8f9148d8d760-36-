/**
 * Inter-School Leaderboard API
 * Returns leaderboard of school teams and their performance in inter-school tournaments
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { SportType, TournamentScope, TournamentStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Validate org session
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.orgId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const orgId = session.orgId;
    const sport = (session.sport || 'CORNHOLE') as SportType;
    const { searchParams } = new URL(request.url);
    const scopeFilter = searchParams.get('scope');

    // Verify this is a school
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'SCHOOL') {
      return NextResponse.json({ error: 'Not a school organization' }, { status: 400 });
    }

    // Get all school teams for this organization
    const schoolTeams = await db.schoolTeam.findMany({
      where: {
        orgId,
        sport,
        status: 'ACTIVE',
      },
    });

    const teamIds = schoolTeams.map((team) => team.id);

    const [teamMembers, teamRegistrations] = await Promise.all([
      db.academicTeamMember.findMany({
        where: {
          teamType: 'SCHOOL',
          teamId: { in: teamIds },
          isActive: true,
        },
        select: { id: true, teamId: true },
      }),
      db.academicTeamRegistration.findMany({
        where: {
          teamType: 'SCHOOL',
          teamId: { in: teamIds },
          tournament: {
            type: 'INTER_ORG',
            status: TournamentStatus.COMPLETED,
          },
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              scope: true,
              startDate: true,
              city: true,
              state: true,
            },
          },
        },
      }),
    ]);

    // Get inter-school tournaments
    const interTournaments = await db.tournament.findMany({
      where: {
        sport,
        type: 'INTER_ORG',
        status: TournamentStatus.COMPLETED,
        ...(scopeFilter && { scope: scopeFilter as TournamentScope }),
      },
      select: {
        id: true,
        name: true,
        scope: true,
        startDate: true,
      },
    });

    // Build leaderboard from team stats
    const leaderboard = schoolTeams
      .map((team) => {
        const registrations = teamRegistrations.filter((registration) => registration.teamId === team.id);
        const members = teamMembers.filter((member) => member.teamId === team.id);

        // Calculate stats from registrations
        const tournamentIds = registrations.map((r) => r.tournamentId);
        const tournaments = interTournaments.filter((t) => tournamentIds.includes(t.id));

        // Calculate medals from final rank
        const goldMedals = registrations.filter((r) => r.finalRank === 1).length;
        const silverMedals = registrations.filter((r) => r.finalRank === 2).length;
        const bronzeMedals = registrations.filter((r) => r.finalRank === 3).length;

        const matches = team.matchesPlayed || 0;
        const wins = team.wins || 0;
        const points = (wins * 3) + (goldMedals * 10) + (silverMedals * 6) + (bronzeMedals * 3);

        return {
          rank: 0, // Will be set after sorting
          id: team.id,
          teamName: team.name,
          schoolName: org.name,
          points,
          matches,
          wins,
          memberCount: members.length,
          tournaments: tournaments.length,
          medals: {
            gold: goldMedals,
            silver: silverMedals,
            bronze: bronzeMedals,
          },
          winRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
        };
      })
      .filter((team) => team.tournaments > 0 || team.points > 0)
      .sort((a, b) => b.points - a.points)
      .map((team, index) => ({
        ...team,
        rank: index + 1,
      }));

    // If no teams with stats, return mock leaderboard for other schools
    if (leaderboard.length === 0) {
      // Return placeholder data showing the structure
      return NextResponse.json({
        success: true,
        data: {
          leaderboard: [],
          stats: {
            totalTeams: schoolTeams.length,
            totalTournaments: interTournaments.length,
            topTeam: null,
            totalWins: 0,
          },
          filters: {
            scopes: ['CITY', 'DISTRICT', 'STATE', 'NATIONAL'],
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        stats: {
          totalTeams: leaderboard.length,
          totalTournaments: interTournaments.length,
          topTeam: leaderboard[0]?.teamName || null,
          totalWins: leaderboard.reduce((sum, t) => sum + t.wins, 0),
        },
        filters: {
          scopes: ['CITY', 'DISTRICT', 'STATE', 'NATIONAL'],
        },
      },
    });
  } catch (error) {
    console.error('Error fetching inter-school leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
