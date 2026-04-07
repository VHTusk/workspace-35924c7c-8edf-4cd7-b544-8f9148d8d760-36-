/**
 * VALORHIVE Sentry Edge Configuration
 * 
 * Edge runtime error tracking configuration for Vercel Edge Functions and Middleware.
 * This file configures Sentry for the Next.js edge bundle.
 * 
 * Features:
 * - Minimal footprint for edge runtime
 * - Middleware error tracking
 * - Request context enrichment
 * - Performance monitoring
 * 
 * IMPORTANT: Edge runtime has limited API access and cannot use Node.js fs module.
 * This config cannot use readSecret (Docker secrets) because:
 * 1. Edge runtime runs in V8 isolates, not Node.js
 * 2. File system access is not available
 * 3. Use environment variables directly for edge runtime
 * 
 * @module sentry-edge-config
 */

import * as Sentry from '@sentry/nextjs';

// Edge runtime uses process.env directly (cannot use Docker secrets via file system)
// Environment variables are available through the Edge runtime
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV;
const SENTRY_ENABLE_DEV = process.env.SENTRY_ENABLE_DEV === 'true';

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    // Data Source Name - identifies your project in Sentry
    dsn: SENTRY_DSN,

    // Environment identifier (development, staging, production)
    environment: SENTRY_ENVIRONMENT,

    // Release version - should match your deployment version
    release: process.env.NEXT_PUBLIC_APP_VERSION || 'valorhive@latest',

    // Sample rate for error events (1.0 = 100%)
    sampleRate: SENTRY_ENVIRONMENT === 'production' ? 1.0 : 1.0,

    // Performance monitoring
    // Lower sample rate for edge functions due to high volume
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.05 : 0.2,

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === 'development',

    // Edge-specific integrations (limited set for minimal bundle)
    integrations: [
      // Request data integration
      Sentry.requestDataIntegration({
        include: {
          cookies: false, // Don't send cookies
          data: false,    // Edge runtime limitation
          headers: true,
        },
      }),
    ],

    // Ignore errors that occur frequently in middleware
    ignoreErrors: [
      // Rate limit errors (expected behavior)
      'RATE_LIMITED',
      'RateLimitExceeded',

      // CSRF errors (expected behavior)
      'CSRF_INVALID',
      'CSRF validation failed',

      // Network errors
      'NetworkError',
      'Failed to fetch',

      // Aborted requests
      'AbortError',
      'Request aborted',
    ],

    // Ignore certain middleware transactions
    ignoreTransactions: [
      // Health checks
      'GET /api/health',
      'GET /api/v1/health',

      // Static assets
      'GET /_next/static/*',

      // Public endpoints (high volume)
      'GET /api/public/*',
    ],

    // Additional options
    attachStacktrace: true,

    // Before send hook - sanitize sensitive data
    beforeSend(event) {
      // Don't send events in development unless explicitly configured
      if (SENTRY_ENVIRONMENT === 'development' && !SENTRY_ENABLE_DEV) {
        return null;
      }

      // Sanitize error message
      if (event.message) {
        event.message = sanitizeMessage(event.message);
      }

      // Sanitize request headers
      if (event.request?.headers) {
        event.request.headers = sanitizeHeaders(event.request.headers as Record<string, string>);
      }

      // Remove cookies
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      return event;
    },

    // Before breadcrumb hook
    beforeBreadcrumb(breadcrumb) {
      // Filter out sensitive routes from breadcrumbs
      if (breadcrumb.category === 'navigation' || breadcrumb.category === 'http') {
        const url = breadcrumb.data?.url as string | undefined;
        if (url) {
          const sensitiveRoutes = [
            '/api/auth/',
            '/api/payments/',
            '/api/admin/',
          ];
          if (sensitiveRoutes.some(route => url.includes(route))) {
            breadcrumb.data = { url: '[filtered]' };
          }
        }
      }
      return breadcrumb;
    },
  });
}

/**
 * Sanitize error message to remove sensitive data
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[email]')
    .replace(/\b\d{10,}\b/g, '[phone]')
    .replace(/\b[A-Za-z0-9]{32,}\b/g, '[token]');
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
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

// Export Sentry instance for manual use in middleware
export { Sentry };
