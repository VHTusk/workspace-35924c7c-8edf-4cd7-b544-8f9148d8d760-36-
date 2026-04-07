/**
 * VALORHIVE Sentry Client Configuration
 * 
 * Client-side error tracking configuration for browser environments.
 * This file configures Sentry for the Next.js client bundle.
 * 
 * Features:
 * - Automatic error capture
 * - Session replay (optional)
 * - User context tracking
 * - Performance monitoring
 * - Source maps integration
 * 
 * IMPORTANT: Client config cannot use Docker secrets (readSecret)
 * because NEXT_PUBLIC_ variables are embedded at build time and
 * client-side code cannot read files from the filesystem.
 * Docker secrets should be configured for server-side only.
 * 
 * @module sentry-client-config
 */

import * as Sentry from '@sentry/nextjs';

// Client-side config uses process.env directly (cannot use Docker secrets)
// NEXT_PUBLIC_ variables are embedded at build time
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
    // Lower in production if volume is high
    sampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.8 : 1.0,

    // Session Replay configuration
    // Captures user sessions for debugging
    replaysSessionSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,

    // Performance monitoring
    // Trace sample rate - percentage of transactions to sample
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 0.5,

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === 'development',

    // Integrations
    integrations: [
      // Browser Tracing for performance monitoring
      Sentry.browserTracingIntegration(),

      // Session Replay for debugging user sessions
      Sentry.replayIntegration({
        // Mask sensitive data
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
      }),

      // Global Handlers for uncaught errors
      Sentry.globalHandlersIntegration({
        onunhandledrejection: true,
        onerror: true,
      }),

      // Breadcrumbs for console logs
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
      }),
    ],

    // Ignore common browser errors that are not actionable
    ignoreErrors: [
      // Browser extension errors
      'Non-Error promise rejection captured',
      'top.GLOBALS',
      'Can\'t find variable: ZiteReader',
      'jigsaw is not defined',
      'ComboSearch is not defined',
      'atomicFindClose',
      
      // Network errors that users can't fix
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'net::ERR_',
      'TypeError: Failed to fetch',
      'TypeError: NetworkError when attempting to fetch resource',
      'TypeError: cancelled',
      'AbortError',
      
      // Random browser/plugin errors
      'window.console',
      'console is not defined',
      'ReferenceError: event is not defined',
      
      // Razorpay specific errors
      'Script error',
      'Javascript error: Script error',
      
      // Chunk loading errors (happen during deployments)
      'ChunkLoadError',
      'Loading CSS chunk',
      'Loading chunk',
      
      // Cancelled requests
      'canceled',
      'Request aborted',
    ],

    // Filter out errors from extensions and third-party scripts
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      
      // Third-party scripts
      /googletagmanager\.com/i,
      /google-analytics\.com/i,
      /googleads\.g\.doubleclick\.net/i,
      /facebook\.net/i,
      
      // Development
      /localhost/i,
    ],

    // Additional options
    attachStacktrace: true,
    
    // Before send hook - sanitize sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly configured
      if (SENTRY_ENVIRONMENT === 'development' && !SENTRY_ENABLE_DEV) {
        return null;
      }

      // Sanitize sensitive data from error messages
      if (event.message) {
        event.message = sanitizeMessage(event.message);
      }

      // Sanitize request data
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = sanitizeHeaders(event.request.headers as Record<string, string>);
        }
        if (event.request.cookies) {
          // Don't send cookies
          delete event.request.cookies;
        }
      }

      return event;
    },

    // Before breadcrumb hook - filter breadcrumbs
    beforeBreadcrumb(breadcrumb, hint) {
      // Don't log sensitive API calls
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const url = breadcrumb.data?.url as string | undefined;
        if (url) {
          // Filter out sensitive endpoints
          const sensitiveEndpoints = [
            '/api/auth/',
            '/api/payments/',
            '/api/admin/',
          ];
          if (sensitiveEndpoints.some(ep => url.includes(ep))) {
            return null;
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
  // Remove potential PII patterns
  return message
    .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[email]') // Email addresses
    .replace(/\b\d{10,}\b/g, '[phone]') // Phone numbers
    .replace(/\b[A-Za-z0-9]{32,}\b/g, '[token]'); // Tokens
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
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveHeaders.some(h => key.toLowerCase().includes(h))) {
      sanitized[key] = '[filtered]';
    }
  }

  return sanitized;
}

// Export Sentry instance for manual use
export { Sentry };
