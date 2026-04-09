// API: Get Organization Corporate Mode Dashboard
// GET /api/orgs/[id]/corporate-dashboard

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
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Employer Sports Stats (Layer 1)
    const [
      totalEmployees,
      verifiedEmployees,
      activeInternalTournaments,
      totalInvitations,
      upcomingTournaments,
    ] = await Promise.all([
      // Count employees
      db.employee.count({
        where: { orgId, sport, isActive: true },
      }),
      db.employee.count({
        where: { orgId, sport, isActive: true, isVerified: true },
      }),
      db.tournament.count({
        where: {
          orgId,
          sport,
          type: 'INTRA_ORG',
          status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] },
        },
      }),
      db.employeeInvitation.count({
        where: { orgId, sport, status: 'PENDING' },
      }),
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
          prizePool: true,
          maxPlayers: true,
        },
      }),
    ]);

    // Competitive Representation Stats (Layer 2)
    const [
      totalSquads,
      totalRepPlayers,
      contractPlayers,
      activeInterOrgRegistrations,
      squads,
    ] = await Promise.all([
      db.repSquad.count({
        where: { orgId, sport, status: 'ACTIVE' },
      }),
      db.repPlayer.count({
        where: {
          squad: { orgId, sport, status: 'ACTIVE' },
          status: 'ACTIVE',
        },
      }),
      db.repPlayer.count({
        where: {
          squad: { orgId, sport, status: 'ACTIVE' },
          status: 'ACTIVE',
          playerType: 'CONTRACT_PLAYER',
        },
      }),
      db.repSquadTournamentRegistration.count({
        where: {
          squad: { orgId, sport, status: 'ACTIVE' },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      }),
      db.repSquad.findMany({
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
          _count: {
            select: {
              players: { where: { status: 'ACTIVE' } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      organization,
      sport,
      employerSports: {
        totalEmployees,
        verifiedEmployees,
        activeTournaments: activeInternalTournaments,
        pendingInvitations: totalInvitations,
        upcomingTournaments,
      },
      competitiveRepresentation: {
        totalSquads,
        totalRepPlayers,
        contractPlayers,
        activeRegistrations: activeInterOrgRegistrations,
        squads,
      },
    });
  } catch (error) {
    console.error('Corporate dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
