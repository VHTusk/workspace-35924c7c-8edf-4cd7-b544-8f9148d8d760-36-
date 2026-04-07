/**
 * VALORHIVE Sentry Server Configuration
 * 
 * Server-side error tracking configuration for Node.js environments.
 * This file configures Sentry for the Next.js server bundle.
 * 
 * Features:
 * - Automatic error capture on server
 * - Database query tracking
 * - API route performance monitoring
 * - Request context enrichment
 * - Source maps upload
 * - Docker secrets support via readSecret
 * 
 * @module sentry-server-config
 */

import * as Sentry from '@sentry/nextjs';
import { readSecret, readNumericSecret, readBooleanSecret } from './src/lib/secrets';

// Type for Sentry context
type Context = Record<string, unknown>;

// Read secrets with Docker secrets support
const SENTRY_DSN = readSecret('NEXT_PUBLIC_SENTRY_DSN');
const SENTRY_ENVIRONMENT = readSecret('SENTRY_ENVIRONMENT') || process.env.NODE_ENV;
const SENTRY_TRACES_SAMPLE_RATE = readNumericSecret('SENTRY_TRACES_SAMPLE_RATE', 0.1);
const SENTRY_ENABLE_DEV = readBooleanSecret('SENTRY_ENABLE_DEV', false);
const SENTRY_URL = readSecret('SENTRY_URL'); // For self-hosted Sentry

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    // Data Source Name - identifies your project in Sentry
    dsn: SENTRY_URL ? `${SENTRY_URL}/api/${SENTRY_DSN}` : SENTRY_DSN,

    // Environment identifier (development, staging, production)
    environment: SENTRY_ENVIRONMENT,

    // Release version - should match your deployment version
    release: readSecret('NEXT_PUBLIC_APP_VERSION') || 'valorhive@latest',

    // Sample rate for error events (1.0 = 100%)
    sampleRate: SENTRY_ENVIRONMENT === 'production' ? 1.0 : 1.0,

    // Performance monitoring
    // Trace sample rate - percentage of transactions to sample
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === 'development',

    // Server-specific integrations
    integrations: [
      // HTTP integration for API calls
      Sentry.httpIntegration(),

      // Express/Connect integration (for custom servers)
      Sentry.expressIntegration(),

      // Request data integration
      Sentry.requestDataIntegration({
        include: {
          cookies: false, // Don't send cookies
          data: true,
          headers: true,
        },
      }),
    ],

    // Ignore common server errors that are not actionable
    ignoreErrors: [
      // Database connection errors (logged elsewhere)
      'PrismaClientKnownRequestError',
      
      // Rate limit errors (expected behavior)
      'RateLimitExceeded',
      
      // Validation errors (handled by app)
      'ValidationError',
      'ZodError',
      
      // Authentication errors (expected behavior)
      'UnauthorizedError',
      'AuthenticationError',
      'TokenExpiredError',
      
      // Not found errors (expected behavior)
      'NotFoundError',
      
      // User-initiated cancellations
      'AbortError',
      'CancelledError',
    ],

    // Server-specific ignore patterns
    ignoreTransactions: [
      // Health checks
      'GET /api/health',
      'GET /api/v1/health',
      'GET /api/health/ready',
      'GET /api/v1/health/ready',
      
      // Static assets
      'GET /_next/static/*',
      'GET /images/*',
      'GET /favicon.ico',
      
      // Webhooks (monitored separately)
      'POST /api/payments/webhook',
    ],

    // Additional options
    attachStacktrace: true,

    // Before send hook - sanitize sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly configured
      if (SENTRY_ENVIRONMENT === 'development' && !SENTRY_ENABLE_DEV) {
        return null;
      }

      // Sanitize error message
      if (event.message) {
        event.message = sanitizeMessage(event.message);
      }

      // Sanitize exception values
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.value) {
            exception.value = sanitizeMessage(exception.value);
          }
        }
      }

      // Sanitize request data
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = sanitizeHeaders(event.request.headers) as { [key: string]: string };
        }
        if (event.request.cookies) {
          delete event.request.cookies;
        }
        if (event.request.data) {
          event.request.data = sanitizeData(event.request.data);
        }
      }

      // Sanitize context data
      if (event.contexts) {
        if (event.contexts.db) {
          event.contexts.db = sanitizeDbContext(event.contexts.db) as Context;
        }
      }

      return event;
    },

    // Before breadcrumb hook
    beforeBreadcrumb(breadcrumb, hint) {
      // Filter sensitive database queries
      if (breadcrumb.category === 'db' && breadcrumb.message) {
        // Don't log queries with sensitive data
        if (breadcrumb.message.toLowerCase().includes('password') ||
            breadcrumb.message.toLowerCase().includes('token') ||
            breadcrumb.message.toLowerCase().includes('secret')) {
          return null;
        }
      }
      return breadcrumb;
    },
  });

  // Set up global error handlers
  setupGlobalErrorHandlers();
}

/**
 * Sanitize error message to remove sensitive data
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[email]')
    .replace(/\b\d{10,}\b/g, '[phone]')
    .replace(/\b[A-Za-z0-9]{32,}\b/g, '[token]')
    .replace(/password["\s:=]+["\w]+/gi, 'password=[filtered]')
    .replace(/token["\s:=]+["\w]+/gi, 'token=[filtered]')
    .replace(/secret["\s:=]+["\w]+/gi, 'secret=[filtered]');
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-session-token',
    'x-auth-token',
    'x-csrf-token',
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveHeaders.some(h => key.toLowerCase().includes(h))) {
      sanitized[key] = '[filtered]';
    }
  }

  return sanitized;
}

/**
 * Sanitize request body data
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    return sanitizeMessage(data);
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data as Record<string, unknown> };
    const sensitiveFields = [
      'password',
      'passwordConfirm',
      'currentPassword',
      'newPassword',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
      'otp',
      'pin',
      'cvv',
      'cardNumber',
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        sanitized[key] = '[filtered]';
      }
    }

    return sanitized;
  }
  return data;
}

/**
 * Sanitize database context
 */
function sanitizeDbContext(dbContext: unknown): unknown {
  if (typeof dbContext === 'object' && dbContext !== null) {
    const context = dbContext as Record<string, unknown>;
    // Remove query parameters that might contain sensitive data
    if (typeof context.query === 'string') {
      context.query = sanitizeMessage(context.query);
    }
    return context;
  }
  return dbContext;
}

/**
 * Set up global error handlers for server-side errors
 */
function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        source: 'uncaughtException',
      },
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        source: 'unhandledRejection',
      },
      extra: {
        promise: '[Promise]',
      },
    });
  });

  // Handle warning events
  process.on('warning', (warning: Error) => {
    // Only capture certain warnings as they might indicate issues
    if (warning.name === 'DeprecationWarning' || warning.message.includes('deprecated')) {
      Sentry.captureMessage(warning.message, {
        level: 'warning',
        tags: {
          source: 'processWarning',
          type: warning.name,
        },
      });
    }
  });
}

// Export Sentry instance for manual use
export { Sentry };
