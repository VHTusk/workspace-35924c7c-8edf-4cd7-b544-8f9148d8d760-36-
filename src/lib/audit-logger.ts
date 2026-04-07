/**
 * VALORHIVE Audit Logger Module
 * 
 * Comprehensive audit logging system for tracking sensitive operations.
 * Provides detailed trails for security compliance and forensic analysis.
 * 
 * Features:
 * - Event type categorization (Auth, Data, Payment, Admin, etc.)
 * - Rich metadata capture
 * - IP and user agent tracking
 * - Integration with existing AuditLog model
 * 
 * @module audit-logger
 */

import { db } from '@/lib/db';
import { AuditAction, Role, SportType } from '@prisma/client';
import logger, { createLogger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

const log = createLogger('audit-logger');

// ============================================
// EVENT TYPE DEFINITIONS
// ============================================

/**
 * Audit Event Types - Maps to AuditAction enum in Prisma
 * Categorized for easier filtering and analysis
 */
export const AuditEventType = {
  // Authentication Events
  AUTH_LOGIN: AuditAction.AUTH_LOGIN,
  AUTH_LOGOUT: AuditAction.AUTH_LOGOUT,
  AUTH_REGISTER: AuditAction.AUTH_REGISTER,
  AUTH_PASSWORD_CHANGE: AuditAction.AUTH_PASSWORD_CHANGE,
  AUTH_EMAIL_VERIFY: AuditAction.AUTH_EMAIL_VERIFY,
  AUTH_PASSWORD_RESET: AuditAction.AUTH_PASSWORD_RESET,
  AUTH_LOGIN_FAILED: AuditAction.AUTH_LOGIN_FAILED,
  
  // Data Operations
  DATA_ACCESS: AuditAction.DATA_ACCESS,
  DATA_EXPORT: AuditAction.DATA_EXPORT,
  DATA_DELETE: AuditAction.DATA_DELETE,
  
  // Payment Events
  PAYMENT_CREATE: AuditAction.PAYMENT_CREATE,
  PAYMENT_VERIFY: AuditAction.PAYMENT_VERIFY,
  PAYMENT_REFUND: AuditAction.PAYMENT_REFUND,
  
  // Permission/Role Changes
  PERMISSION_CHANGE: AuditAction.PERMISSION_CHANGE,
  ROLE_CHANGE: AuditAction.ROLE_CHANGE,
  
  // Profile/Settings
  PROFILE_UPDATE: AuditAction.PROFILE_UPDATE,
  SETTINGS_CHANGE: AuditAction.SETTINGS_CHANGE,
  
  // File Operations
  FILE_UPLOAD: AuditAction.FILE_UPLOAD,
  FILE_DOWNLOAD: AuditAction.FILE_DOWNLOAD,
  FILE_DELETE: AuditAction.FILE_DELETE,
  
  // Tournament Events
  TOURNAMENT_CREATE: AuditAction.TOURNAMENT_CREATE,
  TOURNAMENT_REGISTER: AuditAction.TOURNAMENT_REGISTER,
  TOURNAMENT_CANCEL: AuditAction.TOURNAMENT_CANCEL,
  
  // Admin Actions
  ADMIN_ACTION: AuditAction.ADMIN_ACTION,
  ADMIN_OVERRIDE: AuditAction.ADMIN_OVERRIDE,
  
  // Match/Bracket Events
  MATCH_RESULT_ENTERED: AuditAction.MATCH_RESULT_ENTERED,
  MATCH_RESULT_EDITED: AuditAction.MATCH_RESULT_EDITED,
  MATCH_RESULT_REVERTED: AuditAction.MATCH_RESULT_REVERTED,
  BRACKET_GENERATED: AuditAction.BRACKET_GENERATED,
  BRACKET_DELETED: AuditAction.BRACKET_DELETED,
  BRACKET_RESET: AuditAction.BRACKET_RESET,
  TOURNAMENT_COMPLETED: AuditAction.TOURNAMENT_COMPLETED,
  PRIZE_PAYOUT_RECORDED: AuditAction.PRIZE_PAYOUT_RECORDED,
  DISPUTE_RESOLVED: AuditAction.DISPUTE_RESOLVED,
  
  // User Management
  USER_BANNED: AuditAction.USER_BANNED,
  USER_UNBANNED: AuditAction.USER_UNBANNED,
} as const;

// Type alias for event types
export type AuditEventTypeValue = typeof AuditEventType[keyof typeof AuditEventType];

// ============================================
// INTERFACES
// ============================================

/**
 * Parameters for logging an audit event
 */
export interface LogAuditEventParams {
  /** The type of audit event */
  eventType: AuditEventTypeValue;
  
  /** ID of the user performing the action */
  userId: string;
  
  /** Role of the user performing the action */
  userRole?: Role;
  
  /** Sport context */
  sport: SportType;
  
  /** Type of target entity (User, Tournament, Payment, etc.) */
  targetType: string;
  
  /** ID of the target entity */
  targetId: string;
  
  /** Human-readable description of the action */
  action?: string;
  
  /** Reason for the action (for admin actions, bans, etc.) */
  reason?: string;
  
  /** Additional metadata as key-value pairs */
  metadata?: Record<string, unknown>;
  
  /** IP address of the client */
  ipAddress?: string;
  
  /** User agent string of the client */
  userAgent?: string;
  
  /** Tournament ID if action is related to a tournament */
  tournamentId?: string;
  
  /** Organization operator name (for org admin actions) */
  operatorName?: string;
  
  /** Organization operator email (for org admin actions) */
  operatorEmail?: string;
}

/**
 * Result of logging an audit event
 */
export interface LogAuditEventResult {
  success: boolean;
  auditLogId?: string;
  error?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Check common headers used by proxies and load balancers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For may contain multiple IPs, first is the client
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  
  return undefined;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Extract client info from a NextRequest object
 */
export function extractClientInfo(request: NextRequest): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  };
}

// ============================================
// MAIN LOGGING FUNCTION
// ============================================

/**
 * Log an audit event to the database
 * 
 * @param params - Audit event parameters
 * @returns Result object with success status and audit log ID
 * 
 * @example
 * ```typescript
 * await logAuditEvent({
 *   eventType: AuditEventType.AUTH_LOGIN,
 *   userId: user.id,
 *   userRole: user.role,
 *   sport: user.sport,
 *   targetType: 'Session',
 *   targetId: session.id,
 *   metadata: { loginMethod: 'password' },
 *   ipAddress: getClientIp(request),
 *   userAgent: getUserAgent(request),
 * });
 * ```
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<LogAuditEventResult> {
  const {
    eventType,
    userId,
    userRole = 'PLAYER',
    sport,
    targetType,
    targetId,
    action,
    reason,
    metadata,
    ipAddress,
    userAgent,
    tournamentId,
    operatorName,
    operatorEmail,
  } = params;

  // Validate required fields
  if (!userId) {
    const error = 'userId is required for audit logging';
    log.error(error, { eventType, targetType, targetId });
    return { success: false, error };
  }

  if (!targetId) {
    const error = 'targetId is required for audit logging';
    log.error(error, { eventType, userId, targetType });
    return { success: false, error };
  }

  // Prepare metadata string
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  // Log to application logs for debugging
  log.info('Audit event logged', {
    eventType,
    userId,
    targetType,
    targetId,
    action,
    tournamentId,
  });

  // Write to database
  const auditLog = await db.auditLog.create({
    data: {
      sport,
      action: eventType,
      actorId: userId,
      actorRole: userRole,
      targetType,
      targetId,
      tournamentId,
      operatorName,
      operatorEmail,
      reason: reason || action || null,
      metadata: metadataStr,
      ipAddress,
      userAgent,
    },
  });

  return {
    success: true,
    auditLogId: auditLog.id,
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Log a login event
 */
export async function logLoginEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    loginMethod?: 'password' | 'otp' | 'google';
    success?: boolean;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: options?.success === false ? AuditEventType.AUTH_LOGIN_FAILED : AuditEventType.AUTH_LOGIN,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Session',
    targetId: userId, // Use userId as target for login events
    metadata: {
      loginMethod: options?.loginMethod || 'password',
      success: options?.success !== false,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a logout event
 */
export async function logLogoutEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: { role?: Role }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.AUTH_LOGOUT,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Session',
    targetId: userId,
    ipAddress,
    userAgent,
  });
}

/**
 * Log a registration event
 */
export async function logRegisterEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    email?: string;
    phone?: string;
    referralCode?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.AUTH_REGISTER,
    userId,
    userRole: options?.role || 'PLAYER',
    sport,
    targetType: 'User',
    targetId: userId,
    metadata: {
      email: options?.email,
      phone: options?.phone,
      referralCode: options?.referralCode,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a password change event
 */
export async function logPasswordChangeEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: { role?: Role }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.AUTH_PASSWORD_CHANGE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'User',
    targetId: userId,
    action: 'Password changed',
    ipAddress,
    userAgent,
  });
}

/**
 * Log a payment creation event
 */
export async function logPaymentCreateEvent(
  userId: string,
  sport: SportType,
  orderId: string,
  request: NextRequest,
  options?: {
    role?: Role;
    amount?: number;
    paymentType?: string;
    tournamentId?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.PAYMENT_CREATE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Payment',
    targetId: orderId,
    tournamentId: options?.tournamentId,
    metadata: {
      amount: options?.amount,
      paymentType: options?.paymentType,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a payment verification event
 */
export async function logPaymentVerifyEvent(
  userId: string,
  sport: SportType,
  paymentId: string,
  request: NextRequest,
  options?: {
    role?: Role;
    amount?: number;
    paymentType?: string;
    tournamentId?: string;
    success?: boolean;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.PAYMENT_VERIFY,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Payment',
    targetId: paymentId,
    tournamentId: options?.tournamentId,
    metadata: {
      amount: options?.amount,
      paymentType: options?.paymentType,
      success: options?.success !== false,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log an admin ban event
 */
export async function logAdminBanEvent(
  adminId: string,
  adminRole: Role,
  sport: SportType,
  targetUserId: string,
  reason: string,
  request: NextRequest,
  options?: {
    targetEmail?: string;
    targetPhone?: string;
    expiresAt?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.USER_BANNED,
    userId: adminId,
    userRole: adminRole,
    sport,
    targetType: 'User',
    targetId: targetUserId,
    reason,
    metadata: {
      targetEmail: options?.targetEmail,
      targetPhone: options?.targetPhone,
      expiresAt: options?.expiresAt,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log an admin unban event
 */
export async function logAdminUnbanEvent(
  adminId: string,
  adminRole: Role,
  sport: SportType,
  targetUserId: string,
  request: NextRequest,
  options?: {
    targetEmail?: string;
    reason?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.USER_UNBANNED,
    userId: adminId,
    userRole: adminRole,
    sport,
    targetType: 'User',
    targetId: targetUserId,
    reason: options?.reason,
    metadata: {
      targetEmail: options?.targetEmail,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log an admin override event
 */
export async function logAdminOverrideEvent(
  adminId: string,
  adminRole: Role,
  sport: SportType,
  targetType: string,
  targetId: string,
  action: string,
  request: NextRequest,
  options?: {
    reason?: string;
    tournamentId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.ADMIN_OVERRIDE,
    userId: adminId,
    userRole: adminRole,
    sport,
    targetType,
    targetId,
    action,
    reason: options?.reason,
    tournamentId: options?.tournamentId,
    metadata: options?.metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Log a tournament creation event
 */
export async function logTournamentCreateEvent(
  userId: string,
  sport: SportType,
  tournamentId: string,
  request: NextRequest,
  options?: {
    role?: Role;
    tournamentName?: string;
    orgId?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.TOURNAMENT_CREATE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Tournament',
    targetId: tournamentId,
    tournamentId,
    metadata: {
      tournamentName: options?.tournamentName,
      orgId: options?.orgId,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a tournament registration event
 */
export async function logTournamentRegisterEvent(
  userId: string,
  sport: SportType,
  tournamentId: string,
  registrationId: string,
  request: NextRequest,
  options?: {
    role?: Role;
    tournamentName?: string;
    amount?: number;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.TOURNAMENT_REGISTER,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'TournamentRegistration',
    targetId: registrationId,
    tournamentId,
    metadata: {
      tournamentName: options?.tournamentName,
      amount: options?.amount,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a profile update event
 */
export async function logProfileUpdateEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    updatedFields?: string[];
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.PROFILE_UPDATE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'User',
    targetId: userId,
    metadata: {
      updatedFields: options?.updatedFields,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a settings change event
 */
export async function logSettingsChangeEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    settingsType?: string;
    changes?: Record<string, unknown>;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.SETTINGS_CHANGE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Settings',
    targetId: userId,
    metadata: {
      settingsType: options?.settingsType,
      changes: options?.changes,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a file upload event
 */
export async function logFileUploadEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    filename?: string;
    mimeType?: string;
    fileSize?: number;
    purpose?: string;
    url?: string;
    success?: boolean;
    errorCode?: string;
    warnings?: string[];
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.FILE_UPLOAD,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'File',
    targetId: options?.url || 'upload',
    action: options?.success === false ? 'File upload failed' : 'File uploaded',
    reason: options?.errorCode,
    metadata: {
      filename: options?.filename,
      mimeType: options?.mimeType,
      fileSize: options?.fileSize,
      purpose: options?.purpose,
      success: options?.success !== false,
      errorCode: options?.errorCode,
      warnings: options?.warnings,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a file download event
 */
export async function logFileDownloadEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    filename?: string;
    url?: string;
    purpose?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.FILE_DOWNLOAD,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'File',
    targetId: options?.url || 'download',
    action: 'File downloaded',
    metadata: {
      filename: options?.filename,
      purpose: options?.purpose,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a file delete event
 */
export async function logFileDeleteEvent(
  userId: string,
  sport: SportType,
  request: NextRequest,
  options?: {
    role?: Role;
    filename?: string;
    url?: string;
    purpose?: string;
    reason?: string;
  }
): Promise<LogAuditEventResult> {
  const { ipAddress, userAgent } = extractClientInfo(request);
  
  return logAuditEvent({
    eventType: AuditEventType.FILE_DELETE,
    userId,
    userRole: options?.role,
    sport,
    targetType: 'File',
    targetId: options?.url || 'delete',
    action: 'File deleted',
    reason: options?.reason,
    metadata: {
      filename: options?.filename,
      purpose: options?.purpose,
    },
    ipAddress,
    userAgent,
  });
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  eventType?: AuditAction;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  tournamentId?: string;
  sport?: SportType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  filters: AuditLogFilters,
  options?: {
    page?: number;
    limit?: number;
  }
): Promise<{
  logs: Array<{
    id: string;
    sport: SportType;
    action: AuditAction;
    actorId: string;
    actorRole: Role;
    targetType: string;
    targetId: string;
    tournamentId: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    actor?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      role: Role;
    } | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};
  
  if (filters.eventType) where.action = filters.eventType;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  if (filters.tournamentId) where.tournamentId = filters.tournamentId;
  if (filters.sport) where.sport = filters.sport;
  
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) (where.createdAt as Record<string, Date>).gte = filters.startDate;
    if (filters.endDate) (where.createdAt as Record<string, Date>).lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
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
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      sport: log.sport,
      action: log.action,
      actorId: log.actorId,
      actorRole: log.actorRole,
      targetType: log.targetType,
      targetId: log.targetId,
      tournamentId: log.tournamentId,
      reason: log.reason,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      actor: log.actor,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Default export
export default {
  AuditEventType,
  logAuditEvent,
  logLoginEvent,
  logLogoutEvent,
  logRegisterEvent,
  logPasswordChangeEvent,
  logPaymentCreateEvent,
  logPaymentVerifyEvent,
  logAdminBanEvent,
  logAdminUnbanEvent,
  logAdminOverrideEvent,
  logTournamentCreateEvent,
  logTournamentRegisterEvent,
  logProfileUpdateEvent,
  logSettingsChangeEvent,
  logFileUploadEvent,
  logFileDownloadEvent,
  logFileDeleteEvent,
  queryAuditLogs,
  extractClientInfo,
  getClientIp,
  getUserAgent,
};
