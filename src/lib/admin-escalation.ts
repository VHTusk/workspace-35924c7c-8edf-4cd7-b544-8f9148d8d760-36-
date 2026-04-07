/**
 * VALORHIVE Admin Escalation Service (v3.46.0)
 * 
 * Implements the Enable/Disable Governance Model and Upward Escalation Chain.
 * 
 * Key principles:
 * 1. Authority always flows upward when a role is disabled
 * 2. District disabled → State assumes control
 * 3. State disabled → Sport Admin assumes control
 * 4. Sport Admin disabled → Super Admin assumes control
 * 5. At no point shall a region be left without governance
 */

import { db } from './db';
import { AdminRole, SportType } from '@prisma/client';
import { getNextHigherRole, findNextActiveAdmin } from './admin-permissions';

// ============================================
// TYPES
// ============================================

export interface EnableDisableResult {
  success: boolean;
  message: string;
  escalationTarget?: {
    userId: string;
    role: AdminRole;
  };
}

export interface EscalationResult {
  success: boolean;
  escalationId?: string;
  assignedTo?: {
    userId: string;
    role: AdminRole;
  };
  autoEscalateAt?: Date;
  message: string;
}

export type EscalationType = 
  | 'DISPUTE'
  | 'BAN_REQUEST'
  | 'REFUND'
  | 'CANCEL'
  | 'ELO_ADJUSTMENT'
  | 'MATCH_EDIT'
  | 'PLAYER_ACTION';

export type ResourceType =
  | 'TOURNAMENT'
  | 'PLAYER'
  | 'DISPUTE'
  | 'MATCH'
  | 'REFUND';

// ============================================
// ESCALATION TIMEOUTS
// ============================================

const ESCALATION_TIMEOUTS: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 24 * 60, // 24 hours (minutes)
  [AdminRole.SPORT_ADMIN]: 8 * 60,  // 8 hours
  [AdminRole.STATE_ADMIN]: 2 * 60,  // 2 hours
  [AdminRole.DISTRICT_ADMIN]: 1 * 60, // 1 hour
  [AdminRole.TOURNAMENT_DIRECTOR]: 30, // 30 minutes
};

// ============================================
// ENABLE / DISABLE GOVERNANCE
// ============================================

/**
 * Disable an admin assignment
 * When disabled, authority moves to next active level above
 */
export async function disableAdminAssignment(
  assignmentId: string,
  disabledBy: string,
  reason: string
): Promise<EnableDisableResult> {
  try {
    const assignment = await db.adminAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return { success: false, message: 'Assignment not found' };
    }

    if (!assignment.isActive) {
      return { success: false, message: 'Assignment already disabled' };
    }

    // Update assignment
    await db.adminAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: disabledBy,
        deactivationReason: reason,
      },
    });

    // Log the action
    await db.adminAuditLog.create({
      data: {
        assignmentId,
        action: 'DISABLE',
        reason,
        actedById: disabledBy,
        oldValue: JSON.stringify({ isActive: true }),
        newValue: JSON.stringify({ isActive: false }),
      },
    });

    // Find next active admin for upward authority flow
    const nextAdmin = await findNextActiveAdmin(
      assignment.sport || SportType.CORNHOLE,
      assignment.adminRole,
      assignment.stateCode || undefined,
      assignment.districtName || undefined
    );

    // Notify the next level admin
    if (nextAdmin) {
      await db.notification.create({
        data: {
          userId: nextAdmin.userId,
          sport: assignment.sport || SportType.CORNHOLE,
          type: 'ADMIN_ASSUMPTION',
          title: 'Authority Assumption',
          message: `You have assumed authority for ${assignment.adminRole} in your scope due to admin deactivation.`,
          link: '/admin/dashboard',
        },
      });
    }

    return {
      success: true,
      message: `Admin disabled. Authority escalated to ${nextAdmin?.role || 'Super Admin'}.`,
      escalationTarget: nextAdmin || undefined,
    };
  } catch (error) {
    console.error('Error disabling admin assignment:', error);
    return { success: false, message: 'Failed to disable admin' };
  }
}

/**
 * Re-enable a disabled admin assignment
 * Upon reactivation, authority returns to that level
 */
export async function enableAdminAssignment(
  assignmentId: string,
  enabledBy: string,
  reason: string
): Promise<EnableDisableResult> {
  try {
    const assignment = await db.adminAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return { success: false, message: 'Assignment not found' };
    }

    if (assignment.isActive) {
      return { success: false, message: 'Assignment already active' };
    }

    // Update assignment
    await db.adminAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
      },
    });

    // Log the action
    await db.adminAuditLog.create({
      data: {
        assignmentId,
        action: 'ENABLE',
        reason,
        actedById: enabledBy,
        oldValue: JSON.stringify({ isActive: false }),
        newValue: JSON.stringify({ isActive: true }),
      },
    });

    return {
      success: true,
      message: 'Admin re-enabled. Authority restored.',
    };
  } catch (error) {
    console.error('Error enabling admin assignment:', error);
    return { success: false, message: 'Failed to enable admin' };
  }
}

/**
 * Check if a region has any active admin
 * If not, Super Admin retains control
 */
export async function ensureRegionGovernance(
  sport: SportType,
  stateCode?: string,
  districtName?: string
): Promise<{ hasGovernance: boolean; activeAdmin?: { userId: string; role: AdminRole } }> {
  // Get all admins for this region
  const assignments = await db.adminAssignment.findMany({
    where: {
      sport,
      isActive: true,
      OR: [
        { stateCode: stateCode || null },
        { stateCode: { not: null } }, // Also include higher-level admins
      ],
    },
    orderBy: {
      adminRole: 'asc', // Super Admin first
    },
  });

  // Filter to find relevant admins
  const relevantAdmins = assignments.filter((a) => {
    // Super Admin and Sport Admin always have governance
    if (a.adminRole === AdminRole.SUPER_ADMIN || a.adminRole === AdminRole.SPORT_ADMIN) {
      return true;
    }

    // For state/district, check if assignment covers the region
    if (stateCode) {
      // State admin for this state
      if (a.adminRole === AdminRole.STATE_ADMIN && a.stateCode === stateCode) {
        return true;
      }

      // District admin for this district
      if (
        a.adminRole === AdminRole.DISTRICT_ADMIN &&
        a.stateCode === stateCode &&
        (districtName ? a.districtName === districtName : true)
      ) {
        return true;
      }
    }

    return false;
  });

  if (relevantAdmins.length > 0) {
    return {
      hasGovernance: true,
      activeAdmin: {
        userId: relevantAdmins[0].userId,
        role: relevantAdmins[0].adminRole,
      },
    };
  }

  // No active admin - find Super Admin as fallback
  const superAdmin = await db.adminAssignment.findFirst({
    where: {
      adminRole: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  if (superAdmin) {
    return {
      hasGovernance: true,
      activeAdmin: {
        userId: superAdmin.userId,
        role: AdminRole.SUPER_ADMIN,
      },
    };
  }

  return { hasGovernance: false };
}

// ============================================
// ESCALATION CHAIN
// ============================================

/**
 * Create an escalation for an action that requires higher authority
 */
export async function createEscalation(
  type: EscalationType,
  requestedById: string,
  requestedAction: string,
  resourceType: ResourceType,
  resourceId: string,
  context: { sport: SportType; stateCode?: string; districtName?: string }
): Promise<EscalationResult> {
  try {
    // Get the requesting admin's assignment
    const assignment = await db.adminAssignment.findFirst({
      where: {
        userId: requestedById,
        isActive: true,
      },
    });

    if (!assignment) {
      return { success: false, message: 'No active admin assignment found' };
    }

    // Find next active admin for escalation
    const nextAdmin = await findNextActiveAdmin(
      context.sport,
      assignment.adminRole,
      context.stateCode,
      context.districtName
    );

    if (!nextAdmin) {
      return { success: false, message: 'No higher admin available for escalation' };
    }

    // Calculate auto-escalation time
    const timeoutMinutes = ESCALATION_TIMEOUTS[nextAdmin.role];
    const autoEscalateAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    // Create escalation record
    const escalation = await db.adminEscalation.create({
      data: {
        type,
        requestedById: assignment.id,
        requestedAction,
        resourceType,
        resourceId,
        currentLevel: nextAdmin.role,
        assignedToId: nextAdmin.userId,
        status: 'ASSIGNED',
        escalationChain: JSON.stringify([
          {
            role: assignment.adminRole,
            userId: requestedById,
            time: new Date().toISOString(),
            action: 'REQUESTED',
          },
          {
            role: nextAdmin.role,
            userId: nextAdmin.userId,
            time: new Date().toISOString(),
            action: 'ASSIGNED',
          },
        ]),
        autoEscalateAt,
      },
    });

    // Create notification for assigned admin
    await db.notification.create({
      data: {
        userId: nextAdmin.userId,
        sport: context.sport,
        type: 'ESCALATION',
        title: `Escalation: ${type}`,
        message: `An action requires your review: ${requestedAction}`,
        link: `/admin/escalations/${escalation.id}`,
      },
    });

    return {
      success: true,
      escalationId: escalation.id,
      assignedTo: nextAdmin,
      autoEscalateAt,
      message: `Escalated to ${nextAdmin.role}. Auto-escalation in ${timeoutMinutes} minutes if no response.`,
    };
  } catch (error) {
    console.error('Error creating escalation:', error);
    return { success: false, message: 'Failed to create escalation' };
  }
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
  escalationId: string,
  resolvedById: string,
  resolution: string
): Promise<EscalationResult> {
  try {
    const escalation = await db.adminEscalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation) {
      return { success: false, message: 'Escalation not found' };
    }

    if (escalation.status === 'RESOLVED') {
      return { success: false, message: 'Escalation already resolved' };
    }

    // Update escalation
    await db.adminEscalation.update({
      where: { id: escalationId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedById,
        resolvedAt: new Date(),
      },
    });

    // Update escalation chain
    const chain = JSON.parse(escalation.escalationChain);
    chain.push({
      userId: resolvedById,
      time: new Date().toISOString(),
      action: `RESOLVED: ${resolution}`,
    });

    await db.adminEscalation.update({
      where: { id: escalationId },
      data: { escalationChain: JSON.stringify(chain) },
    });

    // Notify the original requester
    const originalAssignment = await db.adminAssignment.findUnique({
      where: { id: escalation.requestedById },
    });

    if (originalAssignment) {
      await db.notification.create({
        data: {
          userId: originalAssignment.userId,
          sport: SportType.CORNHOLE, // Default
          type: 'DISPUTE_UPDATE',
          title: 'Escalation Resolved',
          message: `Your escalation has been resolved: ${resolution}`,
          link: `/admin/escalations/${escalationId}`,
        },
      });
    }

    return {
      success: true,
      escalationId,
      message: 'Escalation resolved successfully',
    };
  } catch (error) {
    console.error('Error resolving escalation:', error);
    return { success: false, message: 'Failed to resolve escalation' };
  }
}

/**
 * Auto-escalate unresolved items after timeout
 * Should be called by cron job every minute
 */
export async function processAutoEscalations(): Promise<{
  processed: number;
  escalations: Array<{ id: string; from: AdminRole; to: AdminRole }>;
  errors: string[];
}> {
  const result = {
    processed: 0,
    escalations: [] as Array<{ id: string; from: AdminRole; to: AdminRole }>,
    errors: [] as string[],
  };

  try {
    // Find escalations past auto-escalation time
    const pendingEscalations = await db.adminEscalation.findMany({
      where: {
        status: { in: ['PENDING', 'ASSIGNED'] },
        autoEscalateAt: { lte: new Date() },
      },
      include: {
        assignment: true,
      },
    });

    for (const escalation of pendingEscalations) {
      try {
        const currentRole = escalation.currentLevel;
        const nextRole = getNextHigherRole(currentRole);

        if (!nextRole) {
          // Already at Super Admin level
          result.errors.push(`Escalation ${escalation.id} at Super Admin level with no response`);
          continue;
        }

        // Find next active admin
        const nextAdmin = await findNextActiveAdmin(
          escalation.assignment.sport || SportType.CORNHOLE,
          currentRole
        );

        if (!nextAdmin) {
          result.errors.push(`No higher admin for escalation ${escalation.id}`);
          continue;
        }

        // Update escalation
        const chain = JSON.parse(escalation.escalationChain);
        chain.push({
          role: nextAdmin.role,
          userId: nextAdmin.userId,
          time: new Date().toISOString(),
          action: 'AUTO_ESCALATED',
        });

        const timeoutMinutes = ESCALATION_TIMEOUTS[nextAdmin.role];

        await db.adminEscalation.update({
          where: { id: escalation.id },
          data: {
            currentLevel: nextAdmin.role,
            assignedToId: nextAdmin.userId,
            status: 'AUTO_ESCALATED',
            escalationChain: JSON.stringify(chain),
            autoEscalateAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
          },
        });

        // Notify new admin
        await db.notification.create({
          data: {
            userId: nextAdmin.userId,
            sport: escalation.assignment.sport || SportType.CORNHOLE,
            type: 'DISPUTE_UPDATE',
            title: 'Auto-Escalated Action',
            message: `An escalation was auto-escalated to you after timeout: ${escalation.requestedAction}`,
            link: `/admin/escalations/${escalation.id}`,
          },
        });

        result.processed++;
        result.escalations.push({
          id: escalation.id,
          from: currentRole,
          to: nextAdmin.role,
        });
      } catch (error) {
        result.errors.push(`Failed to auto-escalate ${escalation.id}: ${error}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Batch processing error: ${error}`);
    return result;
  }
}

// ============================================
// SELECTIVE DISABLEMENT
// ============================================

/**
 * Disable all admins for a specific region
 * Used for emergency situations
 */
export async function disableRegionAdmins(
  sport: SportType,
  stateCode?: string,
  districtName?: string,
  disabledBy?: string,
  reason?: string
): Promise<{ disabled: number; message: string }> {
  const whereClause: Record<string, unknown> = {
    sport,
    isActive: true,
  };

  if (stateCode) {
    whereClause.stateCode = stateCode;
  }
  if (districtName) {
    whereClause.districtName = districtName;
  }

  const result = await db.adminAssignment.updateMany({
    where: whereClause,
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: reason || 'Emergency disablement',
    },
  });

  // Ensure governance by notifying Super Admin
  const superAdmins = await db.adminAssignment.findMany({
    where: {
      adminRole: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  for (const admin of superAdmins) {
    await db.notification.create({
      data: {
        userId: admin.userId,
        sport,
        type: 'TOURNAMENT_CANCELLED',
        title: 'Region Admins Disabled',
        message: `${result.count} admins disabled for ${stateCode || 'region'}. You have assumed authority.`,
        link: '/admin/dashboard',
      },
    });
  }

  return {
    disabled: result.count,
    message: `Disabled ${result.count} admins. Super Admin has assumed authority.`,
  };
}

/**
 * Disable an entire role tier temporarily
 * Example: Disable all District Admins during restructuring
 */
export async function disableRoleTier(
  role: AdminRole,
  sport: SportType,
  disabledBy: string,
  reason: string
): Promise<{ disabled: number; message: string }> {
  const result = await db.adminAssignment.updateMany({
    where: {
      adminRole: role,
      sport,
      isActive: true,
    },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: disabledBy,
      deactivationReason: reason,
    },
  });

  // Log bulk action
  await db.adminAuditLog.create({
    data: {
      assignmentId: disabledBy, // The admin who performed this action
      action: 'DISABLE_TIER',
      targetType: 'ROLE_TIER',
      targetId: role,
      reason,
      newValue: JSON.stringify({ role, sport, disabledCount: result.count }),
      actedById: disabledBy,
    },
  });

  return {
    disabled: result.count,
    message: `All ${role} accounts disabled. Authority flows upward.`,
  };
}
