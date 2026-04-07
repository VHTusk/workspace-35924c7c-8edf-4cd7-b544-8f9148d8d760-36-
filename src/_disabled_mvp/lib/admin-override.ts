/**
 * VALORHIVE Admin Override Audit Logging
 * 
 * All admin overrides must be logged with detailed metadata for compliance
 * and audit trail purposes.
 */

import { db } from './db';
import { AuditAction, Role, SportType } from '@prisma/client';

export interface AdminOverrideParams {
  sport: SportType;
  action: AuditAction;
  actorId: string;
  actorRole: Role;
  targetType: string;
  targetId: string;
  tournamentId?: string;
  reason: string;  // Required for overrides
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface OverrideResult {
  success: boolean;
  auditLogId: string;
  timestamp: Date;
}

/**
 * Log an admin override action with detailed metadata
 * 
 * All admin overrides require a reason for audit compliance.
 */
export async function logAdminOverride(params: AdminOverrideParams): Promise<OverrideResult> {
  const {
    sport,
    action,
    actorId,
    actorRole,
    targetType,
    targetId,
    tournamentId,
    reason,
    metadata = {},
    ipAddress,
  } = params;

  // All overrides require a reason
  if (!reason || reason.trim().length === 0) {
    throw new Error('Admin override requires a reason for audit compliance');
  }

  // Create audit log with override flag
  const auditLog = await db.auditLog.create({
    data: {
      sport,
      action: AuditAction.ADMIN_OVERRIDE,
      actorId,
      actorRole,
      targetType,
      targetId,
      tournamentId: tournamentId || null,
      reason,
      metadata: JSON.stringify({
        ...metadata,
        originalAction: action,
        isOverride: true,
        overrideReason: reason,
      }),
      ipAddress,
    },
  });

  return {
    success: true,
    auditLogId: auditLog.id,
    timestamp: auditLog.createdAt,
  };
}

/**
 * Check if user has override permissions
 * Only ADMIN and SUB_ADMIN can perform overrides
 */
export function canPerformOverride(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUB_ADMIN;
}

/**
 * Require override permission or throw error
 */
export function requireOverridePermission(role: Role): void {
  if (!canPerformOverride(role)) {
    throw new Error('Only ADMIN or SUB_ADMIN can perform override actions');
  }
}

/**
 * Common override actions with predefined metadata
 */
export const OverrideActions = {
  /**
   * Log match result edit after tournament completion
   */
  async editCompletedMatchResult(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      matchId: string;
      tournamentId: string;
      oldScore: { scoreA: number | null; scoreB: number | null; winnerId: string | null };
      newScore: { scoreA: number; scoreB: number; winnerId: string };
      reason: string;
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.MATCH_RESULT_EDITED,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'Match',
      targetId: params.matchId,
      tournamentId: params.tournamentId,
      reason: params.reason,
      metadata: {
        overrideType: 'EDIT_COMPLETED_MATCH',
        oldScore: params.oldScore,
        newScore: params.newScore,
      },
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log bracket regeneration after tournament start
   */
  async reseedAfterStart(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      tournamentId: string;
      bracketId: string;
      reason: string;
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.BRACKET_RESET,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'Bracket',
      targetId: params.bracketId,
      tournamentId: params.tournamentId,
      reason: params.reason,
      metadata: {
        overrideType: 'RESEED_AFTER_START',
      },
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log ELO adjustment override
   */
  async adjustElo(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      userId: string;
      oldElo: number;
      newElo: number;
      reason: string;
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.ADMIN_OVERRIDE,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'User',
      targetId: params.userId,
      reason: params.reason,
      metadata: {
        overrideType: 'ELO_ADJUSTMENT',
        oldElo: params.oldElo,
        newElo: params.newElo,
        eloChange: params.newElo - params.oldElo,
      },
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log user ban override
   */
  async banUser(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      userId: string;
      reason: string;
      duration?: string;  // 'permanent', '30d', '7d', etc.
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.USER_BANNED,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'User',
      targetId: params.userId,
      reason: params.reason,
      metadata: {
        overrideType: 'USER_BAN',
        duration: params.duration || 'permanent',
      },
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log tournament cancellation override
   */
  async cancelTournament(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      tournamentId: string;
      tournamentName: string;
      reason: string;
      refundProcessed: boolean;
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.TOURNAMENT_CANCELLED,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'Tournament',
      targetId: params.tournamentId,
      tournamentId: params.tournamentId,
      reason: params.reason,
      metadata: {
        overrideType: 'TOURNAMENT_CANCELLATION',
        tournamentName: params.tournamentName,
        refundProcessed: params.refundProcessed,
      },
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log dispute resolution override
   */
  async resolveDispute(
    params: {
      sport: SportType;
      actorId: string;
      actorRole: Role;
      disputeId: string;
      matchId: string;
      tournamentId?: string;
      resolution: string;
      scoreCorrected: boolean;
      reason: string;
      ipAddress?: string;
    }
  ): Promise<OverrideResult> {
    requireOverridePermission(params.actorRole);

    return logAdminOverride({
      sport: params.sport,
      action: AuditAction.DISPUTE_RESOLVED,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: 'Dispute',
      targetId: params.disputeId,
      tournamentId: params.tournamentId,
      reason: params.reason,
      metadata: {
        overrideType: 'DISPUTE_RESOLUTION',
        matchId: params.matchId,
        resolution: params.resolution,
        scoreCorrected: params.scoreCorrected,
      },
      ipAddress: params.ipAddress,
    });
  },
};

/**
 * Get recent admin overrides for audit review
 */
export async function getRecentOverrides(params: {
  sport?: SportType;
  actorId?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {
    action: AuditAction.ADMIN_OVERRIDE,
  };

  if (params.sport) where.sport = params.sport;
  if (params.actorId) where.actorId = params.actorId;
  if (params.targetType) where.targetType = params.targetType;

  const overrides = await db.auditLog.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit || 50,
    skip: params.offset || 0,
  });

  const total = await db.auditLog.count({ where });

  return {
    overrides: overrides.map(log => ({
      id: log.id,
      sport: log.sport,
      actor: log.actor,
      targetType: log.targetType,
      targetId: log.targetId,
      tournamentId: log.tournamentId,
      reason: log.reason,
      metadata: log.metadata ? JSON.parse(log.metadata as string) : {},
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
    total,
  };
}
