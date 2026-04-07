/**
 * VALORHIVE Inactive Admin Detector (v3.50.0)
 * 
 * Monitors admin activity and flags inactive admins for escalation.
 * 
 * Detection Criteria:
 * - Days since last login
 * - Days since last action
 * - Pending escalations not responded to
 * - Unresponded actions in queue
 * 
 * Actions:
 * 1. WARNING - Send notification to admin
 * 2. FLAGGED - Alert higher-level admins
 * 3. ESCALATED - Transfer authority upward
 * 4. DISABLED - Deactivate admin (requires confirmation)
 */

import { db } from './db';
import { AdminRole, InactivityStatus, SportType } from '@prisma/client';
import { findNextActiveAdmin } from './admin-permissions';

// ============================================
// TYPES
// ============================================

export interface InactivityCheckResult {
  processed: number;
  warnings: number;
  flagged: number;
  escalated: number;
  disabled: number;
  errors: string[];
}

export interface AdminActivityStatus {
  adminId: string;
  userId: string;
  role: AdminRole;
  lastLoginAt?: Date;
  lastActionAt?: Date;
  daysInactive: number;
  pendingEscalations: number;
  unrespondedActions: number;
  currentStatus: InactivityStatus;
  needsAction: boolean;
  recommendedAction: 'NONE' | 'WARNING' | 'FLAG' | 'ESCALATE' | 'DISABLE';
}

// ============================================
// INACTIVITY THRESHOLDS (in days)
// ============================================

const INACTIVITY_THRESHOLDS: Record<AdminRole, {
  warningDays: number;
  flagDays: number;
  escalateDays: number;
  disableDays: number;
}> = {
  [AdminRole.SUPER_ADMIN]: {
    warningDays: 14,
    flagDays: 21,
    escalateDays: 30,
    disableDays: 90, // Never auto-disable Super Admin
  },
  [AdminRole.SPORT_ADMIN]: {
    warningDays: 10,
    flagDays: 14,
    escalateDays: 21,
    disableDays: 45,
  },

  [AdminRole.STATE_ADMIN]: {
    warningDays: 5,
    flagDays: 7,
    escalateDays: 10,
    disableDays: 21,
  },
  [AdminRole.DISTRICT_ADMIN]: {
    warningDays: 5,
    flagDays: 7,
    escalateDays: 10,
    disableDays: 21,
  },
  [AdminRole.TOURNAMENT_DIRECTOR]: {
    warningDays: 3,
    flagDays: 5,
    escalateDays: 7,
    disableDays: 14,
  },
};

const MAX_PENDING_ESCALATIONS = 3;
const MAX_UNRESPONDED_ACTIONS = 5;

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Check all active admins for inactivity
 * Should be called by cron job daily
 */
export async function detectInactiveAdmins(): Promise<InactivityCheckResult> {
  const result: InactivityCheckResult = {
    processed: 0,
    warnings: 0,
    flagged: 0,
    escalated: 0,
    disabled: 0,
    errors: [],
  };

  try {
    // Get all active admin assignments
    const activeAdmins = await db.adminAssignment.findMany({
      where: { isActive: true },
      include: {
        user: true,
      },
    });

    for (const admin of activeAdmins) {
      try {
        result.processed++;

        // Get or create inactivity flag
        let inactivityFlag = await db.adminInactivityFlag.findUnique({
          where: { adminId: admin.id },
        });

        if (!inactivityFlag) {
          inactivityFlag = await db.adminInactivityFlag.create({
            data: {
              adminId: admin.id,
              userId: admin.userId,
              status: InactivityStatus.MONITORING,
            },
          });
        }

        // Calculate activity metrics
        const activityStatus = await calculateActivityStatus(admin);

        // Determine required action
        const action = determineRequiredAction(activityStatus, admin.adminRole);

        // Skip if no action needed
        if (action === 'NONE') continue;

        // Execute action based on current status and threshold
        switch (action) {
          case 'WARNING':
            if (inactivityFlag.status === InactivityStatus.MONITORING) {
              await sendInactivityWarning(admin, activityStatus);
              result.warnings++;
            }
            break;

          case 'FLAG':
            if (inactivityFlag.status !== InactivityStatus.FLAGGED) {
              await flagInactiveAdmin(admin, activityStatus);
              result.flagged++;
            }
            break;

          case 'ESCALATE':
            if (inactivityFlag.status !== InactivityStatus.ESCALATED) {
              await escalateInactiveAdmin(admin, activityStatus);
              result.escalated++;
            }
            break;

          case 'DISABLE':
            if (inactivityFlag.status !== InactivityStatus.DISABLED) {
              // Only auto-disable for non-super admins
              if (admin.adminRole !== AdminRole.SUPER_ADMIN) {
                await disableInactiveAdmin(admin, activityStatus);
                result.disabled++;
              }
            }
            break;
        }
      } catch (error) {
        result.errors.push(`Error processing admin ${admin.id}: ${error}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Detection error: ${error}`);
    return result;
  }
}

/**
 * Get activity status for a specific admin
 */
export async function getAdminActivityStatus(adminId: string): Promise<AdminActivityStatus | null> {
  const admin = await db.adminAssignment.findUnique({
    where: { id: adminId },
    include: { user: true },
  });

  if (!admin) return null;

  return calculateActivityStatus(admin);
}

// ============================================
// ACTIVITY CALCULATION
// ============================================

async function calculateActivityStatus(
  admin: {
    id: string;
    userId: string;
    adminRole: AdminRole;
    user: { lastLoginAt?: Date | null };
  }
): Promise<AdminActivityStatus> {
  const now = new Date();

  // Get last login
  const lastLoginAt = admin.user.lastLoginAt;

  // Get last action from audit logs
  const lastAction = await db.adminAuditLog.findFirst({
    where: { assignmentId: admin.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const lastActionAt = lastAction?.createdAt;

  // Calculate days inactive (from last login or last action, whichever is more recent)
  const lastActivity = lastLoginAt && lastActionAt
    ? new Date(Math.max(lastLoginAt.getTime(), lastActionAt.getTime()))
    : lastLoginAt ?? lastActionAt ?? new Date(0);

  const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  // Get pending escalations
  const pendingEscalations = await db.adminEscalation.count({
    where: {
      assignedToId: admin.userId,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
  });

  // Get unresponded actions (tournaments awaiting approval, etc.)
  const unrespondedActions = await countUnrespondedActions(admin.userId, admin.adminRole);

  // Get current flag status
  const flag = await db.adminInactivityFlag.findUnique({
    where: { adminId: admin.id },
  });

  return {
    adminId: admin.id,
    userId: admin.userId,
    role: admin.adminRole,
    lastLoginAt: lastLoginAt ?? undefined,
    lastActionAt: lastActionAt ?? undefined,
    daysInactive,
    pendingEscalations,
    unrespondedActions,
    currentStatus: flag?.status ?? InactivityStatus.MONITORING,
    needsAction: daysInactive > 3 || pendingEscalations > MAX_PENDING_ESCALATIONS,
    recommendedAction: 'NONE',
  };
}

function determineRequiredAction(
  status: AdminActivityStatus,
  role: AdminRole
): 'NONE' | 'WARNING' | 'FLAG' | 'ESCALATE' | 'DISABLE' {
  const thresholds = INACTIVITY_THRESHOLDS[role];

  // Check for critical conditions first
  if (status.pendingEscalations > MAX_PENDING_ESCALATIONS) {
    return 'FLAG';
  }

  if (status.unrespondedActions > MAX_UNRESPONDED_ACTIONS) {
    return 'FLAG';
  }

  // Check time-based thresholds
  if (status.daysInactive >= thresholds.disableDays) {
    return 'DISABLE';
  }

  if (status.daysInactive >= thresholds.escalateDays) {
    return 'ESCALATE';
  }

  if (status.daysInactive >= thresholds.flagDays) {
    return 'FLAG';
  }

  if (status.daysInactive >= thresholds.warningDays) {
    return 'WARNING';
  }

  return 'NONE';
}

async function countUnrespondedActions(userId: string, role: AdminRole): Promise<number> {
  let count = 0;

  // Count tournaments awaiting approval (for roles that can approve)
  if ([AdminRole.SUPER_ADMIN, AdminRole.SPORT_ADMIN].includes(role)) {
    count += await db.tournament.count({
      where: {
        status: 'DRAFT',
        createdById: { not: userId },
      },
    });
  }

  // Count open disputes
  count += await db.dispute.count({
    where: { status: 'OPEN' },
  });

  return count;
}

// ============================================
// ACTION EXECUTION
// ============================================

async function sendInactivityWarning(
  admin: { id: string; userId: string; adminRole: AdminRole; sport?: SportType | null },
  status: AdminActivityStatus
): Promise<void> {
  // Update flag status
  await db.adminInactivityFlag.update({
    where: { adminId: admin.id },
    data: {
      status: InactivityStatus.WARNING,
      flaggedAt: new Date(),
      daysInactive: status.daysInactive,
      pendingEscalations: status.pendingEscalations,
      unrespondedActions: status.unrespondedActions,
    },
  });

  // Send notification
  await db.notification.create({
    data: {
      userId: admin.userId,
      sport: admin.sport ?? SportType.CORNHOLE,
      type: 'INACTIVITY_WARNING',
      title: 'Account Inactivity Warning',
      message: `Your admin account has been inactive for ${status.daysInactive} days. Please log in to avoid escalation.`,
      link: '/admin/dashboard',
    },
  });

  // Log the warning
  await db.adminAuditLog.create({
    data: {
      assignmentId: admin.id,
      action: 'INACTIVITY_WARNING',
      targetType: 'ADMIN',
      targetId: admin.id,
      reason: `Inactive for ${status.daysInactive} days`,
      newValue: JSON.stringify(status),
      actedById: admin.userId,
    },
  });
}

async function flagInactiveAdmin(
  admin: { id: string; userId: string; adminRole: AdminRole; sport?: SportType | null; stateCode?: string | null; districtName?: string | null },
  status: AdminActivityStatus
): Promise<void> {
  // Update flag status
  await db.adminInactivityFlag.update({
    where: { adminId: admin.id },
    data: {
      status: InactivityStatus.FLAGGED,
      flaggedAt: new Date(),
      daysInactive: status.daysInactive,
      pendingEscalations: status.pendingEscalations,
      unrespondedActions: status.unrespondedActions,
    },
  });

  // Find and notify higher-level admin
  const nextAdmin = await findNextActiveAdmin(
    admin.sport ?? SportType.CORNHOLE,
    admin.adminRole,
    admin.stateCode ?? undefined,
    admin.districtName ?? undefined
  );

  if (nextAdmin) {
    await db.notification.create({
      data: {
        userId: nextAdmin.userId,
        sport: admin.sport ?? SportType.CORNHOLE,
        type: 'DISPUTE_UPDATE',
        title: 'Admin Inactivity Alert',
        message: `${admin.adminRole} has been flagged for inactivity (${status.daysInactive} days). Authority may need to be assumed.`,
        link: `/admin/inactivity/${admin.id}`,
      },
    });
  }

  // Log the flag
  await db.adminAuditLog.create({
    data: {
      assignmentId: admin.id,
      action: 'INACTIVITY_FLAGGED',
      targetType: 'ADMIN',
      targetId: admin.id,
      reason: `Flagged after ${status.daysInactive} days inactive`,
      newValue: JSON.stringify({ status, escalatedTo: nextAdmin?.role }),
      actedById: admin.userId,
    },
  });
}

async function escalateInactiveAdmin(
  admin: { id: string; userId: string; adminRole: AdminRole; sport?: SportType | null; stateCode?: string | null; districtName?: string | null },
  status: AdminActivityStatus
): Promise<void> {
  // Find next active admin
  const nextAdmin = await findNextActiveAdmin(
    admin.sport ?? SportType.CORNHOLE,
    admin.adminRole,
    admin.stateCode ?? undefined,
    admin.districtName ?? undefined
  );

  if (!nextAdmin) {
    console.error(`No higher admin available for escalation of ${admin.id}`);
    return;
  }

  // Update flag status
  await db.adminInactivityFlag.update({
    where: { adminId: admin.id },
    data: {
      status: InactivityStatus.ESCALATED,
      escalationLevel: nextAdmin.role,
      escalatedAt: new Date(),
      daysInactive: status.daysInactive,
      pendingEscalations: status.pendingEscalations,
    },
  });

  // Transfer pending escalations
  await db.adminEscalation.updateMany({
    where: {
      assignedToId: admin.userId,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
    data: {
      assignedToId: nextAdmin.userId,
      currentLevel: nextAdmin.role,
      status: 'AUTO_ESCALATED',
    },
  });

  // Create emergency control log
  await db.emergencyControlLog.create({
    data: {
      originalAdminId: admin.id,
      originalRole: admin.adminRole,
      originalStateCode: admin.stateCode,
      originalDistrictName: admin.districtName,
      assumingAdminId: nextAdmin.userId,
      assumingRole: nextAdmin.role,
      triggerType: 'INACTIVITY_TIMEOUT',
      triggerDescription: `Admin inactive for ${status.daysInactive} days`,
    },
  });

  // Log the escalation
  await db.adminAuditLog.create({
    data: {
      assignmentId: admin.id,
      action: 'INACTIVITY_ESCALATED',
      targetType: 'ADMIN',
      targetId: admin.id,
      reason: `Escalated after ${status.daysInactive} days inactive`,
      newValue: JSON.stringify({ status, assumedBy: nextAdmin }),
      actedById: admin.userId,
    },
  });
}

async function disableInactiveAdmin(
  admin: { id: string; userId: string; adminRole: AdminRole; sport?: SportType | null; stateCode?: string | null; districtName?: string | null },
  status: AdminActivityStatus
): Promise<void> {
  // Find next active admin first
  const nextAdmin = await findNextActiveAdmin(
    admin.sport ?? SportType.CORNHOLE,
    admin.adminRole,
    admin.stateCode ?? undefined,
    admin.districtName ?? undefined
  );

  // Disable the admin
  await db.adminAssignment.update({
    where: { id: admin.id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: `Auto-disabled: Inactive for ${status.daysInactive} days`,
    },
  });

  // Update flag status
  await db.adminInactivityFlag.update({
    where: { adminId: admin.id },
    data: {
      status: InactivityStatus.DISABLED,
      autoDisabled: true,
      authorityTransferred: !!nextAdmin,
      transferredToId: nextAdmin?.userId,
      daysInactive: status.daysInactive,
    },
  });

  // Create emergency control log
  await db.emergencyControlLog.create({
    data: {
      originalAdminId: admin.id,
      originalRole: admin.adminRole,
      originalStateCode: admin.stateCode,
      originalDistrictName: admin.districtName,
      assumingAdminId: nextAdmin?.userId ?? 'system',
      assumingRole: nextAdmin?.role ?? AdminRole.SUPER_ADMIN,
      triggerType: 'INACTIVITY_TIMEOUT',
      triggerDescription: `Admin auto-disabled after ${status.daysInactive} days inactive`,
      status: 'RESOLVED',
    },
  });

  // Log the disable
  await db.adminAuditLog.create({
    data: {
      assignmentId: admin.id,
      action: 'AUTO_DISABLED',
      targetType: 'ADMIN',
      targetId: admin.id,
      reason: `Auto-disabled: Inactive for ${status.daysInactive} days`,
      newValue: JSON.stringify({ status, transferredTo: nextAdmin }),
      actedById: admin.userId,
    },
  });
}

// ============================================
// RESOLUTION
// ============================================

/**
 * Mark an admin as active (resolves inactivity flag)
 */
export async function resolveInactivityFlag(
  adminId: string,
  resolvedById: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const flag = await db.adminInactivityFlag.findUnique({
      where: { adminId },
    });

    if (!flag) {
      return { success: false, message: 'No inactivity flag found' };
    }

    // Update flag
    await db.adminInactivityFlag.update({
      where: { adminId },
      data: {
        status: InactivityStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById,
        resolutionNotes: notes,
      },
    });

    // Re-enable admin if they were auto-disabled
    const admin = await db.adminAssignment.findUnique({
      where: { id: adminId },
    });

    if (admin && !admin.isActive && admin.deactivationReason?.includes('Auto-disabled')) {
      await db.adminAssignment.update({
        where: { id: adminId },
        data: {
          isActive: true,
          deactivatedAt: null,
          deactivationReason: null,
        },
      });
    }

    return { success: true, message: 'Inactivity flag resolved' };
  } catch (error) {
    console.error('Error resolving inactivity flag:', error);
    return { success: false, message: 'Failed to resolve flag' };
  }
}

/**
 * Get all flagged/inactive admins for a region
 */
export async function getInactiveAdminsForRegion(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<AdminActivityStatus[]> {
  const whereClause: Record<string, unknown> = {
    sport,
    isActive: true,
  };

  if (stateCode) whereClause.stateCode = stateCode;
  if (districtName) whereClause.districtName = districtName;

  const admins = await db.adminAssignment.findMany({
    where: whereClause,
    include: { user: true },
  });

  const results: AdminActivityStatus[] = [];

  for (const admin of admins) {
    const status = await calculateActivityStatus(admin);
    if (status.needsAction) {
      results.push(status);
    }
  }

  return results.sort((a, b) => b.daysInactive - a.daysInactive);
}
