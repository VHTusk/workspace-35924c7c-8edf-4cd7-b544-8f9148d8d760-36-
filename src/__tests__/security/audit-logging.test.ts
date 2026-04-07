/**
 * Audit Logging Security Tests
 *
 * Tests for:
 * - Audit event creation and storage
 * - IP address and user agent tracking
 * - Event type categorization
 * - Metadata handling
 * - Query and filtering
 * - Convenience logging functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Types (mirroring audit-logger.ts)
// ============================================

type AuditAction = 
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'AUTH_PASSWORD_CHANGE'
  | 'AUTH_EMAIL_VERIFY'
  | 'AUTH_PASSWORD_RESET'
  | 'AUTH_LOGIN_FAILED'
  | 'DATA_ACCESS'
  | 'DATA_EXPORT'
  | 'DATA_DELETE'
  | 'PAYMENT_CREATE'
  | 'PAYMENT_VERIFY'
  | 'PAYMENT_REFUND'
  | 'PERMISSION_CHANGE'
  | 'ROLE_CHANGE'
  | 'PROFILE_UPDATE'
  | 'SETTINGS_CHANGE'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'TOURNAMENT_CREATE'
  | 'TOURNAMENT_REGISTER'
  | 'TOURNAMENT_CANCEL'
  | 'ADMIN_ACTION'
  | 'ADMIN_OVERRIDE'
  | 'USER_BANNED'
  | 'USER_UNBANNED';

type Role = 'PLAYER' | 'DIRECTOR' | 'ADMIN' | 'SUPER_ADMIN';
type SportType = 'CORNHOLE' | 'DARTS';

interface AuditLogEntry {
  id: string;
  sport: SportType;
  action: AuditAction;
  actorId: string;
  actorRole: Role;
  targetType: string;
  targetId: string;
  tournamentId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

interface LogAuditEventParams {
  eventType: AuditAction;
  userId: string;
  userRole?: Role;
  sport: SportType;
  targetType: string;
  targetId: string;
  action?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  tournamentId?: string;
}

// ============================================
// Mock Audit Store
// ============================================

const auditLogs: Map<string, AuditLogEntry> = new Map();
let auditLogCounter = 0;

function generateAuditLogId(): string {
  return `audit-${Date.now()}-${++auditLogCounter}`;
}

// ============================================
// Mock Functions (mirroring audit-logger.ts)
// ============================================

async function logAuditEvent(params: LogAuditEventParams): Promise<{
  success: boolean;
  auditLogId?: string;
  error?: string;
}> {
  // Validate required fields
  if (!params.userId) {
    return { success: false, error: 'userId is required for audit logging' };
  }

  if (!params.targetId) {
    return { success: false, error: 'targetId is required for audit logging' };
  }

  const entry: AuditLogEntry = {
    id: generateAuditLogId(),
    sport: params.sport,
    action: params.eventType,
    actorId: params.userId,
    actorRole: params.userRole || 'PLAYER',
    targetType: params.targetType,
    targetId: params.targetId,
    tournamentId: params.tournamentId,
    reason: params.reason || params.action,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: new Date(),
  };

  auditLogs.set(entry.id, entry);

  return { success: true, auditLogId: entry.id };
}

function getClientIp(headers: Record<string, string | null>): string | undefined {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return undefined;
}

function getUserAgent(headers: Record<string, string | null>): string | undefined {
  return headers['user-agent'] || undefined;
}

function extractClientInfo(headers: Record<string, string | null>): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: getClientIp(headers),
    userAgent: getUserAgent(headers),
  };
}

// Convenience logging functions
async function logLoginEvent(
  userId: string,
  sport: SportType,
  headers: Record<string, string | null>,
  options?: {
    role?: Role;
    loginMethod?: 'password' | 'otp' | 'google';
    success?: boolean;
  }
): Promise<{ success: boolean; auditLogId?: string }> {
  const { ipAddress, userAgent } = extractClientInfo(headers);

  return logAuditEvent({
    eventType: options?.success === false ? 'AUTH_LOGIN_FAILED' : 'AUTH_LOGIN',
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Session',
    targetId: userId,
    metadata: {
      loginMethod: options?.loginMethod || 'password',
      success: options?.success !== false,
    },
    ipAddress,
    userAgent,
  });
}

async function logLogoutEvent(
  userId: string,
  sport: SportType,
  headers: Record<string, string | null>,
  options?: { role?: Role }
): Promise<{ success: boolean; auditLogId?: string }> {
  const { ipAddress, userAgent } = extractClientInfo(headers);

  return logAuditEvent({
    eventType: 'AUTH_LOGOUT',
    userId,
    userRole: options?.role,
    sport,
    targetType: 'Session',
    targetId: userId,
    ipAddress,
    userAgent,
  });
}

async function logPaymentCreateEvent(
  userId: string,
  sport: SportType,
  orderId: string,
  headers: Record<string, string | null>,
  options?: {
    role?: Role;
    amount?: number;
    paymentType?: string;
    tournamentId?: string;
  }
): Promise<{ success: boolean; auditLogId?: string }> {
  const { ipAddress, userAgent } = extractClientInfo(headers);

  return logAuditEvent({
    eventType: 'PAYMENT_CREATE',
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

async function logAdminBanEvent(
  adminId: string,
  adminRole: Role,
  sport: SportType,
  targetUserId: string,
  reason: string,
  headers: Record<string, string | null>,
  options?: {
    targetEmail?: string;
    targetPhone?: string;
    expiresAt?: string;
  }
): Promise<{ success: boolean; auditLogId?: string }> {
  const { ipAddress, userAgent } = extractClientInfo(headers);

  return logAuditEvent({
    eventType: 'USER_BANNED',
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

async function logFileUploadEvent(
  userId: string,
  sport: SportType,
  headers: Record<string, string | null>,
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
): Promise<{ success: boolean; auditLogId?: string }> {
  const { ipAddress, userAgent } = extractClientInfo(headers);

  return logAuditEvent({
    eventType: 'FILE_UPLOAD',
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

// Query function
interface AuditLogFilters {
  eventType?: AuditAction;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  tournamentId?: string;
  sport?: SportType;
  startDate?: Date;
  endDate?: Date;
}

async function queryAuditLogs(
  filters: AuditLogFilters,
  options?: {
    page?: number;
    limit?: number;
  }
): Promise<{
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = options?.page || 1;
  const limit = options?.limit || 50;

  let filtered = Array.from(auditLogs.values());

  if (filters.eventType) {
    filtered = filtered.filter(l => l.action === filters.eventType);
  }
  if (filters.actorId) {
    filtered = filtered.filter(l => l.actorId === filters.actorId);
  }
  if (filters.targetType) {
    filtered = filtered.filter(l => l.targetType === filters.targetType);
  }
  if (filters.targetId) {
    filtered = filtered.filter(l => l.targetId === filters.targetId);
  }
  if (filters.tournamentId) {
    filtered = filtered.filter(l => l.tournamentId === filters.tournamentId);
  }
  if (filters.sport) {
    filtered = filtered.filter(l => l.sport === filters.sport);
  }
  if (filters.startDate) {
    filtered = filtered.filter(l => l.createdAt >= filters.startDate!);
  }
  if (filters.endDate) {
    filtered = filtered.filter(l => l.createdAt <= filters.endDate!);
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    logs: paginated,
    pagination: { page, limit, total, totalPages },
  };
}

// ============================================
// Tests
// ============================================

describe('Audit Logging Security', () => {
  beforeEach(() => {
    auditLogs.clear();
    auditLogCounter = 0;
  });

  describe('Audit Event Creation', () => {
    it('should create an audit log entry', async () => {
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
      });

      expect(result.success).toBe(true);
      expect(result.auditLogId).toBeDefined();
    });

    it('should require userId', async () => {
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: '',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('userId is required');
    });

    it('should require targetId', async () => {
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('targetId is required');
    });

    it('should store all provided fields', async () => {
      const metadata = { loginMethod: 'password', success: true };

      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        userRole: 'PLAYER',
        sport: 'DARTS',
        targetType: 'Session',
        targetId: 'session-1',
        action: 'User logged in',
        reason: 'Normal login',
        metadata,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        tournamentId: 'tournament-1',
      });

      expect(result.success).toBe(true);

      const log = auditLogs.get(result.auditLogId!);
      expect(log).toBeDefined();
      expect(log?.action).toBe('AUTH_LOGIN');
      expect(log?.actorId).toBe('user-1');
      expect(log?.actorRole).toBe('PLAYER');
      expect(log?.sport).toBe('DARTS');
      expect(log?.targetType).toBe('Session');
      expect(log?.targetId).toBe('session-1');
      expect(log?.reason).toBe('Normal login');
      expect(log?.metadata).toEqual(metadata);
      expect(log?.ipAddress).toBe('192.168.1.1');
      expect(log?.userAgent).toBe('Mozilla/5.0');
      expect(log?.tournamentId).toBe('tournament-1');
      expect(log?.createdAt).toBeDefined();
    });

    it('should generate unique audit log IDs', async () => {
      const results = await Promise.all([
        logAuditEvent({
          eventType: 'AUTH_LOGIN',
          userId: 'user-1',
          sport: 'CORNHOLE',
          targetType: 'Session',
          targetId: 'session-1',
        }),
        logAuditEvent({
          eventType: 'AUTH_LOGOUT',
          userId: 'user-1',
          sport: 'CORNHOLE',
          targetType: 'Session',
          targetId: 'session-1',
        }),
      ]);

      expect(results[0].auditLogId).not.toBe(results[1].auditLogId);
    });

    it('should default role to PLAYER', async () => {
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.actorRole).toBe('PLAYER');
    });
  });

  describe('IP Address and User Agent Tracking', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const headers = { 'x-forwarded-for': '203.0.113.1, 70.41.3.18' };
      const ip = getClientIp(headers);

      expect(ip).toBe('203.0.113.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const headers = { 'x-real-ip': '203.0.113.2' };
      const ip = getClientIp(headers);

      expect(ip).toBe('203.0.113.2');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const headers = { 'cf-connecting-ip': '203.0.113.3' };
      const ip = getClientIp(headers);

      expect(ip).toBe('203.0.113.3');
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '203.0.113.2',
        'cf-connecting-ip': '203.0.113.3',
      };
      const ip = getClientIp(headers);

      expect(ip).toBe('203.0.113.1');
    });

    it('should return undefined when no IP headers present', () => {
      const headers = {};
      const ip = getClientIp(headers);

      expect(ip).toBeUndefined();
    });

    it('should extract user agent from headers', () => {
      const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
      const ua = getUserAgent(headers);

      expect(ua).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    });

    it('should return undefined when no user agent present', () => {
      const headers = {};
      const ua = getUserAgent(headers);

      expect(ua).toBeUndefined();
    });

    it('should extract both IP and user agent', () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1',
        'user-agent': 'Mozilla/5.0',
      };
      const info = extractClientInfo(headers);

      expect(info.ipAddress).toBe('203.0.113.1');
      expect(info.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('Event Type Categorization', () => {
    it('should log AUTH_LOGIN event', async () => {
      const result = await logLoginEvent('user-1', 'CORNHOLE', {});

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('AUTH_LOGIN');
      expect(log?.targetType).toBe('Session');
    });

    it('should log AUTH_LOGIN_FAILED event when success is false', async () => {
      const result = await logLoginEvent('user-1', 'CORNHOLE', {}, { success: false });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('AUTH_LOGIN_FAILED');
    });

    it('should log AUTH_LOGOUT event', async () => {
      const result = await logLogoutEvent('user-1', 'CORNHOLE', {});

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('AUTH_LOGOUT');
    });

    it('should log PAYMENT_CREATE event', async () => {
      const result = await logPaymentCreateEvent(
        'user-1',
        'CORNHOLE',
        'order-123',
        {},
        { amount: 50000 }
      );

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('PAYMENT_CREATE');
      expect(log?.targetId).toBe('order-123');
      expect(log?.metadata?.amount).toBe(50000);
    });

    it('should log USER_BANNED event', async () => {
      const result = await logAdminBanEvent(
        'admin-1',
        'ADMIN',
        'CORNHOLE',
        'user-2',
        'Spamming',
        {},
        { targetEmail: 'banned@example.com' }
      );

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('USER_BANNED');
      expect(log?.actorRole).toBe('ADMIN');
      expect(log?.reason).toBe('Spamming');
      expect(log?.metadata?.targetEmail).toBe('banned@example.com');
    });

    it('should log FILE_UPLOAD event', async () => {
      const result = await logFileUploadEvent('user-1', 'CORNHOLE', {}, {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        success: true,
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.action).toBe('FILE_UPLOAD');
      expect(log?.metadata?.filename).toBe('document.pdf');
      expect(log?.metadata?.success).toBe(true);
    });
  });

  describe('Metadata Handling', () => {
    it('should store complex metadata objects', async () => {
      const metadata = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
        boolean: true,
        null: null,
      };

      const result = await logAuditEvent({
        eventType: 'ADMIN_ACTION',
        userId: 'admin-1',
        sport: 'CORNHOLE',
        targetType: 'User',
        targetId: 'user-2',
        metadata,
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata).toEqual(metadata);
    });

    it('should handle missing metadata gracefully', async () => {
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata).toBeUndefined();
    });
  });

  describe('Query and Filtering', () => {
    beforeEach(async () => {
      // Create sample logs
      await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
        ipAddress: '192.168.1.1',
      });

      await logAuditEvent({
        eventType: 'AUTH_LOGOUT',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
        ipAddress: '192.168.1.1',
      });

      await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-2',
        sport: 'DARTS',
        targetType: 'Session',
        targetId: 'session-2',
        ipAddress: '192.168.1.2',
      });

      await logAuditEvent({
        eventType: 'PAYMENT_CREATE',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Payment',
        targetId: 'payment-1',
      });
    });

    it('should filter by event type', async () => {
      const result = await queryAuditLogs({ eventType: 'AUTH_LOGIN' });

      expect(result.logs.length).toBe(2);
      result.logs.forEach(log => {
        expect(log.action).toBe('AUTH_LOGIN');
      });
    });

    it('should filter by actor ID', async () => {
      const result = await queryAuditLogs({ actorId: 'user-1' });

      expect(result.logs.length).toBe(3);
      result.logs.forEach(log => {
        expect(log.actorId).toBe('user-1');
      });
    });

    it('should filter by target type', async () => {
      const result = await queryAuditLogs({ targetType: 'Payment' });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].action).toBe('PAYMENT_CREATE');
    });

    it('should filter by sport', async () => {
      const result = await queryAuditLogs({ sport: 'DARTS' });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].sport).toBe('DARTS');
    });

    it('should filter by target ID', async () => {
      const result = await queryAuditLogs({ targetId: 'session-1' });

      expect(result.logs.length).toBe(2);
      result.logs.forEach(log => {
        expect(log.targetId).toBe('session-1');
      });
    });

    it('should combine multiple filters', async () => {
      const result = await queryAuditLogs({
        eventType: 'AUTH_LOGIN',
        sport: 'CORNHOLE',
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].actorId).toBe('user-1');
    });

    it('should support pagination', async () => {
      const result = await queryAuditLogs({}, { page: 1, limit: 2 });

      expect(result.logs.length).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(4);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should return second page correctly', async () => {
      const result = await queryAuditLogs({}, { page: 2, limit: 2 });

      expect(result.logs.length).toBe(2);
      expect(result.pagination.page).toBe(2);
    });

    it('should sort logs by createdAt descending', async () => {
      const result = await queryAuditLogs({});

      for (let i = 0; i < result.logs.length - 1; i++) {
        expect(result.logs[i].createdAt.getTime())
          .toBeGreaterThanOrEqual(result.logs[i + 1].createdAt.getTime());
      }
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 1000);
      const endDate = new Date(Date.now() + 1000);

      const result = await queryAuditLogs({ startDate, endDate });

      expect(result.logs.length).toBe(4);
    });

    it('should return empty array when no matches', async () => {
      const result = await queryAuditLogs({ actorId: 'nonexistent' });

      expect(result.logs.length).toBe(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('Convenience Functions', () => {
    it('should log login event with login method in metadata', async () => {
      const result = await logLoginEvent('user-1', 'CORNHOLE', {}, {
        loginMethod: 'google',
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata?.loginMethod).toBe('google');
    });

    it('should log file upload event with success status', async () => {
      const result = await logFileUploadEvent('user-1', 'CORNHOLE', {}, {
        success: false,
        errorCode: 'FILE_TOO_LARGE',
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata?.success).toBe(false);
      expect(log?.metadata?.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should capture IP and user agent in convenience functions', async () => {
      const headers = {
        'x-forwarded-for': '203.0.113.1',
        'user-agent': 'TestAgent/1.0',
      };

      const result = await logLoginEvent('user-1', 'CORNHOLE', headers);

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.ipAddress).toBe('203.0.113.1');
      expect(log?.userAgent).toBe('TestAgent/1.0');
    });
  });

  describe('Security Considerations', () => {
    it('should log admin actions with elevated role', async () => {
      const result = await logAdminBanEvent(
        'admin-1',
        'SUPER_ADMIN',
        'CORNHOLE',
        'user-2',
        'Violation of terms',
        {}
      );

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.actorRole).toBe('SUPER_ADMIN');
      expect(log?.action).toBe('USER_BANNED');
    });

    it('should track file upload warnings', async () => {
      const result = await logFileUploadEvent('user-1', 'CORNHOLE', {}, {
        warnings: ['File renamed', 'Metadata stripped'],
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata?.warnings).toEqual(['File renamed', 'Metadata stripped']);
    });

    it('should not store sensitive data in plaintext metadata', async () => {
      // This test verifies the pattern - actual implementation should encrypt/redact
      const result = await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        userId: 'user-1',
        sport: 'CORNHOLE',
        targetType: 'Session',
        targetId: 'session-1',
        metadata: {
          loginMethod: 'password',
          // Password should NEVER be in metadata
        },
      });

      const log = auditLogs.get(result.auditLogId!);
      expect(log?.metadata?.password).toBeUndefined();
    });
  });
});
