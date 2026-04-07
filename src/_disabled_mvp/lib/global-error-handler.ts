/**
 * VALORHIVE Global Error Handler
 * 
 * Handles uncaught exceptions and unhandled promise rejections at the process level.
 * Ensures graceful shutdown and proper error logging.
 * 
 * Features:
 * - Unhandled rejection handler
 * - Uncaught exception handler
 * - Graceful shutdown sequence
 * - Error logging with stack traces
 * - Production-safe error responses
 * - Sentry integration for error tracking
 * 
 * @module global-error-handler
 */

import { NextRequest, NextResponse } from 'next/server';
import logger, { log } from './logger';
import { captureException, captureMessage } from './sentry';

// ============================================
// Types
// ============================================

interface ErrorHandlerOptions {
  includeStackTrace?: boolean;
  logErrors?: boolean;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

// ============================================
// Global Error Handlers
// ============================================

let handlersRegistered = false;

/**
 * Register global error handlers for the process
 * Should be called once at application startup
 */
export function registerGlobalErrorHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    logger.error({
      type: 'UNHANDLED_REJECTION',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, 'Unhandled Promise Rejection');

    // Capture with Sentry
    captureException(error, {
      tags: {
        source: 'unhandledRejection',
        environment: process.env.NODE_ENV,
      },
      extra: {
        promiseType: typeof promise,
      },
      level: 'fatal',
    });

    // In production, we might want to exit on unhandled rejections
    // to ensure consistent state
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] Unhandled rejection in production. Exiting...');
      gracefulShutdown(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error({
      type: 'UNCAUGHT_EXCEPTION',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, 'Uncaught Exception');

    // Capture with Sentry - mark as fatal
    captureException(error, {
      tags: {
        source: 'uncaughtException',
        environment: process.env.NODE_ENV,
      },
      level: 'fatal',
    });

    // Uncaught exceptions should always exit the process
    // as the application may be in an inconsistent state
    console.error('[FATAL] Uncaught exception. Exiting...');
    gracefulShutdown(1);
  });

  // Handle warning events
  process.on('warning', (warning: Error) => {
    logger.warn({
      type: 'PROCESS_WARNING',
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString(),
    }, 'Process Warning');

    // Capture deprecation warnings with Sentry
    if (warning.name === 'DeprecationWarning') {
      captureMessage(`Deprecation: ${warning.message}`, 'warning', {
        tags: {
          source: 'processWarning',
          type: warning.name,
        },
      });
    }
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    log.info('SIGTERM received. Starting graceful shutdown...');
    
    // Log to Sentry
    captureMessage('SIGTERM received - initiating graceful shutdown', 'info', {
      tags: { source: 'signal' },
    });
    
    gracefulShutdown(0);
  });

  process.on('SIGINT', () => {
    log.info('SIGINT received. Starting graceful shutdown...');
    
    // Log to Sentry
    captureMessage('SIGINT received - initiating graceful shutdown', 'info', {
      tags: { source: 'signal' },
    });
    
    gracefulShutdown(0);
  });

  log.info('Global error handlers registered');
}

// ============================================
// Graceful Shutdown
// ============================================

let isShuttingDown = false;
const shutdownCallbacks: Array<() => Promise<void>> = [];

/**
 * Register a callback to be called during graceful shutdown
 */
export function registerShutdownCallback(callback: () => Promise<void>): void {
  shutdownCallbacks.push(callback);
}

/**
 * Perform graceful shutdown
 */
async function gracefulShutdown(exitCode: number): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info('Starting graceful shutdown...');

  // Run shutdown callbacks with timeout
  const shutdownTimeout = setTimeout(() => {
    log.warn('Shutdown timeout reached. Forcing exit.');
    process.exit(exitCode);
  }, 10000); // 10 second timeout

  try {
    // Run all shutdown callbacks
    await Promise.allSettled(
      shutdownCallbacks.map(callback => 
        Promise.race([
          callback(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown callback timeout')), 5000)
          )
        ])
      )
    );
    
    clearTimeout(shutdownTimeout);
    log.info('Graceful shutdown completed');
  } catch (error) {
    log.error('Error during graceful shutdown', { error: String(error) });
  }

  process.exit(exitCode);
}

// ============================================
// API Error Boundary
// ============================================

/**
 * Wrap an API handler with error handling
 * 
 * This function provides a consistent error handling wrapper for API routes.
 * It catches all errors, logs them appropriately, and returns a standardized
 * error response.
 * 
 * @example
 * export const GET = apiErrorBoundary(async (request) => {
 *   const data = await fetchData();
 *   return { success: true, data };
 * });
 */
export function apiErrorBoundary<T>(
  handler: (request: NextRequest, context?: { params?: Record<string, string | string[]> }) => Promise<T>,
  options: ErrorHandlerOptions = {}
): (request: NextRequest, context?: { params?: Record<string, string | string[]> }) => Promise<NextResponse> {
  const { includeStackTrace = process.env.NODE_ENV === 'development', logErrors = true, onError } = options;

  return async (request: NextRequest, context?: { params?: Record<string, string | string[]> }) => {
    try {
      const result = await handler(request, context);

      // If result is already a NextResponse, return it
      if (result instanceof NextResponse) {
        return result;
      }

      // Otherwise, wrap in JSON response
      return NextResponse.json(result, {
        headers: {
          'X-API-Version': '1.0.0',
        },
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // Log the error
      if (logErrors) {
        log.errorWithStack('API Error', errorObj, {
          path: request.nextUrl.pathname,
          method: request.method,
        });
      }

      // Capture with Sentry
      captureException(errorObj, {
        tags: {
          source: 'apiErrorBoundary',
          method: request.method,
          path: request.nextUrl.pathname,
        },
        extra: {
          query: Object.fromEntries(request.nextUrl.searchParams),
        },
        request: {
          method: request.method,
          url: request.url,
        },
        level: 'error',
      });

      // Call custom error handler if provided
      if (onError) {
        onError(errorObj, {
          path: request.nextUrl.pathname,
          method: request.method,
        });
      }

      // Build error response
      const statusCode = getStatusCode(error);
      const errorMessage = getErrorMessage(error);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: getErrorCode(error),
            message: errorMessage,
            ...(includeStackTrace && error instanceof Error && { stack: error.stack }),
          },
        },
        {
          status: statusCode,
          headers: {
            'X-API-Version': '1.0.0',
          },
        }
      );
    }
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get HTTP status code from error
 */
function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object') {
    // Check for status property
    if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
      return (error as { statusCode: number }).statusCode;
    }
    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
      return (error as { status: number }).status;
    }
    // Check for Prisma errors
    if ('code' in error) {
      const prismaCode = (error as { code: string }).code;
      switch (prismaCode) {
        case 'P2002': return 409; // Unique constraint
        case 'P2025': return 404; // Not found
        case 'P2003': return 400; // Foreign key
        default: return 500;
      }
    }
  }
  return 500;
}

/**
 * Get error code string
 */
function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  if (error instanceof Error) {
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'UnauthorizedError') return 'UNAUTHORIZED';
    if (error.name === 'ForbiddenError') return 'FORBIDDEN';
    if (error.name === 'NotFoundError') return 'NOT_FOUND';
  }
  return 'INTERNAL_ERROR';
}

/**
 * Get safe error message for client
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // For operational errors, return the message
    // For programming errors, return generic message
    const isOperational = 'isOperational' in error && (error as { isOperational: boolean }).isOperational;
    if (isOperational || process.env.NODE_ENV === 'development') {
      return error.message;
    }
  }
  return 'An unexpected error occurred. Please try again later.';
}

// ============================================
// Safe Async Execution
// ============================================

/**
 * Execute an async function safely with error handling
 * 
 * @example
 * const [result, error] = await safeAsync(fetchData());
 * if (error) {
 *   return handleError(error);
 * }
 */
export async function safeAsync<T>(
  promise: Promise<T>
): Promise<[T | null, Error | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    // Capture with Sentry
    captureException(errorObj, {
      tags: { source: 'safeAsync' },
      level: 'error',
    });
    
    return [null, errorObj];
  }
}

/**
 * Execute multiple async functions in parallel safely
 * 
 * @example
 * const results = await safeAsyncAll([
 *   fetchUsers(),
 *   fetchTournaments(),
 *   fetchMatches(),
 * ]);
 */
export async function safeAsyncAll<T extends readonly unknown[]>(
  promises: T
): Promise<{ [K in keyof T]: T[K] extends Promise<infer U> ? [U | null, Error | null] : never }> {
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value, null] as const;
    }
    
    const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
    
    // Capture with Sentry
    captureException(error, {
      tags: { source: 'safeAsyncAll' },
      extra: { promiseIndex: index },
      level: 'error',
    });
    
    return [null, error] as const;
  }) as { [K in keyof T]: T[K] extends Promise<infer U> ? [U | null, Error | null] : never };
}

// ============================================
// Exports
// ============================================

export {
  registerGlobalErrorHandlers,
  registerShutdownCallback,
  apiErrorBoundary,
  safeAsync,
  safeAsyncAll,
};
