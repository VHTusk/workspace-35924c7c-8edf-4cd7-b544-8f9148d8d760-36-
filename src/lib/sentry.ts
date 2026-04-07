/**
 * VALORHIVE Sentry Utility Functions
 * 
 * Provides convenient wrappers and utilities for Sentry error tracking.
 * These functions can be used throughout the application for consistent
 * error reporting and context enrichment.
 * 
 * Features:
 * - captureException: Capture exceptions with context
 * - captureMessage: Capture messages with severity levels
 * - setUserContext: Set user context for error attribution
 * - withSentry: Wrap API handlers with automatic error capture
 * - withSentryTransaction: Wrap operations with performance tracking
 * 
 * @module sentry-utils
 */

import * as Sentry from '@sentry/nextjs';
import type { NextRequest, NextResponse } from 'next/server';

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

// ============================================
// Types
// ============================================

export interface SentryContext {
  /** Tags to attach to the event */
  tags?: Record<string, string | number | boolean>;
  /** Extra data to attach to the event */
  extra?: Record<string, unknown>;
  /** User information */
  user?: {
    id?: string;
    email?: string;
    username?: string;
    role?: string;
    sport?: string;
  };
  /** Request information */
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    query?: Record<string, string | string[]>;
  };
  /** Fingerprint for grouping similar errors */
  fingerprint?: string[];
  /** Level of the event */
  level?: SeverityLevel;
}

export interface UserContext {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  sport?: string;
  organizationId?: string | null;
}

export interface ApiHandlerContext {
  params?: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
}

type ApiHandler<T = unknown> = (
  request: NextRequest,
  context?: ApiHandlerContext
) => Promise<T>;

// ============================================
// Error Capture Functions
// ============================================

/**
 * Capture an exception with Sentry
 * 
 * Use this to capture any error with additional context for debugging.
 * 
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureException(error, {
 *     tags: { operation: 'riskyOperation' },
 *     extra: { userId: user.id },
 *   });
 *   throw error;
 * }
 * ```
 */
export function captureException(
  error: Error | unknown,
  context?: SentryContext
): string | undefined {
  // Check if Sentry is configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error('[Sentry] Not configured, error:', error);
    return undefined;
  }

  const eventId = Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
    level: context?.level,
    fingerprint: context?.fingerprint,
    contexts: context?.request
      ? {
          request: context.request,
        }
      : undefined,
  });

  return eventId;
}

/**
 * Capture a message with Sentry
 * 
 * Use this for important messages that aren't errors but should be tracked.
 * 
 * @example
 * ```ts
 * captureMessage('Payment webhook received', 'info', {
 *   tags: { paymentId: payment.id },
 * });
 * ```
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: Omit<SentryContext, 'level'>
): string | undefined {
  // Check if Sentry is configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.log(`[Sentry] ${level.toUpperCase()}: ${message}`);
    return undefined;
  }

  const eventId = Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
    fingerprint: context?.fingerprint,
    contexts: context?.request
      ? {
          request: context.request,
        }
      : undefined,
  });

  return eventId;
}

// ============================================
// Context Functions
// ============================================

/**
 * Set user context for Sentry
 * 
 * Call this after authentication to attribute errors to users.
 * Use clearUserContext on logout.
 * 
 * @example
 * ```ts
 * // After login
 * setUserContext({
 *   id: user.id,
 *   email: user.email,
 *   role: user.role,
 * });
 * 
 * // On logout
 * clearUserContext();
 * ```
 */
export function setUserContext(user: UserContext | null): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
  });

  // Set additional context as tags
  if (user.role) {
    Sentry.setTag('user.role', user.role);
  }
  if (user.sport) {
    Sentry.setTag('user.sport', user.sport);
  }
  if (user.organizationId) {
    Sentry.setTag('user.organizationId', user.organizationId);
  }
}

/**
 * Clear user context from Sentry
 * 
 * Call this on logout to remove user attribution from subsequent errors.
 */
export function clearUserContext(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.setUser(null);
  Sentry.setTag('user.role', undefined);
  Sentry.setTag('user.sport', undefined);
  Sentry.setTag('user.organizationId', undefined);
}

/**
 * Set custom tags for current scope
 * 
 * Tags are searchable and useful for filtering in Sentry.
 * 
 * @example
 * ```ts
 * setTags({
 *   tournament: tournamentId,
 *   sport: 'CORNHOLE',
 * });
 * ```
 */
export function setTags(tags: Record<string, string | number | boolean | undefined>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  for (const [key, value] of Object.entries(tags)) {
    if (value !== undefined) {
      Sentry.setTag(key, value);
    }
  }
}

/**
 * Set extra context for current scope
 * 
 * Extra data is visible in event details but not searchable.
 * 
 * @example
 * ```ts
 * setExtra({
 *   matchId: match.id,
 *   scores: match.scores,
 * });
 * ```
 */
export function setExtra(extra: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  for (const [key, value] of Object.entries(extra)) {
    Sentry.setExtra(key, value);
  }
}

// ============================================
// API Handler Wrapper
// ============================================

/**
 * Wrap an API handler with Sentry error tracking
 * 
 * Automatically captures errors and adds request context.
 * Use this for all API route handlers.
 * 
 * @example
 * ```ts
 * // In app/api/users/route.ts
 * export const GET = withSentry(async (request) => {
 *   const users = await db.user.findMany();
 *   return NextResponse.json({ users });
 * }, {
 *   operation: 'getUsers',
 *   sport: 'CORNHOLE',
 * });
 * ```
 */
export function withSentry<T>(
  handler: ApiHandler<T>,
  options?: {
    /** Operation name for tracking */
    operation?: string;
    /** Sport context */
    sport?: string;
    /** Whether to capture request body (be careful with sensitive data) */
    captureBody?: boolean;
    /** Custom error handler */
    onError?: (error: Error, request: NextRequest) => void;
  }
): ApiHandler<T> {
  return async (request: NextRequest, context?: ApiHandlerContext) => {
    // Skip if Sentry is not configured
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return handler(request, context);
    }

    // Start a span for performance tracking
    return Sentry.startSpan(
      {
        op: 'http.server',
        name: `${request.method} ${new URL(request.url).pathname}`,
      },
      async (span) => {
        // Set tags
        if (options?.operation) {
          Sentry.setTag('operation', options.operation);
        }
        if (options?.sport) {
          Sentry.setTag('sport', options.sport);
        }

        // Set request context
        Sentry.setContext('request', {
          method: request.method,
          url: request.url,
          headers: sanitizeHeaders(Object.fromEntries(request.headers)),
          query: context?.query,
        });

        try {
          const result = await handler(request, context);

          // Set status on span if result is a Response
          if (result instanceof Response || 'status' in (result as object)) {
            const status = (result as { status: number }).status;
            span?.setStatus({ code: status >= 400 ? 2 : 1 }); // 1=OK, 2=Unknown/Error
          }

          return result;
        } catch (error) {
          // Capture the error
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureException(errorObj, {
            tags: {
              ...(options?.operation ? { operation: options.operation } : {}),
              ...(options?.sport ? { sport: options.sport } : {}),
              method: request.method,
            },
            extra: {
              url: request.url,
              query: context?.query,
            },
            level: 'error',
          });

          // Call custom error handler if provided
          if (options?.onError) {
            options.onError(errorObj, request);
          }

          // Re-throw to let Next.js handle it
          throw error;
        }
      }
    );
  };
}

/**
 * Wrap an async function with Sentry transaction tracking
 * 
 * Use this for background operations, cron jobs, etc.
 * 
 * @example
 * ```ts
 * await withSentryTransaction('processPendingPayments', async () => {
 *   // ... processing logic
 * });
 * ```
 */
export async function withSentryTransaction<T>(
  name: string,
  operation: () => Promise<T>,
  options?: {
    op?: string;
    tags?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return operation();
  }

  return Sentry.startSpan(
    {
      op: options?.op || 'task',
      name,
    },
    async () => {
      if (options?.tags) {
        setTags(options.tags);
      }

      try {
        return await operation();
      } catch (error) {
        captureException(error, {
          tags: { transaction: name },
          level: 'error',
        });
        throw error;
      }
    }
  );
}

// ============================================
// Utility Functions
// ============================================

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-session-token',
    'x-auth-token',
    'x-csrf-token',
  ];

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.some((h) => key.toLowerCase().includes(h))) {
      sanitized[key] = '[filtered]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a breadcrumb for navigation tracking
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Create a fingerprint for grouping similar errors
 * 
 * Use this to prevent noise from errors with dynamic parts.
 * 
 * @example
 * ```ts
 * // Group all "user not found" errors together regardless of user ID
 * captureException(error, {
 *   fingerprint: ['user-not-found', request.method, pathname],
 * });
 * ```
 */
export function createFingerprint(...parts: (string | number)[]): string[] {
  return parts.map(String);
}

// ============================================
// Exports
// ============================================

// Re-export Sentry for direct use if needed
export { Sentry };
