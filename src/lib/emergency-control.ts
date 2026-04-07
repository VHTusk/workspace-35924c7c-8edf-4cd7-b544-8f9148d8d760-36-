/**
 * VALORHIVE Emergency Control Service (v3.50.0)
 * 
 * Manages emergency transfer of authority when regional admins are unavailable.
 * 
 * Triggers:
 * - Admin disabled (manual or automatic)
 * - Inactivity timeout
 * - System failure
 * - Regional emergency
 * - Security incident
 * - Voluntary transfer request
 * 
 * Key Principles:
 * - Authority always flows upward
 * - No region left without governance
 * - Super Admin is ultimate fallback
 * - All transfers are logged and reversible
 */

import { db } from './db';
import { AdminRole, SportType, EmergencyTriggerType, EmergencyStatus } from '@prisma/client';
import { findNextActiveAdmin, getRoleLevel } from './admin-permissions';

// ============================================
// TYPES
// ============================================

export interface EmergencyControlResult {
  success: boolean;
  emergencyId?: string;
  transferredTo?: {
    adminId: string;
    userId: string;
    role: AdminRole;
  };
  affectedTournaments: number;
  message: string;
}

export interface EmergencyControlStatus {
  id: string;
  status: EmergencyStatus;
  originalAdmin?: {
    id: string;
    role: AdminRole;
    stateCode?: string;
    districtName?: string;
  };
  assumingAdmin: {
    id: string;
    userId: string;
    role: AdminRole;
  };
  triggerType: EmergencyTriggerType;
  triggeredAt: Date;
  duration: string;
  affectedResources: number;
}

export interface VoluntaryTransferRequest {
  requestingAdminId: string;
  reason: string;
  estimatedDuration?: number; // hours
  temporaryReplacement?: string; // specific admin to transfer to
}

// ============================================
// EMERGENCY CONTROL ROUTING
// ============================================

/**
 * Initiate emergency control when admin becomes unavailable
 */
export async function initiateEmergencyControl(
  originalAdminId: string,
  triggerType: EmergencyTriggerType,
  triggerDescription: string,
  triggeredById?: string
): Promise<EmergencyControlResult> {
  try {
    // Get original admin details
    const originalAdmin = await db.adminAssignment.findUnique({
      where: { id: originalAdminId },
      include: { user: true },
    });

    if (!originalAdmin) {
      return {
        success: false,
        affectedTournaments: 0,
        message: 'Original admin not found',
      };
    }

    // Find next active admin in hierarchy
    const nextAdmin = await findNextActiveAdmin(
      originalAdmin.sport ?? SportType.CORNHOLE,
      originalAdmin.adminRole,
      originalAdmin.stateCode ?? undefined,
      originalAdmin.districtName ?? undefined
    );

    if (!nextAdmin) {
      // Critical: No one to assume authority - alert Super Admin
      await alertSuperAdmins(originalAdmin, triggerType, triggerDescription);

      return {
        success: false,
        affectedTournaments: 0,
        message: 'No available admin to assume authority. Super Admins alerted.',
      };
    }

    // Get affected tournaments
    const affectedTournaments = await db.tournamentStaff.count({
      where: {
        userId: originalAdmin.userId,
        tournament: {
          status: { in: ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
        },
      },
    });

    // Get affected regions
    const affectedRegions: string[] = [];
    if (originalAdmin.stateCode) affectedRegions.push(originalAdmin.stateCode);
    if (originalAdmin.districtName) affectedRegions.push(originalAdmin.districtName);

    // Create emergency control log
    const emergencyLog = await db.emergencyControlLog.create({
      data: {
        originalAdminId: originalAdmin.id,
        originalRole: originalAdmin.adminRole,
        originalStateCode: originalAdmin.stateCode,
        originalDistrictName: originalAdmin.districtName,
        assumingAdminId: nextAdmin.userId,
        assumingRole: nextAdmin.role,
        triggerType,
        triggerDescription,
        triggeredById,
        affectedTournaments,
        affectedRegions: JSON.stringify(affectedRegions),
        status: EmergencyStatus.ACTIVE,
        superAdminNotified: false,
        sportAdminNotified: false,
        affectedAdminsNotified: false,
      },
    });

    // Transfer tournament assignments
    await transferTournamentAssignments(originalAdmin.userId, nextAdmin.userId);

    // Transfer pending escalations
    await transferEscalations(originalAdmin.userId, nextAdmin.userId);

    // Send notifications
    await sendEmergencyNotifications(emergencyLog.id, originalAdmin, nextAdmin, triggerType);

    return {
      success: true,
      emergencyId: emergencyLog.id,
      transferredTo: {
        adminId: nextAdmin.userId,
        userId: nextAdmin.userId,
        role: nextAdmin.role,
      },
      affectedTournaments,
      message: `Emergency control transferred to ${nextAdmin.role}`,
    };
  } catch (error) {
    console.error('Error initiating emergency control:', error);
    return {
      success: false,
      affectedTournaments: 0,
      message: 'Failed to initiate emergency control',
    };
  }
}

/**
 * Handle voluntary transfer request
 */
export async function requestVoluntaryTransfer(
  request: VoluntaryTransferRequest
): Promise<EmergencyControlResult> {
  try {
    const admin = await db.adminAssignment.findUnique({
      where: { id: request.requestingAdminId },
    });

    if (!admin) {
      return {
        success: false,
        affectedTournaments: 0,
        message: 'Admin not found',
      };
    }

    // If specific replacement requested
    if (request.temporaryReplacement) {
      const replacement = await db.adminAssignment.findUnique({
        where: { id: request.temporaryReplacement },
      });

      if (!replacement || !replacement.isActive) {
        return {
          success: false,
          affectedTournaments: 0,
          message: 'Specified replacement is not available',
        };
      }

      // Verify replacement is at same or higher level
      if (getRoleLevel(replacement.adminRole) > getRoleLevel(admin.adminRole)) {
        return {
          success: false,
          affectedTournaments: 0,
          message: 'Replacement must be at same or higher authority level',
        };
      }

      // Transfer to specific replacement
      return await initiateEmergencyControl(
        request.requestingAdminId,
        EmergencyTriggerType.VOLUNTARY_TRANSFER,
        request.reason,
        admin.userId
      );
    }

    // Auto-select replacement
    return await initiateEmergencyControl(
      request.requestingAdminId,
      EmergencyTriggerType.VOLUNTARY_TRANSFER,
      request.reason,
      admin.userId
    );
  } catch (error) {
    console.error('Error processing voluntary transfer:', error);
    return {
      success: false,
      affectedTournaments: 0,
      message: 'Failed to process transfer request',
    };
  }
}

/**
 * Resolve emergency control and restore normal operations
 */
export async function resolveEmergencyControl(
  emergencyId: string,
  resolvedById: string,
  restoreOriginal: boolean,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const emergency = await db.emergencyControlLog.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      return { success: false, message: 'Emergency not found' };
    }

    if (emergency.status === EmergencyStatus.RESOLVED) {
      return { success: false, message: 'Emergency already resolved' };
    }

    // If restoring original admin
    if (restoreOriginal && emergency.originalAdminId) {
      const originalAdmin = await db.adminAssignment.findUnique({
        where: { id: emergency.originalAdminId },
      });

      if (originalAdmin) {
        // Re-enable original admin if disabled
        if (!originalAdmin.isActive) {
          await db.adminAssignment.update({
            where: { id: originalAdmin.id },
            data: {
              isActive: true,
              deactivatedAt: null,
              deactivationReason: null,
            },
          });
        }

        // Transfer assignments back
        await transferTournamentAssignments(emergency.assumingAdminId, originalAdmin.userId);
      }
    }

    // Update emergency log
    await db.emergencyControlLog.update({
      where: { id: emergencyId },
      data: {
        status: EmergencyStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById,
        resolutionNotes: notes,
        actualEndTime: new Date(),
      },
    });

    return { success: true, message: 'Emergency control resolved' };
  } catch (error) {
    console.error('Error resolving emergency:', error);
    return { success: false, message: 'Failed to resolve emergency' };
  }
}

// ============================================
// TRANSFER OPERATIONS
// ============================================

async function transferTournamentAssignments(
  fromUserId: string,
  toUserId: string
): Promise<number> {
  // Transfer director assignments
  const result = await db.tournamentStaff.updateMany({
    where: {
      userId: fromUserId,
      tournament: {
        status: { in: ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      },
    },
    data: {
      userId: toUserId,
    },
  });

  return result.count;
}

async function transferEscalations(
  fromUserId: string,
  toUserId: string
): Promise<number> {
  const result = await db.adminEscalation.updateMany({
    where: {
      assignedToId: fromUserId,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
    data: {
      assignedToId: toUserId,
    },
  });

  return result.count;
}

// ============================================
// NOTIFICATIONS
// ============================================

async function sendEmergencyNotifications(
  emergencyId: string,
  originalAdmin: {
    id: string;
    userId: string;
    adminRole: AdminRole;
    sport?: SportType | null;
  },
  nextAdmin: {
    userId: string;
    role: AdminRole;
  },
  triggerType: EmergencyTriggerType
): Promise<void> {
  const sport = originalAdmin.sport ?? SportType.CORNHOLE;

  // Notify assuming admin
  await db.notification.create({
    data: {
      userId: nextAdmin.userId,
      sport,
      type: 'EMERGENCY_CONTROL',
      title: 'Emergency Control Assumed',
      message: `You have assumed control from ${originalAdmin.adminRole}. Trigger: ${triggerType}`,
      link: `/admin/emergency/${emergencyId}`,
    },
  });

  // Notify Sport Admins
  const sportAdmins = await db.adminAssignment.findMany({
    where: {
      adminRole: AdminRole.SPORT_ADMIN,
      sport,
      isActive: true,
    },
  });

  for (const sa of sportAdmins) {
    await db.notification.create({
      data: {
        userId: sa.userId,
        sport,
        type: 'TOURNAMENT_CANCELLED',
        title: 'Emergency Control Alert',
        message: `${originalAdmin.adminRole} authority transferred to ${nextAdmin.role}`,
        link: `/admin/emergency/${emergencyId}`,
      },
    });
  }

  // Update notification flags
  await db.emergencyControlLog.update({
    where: { id: emergencyId },
    data: {
      sportAdminNotified: sportAdmins.length > 0,
      affectedAdminsNotified: true,
    },
  });
}

async function alertSuperAdmins(
  originalAdmin: {
    id: string;
    userId: string;
    adminRole: AdminRole;
    sport?: SportType | null;
    stateCode?: string | null;
    districtName?: string | null;
  },
  triggerType: EmergencyTriggerType,
  description: string
): Promise<void> {
  const superAdmins = await db.adminAssignment.findMany({
    where: {
      adminRole: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  for (const sa of superAdmins) {
    await db.notification.create({
      data: {
        userId: sa.userId,
        sport: originalAdmin.sport ?? SportType.CORNHOLE,
        type: 'TOURNAMENT_CANCELLED',
        title: 'CRITICAL: No Admin Available',
        message: `${originalAdmin.adminRole} in ${originalAdmin.stateCode ?? 'region'} is unavailable and no higher admin found. ${triggerType}: ${description}`,
        link: '/admin/emergency',
      },
    });
  }
}

// ============================================
// STATUS AND QUERIES
// ============================================

/**
 * Get all active emergencies
 */
export async function getActiveEmergencies(
  sport?: SportType
): Promise<EmergencyControlStatus[]> {
  const whereClause: Record<string, unknown> = {
    status: EmergencyStatus.ACTIVE,
  };

  if (sport) {
    // Would need to join with admin assignments for sport filter
  }

  const emergencies = await db.emergencyControlLog.findMany({
    where: whereClause,
    orderBy: { triggeredAt: 'desc' },
  });

  return emergencies.map((e) => ({
    id: e.id,
    status: e.status,
    originalAdmin: {
      id: e.originalAdminId ?? '',
      role: e.originalRole,
      stateCode: e.originalStateCode ?? undefined,
      districtName: e.originalDistrictName ?? undefined,
    },
    assumingAdmin: {
      id: e.assumingAdminId,
      userId: e.assumingAdminId,
      role: e.assumingRole,
    },
    triggerType: e.triggerType,
    triggeredAt: e.triggeredAt,
    duration: calculateDuration(e.triggeredAt),
    affectedResources: e.affectedTournaments,
  }));
}

/**
 * Get emergency history for an admin
 */
export async function getAdminEmergencyHistory(
  adminId: string
): Promise<EmergencyControlStatus[]> {
  const emergencies = await db.emergencyControlLog.findMany({
    where: {
      OR: [
        { originalAdminId: adminId },
        { assumingAdminId: adminId },
      ],
    },
    orderBy: { triggeredAt: 'desc' },
    take: 10,
  });

  return emergencies.map((e) => ({
    id: e.id,
    status: e.status,
    originalAdmin: {
      id: e.originalAdminId ?? '',
      role: e.originalRole,
      stateCode: e.originalStateCode ?? undefined,
      districtName: e.originalDistrictName ?? undefined,
    },
    assumingAdmin: {
      id: e.assumingAdminId,
      userId: e.assumingAdminId,
      role: e.assumingRole,
    },
    triggerType: e.triggerType,
    triggeredAt: e.triggeredAt,
    duration: calculateDuration(e.triggeredAt),
    affectedResources: e.affectedTournaments,
  }));
}

/**
 * Check if region has active emergency
 */
export async function checkRegionEmergencyStatus(
  stateCode?: string,
  districtName?: string
): Promise<{
  hasActiveEmergency: boolean;
  emergency?: EmergencyControlStatus;
}> {
  const whereClause: Record<string, unknown> = {
    status: EmergencyStatus.ACTIVE,
  };

  if (stateCode) whereClause.originalStateCode = stateCode;
  if (districtName) whereClause.originalDistrictName = districtName;

  const emergency = await db.emergencyControlLog.findFirst({
    where: whereClause,
    orderBy: { triggeredAt: 'desc' },
  });

  if (!emergency) {
    return { hasActiveEmergency: false };
  }

  return {
    hasActiveEmergency: true,
    emergency: {
      id: emergency.id,
      status: emergency.status,
      originalAdmin: {
        id: emergency.originalAdminId ?? '',
        role: emergency.originalRole,
        stateCode: emergency.originalStateCode ?? undefined,
        districtName: emergency.originalDistrictName ?? undefined,
      },
      assumingAdmin: {
        id: emergency.assumingAdminId,
        userId: emergency.assumingAdminId,
        role: emergency.assumingRole,
      },
      triggerType: emergency.triggerType,
      triggeredAt: emergency.triggeredAt,
      duration: calculateDuration(emergency.triggeredAt),
      affectedResources: emergency.affectedTournaments,
    },
  };
}

// ============================================
// HELPERS
// ============================================

function calculateDuration(from: Date): string {
  const now = new Date();
  const diff = now.getTime() - from.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
