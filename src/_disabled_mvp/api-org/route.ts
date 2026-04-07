import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET organization data for dashboard
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(token);
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const org = session.org;

    // Get roster with player details
    const roster = await db.orgRosterPlayer.findMany({
      where: { orgId: org.id },
      include: {
        user: {
          include: {
            rating: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Get hosted tournaments
    const tournaments = await db.tournament.findMany({
      where: { orgId: org.id },
      orderBy: { startDate: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    // Get org admins
    const admins = await db.orgAdmin.findMany({
      where: { orgId: org.id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Calculate stats
    const activeMembers = roster.filter(r => r.isActive).length;
    const diamondPlayers = roster.filter(r => 
      r.isActive && r.user.rating && r.user.hiddenElo >= 1900
    ).length;
    
    const tournamentsHosted = await db.tournament.count({
      where: { orgId: org.id },
    });

    const tournamentsWon = await db.tournamentResult.count({
      where: {
        user: { affiliatedOrgId: org.id },
        rank: 1,
      },
    });

    // Upcoming events
    const upcomingTournaments = await db.tournament.count({
      where: {
        orgId: org.id,
        startDate: { gte: new Date() },
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED'] },
      },
    });

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        email: org.email,
        phone: org.phone,
        city: org.city,
        district: org.district,
        state: org.state,
        sport: org.sport,
        planTier: org.planTier,
        subscription: org.subscription ? {
          status: org.subscription.status,
          endDate: org.subscription.endDate,
          plan: org.planTier,
        } : null,
      },
      stats: {
        totalMembers: roster.length,
        activeMembers,
        diamondPlayers,
        tournamentsHosted,
        tournamentsWon,
        upcomingEvents: upcomingTournaments,
      },
      roster: roster.map(r => ({
        id: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        tier: r.user.rating ? getTierFromElo(r.user.hiddenElo, r.user.rating.matchesPlayed) : 'UNRANKED',
        status: r.isActive ? 'ACTIVE' : 'INACTIVE',
        joinedAt: r.joinedAt,
        hiddenElo: r.user.hiddenElo,
        matchesPlayed: r.user.rating?.matchesPlayed || 0,
      })),
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        status: t.status,
        participants: t._count.registrations,
      })),
      admins: admins.map(a => ({
        id: a.id,
        userId: a.user.id,
        name: `${a.user.firstName} ${a.user.lastName}`,
        email: a.user.email,
        role: a.role,
        isPrimary: a.role === 'PRIMARY',
      })),
    });
  } catch (error) {
    console.error('Error fetching org data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTierFromElo(elo: number, matchCount: number): string {
  if (matchCount < 30) return 'UNRANKED';
  if (elo >= 1900) return 'DIAMOND';
  if (elo >= 1700) return 'PLATINUM';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1300) return 'SILVER';
  return 'BRONZE';
}
