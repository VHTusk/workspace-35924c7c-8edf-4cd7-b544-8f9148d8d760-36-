// API: Get Organization School Mode Dashboard
// GET /api/orgs/[id]/school-dashboard

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';

    // Get organization details
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        type: true,
        planTier: true,
        logoUrl: true,
        email: true,
        phone: true,
        city: true,
        state: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Campus Sports Stats (Layer 1)
    const [
      totalClasses,
      totalHouses,
      totalStudents,
      verifiedStudents,
      activeInternalTournaments,
      upcomingTournaments,
      classes,
      houses,
    ] = await Promise.all([
      // Count classes
      db.schoolClass.count({
        where: { orgId, sport, isActive: true },
      }),
      // Count houses
      db.schoolHouse.count({
        where: { orgId, sport, isActive: true },
      }),
      // Count students
      db.student.count({
        where: { 
          orgId, 
          sport, 
          studentType: 'SCHOOL_STUDENT',
          status: 'ACTIVE' 
        },
      }),
      // Count verified students
      db.student.count({
        where: { 
          orgId, 
          sport, 
          studentType: 'SCHOOL_STUDENT',
          status: 'ACTIVE',
          isVerified: true 
        },
      }),
      // Count active internal tournaments
      db.tournament.count({
        where: {
          orgId,
          sport,
          type: 'INTRA_ORG',
          status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] },
        },
      }),
      // Get upcoming tournaments
      db.tournament.findMany({
        where: {
          orgId,
          sport,
          type: 'INTRA_ORG',
          status: { in: ['DRAFT', 'REGISTRATION_OPEN'] },
          startDate: { gte: new Date() },
        },
        take: 5,
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          name: true,
          startDate: true,
          status: true,
          type: true,
          prizePool: true,
          maxPlayers: true,
        },
      }),
      // Get classes with student counts
      db.schoolClass.findMany({
        where: { orgId, sport, isActive: true },
        orderBy: { gradeLevel: 'asc' },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          isActive: true,
          _count: {
            select: {
              students: {
                where: { status: 'ACTIVE' }
              }
            }
          }
        }
      }),
      // Get houses with stats
      db.schoolHouse.findMany({
        where: { orgId, sport, isActive: true },
        orderBy: { points: 'desc' },
        select: {
          id: true,
          name: true,
          color: true,
          logoUrl: true,
          points: true,
          tournamentsWon: true,
          _count: {
            select: {
              students: {
                where: { status: 'ACTIVE' }
              }
            }
          }
        }
      }),
    ]);

    // School Teams Stats (Layer 2)
    const teams = await db.schoolTeam.findMany({
      where: { orgId, sport, status: 'ACTIVE' },
      take: 5,
      orderBy: { formedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        formedAt: true,
        wins: true,
        losses: true,
        status: true,
        logoUrl: true,
        matchesPlayed: true,
        tournamentsParticipated: true,
        tournamentsWon: true,
      },
    });

    const totalTeams = await db.schoolTeam.count({
      where: { orgId, sport, status: 'ACTIVE' },
    });

    const teamIds = teams.map((team) => team.id);
    const [teamMembers, activeRegistrations] = await Promise.all([
      db.academicTeamMember.findMany({
        where: {
          teamType: 'SCHOOL',
          teamId: { in: teamIds },
          isActive: true,
          student: { orgId, sport },
        },
        select: { id: true, teamId: true },
      }),
      db.academicTeamRegistration.findMany({
        where: {
          teamType: 'SCHOOL',
          teamId: { in: teamIds },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { id: true, teamId: true },
      }),
    ]);

    const teamPlayers = teamMembers.length;
    const activeInterOrgRegistrations = activeRegistrations.length;

    // Format classes with student count
    const formattedClasses = classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      studentCount: c._count.students,
      isActive: c.isActive,
    }));

    // Format houses with student count
    const formattedHouses = houses.map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      logoUrl: h.logoUrl,
      points: h.points,
      tournamentsWon: h.tournamentsWon,
      studentCount: h._count.students,
    }));

    // Format teams with player count
    const formattedTeams = teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      logoUrl: t.logoUrl,
      status: t.status,
      formedAt: t.formedAt,
      matchesPlayed: t.matchesPlayed,
      wins: t.wins,
      losses: t.losses,
      tournamentsParticipated: t.tournamentsParticipated,
      tournamentsWon: t.tournamentsWon,
      playerCount: teamMembers.filter((member) => member.teamId === t.id).length,
    }));

    return NextResponse.json({
      organization,
      sport,
      campusSports: {
        totalClasses,
        totalHouses,
        totalStudents,
        verifiedStudents,
        activeTournaments: activeInternalTournaments,
        upcomingTournaments,
        classes: formattedClasses,
        houses: formattedHouses,
      },
      schoolTeams: {
        totalTeams,
        totalPlayers: teamPlayers,
        activeRegistrations: activeInterOrgRegistrations,
        teams: formattedTeams,
      },
    });
  } catch (error) {
    console.error('School dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
