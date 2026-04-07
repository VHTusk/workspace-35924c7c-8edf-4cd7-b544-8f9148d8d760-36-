/**
 * Admin Performance API (v4.15.0)
 * 
 * GET: Retrieve real performance metrics for admin dashboard
 * - Tournaments managed
 * - Disputes resolved
 * - Average response time
 * - Escalation count
 * - Trust score
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { checkAdminPermission } from '@/lib/admin-permissions';
import { Role, DisputeStatus, TournamentStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canViewAnalytics',
      { sport: session.sport }
    );

    const hasLegacyAdminRole = [Role.ADMIN, Role.SUB_ADMIN].includes(user.role as Role);

    if (!permCheck.granted && !hasLegacyAdminRole) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'week';
    const adminId = searchParams.get('adminId'); // For specific admin

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      default: // week
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get admin assignments for filtering
    const adminAssignments = await db.adminAssignment.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            photoUrl: true,
          },
        },
        permissions: true,
        _count: {
          select: { auditLogs: true },
        },
      },
      orderBy: [
        { adminRole: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Get metrics for each admin
    const adminMetrics = await Promise.all(
      adminAssignments.map(async (assignment) => {
        // Get tournaments managed (created or acted on by this admin)
        const tournamentsManaged = await db.tournament.count({
          where: {
            createdById: assignment.userId,
            createdAt: { gte: startDate },
            sport: assignment.sport || undefined,
          },
        });

        // Get disputes resolved
        const disputesResolved = await db.dispute.count({
          where: {
            resolvedById: assignment.userId,
            status: DisputeStatus.RESOLVED,
            updatedAt: { gte: startDate },
          },
        });

        // Get audit logs for this admin to calculate activity
        const auditLogs = await db.auditLog.findMany({
          where: {
            actorId: assignment.userId,
            createdAt: { gte: startDate },
          },
          select: {
            createdAt: true,
            action: true,
          },
        });

        // Calculate average response time (time from dispute creation to resolution)
        const resolvedDisputes = await db.dispute.findMany({
          where: {
            resolvedById: assignment.userId,
            status: DisputeStatus.RESOLVED,
            updatedAt: { gte: startDate },
          },
          select: {
            createdAt: true,
            updatedAt: true,
          },
        });

        let avgResolutionTime = 0;
        if (resolvedDisputes.length > 0) {
          const totalHours = resolvedDisputes.reduce((sum, d) => {
            const diff = d.updatedAt.getTime() - d.createdAt.getTime();
            return sum + diff / (1000 * 60 * 60);
          }, 0);
          avgResolutionTime = totalHours / resolvedDisputes.length;
        }

        // Get escalations count
        const escalationsCount = await db.adminAuditLog.count({
          where: {
            assignmentId: assignment.id,
            action: 'ESCALATE',
            actedAt: { gte: startDate },
          },
        });

        // Calculate tasks completed vs pending
        const tasksCompleted = auditLogs.length;
        const pendingDisputes = await db.dispute.count({
          where: {
            status: DisputeStatus.OPEN,
            sport: assignment.sport || undefined,
          },
        });

        // Calculate player satisfaction (based on tournament completions without disputes)
        const completedTournaments = await db.tournament.count({
          where: {
            createdById: assignment.userId,
            status: TournamentStatus.COMPLETED,
            createdAt: { gte: startDate },
          },
        });

        const tournamentsWithDisputes = await db.tournament.count({
          where: {
            createdById: assignment.userId,
            status: TournamentStatus.COMPLETED,
            createdAt: { gte: startDate },
            matches: {
              some: {
                dispute: { isNot: null },
              },
            },
          },
        });

        const playerSatisfaction = completedTournaments > 0
          ? Math.round(((completedTournaments - tournamentsWithDisputes) / completedTournaments) * 100)
          : 0;

        // Calculate trend (comparing to previous period)
        const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
        const previousTournaments = await db.tournament.count({
          where: {
            createdById: assignment.userId,
            createdAt: { gte: previousPeriodStart, lt: startDate },
          },
        });

        const tournamentTrend = previousTournaments > 0
          ? Math.round(((tournamentsManaged - previousTournaments) / previousTournaments) * 100)
          : 0;

        const previousDisputes = await db.dispute.count({
          where: {
            resolvedById: assignment.userId,
            status: DisputeStatus.RESOLVED,
            updatedAt: { gte: previousPeriodStart, lt: startDate },
          },
        });

        const disputeTrend = previousDisputes > 0
          ? Math.round(((disputesResolved - previousDisputes) / previousDisputes) * 100)
          : 0;

        return {
          id: assignment.id,
          userId: assignment.userId,
          name: `${assignment.user.firstName} ${assignment.user.lastName}`,
          email: assignment.user.email,
          role: assignment.adminRole,
          avatar: assignment.user.photoUrl,
          metrics: {
            tournamentsManaged,
            disputesResolved,
            avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
            playerSatisfaction,
            responseTime: Math.round(avgResolutionTime * 60), // in minutes
            tasksCompleted,
            tasksPending: pendingDisputes,
          },
          trend: {
            tournaments: tournamentTrend,
            disputes: disputeTrend,
            satisfaction: 0, // Would need historical satisfaction data
          },
          trustLevel: assignment.trustLevel,
          actionsCount: assignment.actionsCount,
          escalationsCount: assignment.escalationsCount,
        };
      })
    );

    // Get weekly activity data
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const [tournaments, disputes] = await Promise.all([
        db.tournament.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        db.dispute.count({
          where: {
            status: DisputeStatus.RESOLVED,
            updatedAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ]);

      weeklyData.push({
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        tournaments,
        disputes,
      });
    }

    // Calculate team totals
    const teamMetrics = {
      totalTournaments: adminMetrics.reduce((sum, a) => sum + a.metrics.tournamentsManaged, 0),
      activeDisputes: adminMetrics.reduce((sum, a) => sum + a.metrics.tasksPending, 0),
      resolvedThisWeek: adminMetrics.reduce((sum, a) => sum + a.metrics.disputesResolved, 0),
      avgResolutionTime: adminMetrics.length > 0
        ? adminMetrics.reduce((sum, a) => sum + a.metrics.avgResolutionTime, 0) / adminMetrics.length
        : 0,
      avgSatisfaction: adminMetrics.length > 0
        ? adminMetrics.reduce((sum, a) => sum + a.metrics.playerSatisfaction, 0) / adminMetrics.length
        : 0,
      totalTasks: adminMetrics.reduce((sum, a) => sum + a.metrics.tasksCompleted + a.metrics.tasksPending, 0),
      completedTasks: adminMetrics.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0),
    };

    return NextResponse.json({
      admins: adminMetrics,
      weeklyData,
      teamMetrics,
      timeRange,
    });
  } catch (error) {
    console.error('Admin performance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
