/**
 * VALORHIVE Audit Log Helper Module
 * 
 * Provides centralized audit logging functionality for tracking all
 * significant actions in the system. This module ensures consistent
 * audit trail generation across all API routes and services.
 * 
 * @module audit-helper
 */

import { db } from './db';
import {
  AuditAction,
  SportType,
  Role,
  User,
  Tournament,
  Match,
} from '@prisma/client';
import { NextRequest } from 'next/server';

// ============================================
// TYPES
// ============================================

export interface LogActionParams {
  /** ID of the user performing the action */
  actorId: string;
  /** The action being performed */
  action: AuditAction | string;
  /** Type of resource being acted upon */
  resourceType: string;
  /** ID of the specific resource */
  resourceId: string;
  /** Sport context */
  sport?: SportType;
  /** Tournament ID if action is tournament-related */
  tournamentId?: string;
  /** State of resource before the action */
  before?: any;
  /** State of resource after the action */
  after?: any;
  /** Reason for the action (especially for admin actions) */
  reason?: string;
  /** IP address of the actor */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Operator name for org sessions */
  operatorName?: string;
  /** Operator email for org sessions */
  operatorEmail?: string;
  /** Additional metadata as JSON */
  metadata?: Record<string, any>;
}

export interface LogMatchActionParams {
  actorId: string;
  matchId: string;
  action: 'score_entered' | 'score_edited' | 'score_reverted' | 'disputed' | 'resolved';
  sport: SportType;
  tournamentId?: string;
  before?: {
    scoreA?: number | null;
    scoreB?: number | null;
    winnerId?: string | null;
    outcome?: string | null;
  };
  after?: {
    scoreA?: number | null;
    scoreB?: number | null;
    winnerId?: string | null;
    outcome?: string | null;
  };
  reason?: string;
  ipAddress?: string;
}

export interface LogTournamentActionParams {
  actorId: string;
  tournamentId: string;
  action: 'created' | 'updated' | 'published' | 'started' | 'paused' | 'completed' | 'cancelled' | 'deleted';
  sport: SportType;
  before?: Partial<Tournament>;
  after?: Partial<Tournament>;
  reason?: string;
  ipAddress?: string;
}

export interface LogAdminActionParams {
  actorId: string;
  action: 'admin_assigned' | 'admin_removed' | 'director_assigned' | 'director_removed' | 
          'player_banned' | 'player_unbanned' | 'org_suspended' | 'org_approved' |
          'override_applied' | 'escalation_triggered' | 'feature_flag_changed';
  resourceType: 'user' | 'organization' | 'tournament' | 'admin_assignment' | 'feature_flag';
  resourceId: string;
  sport?: SportType;
  before?: any;
  after?: any;
  reason: string; // Required for admin actions
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: string;
  sport: SportType;
  action: AuditAction;
  actorId: string;
  actorRole: Role;
  targetType: string;
  targetId: string;
  tournamentId?: string;
  operatorName?: string;
  operatorEmail?: string;
  reason?: string;
  metadata?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface AuditLogQuery {
  sport?: SportType;
  action?: AuditAction | AuditAction[];
  actorId?: string;
  targetType?: string;
  targetId?: string;
  tournamentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalLogs: number;
  byAction: Record<string, number>;
  byTargetType: Record<string, number>;
  recentActivity: Array<{
    action: string;
    count: number;
    date: string;
  }>;
}

// ============================================
// AUDIT ACTION MAPPING
// ============================================

/**
 * Map custom action strings to AuditAction enum values
 */
function mapToAuditAction(action: string): AuditAction {
  const actionMap: Record<string, AuditAction> = {
    // Match actions
    score_entered: AuditAction.MATCH_RESULT_ENTERED,
    score_edited: AuditAction.MATCH_RESULT_EDITED,
    score_reverted: AuditAction.MATCH_RESULT_REVERTED,
    disputed: AuditAction.MATCH_RESULT_EDITED,
    resolved: AuditAction.DISPUTE_RESOLVED,
    
    // Tournament actions
    created: AuditAction.BRACKET_GENERATED,
    published: AuditAction.BRACKET_GENERATED,
    started: AuditAction.BRACKET_GENERATED,
    completed: AuditAction.TOURNAMENT_COMPLETED,
    cancelled: AuditAction.TOURNAMENT_CANCEL,
    deleted: AuditAction.TOURNAMENT_CANCEL,
    
    // Admin actions
    admin_assigned: AuditAction.ADMIN_OVERRIDE,
    admin_removed: AuditAction.ADMIN_OVERRIDE,
    director_assigned: AuditAction.ADMIN_OVERRIDE,
    director_removed: AuditAction.ADMIN_OVERRIDE,
    player_banned: AuditAction.USER_BANNED,
    player_unbanned: AuditAction.USER_UNBANNED,
    org_suspended: AuditAction.ADMIN_OVERRIDE,
    org_approved: AuditAction.ADMIN_OVERRIDE,
    override_applied: AuditAction.ADMIN_OVERRIDE,
    escalation_triggered: AuditAction.ADMIN_OVERRIDE,
    feature_flag_changed: AuditAction.ADMIN_OVERRIDE,
  };

  // Return mapped action or try to use as-is if it's already an AuditAction
  return actionMap[action] || (action as AuditAction);
}

/**
 * Get the actor's role from the database
 */
async function getActorRole(actorId: string): Promise<Role> {
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  return user?.role || Role.PLAYER;
}

// ============================================
// CORE LOGGING FUNCTIONS
// ============================================

/**
 * Log an action to the audit log
 * This is the primary function for recording audit events
 * 
 * @param params - LogActionParams containing all audit information
 * @returns The created audit log entry
 */
export async function logAction(params: LogActionParams): Promise<AuditLogEntry | null> {
  try {
    const actorRole = await getActorRole(params.actorId);
    const auditAction = mapToAuditAction(params.action);

    // Determine sport - use provided or try to infer
    let sport = params.sport;
    if (!sport) {
      // Try to get sport from actor
      const actor = await db.user.findUnique({
        where: { id: params.actorId },
        select: { sport: true },
      });
      sport = actor?.sport;
    }

    if (!sport) {
      console.error('[AuditHelper] Cannot log action without sport context');
      return null;
    }

    const metadata = {
      before: params.before,
      after: params.after,
      customAction: params.action,
      userAgent: params.userAgent,
      ...params.metadata,
    };

    const entry = await db.auditLog.create({
      data: {
        sport,
        action: auditAction,
        actorId: params.actorId,
        actorRole,
        targetType: params.resourceType,
        targetId: params.resourceId,
        tournamentId: params.tournamentId,
        operatorName: params.operatorName,
        operatorEmail: params.operatorEmail,
        reason: params.reason,
        metadata: JSON.stringify(metadata),
        ipAddress: params.ipAddress,
      },
    });

    return entry as AuditLogEntry;
  } catch (error) {
    console.error('[AuditHelper] Failed to log action:', error);
    return null;
  }
}

/**
 * Log a match-related action
 * Provides a simplified interface for common match events
 * 
 * @param params - LogMatchActionParams with match-specific fields
 * @returns The created audit log entry
 */
export async function logMatchAction(params: LogMatchActionParams): Promise<AuditLogEntry | null> {
  const match = await db.match.findUnique({
    where: { id: params.matchId },
    select: { tournamentId: true },
  });

  const actionMap: Record<string, AuditAction> = {
    score_entered: AuditAction.MATCH_RESULT_ENTERED,
    score_edited: AuditAction.MATCH_RESULT_EDITED,
    score_reverted: AuditAction.MATCH_RESULT_REVERTED,
    disputed: AuditAction.MATCH_RESULT_EDITED,
    resolved: AuditAction.DISPUTE_RESOLVED,
  };

  return logAction({
    actorId: params.actorId,
    action: actionMap[params.action] || params.action,
    resourceType: 'match',
    resourceId: params.matchId,
    sport: params.sport,
    tournamentId: params.tournamentId || match?.tournamentId || undefined,
    before: params.before,
    after: params.after,
    reason: params.reason,
    ipAddress: params.ipAddress,
    metadata: {
      matchAction: params.action,
    },
  });
}

/**
 * Log a tournament-related action
 * Provides a simplified interface for tournament lifecycle events
 * 
 * @param params - LogTournamentActionParams with tournament-specific fields
 * @returns The created audit log entry
 */
export async function logTournamentAction(
  params: LogTournamentActionParams
): Promise<AuditLogEntry | null> {
  const actionMap: Record<string, AuditAction> = {
    created: AuditAction.BRACKET_GENERATED,
    updated: AuditAction.BRACKET_GENERATED,
    published: AuditAction.BRACKET_GENERATED,
    started: AuditAction.BRACKET_GENERATED,
    paused: AuditAction.BRACKET_GENERATED,
    completed: AuditAction.TOURNAMENT_COMPLETED,
    cancelled: AuditAction.TOURNAMENT_CANCEL,
    deleted: AuditAction.TOURNAMENT_CANCEL,
  };

  return logAction({
    actorId: params.actorId,
    action: actionMap[params.action] || params.action,
    resourceType: 'tournament',
    resourceId: params.tournamentId,
    sport: params.sport,
    tournamentId: params.tournamentId,
    before: params.before,
    after: params.after,
    reason: params.reason,
    ipAddress: params.ipAddress,
    metadata: {
      tournamentAction: params.action,
    },
  });
}

/**
 * Log an admin action
 * Ensures all admin actions are properly documented with required reason
 * 
 * @param params - LogAdminActionParams with admin-specific fields
 * @returns The created audit log entry
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<AuditLogEntry | null> {
  const actionMap: Record<string, AuditAction> = {
    admin_assigned: AuditAction.ADMIN_OVERRIDE,
    admin_removed: AuditAction.ADMIN_OVERRIDE,
    director_assigned: AuditAction.ADMIN_OVERRIDE,
    director_removed: AuditAction.ADMIN_OVERRIDE,
    player_banned: AuditAction.USER_BANNED,
    player_unbanned: AuditAction.USER_UNBANNED,
    org_suspended: AuditAction.ADMIN_OVERRIDE,
    org_approved: AuditAction.ADMIN_OVERRIDE,
    override_applied: AuditAction.ADMIN_OVERRIDE,
    escalation_triggered: AuditAction.ADMIN_OVERRIDE,
    feature_flag_changed: AuditAction.ADMIN_OVERRIDE,
  };

  return logAction({
    actorId: params.actorId,
    action: actionMap[params.action] || params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    sport: params.sport,
    before: params.before,
    after: params.after,
    reason: params.reason, // Required for admin actions
    ipAddress: params.ipAddress,
    metadata: {
      adminAction: params.action,
    },
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Query audit logs with filtering
 * 
 * @param query - Query parameters for filtering
 * @returns Array of matching audit log entries
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<AuditLogEntry[]> {
  const where: any = {};

  if (query.sport) where.sport = query.sport;
  if (query.actorId) where.actorId = query.actorId;
  if (query.targetType) where.targetType = query.targetType;
  if (query.targetId) where.targetId = query.targetId;
  if (query.tournamentId) where.tournamentId = query.tournamentId;

  if (query.action) {
    if (Array.isArray(query.action)) {
      where.action = { in: query.action };
    } else {
      where.action = query.action;
    }
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = query.startDate;
    if (query.endDate) where.createdAt.lte = query.endDate;
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query.limit || 100,
    skip: query.offset || 0,
  });

  return logs as AuditLogEntry[];
}

/**
 * Get audit logs for a specific tournament
 * 
 * @param tournamentId - Tournament ID
 * @param options - Additional query options
 * @returns Array of audit log entries
 */
export async function getTournamentAuditLogs(
  tournamentId: string,
  options?: { limit?: number; offset?: number }
): Promise<AuditLogEntry[]> {
  return queryAuditLogs({
    tournamentId,
    limit: options?.limit || 100,
    offset: options?.offset || 0,
  });
}

/**
 * Get audit logs for a specific match
 * 
 * @param matchId - Match ID
 * @param options - Additional query options
 * @returns Array of audit log entries
 */
export async function getMatchAuditLogs(
  matchId: string,
  options?: { limit?: number; offset?: number }
): Promise<AuditLogEntry[]> {
  return queryAuditLogs({
    targetType: 'match',
    targetId: matchId,
    limit: options?.limit || 50,
    offset: options?.offset || 0,
  });
}

/**
 * Get audit logs for a specific user (actor)
 * 
 * @param userId - User ID
 * @param options - Additional query options
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
  userId: string,
  options?: { limit?: number; offset?: number; sport?: SportType }
): Promise<AuditLogEntry[]> {
  return queryAuditLogs({
    actorId: userId,
    sport: options?.sport,
    limit: options?.limit || 100,
    offset: options?.offset || 0,
  });
}

/**
 * Get audit statistics for a sport
 * 
 * @param sport - Sport type
 * @param days - Number of days to look back
 * @returns Audit statistics
 */
export async function getAuditStats(sport: SportType, days: number = 30): Promise<AuditStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total count
  const totalLogs = await db.auditLog.count({
    where: { sport, createdAt: { gte: startDate } },
  });

  // Get count by action
  const byActionRaw = await db.auditLog.groupBy({
    by: ['action'],
    where: { sport, createdAt: { gte: startDate } },
    _count: true,
  });
  const byAction: Record<string, number> = {};
  byActionRaw.forEach((item) => {
    byAction[item.action] = item._count;
  });

  // Get count by target type
  const byTargetTypeRaw = await db.auditLog.groupBy({
    by: ['targetType'],
    where: { sport, createdAt: { gte: startDate } },
    _count: true,
  });
  const byTargetType: Record<string, number> = {};
  byTargetTypeRaw.forEach((item) => {
    byTargetType[item.targetType] = item._count;
  });

  // Get recent activity by day
  const recentActivityRaw = await db.$queryRaw<Array<{ date: string; action: string; count: bigint }>>`
    SELECT 
      DATE(createdAt) as date,
      action,
      COUNT(*) as count
    FROM AuditLog
    WHERE sport = ${sport}
      AND createdAt >= ${startDate}
    GROUP BY DATE(createdAt), action
    ORDER BY date DESC
    LIMIT 100
  `;

  const recentActivity = recentActivityRaw.map((item) => ({
    date: item.date,
    action: item.action,
    count: Number(item.count),
  }));

  return {
    totalLogs,
    byAction,
    byTargetType,
    recentActivity,
  };
}

// ============================================
// REQUEST HELPERS
// ============================================

/**
 * Extract IP address from a request
 * Handles various proxy headers and fallbacks
 * 
 * @param request - Next.js request object
 * @returns IP address string or null
 */
export function extractIpAddress(request: NextRequest): string | null {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For may contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Check for client IP in various headers
  const clientIp = request.headers.get('x-client-ip');
  if (clientIp) {
    return clientIp.trim();
  }

  return null;
}

/**
 * Extract user agent from a request
 * 
 * @param request - Next.js request object
 * @returns User agent string or null
 */
export function extractUserAgent(request: NextRequest): string | null {
  return request.headers.get('user-agent');
}

/**
 * Create a log action params object from a request
 * Convenience function for API routes
 * 
 * @param request - Next.js request object
 * @param baseParams - Base parameters for the log entry
 * @returns Complete LogActionParams
 */
export function createLogParamsFromRequest(
  request: NextRequest,
  baseParams: Omit<LogActionParams, 'ipAddress' | 'userAgent'>
): LogActionParams {
  return {
    ...baseParams,
    ipAddress: extractIpAddress(request) || undefined,
    userAgent: extractUserAgent(request) || undefined,
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Log multiple actions in a batch
 * Useful for bulk operations like bracket generation
 * 
 * @param actions - Array of LogActionParams
 * @returns Number of successfully logged actions
 */
export async function logBatchActions(actions: LogActionParams[]): Promise<number> {
  let successCount = 0;

  // Process in batches of 10 to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < actions.length; i += batchSize) {
    const batch = actions.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((params) => logAction(params))
    );
    
    successCount += results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;
  }

  return successCount;
}

/**
 * Export audit logs to JSON format
 * Useful for compliance reporting
 * 
 * @param query - Query parameters
 * @returns JSON string of audit logs
 */
export async function exportAuditLogsJson(query: AuditLogQuery): Promise<string> {
  const logs = await queryAuditLogs({
    ...query,
    limit: query.limit || 1000,
  });

  // Enrich with actor information
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      const actor = await db.user.findUnique({
        where: { id: log.actorId },
        select: { firstName: true, lastName: true, email: true },
      });

      return {
        ...log,
        actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Unknown',
        actorEmail: actor?.email || 'Unknown',
      };
    })
  );

  return JSON.stringify(enrichedLogs, null, 2);
}

// Re-export types
export type { AuditAction, SportType, Role };
