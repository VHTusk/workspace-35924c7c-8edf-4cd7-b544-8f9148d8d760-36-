/**
 * Admin Governance Dashboard API
 * 
 * Provides comprehensive governance metrics for the Super Admin dashboard:
 * - Admin stats by role
 * - Load metrics by region
 * - Inactive admins requiring attention
 * - Active emergencies
 * - Pending refunds and disputes
 * - Financial snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AdminRole, SportType, PayoutStatus, DisputeStatus, Role } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user, session } = auth;

    // Get the user's highest admin role from AdminAssignment
    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    const legacyAdminRole = user.role;
    
    // Determine the admin role - check AdminAssignment first, fallback to legacy role
    let highestAdminRole: AdminRole | null = null;
    let isSuperAdmin = false;
    let canViewRevenue = false;
    let canAssignAdmins = false;
    
    if (user.adminAssignments && user.adminAssignments.length > 0) {
      // Sort by hierarchy - Super Admin is first
      const sortedAssignments = user.adminAssignments
        .filter((a: { isActive: boolean }) => a.isActive)
        .sort((a: { adminRole: AdminRole }, b: { adminRole: AdminRole }) => {
          const roleOrder = [
            AdminRole.SUPER_ADMIN,
            AdminRole.SPORT_ADMIN,
            AdminRole.STATE_ADMIN,
            AdminRole.DISTRICT_ADMIN,
            AdminRole.TOURNAMENT_DIRECTOR,
          ];
          return roleOrder.indexOf(a.adminRole) - roleOrder.indexOf(b.adminRole);
        });
      
      if (sortedAssignments.length > 0) {
        highestAdminRole = sortedAssignments[0].adminRole;
        isSuperAdmin = highestAdminRole === AdminRole.SUPER_ADMIN || highestAdminRole === AdminRole.SPORT_ADMIN;
        canViewRevenue = sortedAssignments[0].permissions?.canViewRevenue ?? false;
        canAssignAdmins = sortedAssignments[0].permissions?.canAssignAdmins ?? false;
      }
    } else if (adminRoles.includes(legacyAdminRole)) {
      // Legacy admin - treat as SPORT_ADMIN equivalent
      isSuperAdmin = legacyAdminRole === Role.ADMIN;
      canViewRevenue = legacyAdminRole === Role.ADMIN;
      canAssignAdmins = legacyAdminRole === Role.ADMIN;
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const sportFilter = sport ? { sport } : {};

    // Parallel fetch all governance data
    const [
      adminsByRole,
      inactiveAdmins,
      activeEmergencies,
      pendingRefunds,
      pendingDisputes,
      financialSnapshot,
      loadMetrics,
    ] = await Promise.all([
      // Admins by role
      getAdminsByRole(sport),
      
      // Inactive admins (no activity in 30 days)
      getInactiveAdmins(sport),
      
      // Active emergencies
      getActiveEmergencies(sport),
      
      // Pending refunds (pending payouts)
      getPendingRefunds(sport),
      
      // Pending disputes
      getPendingDisputes(sport),
      
      // Financial snapshot (only for those with permission)
      canViewRevenue ? getFinancialSnapshot(sport) : null,
      
      // Load metrics by region
      getLoadMetricsByRegion(sport),
    ]);

    return NextResponse.json({
      success: true,
      admin: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: highestAdminRole || legacyAdminRole,
        isSuperAdmin,
        canViewRevenue,
        canAssignAdmins,
      },
      governance: {
        adminsByRole,
        inactiveAdmins,
        activeEmergencies,
        loadMetrics,
      },
      pendingActions: {
        pendingRefunds,
        pendingDisputes,
        inactiveAdminsCount: inactiveAdmins.length,
        activeEmergenciesCount: activeEmergencies.length,
      },
      financial: financialSnapshot,
    });
  } catch (error) {
    console.error('Governance dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get admin counts by role
async function getAdminsByRole(sport: SportType | null) {
  const where = sport ? { sport, isActive: true } : { isActive: true };
  
  const adminsByRole = await db.adminAssignment.groupBy({
    by: ['adminRole'],
    where,
    _count: { id: true },
  });

  const roleOrder = [
    AdminRole.SUPER_ADMIN,
    AdminRole.SPORT_ADMIN,
    AdminRole.STATE_ADMIN,
    AdminRole.DISTRICT_ADMIN,
    AdminRole.TOURNAMENT_DIRECTOR,
  ];

  const result = roleOrder.map(role => {
    const found = adminsByRole.find(a => a.adminRole === role);
    return {
      role,
      count: found?._count.id || 0,
      label: role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    };
  });

  return result;
}

// Get inactive admins (no activity in 30 days)
async function getInactiveAdmins(sport: SportType | null) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const where = {
    isActive: true,
    ...(sport ? { sport } : {}),
  };

  // Get admins with their metrics
  const adminAssignments = await db.adminAssignment.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      permissions: true,
    },
  });

  // Filter for inactive based on actions count and last activity
  const inactiveAdmins = adminAssignments.filter(a => {
    // An admin is considered inactive if:
    // - They have 0 actions and have been assigned for more than 30 days
    // - Or their trust level is 0 (new) and no activity
    const assignedRecently = new Date(a.assignedAt) > thirtyDaysAgo;
    const hasNoActions = a.actionsCount === 0;
    return !assignedRecently && hasNoActions;
  });

  return inactiveAdmins.map(a => ({
    id: a.id,
    user: a.user,
    role: a.adminRole,
    sport: a.sport,
    assignedAt: a.assignedAt,
    actionsCount: a.actionsCount,
    trustLevel: a.trustLevel,
    stateCode: a.stateCode,
    districtName: a.districtName,
  }));
}

// Get active emergencies from EmergencyControlLog model
async function getActiveEmergencies(sport: SportType | null) {
  const emergencies = await db.emergencyControlLog.findMany({
    where: {
      status: 'ACTIVE',
    },
    orderBy: { triggeredAt: 'desc' },
    take: 10,
  });

  return emergencies.map(e => ({
    id: e.id,
    triggerType: e.triggerType,
    triggerDescription: e.triggerDescription,
    createdAt: e.triggeredAt,
    adminRole: e.assumingRole,
    affectedTournaments: e.affectedTournaments,
    affectedPlayers: e.affectedPlayers,
  }));
}

// Get pending refunds
async function getPendingRefunds(sport: SportType | null) {
  const pendingPayouts = await db.prizePayout.findMany({
    where: {
      status: PayoutStatus.PENDING,
      ...(sport ? { tournament: { sport } } : {}),
    },
    include: {
      tournament: {
        select: {
          name: true,
          sport: true,
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return pendingPayouts.map(p => ({
    id: p.id,
    amount: p.amount,
    position: p.position,
    status: p.status,
    tournament: p.tournament,
    user: p.user,
    createdAt: p.createdAt,
  }));
}

// Get pending disputes
async function getPendingDisputes(sport: SportType | null) {
  const disputes = await db.dispute.findMany({
    where: {
      status: { in: [DisputeStatus.OPEN, DisputeStatus.REVIEWING] },
      ...(sport ? { sport } : {}),
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return disputes.map(d => ({
    id: d.id,
    matchId: d.matchId,
    reason: d.reason,
    status: d.status,
    createdAt: d.createdAt,
    raisedBy: d.user,
  }));
}

// Get financial snapshot
async function getFinancialSnapshot(sport: SportType | null) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const sportFilter = sport ? { sport } : {};

  // Get this month's revenue
  const thisMonthRevenue = await db.paymentLedger.aggregate({
    where: {
      status: 'PAID',
      createdAt: { gte: startOfMonth },
      ...sportFilter,
    },
    _sum: { amount: true },
  });

  // Get last month's revenue for comparison
  const lastMonthRevenue = await db.paymentLedger.aggregate({
    where: {
      status: 'PAID',
      createdAt: { gte: startOfLastMonth, lt: endOfLastMonth },
      ...sportFilter,
    },
    _sum: { amount: true },
  });

  // Get pending payouts total
  const pendingPayoutsTotal = await db.prizePayout.aggregate({
    where: {
      status: PayoutStatus.PENDING,
      ...(sport ? { tournament: { sport } } : {}),
    },
    _sum: { amount: true },
    _count: true,
  });

  // Get refunds processed this month
  const refundsProcessed = await db.paymentLedger.aggregate({
    where: {
      status: 'REFUNDED',
      createdAt: { gte: startOfMonth },
      ...sportFilter,
    },
    _sum: { amount: true },
    _count: true,
  });

  const currentRevenue = thisMonthRevenue._sum.amount || 0;
  const previousRevenue = lastMonthRevenue._sum.amount || 0;
  const changePercent = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : 0;

  return {
    thisMonthRevenue: {
      amount: currentRevenue,
      currency: 'INR',
      changePercent: Math.round(changePercent * 10) / 10,
      trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable',
    },
    pendingPayouts: {
      amount: pendingPayoutsTotal._sum.amount || 0,
      count: pendingPayoutsTotal._count,
      currency: 'INR',
    },
    refundsProcessed: {
      amount: refundsProcessed._sum.amount || 0,
      count: refundsProcessed._count,
      currency: 'INR',
    },
  };
}

// Get load metrics by region (state)
async function getLoadMetricsByRegion(sport: SportType | null) {
  // Get tournaments by state
  const tournamentsByState = await db.tournament.groupBy({
    by: ['state'],
    where: {
      state: { not: null },
      ...(sport ? { sport } : {}),
    },
    _count: { id: true },
  });

  // Get admins by state
  const adminsByState = await db.adminAssignment.groupBy({
    by: ['stateCode'],
    where: {
      stateCode: { not: null },
      isActive: true,
      ...(sport ? { sport } : {}),
    },
    _count: { id: true },
  });

  // Combine into load metrics
  const stateMetrics = tournamentsByState
    .filter(t => t.state)
    .map(t => {
      const adminCount = adminsByState.find(a => a.stateCode === t.state)?._count.id || 0;
      const tournamentCount = t._count.id;
      return {
        state: t.state,
        tournaments: tournamentCount,
        admins: adminCount,
        load: adminCount > 0 ? Math.round((tournamentCount / adminCount) * 10) / 10 : tournamentCount,
        status: adminCount === 0 ? 'critical' : tournamentCount / adminCount > 20 ? 'high' : tournamentCount / adminCount > 10 ? 'moderate' : 'healthy',
      };
    })
    .sort((a, b) => b.load - a.load)
    .slice(0, 10);

  return stateMetrics;
}
