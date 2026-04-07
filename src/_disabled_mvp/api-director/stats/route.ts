import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, BracketMatchStatus, SportType } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get stats for director dashboard
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Check if user is a tournament director or admin
    const allowedRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;

    // Get tournaments where user is assigned as staff OR all tournaments for admins
    const isAdmin = [Role.ADMIN, Role.SUB_ADMIN].includes(user.role as Role);

    // Build where clause for tournaments
    const tournamentWhere: Record<string, unknown> = {
      ...(sport ? { sport } : {}),
    };

    // If not admin, filter by tournaments where user is staff
    if (!isAdmin) {
      tournamentWhere.staff = {
        some: { userId: user.id },
      };
    }

    // Get tournaments managed by this director
    const tournaments = await db.tournament.findMany({
      where: tournamentWhere,
      include: {
        _count: {
          select: { registrations: true },
        },
        staff: {
          where: { userId: user.id },
        },
      },
    });

    // Calculate stats
    const activeTournaments = tournaments.filter(
      t => t.status === TournamentStatus.IN_PROGRESS
    ).length;

    const tournamentIds = tournaments.map(t => t.id);

    // Get pending matches count
    const pendingMatches = await db.bracketMatch.count({
      where: {
        bracket: { tournamentId: { in: tournamentIds } },
        status: BracketMatchStatus.PENDING,
      },
    });

    // Get live matches count
    const liveMatches = await db.bracketMatch.count({
      where: {
        bracket: { tournamentId: { in: tournamentIds } },
        status: BracketMatchStatus.LIVE,
      },
    });

    // Get completed matches today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = await db.match.count({
      where: {
        tournamentId: { in: tournamentIds },
        winnerId: { not: null },
        playedAt: { gte: today },
      },
    });

    // Get check-in stats
    const checkedIn = await db.tournamentCheckin.count({
      where: {
        tournamentId: { in: tournamentIds },
        checkedInAt: { gte: today },
      },
    });

    // Get total players across all tournaments
    const totalPlayers = tournaments.reduce((sum, t) => sum + t._count.registrations, 0);

    // Get open disputes count
    const openDisputes = await db.dispute.count({
      where: {
        match: { tournamentId: { in: tournamentIds } },
        status: 'OPEN',
      },
    });

    // Calculate overall progress
    const totalBracketMatches = await db.bracketMatch.count({
      where: {
        bracket: { tournamentId: { in: tournamentIds } },
      },
    });
    const completedMatches = await db.bracketMatch.count({
      where: {
        bracket: { tournamentId: { in: tournamentIds } },
        status: BracketMatchStatus.COMPLETED,
      },
    });
    const progress = totalBracketMatches > 0
      ? Math.round((completedMatches / totalBracketMatches) * 100)
      : 0;

    return NextResponse.json({
      stats: {
        activeTournaments,
        pendingMatches,
        liveMatches,
        completedToday,
        checkedIn,
        totalPlayers,
        openDisputes,
        progress,
      },
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        startDate: t.startDate,
        registrationsCount: t._count.registrations,
        maxPlayers: t.maxPlayers,
        location: t.location,
      })),
    });
  } catch (error) {
    console.error('Director stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
