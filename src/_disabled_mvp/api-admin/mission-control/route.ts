/**
 * Super Admin Mission Control API (v3.46.0)
 * 
 * Real-time dashboard showing all sports, sectors, active tournaments.
 * 
 * GET: Get mission control data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { TournamentStatus, AdminRole, SportType } from '@prisma/client';
import { checkAdminPermission } from '@/lib/admin-permissions';

// GET /api/admin/mission-control
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    // Check if user is Super Admin
    const superAdminAssignment = await db.adminAssignment.findFirst({
      where: {
        userId: user.id,
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    if (!superAdminAssignment) {
      return NextResponse.json(
        { error: 'Mission Control requires Super Admin access' },
        { status: 403 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;

    // Build sport filter
    const sportFilter = sport ? { sport } : {};

    // Get all active tournaments
    const activeTournaments = await db.tournament.findMany({
      where: {
        ...sportFilter,
        status: {
          in: [
            TournamentStatus.REGISTRATION_OPEN,
            TournamentStatus.REGISTRATION_CLOSED,
            TournamentStatus.BRACKET_GENERATED,
            TournamentStatus.IN_PROGRESS,
          ],
        },
      },
      include: {
        _count: {
          select: {
            registrations: { where: { status: 'CONFIRMED' } },
            matches: true,
          },
        },
        bracket: {
          include: {
            _count: { select: { matches: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Get tournaments by sport
    const tournamentsBySport = await db.tournament.groupBy({
      by: ['sport'],
      where: {
        ...sportFilter,
        status: TournamentStatus.IN_PROGRESS,
      },
      _count: true,
    });

    // Get players by sport (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const matchesToday = await db.match.groupBy({
      by: ['sport'],
      where: {
        ...sportFilter,
        playedAt: { gte: today },
      },
      _count: true,
    });

    // Get revenue by sport (this month)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const revenue = await db.paymentLedger.groupBy({
      by: ['sport'],
      where: {
        ...sportFilter,
        status: 'PAID',
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    // Get open disputes
    const openDisputes = await db.dispute.groupBy({
      by: ['sport'],
      where: {
        ...sportFilter,
        status: 'OPEN',
      },
      _count: true,
    });

    // Get pending escalations
    const pendingEscalations = await db.adminEscalation.count({
      where: {
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
    });

    // Get admin counts by role
    const adminsByRole = await db.adminAssignment.groupBy({
      by: ['adminRole', 'sport'],
      where: { isActive: true },
      _count: true,
    });

    // Get sector/zone status
    const sectors = await db.sector.findMany({
      include: {
        zones: {
          include: {
            _count: {
              select: {
                admins: { where: { isActive: true } },
              },
            },
          },
        },
        _count: {
          select: {
            admins: { where: { isActive: true } },
          },
        },
      },
    });

    // Get recent alerts (escalations, paused tournaments, etc.)
    const alerts = await db.adminEscalation.findMany({
      where: {
        status: { in: ['PENDING', 'ASSIGNED', 'AUTO_ESCALATED'] },
      },
      include: {
        assignment: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Format tournaments for map display
    const tournamentMarkers = activeTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      state: t.state,
      city: t.city,
      startDate: t.startDate,
      registrations: t._count.registrations,
      color:
        t.status === TournamentStatus.IN_PROGRESS
          ? 'green'
          : t.status === TournamentStatus.REGISTRATION_OPEN
          ? 'blue'
          : 'amber',
    }));

    // Format sport panels
    const sportPanels = Object.values(SportType).map((sportType) => {
      const tournaments = tournamentsBySport.find((t) => t.sport === sportType)?._count || 0;
      const players = matchesToday.find((m) => m.sport === sportType)?._count || 0;
      const revenueAmount = revenue.find((r) => r.sport === sportType)?._sum?.amount || 0;
      const disputes = openDisputes.find((d) => d.sport === sportType)?._count || 0;

      return {
        sport: sportType,
        activeTournaments: tournaments,
        playersToday: players,
        revenue: revenueAmount,
        openDisputes: disputes,
      };
    });

    return NextResponse.json({
      missionControl: {
        // Summary panels
        sportPanels,
        
        // Map markers
        tournamentMarkers,
        
        // Alerts feed
        alerts: alerts.map((a) => ({
          id: a.id,
          type: a.type,
          requestedAction: a.requestedAction,
          status: a.status,
          level: a.currentLevel,
          autoEscalateAt: a.autoEscalateAt,
          createdAt: a.createdAt,
          requester: a.assignment?.user
            ? `${a.assignment.user.firstName} ${a.assignment.user.lastName}`
            : 'Unknown',
        })),
        
        // Sector/zone structure
        sectors: sectors.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          isActive: s.isActive,
          adminCount: s._count.admins,
          zones: s.zones.map((z) => ({
            id: z.id,
            name: z.name,
            code: z.code,
            states: JSON.parse(z.states),
            isActive: z.isActive,
            adminCount: z._count.admins,
          })),
        })),
        
        // Admin counts
        adminsByRole: adminsByRole.map((a) => ({
          role: a.adminRole,
          sport: a.sport,
          count: a._count,
        })),
        
        // Pending escalations count
        pendingEscalations,
        
        // Timestamps
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching mission control data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
