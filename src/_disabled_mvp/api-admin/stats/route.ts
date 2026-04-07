import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role, TournamentStatus, SportType, DisputeStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;

    // Build where clause for sport filter
    const sportFilter = sport ? { sport } : {};

    // Get counts in parallel
    const [
      totalPlayers,
      totalOrgs,
      activeTournaments,
      completedTournaments,
      pendingRegistrations,
      openDisputes,
      totalMatches,
      todayMatches,
      recentUsers,
    ] = await Promise.all([
      // Total players
      db.user.count({
        where: { ...sportFilter, role: Role.PLAYER, isActive: true },
      }),
      
      // Total organizations
      db.organization.count({
        where: sport ? { sport } : {},
      }),
      
      // Active tournaments (REGISTRATION_OPEN or IN_PROGRESS)
      db.tournament.count({
        where: {
          ...sportFilter,
          status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] },
        },
      }),
      
      // Completed tournaments
      db.tournament.count({
        where: {
          ...sportFilter,
          status: TournamentStatus.COMPLETED,
        },
      }),
      
      // Pending registrations
      db.tournamentRegistration.count({
        where: { status: 'PENDING' },
      }),
      
      // Open disputes
      db.dispute.count({
        where: {
          ...sportFilter,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.REVIEWING] },
        },
      }),
      
      // Total matches
      db.match.count({
        where: sport ? { sport } : {},
      }),
      
      // Matches played today
      db.match.count({
        where: {
          ...sportFilter,
          playedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      
      // Users registered in last 7 days
      db.user.count({
        where: {
          ...sportFilter,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get active users today (users with sessions)
    const activeToday = await db.session.count({
      where: {
        lastActivityAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    // Get registrations today
    const registrationsToday = await db.tournamentRegistration.count({
      where: {
        registeredAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    // Get sport-wise breakdown
    const sportStats = await Promise.all([
      db.user.count({ where: { sport: SportType.CORNHOLE, role: Role.PLAYER, isActive: true } }),
      db.user.count({ where: { sport: SportType.DARTS, role: Role.PLAYER, isActive: true } }),
      db.tournament.count({ where: { sport: SportType.CORNHOLE } }),
      db.tournament.count({ where: { sport: SportType.DARTS } }),
    ]);

    // Calculate total prize pool
    const prizePoolResult = await db.tournament.aggregate({
      where: {
        ...sportFilter,
        status: TournamentStatus.COMPLETED,
      },
      _sum: {
        prizePool: true,
      },
    });

    // Get recent activity (last 10 audit logs)
    const recentActivity = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      stats: {
        totalPlayers,
        totalOrgs,
        activeTournaments,
        completedTournaments,
        pendingRegistrations,
        openDisputes,
        totalMatches,
        todayMatches,
        activeToday,
        registrationsToday,
        recentUsers,
        totalPrizePool: prizePoolResult._sum.prizePool || 0,
      },
      sportBreakdown: {
        cornhole: {
          players: sportStats[0],
          tournaments: sportStats[2],
        },
        darts: {
          players: sportStats[1],
          tournaments: sportStats[3],
        },
      },
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System',
        targetType: log.targetType,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
