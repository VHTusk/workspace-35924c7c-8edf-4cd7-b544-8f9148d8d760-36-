/**
 * VALORHIVE Secure Logger Module
 * 
 * Production-safe logging with automatic sensitive data redaction.
 * Uses Pino for high-performance structured logging.
 * 
 * Features:
 * - Automatic redaction of sensitive fields (passwords, tokens, OTP, etc.)
 * - Request logging with safe data extraction
 * - Structured logging for production (JSON)
 * - Pretty printing for development
 * - Tournament, match, payment, and auth-specific logging helpers
 * 
 * @module logger
 */

import pino from 'pino';
import type { NextRequest } from 'next/server';

// ============================================
// Sensitive Fields Configuration
// ============================================

/**
 * Fields that should NEVER be logged
 * These will be automatically redacted from all log outputs
 */
const SENSITIVE_FIELDS = [
  // Authentication
  'password',
  'passwordConfirm',
  'currentPassword',
  'newPassword',
  'hashedPassword',
  'token',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'authToken',
  'bearer',
  'authorization',
  
  // OTP & Verification
  'otp',
  'verificationCode',
  'emailVerifyToken',
  'phoneVerifyCode',
  'resetToken',
  'magicLink',
  
  // Session
  'session',
  'cookie',
  'cookies',
  'sessionId',
  
  // Personal Identifiable Information (PII)
  'aadhaarNumber',
  'panNumber',
  'idNumber',
  'bankAccount',
  'ifscCode',
  'creditCard',
  'cvv',
  
  // API Keys & Secrets
  'apiKey',
  'apiSecret',
  'secretKey',
  'privateKey',
  'webhookSecret',
  
  // Payment
  'cardNumber',
  'cvv',
  'expiryDate',
  
  // Hashes
  'identityHash',
  'hash',
  'salt',
];

/**
 * Fields that should be partially redacted (show last 4 chars)
 */
const PARTIAL_REDACT_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'mobile',
];

/**
 * Headers that should be redacted
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-session-token',
  'x-auth-token',
  'x-api-key',
];

// ============================================
// Redaction Functions
// ============================================

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => 
    lowerField === sensitive.toLowerCase() ||
    lowerField.includes(sensitive.toLowerCase())
  );
}

/**
 * Check if a field should be partially redacted
 */
function isPartialRedactField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return PARTIAL_REDACT_FIELDS.some(field => 
    lowerField === field.toLowerCase()
  );
}

/**
 * Redact a sensitive value
 */
function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  
  const keyLower = key.toLowerCase();
  
  // Full redaction for sensitive fields
  if (isSensitiveField(key)) {
    return '[REDACTED]';
  }
  
  // Partial redaction for PII
  if (isPartialRedactField(key) && typeof value === 'string') {
    if (value.includes('@')) {
      // Email: show first 2 chars and domain
      const [local, domain] = value.split('@');
      const visibleLocal = local.slice(0, 2);
      return `${visibleLocal}***@${domain}`;
    }
    // Phone: show last 4 digits
    return `***${value.slice(-4)}`;
  }
  
  return value;
}

/**
 * Recursively redact sensitive data from an object
 */
function redactObject(obj: unknown, depth: number = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }
  
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      redacted[key] = '[REDACTED]';
    } else if (isPartialRedactField(key) && typeof value === 'string') {
      redacted[key] = redactValue(key, value);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Redact headers from a request
 */
function redactHeaders(headers: Headers): Record<string, string> {
  const redacted: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  });
  return redacted;
}

// ============================================
// Logger Configuration
// ============================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Built-in redaction for paths (additional safety)
  redact: {
    paths: SENSITIVE_FIELDS.flatMap(field => [
      `req.headers.${field}`,
      `req.body.${field}`,
      `res.body.${field}`,
      `*.${field}`,
    ]),
    censor: '[REDACTED]',
  },
});

export default logger;

// ============================================
// Convenience Methods
// ============================================

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => {
    const redactedData = data ? redactObject(data) as Record<string, unknown> : undefined;
    logger.info(redactedData || {}, msg);
  },
  
  error: (msg: string, data?: Record<string, unknown>) => {
    const redactedData = data ? redactObject(data) as Record<string, unknown> : undefined;
    logger.error(redactedData || {}, msg);
  },
  
  warn: (msg: string, data?: Record<string, unknown>) => {
    const redactedData = data ? redactObject(data) as Record<string, unknown> : undefined;
    logger.warn(redactedData || {}, msg);
  },
  
  debug: (msg: string, data?: Record<string, unknown>) => {
    const redactedData = data ? redactObject(data) as Record<string, unknown> : undefined;
    logger.debug(redactedData || {}, msg);
  },

  // Request logging helper - SAFE
  request: (req: NextRequest, context?: Record<string, unknown>) => {
    const safeContext = context ? redactObject(context) as Record<string, unknown> : {};
    logger.info({
      method: req.method,
      url: req.url,
      path: req.nextUrl.pathname,
      // Don't log headers by default - they may contain sensitive data
      ...safeContext,
    }, 'API Request');
  },

  // Error with stack trace - SAFE
  errorWithStack: (msg: string, error: Error, data?: Record<string, unknown>) => {
    const redactedData = data ? redactObject(data) as Record<string, unknown> : {};
    logger.error({
      ...redactedData,
      stack: error.stack,
      errorName: error.name,
      // Error message should be safe (it's typically operational)
      errorMessage: error.message,
    }, msg);
  },
  
  // Safe body logging (redacts sensitive fields)
  safeBody: (msg: string, body: unknown) => {
    logger.info(redactObject(body), msg);
  },
};

// ============================================
// Tournament-Specific Logging Helpers
// ============================================

export const tournamentLog = {
  bracketGenerated: (tournamentId: string, playerCount: number, format: string) => {
    logger.info({
      tournamentId,
      playerCount,
      format,
      timestamp: new Date().toISOString(),
    }, 'Bracket generated');
  },

  registrationConfirmed: (tournamentId: string, userId: string, playerName: string) => {
    logger.info({
      tournamentId,
      userId,
      playerName,
      timestamp: new Date().toISOString(),
    }, 'Registration confirmed');
  },

  started: (tournamentId: string, name: string) => {
    logger.info({
      tournamentId,
      name,
      timestamp: new Date().toISOString(),
    }, 'Tournament started');
  },

  completed: (tournamentId: string, winnerId: string, totalMatches: number) => {
    logger.info({
      tournamentId,
      winnerId,
      totalMatches,
      timestamp: new Date().toISOString(),
    }, 'Tournament completed');
  },
};

// ============================================
// Match-Specific Logging Helpers
// ============================================

export const matchLog = {
  scored: (matchId: string, playerAId: string, playerBId: string, winnerId: string | null, scoreA: number, scoreB: number) => {
    logger.info({
      matchId,
      playerAId,
      playerBId,
      winnerId,
      scoreA,
      scoreB,
      timestamp: new Date().toISOString(),
    }, 'Match scored');
  },

  eloUpdated: (userId: string, oldElo: number, newElo: number, change: number) => {
    logger.debug({
      userId,
      oldElo,
      newElo,
      change,
      timestamp: new Date().toISOString(),
    }, 'ELO updated');
  },

  error: (matchId: string, error: Error, context?: Record<string, unknown>) => {
    const safeContext = context ? redactObject(context) as Record<string, unknown> : {};
    logger.error({
      matchId,
      ...safeContext,
      stack: error.stack,
      errorName: error.name,
      errorMessage: error.message,
    }, 'Match error');
  },
};

// ============================================
// Payment-Specific Logging Helpers
// ============================================

export const paymentLog = {
  webhookReceived: (eventType: string, paymentId: string, amount: number) => {
    logger.info({
      eventType,
      paymentId,
      amount,
      timestamp: new Date().toISOString(),
    }, 'Payment webhook received');
  },

  success: (orderId: string, paymentId: string, amount: number) => {
    logger.info({
      orderId,
      paymentId,
      amount,
      timestamp: new Date().toISOString(),
    }, 'Payment successful');
  },

  failed: (orderId: string, reason: string, amount?: number) => {
    logger.error({
      orderId,
      reason,
      amount,
      timestamp: new Date().toISOString(),
    }, 'Payment failed');
  },

  refundInitiated: (paymentId: string, amount: number, reason: string) => {
    logger.info({
      paymentId,
      amount,
      reason,
      timestamp: new Date().toISOString(),
    }, 'Refund initiated');
  },
};

// ============================================
// Auth-Specific Logging Helpers (SAFE)
// ============================================

export const authLog = {
  loginAttempt: (email: string | undefined, phone: string | undefined, ip: string | undefined) => {
    logger.info({
      // Only log redacted identifiers
      email: email ? redactValue('email', email) : undefined,
      phone: phone ? redactValue('phone', phone) : undefined,
      ip,
      timestamp: new Date().toISOString(),
    }, 'Login attempt');
  },

  loginSuccess: (userId: string, userType: 'player' | 'org') => {
    logger.info({
      userId,
      userType,
      timestamp: new Date().toISOString(),
    }, 'Login successful');
  },

  loginFailed: (email: string | undefined, reason: string, ip: string | undefined) => {
    logger.warn({
      email: email ? redactValue('email', email) : undefined,
      reason,
      ip,
      timestamp: new Date().toISOString(),
    }, 'Login failed');
  },

  accountLocked: (userId: string, lockoutUntil: Date) => {
    logger.warn({
      userId,
      lockoutUntil: lockoutUntil.toISOString(),
      timestamp: new Date().toISOString(),
    }, 'Account locked');
  },

  registered: (userId: string, email: string | undefined, phone: string | undefined) => {
    logger.info({
      userId,
      email: email ? redactValue('email', email) : undefined,
      phone: phone ? redactValue('phone', phone) : undefined,
      timestamp: new Date().toISOString(),
    }, 'User registered');
  },

  logout: (userId: string, userType: 'player' | 'org') => {
    logger.info({
      userId,
      userType,
      timestamp: new Date().toISOString(),
    }, 'User logged out');
  },
};

// ============================================
// Leaderboard-Specific Logging Helpers
// ============================================

export const leaderboardLog = {
  cacheHit: (sport: string, scope: string) => {
    logger.debug({
      sport,
      scope,
      timestamp: new Date().toISOString(),
    }, 'Leaderboard cache hit');
  },

  cacheMiss: (sport: string, scope: string) => {
    logger.debug({
      sport,
      scope,
      timestamp: new Date().toISOString(),
    }, 'Leaderboard cache miss');
  },

  updated: (sport: string, scope: string, playerCount: number) => {
    logger.info({
      sport,
      scope,
      playerCount,
      timestamp: new Date().toISOString(),
    }, 'Leaderboard updated');
  },
};

// ============================================
// Security Logging Helpers
// ============================================

export const securityLog = {
  suspiciousActivity: (type: string, details: Record<string, unknown>, ip: string) => {
    const safeDetails = redactObject(details) as Record<string, unknown>;
    logger.warn({
      type,
      ...safeDetails,
      ip,
      timestamp: new Date().toISOString(),
    }, 'Suspicious activity detected');
  },

  rateLimitExceeded: (identifier: string, endpoint: string, ip: string) => {
    logger.warn({
      identifier: redactValue('identifier', identifier),
      endpoint,
      ip,
      timestamp: new Date().toISOString(),
    }, 'Rate limit exceeded');
  },

  csrfValidationFailed: (endpoint: string, ip: string) => {
    logger.warn({
      endpoint,
      ip,
      timestamp: new Date().toISOString(),
    }, 'CSRF validation failed');
  },

  unauthorizedAccess: (userId: string | undefined, resource: string, action: string, ip: string) => {
    logger.warn({
      userId,
      resource,
      action,
      ip,
      timestamp: new Date().toISOString(),
    }, 'Unauthorized access attempt');
  },
};

// ============================================
// Console Replacement Helpers
// ============================================

/**
 * Console-compatible logging interface
 * Use these to replace console.log/error/warn/info/debug
 * 
 * IMPORTANT: These should be used instead of console.* throughout the codebase
 * for production-safe, structured logging.
 */
export const consoleReplacement = {
  /**
   * Replace console.log with structured info logging
   * Usage: console.log('[Module] message', data) -> logger.info(data, 'message')
   */
  log: (message: string, ...args: unknown[]) => {
    // Extract context from message prefix like '[Module]'
    const match = message.match(/^\[([^\]]+)\]/);
    const context = match ? match[1] : 'app';
    const cleanMessage = match ? message.replace(/^\[[^\]]+\]\s*/, '') : message;
    
    if (args.length === 0) {
      logger.info({ context }, cleanMessage);
    } else if (args.length === 1 && typeof args[0] === 'object') {
      logger.info({ context, ...redactObject(args[0]) as Record<string, unknown> }, cleanMessage);
    } else {
      logger.info({ context, args: args.map(a => redactObject(a)) }, cleanMessage);
    }
  },

  /**
   * Replace console.error with structured error logging
   */
  error: (message: string, ...args: unknown[]) => {
    const match = message.match(/^\[([^\]]+)\]/);
    const context = match ? match[1] : 'app';
    const cleanMessage = match ? message.replace(/^\[[^\]]+\]\s*/, '') : message;
    
    if (args.length === 0) {
      logger.error({ context }, cleanMessage);
    } else if (args.length === 1 && args[0] instanceof Error) {
      logger.error({ context, stack: args[0].stack, errorName: args[0].name }, cleanMessage);
    } else if (args.length === 1 && typeof args[0] === 'object') {
      logger.error({ context, ...redactObject(args[0]) as Record<string, unknown> }, cleanMessage);
    } else {
      logger.error({ context, args: args.map(a => redactObject(a)) }, cleanMessage);
    }
  },

  /**
   * Replace console.warn with structured warning logging
   */
  warn: (message: string, ...args: unknown[]) => {
    const match = message.match(/^\[([^\]]+)\]/);
    const context = match ? match[1] : 'app';
    const cleanMessage = match ? message.replace(/^\[[^\]]+\]\s*/, '') : message;
    
    if (args.length === 0) {
      logger.warn({ context }, cleanMessage);
    } else if (args.length === 1 && typeof args[0] === 'object') {
      logger.warn({ context, ...redactObject(args[0]) as Record<string, unknown> }, cleanMessage);
    } else {
      logger.warn({ context, args: args.map(a => redactObject(a)) }, cleanMessage);
    }
  },

  /**
   * Replace console.info with structured info logging
   */
  info: (message: string, ...args: unknown[]) => {
    consoleReplacement.log(message, ...args);
  },

  /**
   * Replace console.debug with structured debug logging
   */
  debug: (message: string, ...args: unknown[]) => {
    const match = message.match(/^\[([^\]]+)\]/);
    const context = match ? match[1] : 'app';
    const cleanMessage = match ? message.replace(/^\[[^\]]+\]\s*/, '') : message;
    
    if (args.length === 0) {
      logger.debug({ context }, cleanMessage);
    } else if (args.length === 1 && typeof args[0] === 'object') {
      logger.debug({ context, ...redactObject(args[0]) as Record<string, unknown> }, cleanMessage);
    } else {
      logger.debug({ context, args: args.map(a => redactObject(a)) }, cleanMessage);
    }
  },
};

// Export a createLogger function for module-specific loggers
export function createLogger(module: string) {
  const normalizeData = (data?: unknown): Record<string, unknown> => {
    if (data instanceof Error) {
      return {
        errorName: data.name,
        errorMessage: data.message,
        stack: data.stack,
      };
    }

    if (data && typeof data === 'object') {
      return redactObject(data) as Record<string, unknown>;
    }

    if (data === undefined) {
      return {};
    }

    return { value: data };
  };

  return {
    info: (message: string, data?: unknown) => {
      logger.info({ module, ...normalizeData(data) }, message);
    },
    error: (message: string, data?: unknown) => {
      logger.error({ module, ...normalizeData(data) }, message);
    },
    warn: (message: string, data?: unknown) => {
      logger.warn({ module, ...normalizeData(data) }, message);
    },
    debug: (message: string, data?: unknown) => {
      logger.debug({ module, ...normalizeData(data) }, message);
    },
  };
}
