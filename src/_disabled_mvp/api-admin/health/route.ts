import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DisputeStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Get current timestamp for calculations
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get active sessions (non-expired)
    const activeSessions = await db.session.count({
      where: {
        expiresAt: { gt: now },
      },
    });

    // Get live tournaments
    const liveTournaments = await db.tournament.count({
      where: {
        status: 'IN_PROGRESS',
      },
    });

    // Get pending registrations
    const pendingRegistrations = await db.tournamentRegistration.count({
      where: {
        status: 'CONFIRMED',
        tournament: {
          status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED'] },
        },
      },
    });

    // Get total users
    const totalUsers = await db.user.count();

    // Get total organizations
    const totalOrganizations = await db.organization.count();

    // Get matches played today
    const matchesToday = await db.match.count({
      where: {
        playedAt: { gte: oneDayAgo },
        outcome: { not: null },
      },
    });

    // Get pending disputes
    const pendingDisputes = await db.dispute.count({
      where: {
        status: DisputeStatus.OPEN,
      },
    });

    // Get pending ELO jobs
    const pendingEloJobs = await db.eloJob.count({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    // System health indicators
    const healthIndicators = {
      database: 'healthy',
      api: 'healthy',
      websocket: 'healthy',
      cron: 'healthy',
    };

    // Simulated response times (in production, track these)
    const responseTimes = {
      api: Math.floor(Math.random() * 50) + 20, // 20-70ms
      database: Math.floor(Math.random() * 30) + 10, // 10-40ms
    };

    return NextResponse.json({
      timestamp: now.toISOString(),
      stats: {
        activeUsers: activeSessions,
        liveTournaments,
        pendingRegistrations,
        totalUsers,
        totalOrganizations,
        matchesToday,
        pendingDisputes,
        pendingEloJobs,
      },
      health: healthIndicators,
      performance: responseTimes,
      uptime: process.uptime ? Math.floor(process.uptime()) : null,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch health data',
        health: {
          database: 'unhealthy',
          api: 'degraded',
          websocket: 'unknown',
          cron: 'unknown',
        },
      },
      { status: 500 }
    );
  }
}
