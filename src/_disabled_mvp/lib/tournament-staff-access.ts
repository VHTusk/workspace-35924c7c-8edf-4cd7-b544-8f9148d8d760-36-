/**
 * Tournament Staff Access Control
 * Validates staff permissions for tournament operations
 * 
 * v3.43.0 - Ensures directors can only access their assigned tournaments
 */

import { db } from '@/lib/db';

export enum StaffRole {
  HEAD_DIRECTOR = 'HEAD_DIRECTOR',
  ASSISTANT_DIRECTOR = 'ASSISTANT_DIRECTOR',
  SCORER = 'SCORER',
  VOLUNTEER = 'VOLUNTEER',
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<StaffRole, number> = {
  HEAD_DIRECTOR: 4,
  ASSISTANT_DIRECTOR: 3,
  SCORER: 2,
  VOLUNTEER: 1,
};

// Permission sets per role
const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  HEAD_DIRECTOR: [
    'manage_staff',
    'manage_tournament',
    'manage_matches',
    'manage_checkin',
    'manage_announcements',
    'manage_schedule',
    'score_matches',
    'pause_tournament',
    'complete_tournament',
  ],
  ASSISTANT_DIRECTOR: [
    'manage_matches',
    'manage_checkin',
    'manage_announcements',
    'score_matches',
  ],
  SCORER: [
    'score_matches',
    'view_matches',
  ],
  VOLUNTEER: [
    'manage_checkin',
    'view_matches',
  ],
};

export interface StaffAccessResult {
  allowed: boolean;
  role?: StaffRole;
  permissions?: string[];
  reason?: string;
  staffRecord?: {
    id: string;
    role: StaffRole;
    assignedAt: Date;
  };
}

/**
 * Check if a user has staff access to a tournament
 */
export async function validateStaffAccess(
  userId: string,
  tournamentId: string,
  requiredPermission?: string
): Promise<StaffAccessResult> {
  try {
    const staff = await db.tournamentStaff.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId },
      },
    });

    if (!staff) {
      return {
        allowed: false,
        reason: 'NOT_ASSIGNED',
      };
    }

    if (!staff.isActive) {
      return {
        allowed: false,
        reason: 'INACTIVE_ASSIGNMENT',
      };
    }

    const role = staff.role as StaffRole;
    const permissions = ROLE_PERMISSIONS[role] || [];

    // If no specific permission required, just being assigned is enough
    if (!requiredPermission) {
      return {
        allowed: true,
        role,
        permissions,
        staffRecord: {
          id: staff.id,
          role,
          assignedAt: staff.assignedAt,
        },
      };
    }

    // Check if the role has the required permission
    if (!permissions.includes(requiredPermission)) {
      return {
        allowed: false,
        role,
        permissions,
        reason: 'INSUFFICIENT_PERMISSIONS',
      };
    }

    return {
      allowed: true,
      role,
      permissions,
      staffRecord: {
        id: staff.id,
        role,
        assignedAt: staff.assignedAt,
      },
    };
  } catch (error) {
    console.error('[StaffAccess] Error validating access:', error);
    return {
      allowed: false,
      reason: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Check if a user has a minimum role level
 */
export async function validateMinimumRole(
  userId: string,
  tournamentId: string,
  minimumRole: StaffRole
): Promise<StaffAccessResult> {
  const access = await validateStaffAccess(userId, tournamentId);

  if (!access.allowed || !access.role) {
    return access;
  }

  const userLevel = ROLE_HIERARCHY[access.role];
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (userLevel < requiredLevel) {
    return {
      allowed: false,
      role: access.role,
      reason: 'ROLE_TOO_LOW',
    };
  }

  return access;
}

/**
 * Assign staff to a tournament
 */
export async function assignStaffToTournament(
  params: {
    tournamentId: string;
    userId: string;
    role: StaffRole;
    assignedBy: string;
    permissions?: string[];
    notes?: string;
  }
): Promise<{ success: boolean; staffId?: string; error?: string }> {
  try {
    // Check if assignment already exists
    const existing = await db.tournamentStaff.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: params.tournamentId,
          userId: params.userId,
        },
      },
    });

    if (existing) {
      // Update existing assignment
      const updated = await db.tournamentStaff.update({
        where: { id: existing.id },
        data: {
          role: params.role,
          permissions: params.permissions ? JSON.stringify(params.permissions) : null,
          isActive: true,
          assignedBy: params.assignedBy,
          notes: params.notes,
        },
      });
      return { success: true, staffId: updated.id };
    }

    // Create new assignment
    const staff = await db.tournamentStaff.create({
      data: {
        tournamentId: params.tournamentId,
        userId: params.userId,
        role: params.role,
        permissions: params.permissions ? JSON.stringify(params.permissions) : null,
        assignedBy: params.assignedBy,
        notes: params.notes,
      },
    });

    return { success: true, staffId: staff.id };
  } catch (error) {
    console.error('[StaffAccess] Error assigning staff:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove staff from tournament
 */
export async function removeStaffFromTournament(
  tournamentId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    await db.tournamentStaff.updateMany({
      where: { tournamentId, userId },
      data: { isActive: false },
    });
    return { success: true };
  } catch (error) {
    console.error('[StaffAccess] Error removing staff:', error);
    return { success: false };
  }
}

/**
 * Get all staff for a tournament
 */
export async function getTournamentStaff(tournamentId: string) {
  const staff = await db.tournamentStaff.findMany({
    where: { tournamentId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });

  return staff.map(s => ({
    id: s.id,
    userId: s.userId,
    role: s.role as StaffRole,
    permissions: s.permissions ? JSON.parse(s.permissions) : [],
    assignedAt: s.assignedAt,
    notes: s.notes,
    user: s.user,
  }));
}

/**
 * Get all tournaments a user is staff for
 */
export async function getUserStaffAssignments(
  userId: string,
  options?: { activeOnly?: boolean; sport?: string }
) {
  const assignments = await db.tournamentStaff.findMany({
    where: {
      userId,
      isActive: options?.activeOnly !== false,
      tournament: options?.sport ? { sport: options.sport as any } : undefined,
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          status: true,
          startDate: true,
          location: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  return assignments;
}
