import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

// Detailed health check - requires admin authentication
// Returns DB connectivity and system status
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const auth = await getAuthenticatedAdmin(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user } = auth;

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check database connectivity
    let dbStatus = 'ok';
    let dbLatency = 0;
    try {
      const start = Date.now();
      await db.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch (error) {
      dbStatus = 'error';
    }

    // Get table counts
    const [
      userCount,
      tournamentCount,
      matchCount,
      orgCount,
      sessionCount,
    ] = await Promise.all([
      db.user.count(),
      db.tournament.count(),
      db.match.count(),
      db.organization.count(),
      db.session.count(),
    ]);

    // Get active sessions (not expired)
    const activeSessions = await db.session.count({
      where: {
        expiresAt: { gte: new Date() },
      },
    });

    // Get pending matches
    const pendingMatches = await db.match.count({
      where: {
        scoreA: null,
        scoreB: null,
      },
    });

    // Get open disputes
    const openDisputes = await db.dispute.count({
      where: {
        status: { in: ['OPEN', 'REVIEWING'] },
      },
    });

    return NextResponse.json({
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
      },
      stats: {
        users: userCount,
        organizations: orgCount,
        tournaments: tournamentCount,
        matches: matchCount,
        totalSessions: sessionCount,
        activeSessions,
        pendingMatches,
        openDisputes,
      },
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime())}s`,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
