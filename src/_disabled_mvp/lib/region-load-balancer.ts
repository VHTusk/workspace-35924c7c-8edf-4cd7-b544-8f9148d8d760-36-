/**
 * VALORHIVE Region Load Balancer (v3.50.0)
 * 
 * Distributes tournament assignments across admins to prevent overload.
 * 
 * Key Features:
 * - Track active tournaments per admin
 * - Calculate load percentages
 * - Recommend least loaded admin
 * - Rebalance when thresholds exceeded
 */

import { db } from './db';
import { AdminRole, SportType } from '@prisma/client';
import { AdminAvailabilityStatus } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface AdminLoadInfo {
  adminId: string;
  userId: string;
  role: AdminRole;
  activeTournaments: number;
  pendingActions: number;
  openEscalations: number;
  scheduledToday: number;
  scheduledThisWeek: number;
  maxCapacity: number;
  currentLoadPercent: number;
  availableSlots: number;
  isOverloaded: boolean;
  availabilityStatus: AdminAvailabilityStatus;
}

export interface LoadBalanceResult {
  success: boolean;
  assignedTo?: AdminLoadInfo;
  message: string;
  skippedAdmins: Array<{ adminId: string; reason: string }>;
}

export interface RebalanceResult {
  success: boolean;
  transferred: number;
  remaining: number;
  actions: Array<{
    tournamentId: string;
    fromAdminId: string;
    toAdminId: string;
  }>;
  errors: string[];
}

// ============================================
// CONSTANTS
// ============================================

const LOAD_THRESHOLDS = {
  LOW: 50,      // Below 50% - good candidate for assignment
  MEDIUM: 70,   // 50-70% - acceptable
  HIGH: 85,     // 70-85% - approaching limit
  CRITICAL: 100 // Above 85% - do not assign
};

const DEFAULT_CAPACITIES: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 50,
  [AdminRole.SPORT_ADMIN]: 30,
  [AdminRole.STATE_ADMIN]: 10,
  [AdminRole.DISTRICT_ADMIN]: 7,
  [AdminRole.TOURNAMENT_DIRECTOR]: 5,
};

// ============================================
// LOAD CALCULATION
// ============================================

/**
 * Get current load for an admin
 */
export async function getAdminLoad(adminId: string): Promise<AdminLoadInfo | null> {
  const admin = await db.adminAssignment.findUnique({
    where: { id: adminId },
    include: { user: true },
  });

  if (!admin) return null;

  return calculateAdminLoad(admin);
}

/**
 * Calculate comprehensive load for an admin
 */
async function calculateAdminLoad(admin: {
  id: string;
  userId: string;
  adminRole: AdminRole;
  sport?: SportType | null;
}): Promise<AdminLoadInfo> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Count active tournaments
  const activeTournaments = await db.tournamentStaff.count({
    where: {
      userId: admin.userId,
      tournament: {
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      },
    },
  });

  // Count pending actions
  const pendingActions = await db.adminEscalation.count({
    where: {
      assignedToId: admin.userId,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
  });

  // Count open escalations handled
  const openEscalations = await db.adminEscalation.count({
    where: {
      assignedToId: admin.userId,
      status: { in: ['PENDING', 'ASSIGNED', 'AUTO_ESCALATED'] },
    },
  });

  // Count tournaments scheduled today
  const scheduledToday = await db.tournamentStaff.count({
    where: {
      userId: admin.userId,
      tournament: {
        startDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
      },
    },
  });

  // Count tournaments scheduled this week
  const scheduledThisWeek = await db.tournamentStaff.count({
    where: {
      userId: admin.userId,
      tournament: {
        startDate: { gte: todayStart, lt: weekEnd },
      },
    },
  });

  // Get availability status
  const availability = await db.adminAvailability.findFirst({
    where: { adminId: admin.id },
  });

  // Calculate max capacity
  const maxCapacity = availability?.maxConcurrent ?? DEFAULT_CAPACITIES[admin.adminRole];

  // Calculate load percentage
  const tournamentLoad = (activeTournaments / maxCapacity) * 60;
  const actionLoad = (pendingActions / 5) * 20;
  const scheduleLoad = (scheduledToday / 3) * 20;
  const totalLoad = Math.min(100, tournamentLoad + actionLoad + scheduleLoad);

  const availableSlots = Math.max(0, maxCapacity - activeTournaments);
  const isOverloaded = totalLoad >= LOAD_THRESHOLDS.HIGH;

  return {
    adminId: admin.id,
    userId: admin.userId,
    role: admin.adminRole,
    activeTournaments,
    pendingActions,
    openEscalations,
    scheduledToday,
    scheduledThisWeek,
    maxCapacity,
    currentLoadPercent: Math.round(totalLoad * 10) / 10,
    availableSlots,
    isOverloaded,
    availabilityStatus: availability?.currentStatus ?? AdminAvailabilityStatus.AVAILABLE,
  };
}

/**
 * Get load for all admins in a region
 */
export async function getRegionLoadMetrics(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<AdminLoadInfo[]> {
  const whereClause: Record<string, unknown> = {
    sport,
    isActive: true,
  };

  if (stateCode) whereClause.stateCode = stateCode;
  if (districtName) whereClause.districtName = districtName;

  const admins = await db.adminAssignment.findMany({
    where: whereClause,
  });

  const results: AdminLoadInfo[] = [];

  for (const admin of admins) {
    const load = await calculateAdminLoad(admin);
    results.push(load);
  }

  // Create/update load metrics in database
  for (const load of results) {
    await db.regionLoadMetric.create({
      data: {
        adminId: load.adminId,
        userId: load.userId,
        activeTournaments: load.activeTournaments,
        pendingActions: load.pendingActions,
        openEscalations: load.openEscalations,
        scheduledToday: load.scheduledToday,
        scheduledThisWeek: load.scheduledThisWeek,
        maxCapacity: load.maxCapacity,
        currentLoadPercent: load.currentLoadPercent,
      },
    });
  }

  return results.sort((a, b) => a.currentLoadPercent - b.currentLoadPercent);
}

// ============================================
// LOAD BALANCING
// ============================================

/**
 * Find the best admin for a new assignment
 * Considers current load, availability, and capacity
 */
export async function findBestAdminForAssignment(
  sport: SportType,
  stateCode?: string,
  districtName?: string,
  options: {
    minTrustLevel?: number;
    requireAvailable?: boolean;
    excludeAdminIds?: string[];
  } = {}
): Promise<LoadBalanceResult> {
  const skippedAdmins: Array<{ adminId: string; reason: string }> = [];

  // Get all eligible admins
  const whereClause: Record<string, unknown> = {
    sport,
    isActive: true,
    adminRole: { in: [AdminRole.TOURNAMENT_DIRECTOR, AdminRole.DISTRICT_ADMIN, AdminRole.STATE_ADMIN] },
  };

  if (stateCode) whereClause.stateCode = stateCode;
  if (districtName) whereClause.districtName = districtName;

  const admins = await db.adminAssignment.findMany({
    where: whereClause,
  });

  if (admins.length === 0) {
    return {
      success: false,
      message: 'No eligible admins found in this region',
      skippedAdmins,
    };
  }

  // Calculate load for each admin and filter
  const candidates: AdminLoadInfo[] = [];

  for (const admin of admins) {
    // Skip excluded admins
    if (options.excludeAdminIds?.includes(admin.id)) {
      skippedAdmins.push({ adminId: admin.id, reason: 'Excluded from selection' });
      continue;
    }

    // Check trust level
    if (options.minTrustLevel && admin.trustLevel < options.minTrustLevel) {
      skippedAdmins.push({ adminId: admin.id, reason: 'Insufficient trust level' });
      continue;
    }

    const load = await calculateAdminLoad(admin);

    // Check if overloaded
    if (load.isOverloaded) {
      skippedAdmins.push({ adminId: admin.id, reason: `Overloaded (${load.currentLoadPercent}%)` });
      continue;
    }

    // Check availability if required
    if (options.requireAvailable && load.availabilityStatus !== AdminAvailabilityStatus.AVAILABLE) {
      if (load.availabilityStatus !== AdminAvailabilityStatus.EMERGENCY_ONLY) {
        skippedAdmins.push({ adminId: admin.id, reason: `Not available (${load.availabilityStatus})` });
        continue;
      }
    }

    // Check for available slots
    if (load.availableSlots <= 0) {
      skippedAdmins.push({ adminId: admin.id, reason: 'No available slots' });
      continue;
    }

    candidates.push(load);
  }

  if (candidates.length === 0) {
    return {
      success: false,
      message: 'No admins with available capacity',
      skippedAdmins,
    };
  }

  // Sort by load (lowest first)
  candidates.sort((a, b) => {
    // First priority: lowest load
    if (a.currentLoadPercent !== b.currentLoadPercent) {
      return a.currentLoadPercent - b.currentLoadPercent;
    }
    // Second priority: most available slots
    return b.availableSlots - a.availableSlots;
  });

  return {
    success: true,
    assignedTo: candidates[0],
    message: `Selected admin with ${candidates[0].currentLoadPercent}% load and ${candidates[0].availableSlots} available slots`,
    skippedAdmins,
  };
}

/**
 * Rebalance load by transferring tournaments from overloaded admins
 */
export async function rebalanceRegionLoad(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<RebalanceResult> {
  const result: RebalanceResult = {
    success: true,
    transferred: 0,
    remaining: 0,
    actions: [],
    errors: [],
  };

  try {
    // Get all admins and their load
    const loadMetrics = await getRegionLoadMetrics(sport, stateCode, districtName);

    // Find overloaded admins
    const overloaded = loadMetrics.filter((m) => m.isOverloaded);
    const underloaded = loadMetrics.filter(
      (m) => m.currentLoadPercent < LOAD_THRESHOLDS.LOW && m.availableSlots > 0
    );

    if (overloaded.length === 0) {
      return { ...result, message: 'No overloaded admins found' };
    }

    if (underloaded.length === 0) {
      return {
        ...result,
        success: false,
        remaining: overloaded.reduce((sum, a) => sum + a.activeTournaments, 0),
        errors: ['No admins available to receive transfers'],
      };
    }

    // For each overloaded admin, find tournaments to transfer
    for (const sourceAdmin of overloaded) {
      // Get tournaments that could be transferred
      const tournaments = await db.tournamentStaff.findMany({
        where: {
          userId: sourceAdmin.userId,
          tournament: {
            status: { in: ['DRAFT', 'REGISTRATION_OPEN'] }, // Only transfer early-stage tournaments
          },
        },
        include: { tournament: true },
      });

      // Calculate how many to transfer
      const excess = sourceAdmin.activeTournaments - Math.floor(sourceAdmin.maxCapacity * 0.7);
      const toTransfer = Math.min(excess, tournaments.length);

      for (let i = 0; i < toTransfer && underloaded.length > 0; i++) {
        const tournament = tournaments[i];

        // Find best target admin
        const targetAdmin = underloaded.find((a) => a.availableSlots > 0);

        if (!targetAdmin) break;

        // Transfer the assignment
        try {
          await db.tournamentStaff.update({
            where: { id: tournament.id },
            data: { userId: targetAdmin.userId },
          });

          // Update load metrics
          sourceAdmin.activeTournaments--;
          sourceAdmin.availableSlots++;
          targetAdmin.activeTournaments++;
          targetAdmin.availableSlots--;

          // Remove from underloaded if now at capacity
          if (targetAdmin.availableSlots <= 0) {
            const idx = underloaded.indexOf(targetAdmin);
            if (idx > -1) underloaded.splice(idx, 1);
          }

          result.transferred++;
          result.actions.push({
            tournamentId: tournament.tournamentId,
            fromAdminId: sourceAdmin.adminId,
            toAdminId: targetAdmin.adminId,
          });
        } catch (error) {
          result.errors.push(`Failed to transfer ${tournament.tournamentId}: ${error}`);
        }
      }
    }

    result.remaining = overloaded.reduce(
      (sum, a) => sum + Math.max(0, a.activeTournaments - Math.floor(a.maxCapacity * 0.7)),
      0
    );

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Rebalance error: ${error}`);
    return result;
  }
}

// ============================================
// CAPACITY MANAGEMENT
// ============================================

/**
 * Set max capacity for an admin
 */
export async function setAdminCapacity(
  adminId: string,
  maxCapacity: number
): Promise<{ success: boolean; message: string }> {
  try {
    const availability = await db.adminAvailability.findFirst({
      where: { adminId },
    });

    if (availability) {
      await db.adminAvailability.update({
        where: { id: availability.id },
        data: { maxConcurrent: maxCapacity },
      });
    } else {
      await db.adminAvailability.create({
        data: {
          adminId,
          userId: (await db.adminAssignment.findUnique({ where: { id: adminId } }))?.userId ?? '',
          dayOfWeek: 0,
          startTime: '00:00',
          endTime: '23:59',
          isAllDay: true,
          maxConcurrent: maxCapacity,
        },
      });
    }

    return { success: true, message: `Capacity set to ${maxCapacity}` };
  } catch (error) {
    console.error('Error setting capacity:', error);
    return { success: false, message: 'Failed to set capacity' };
  }
}

/**
 * Check if region needs more admins
 */
export async function checkRegionCapacityNeeds(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<{
  needsMoreAdmins: boolean;
  totalCapacity: number;
  totalUsed: number;
  utilizationPercent: number;
  recommendation: string;
}> {
  const metrics = await getRegionLoadMetrics(sport, stateCode, districtName);

  const totalCapacity = metrics.reduce((sum, m) => sum + m.maxCapacity, 0);
  const totalUsed = metrics.reduce((sum, m) => sum + m.activeTournaments, 0);
  const utilizationPercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

  const overloadedCount = metrics.filter((m) => m.isOverloaded).length;
  const availableCount = metrics.filter(
    (m) => m.currentLoadPercent < LOAD_THRESHOLDS.LOW
  ).length;

  let recommendation = 'Capacity is healthy';
  let needsMoreAdmins = false;

  if (utilizationPercent > 80) {
    recommendation = 'Region is highly utilized. Consider adding more admins.';
    needsMoreAdmins = true;
  } else if (overloadedCount > metrics.length / 2) {
    recommendation = 'Many admins are overloaded. Load balancing needed.';
    needsMoreAdmins = true;
  } else if (availableCount === 0) {
    recommendation = 'No admins available for new assignments.';
    needsMoreAdmins = true;
  }

  return {
    needsMoreAdmins,
    totalCapacity,
    totalUsed,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    recommendation,
  };
}

/**
 * Get load summary for dashboard
 */
export async function getRegionLoadSummary(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<{
  totalAdmins: number;
  availableAdmins: number;
  overloadedAdmins: number;
  avgLoadPercent: number;
  topLoaded: AdminLoadInfo[];
  topAvailable: AdminLoadInfo[];
}> {
  const metrics = await getRegionLoadMetrics(sport, stateCode, districtName);

  const available = metrics.filter((m) => m.currentLoadPercent < LOAD_THRESHOLDS.MEDIUM);
  const overloaded = metrics.filter((m) => m.isOverloaded);
  const avgLoad = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.currentLoadPercent, 0) / metrics.length
    : 0;

  // Sort for top loaded
  const sortedByLoad = [...metrics].sort((a, b) => b.currentLoadPercent - a.currentLoadPercent);
  const sortedByAvailable = [...metrics].sort((a, b) => a.currentLoadPercent - b.currentLoadPercent);

  return {
    totalAdmins: metrics.length,
    availableAdmins: available.length,
    overloadedAdmins: overloaded.length,
    avgLoadPercent: Math.round(avgLoad * 10) / 10,
    topLoaded: sortedByLoad.slice(0, 3),
    topAvailable: sortedByAvailable.slice(0, 3),
  };
}
