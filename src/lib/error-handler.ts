/**
 * VALORHIVE Error Handler Middleware
 * 
 * Centralized error handling for API routes with consistent error responses,
 * logging, and proper HTTP status code mapping.
 * 
 * Features:
 * - handleApiError: Maps any error to HTTP response
 * - wrapApiHandler: HOF for consistent error handling in API routes
 * - Logging with stack traces for unexpected errors
 * - Structured error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  StateTransitionError,
  OptimisticLockError,
  IdempotencyError,
  InternalServerError,
  isAppError,
  isOperationalError,
  errorToHttpStatus,
  getErrorCode,
  getSafeErrorMessage,
  serializeError,
  ErrorCodes,
} from './errors';
import { createErrorResponse, API_VERSION } from './constants';

// ============================================
// Types
// ============================================

/**
 * API Handler function type
 */
export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<T>;

/**
 * API Handler that returns NextResponse
 */
export type NextApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<NextResponse>;

/**
 * Error log entry for structured logging
 */
interface ErrorLogEntry {
  timestamp: string;
  error: string;
  code: string;
  statusCode: number;
  path: string;
  method: string;
  isOperational: boolean;
  stack?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
}

// ============================================
// Error Logging
// ============================================

/**
 * Log error to console with structured format
 * In production, this would be replaced with a proper logging service
 */
function logError(
  error: unknown,
  request: NextRequest,
  additionalInfo?: { userId?: string; requestId?: string }
): void {
  const statusCode = errorToHttpStatus(error);
  const isOperational = isOperationalError(error);
  const serialized = serializeError(error);
  const serializedMessage =
    typeof serialized.message === 'string'
      ? serialized.message
      : serialized.message != null
        ? JSON.stringify(serialized.message)
        : 'Unknown error';
  
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    error: serializedMessage,
    code: getErrorCode(error),
    statusCode,
    path: request.nextUrl.pathname,
    method: request.method,
    isOperational,
    stack: process.env.NODE_ENV === 'development' ? serialized.stack as string : undefined,
    details: serialized.details as Record<string, unknown>,
    requestId: additionalInfo?.requestId,
    userId: additionalInfo?.userId,
  };
  
  // Use different log levels based on error type
  if (!isOperational || statusCode >= 500) {
    // Unexpected errors - log as error with full stack trace
    console.error('[API Error]', JSON.stringify(logEntry, null, 2));
    
    // Also log the stack trace separately for readability
    if (error instanceof Error && error.stack) {
      console.error('[Stack Trace]', error.stack);
    }
  } else {
    // Operational errors - log as warning (expected behavior)
    console.warn('[API Error]', JSON.stringify(logEntry, null, 2));
  }
}

// ============================================
// Error Response Builder
// ============================================

/**
 * Build error response object
 */
function buildErrorResponse(
  error: unknown,
  includeDetails: boolean = process.env.NODE_ENV === 'development'
): { response: ReturnType<typeof createErrorResponse>; statusCode: number } {
  const statusCode = errorToHttpStatus(error);
  const code = getErrorCode(error);
  const message = getSafeErrorMessage(error);
  
  let details: Record<string, unknown> | undefined;
  
  if (includeDetails && error instanceof AppError && error.details) {
    details = error.details;
  }
  
  // Add specific error type information
  if (error instanceof RateLimitError && error.retryAfter) {
    details = { ...details, retryAfter: error.retryAfter };
  }
  
  if (error instanceof OptimisticLockError) {
    details = {
      ...details,
      expectedVersion: error.expectedVersion,
      actualVersion: error.actualVersion,
    };
  }
  
  if (error instanceof StateTransitionError) {
    details = {
      ...details,
      currentState: error.currentState,
      targetState: error.targetState,
      allowedTransitions: error.allowedTransitions,
    };
  }
  
  if (error instanceof IdempotencyError) {
    details = {
      ...details,
      idempotencyKey: error.idempotencyKey,
      previousRequestId: error.previousRequestId,
    };
  }
  
  return {
    response: createErrorResponse(code, message, details),
    statusCode,
  };
}

// ============================================
// Error Handler Functions
// ============================================

/**
 * Handle API error and return appropriate HTTP response
 * 
 * This function should be used in catch blocks or error handling middleware
 * to convert any error type into a consistent HTTP response.
 * 
 * @param error - The error to handle
 * @param request - The NextRequest object (for logging context)
 * @param options - Additional options for error handling
 * @returns NextResponse with appropriate error response
 */
export function handleApiError(
  error: unknown,
  request?: NextRequest,
  options?: {
    userId?: string;
    requestId?: string;
    includeStackTrace?: boolean;
  }
): NextResponse {
  // Log the error
  if (request) {
    logError(error, request, { userId: options?.userId, requestId: options?.requestId });
  }
  
  // Build error response
  const { response, statusCode } = buildErrorResponse(error, options?.includeStackTrace);
  
  // Create response with appropriate headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Version': API_VERSION,
  };
  
  // Add Retry-After header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }
  
  // Add stack trace in development mode (for debugging)
  if (options?.includeStackTrace && error instanceof Error && error.stack) {
    headers['X-Stack-Trace'] = Buffer.from(error.stack).toString('base64');
  }
  
  return NextResponse.json(response, { status: statusCode, headers });
}

/**
 * Wrap an API handler with automatic error handling
 * 
 * This higher-order function wraps any API handler to provide consistent
 * error handling, logging, and response formatting.
 * 
 * @example
 * export const GET = wrapApiHandler(async (request) => {
 *   const data = await fetchData();
 *   return { success: true, data };
 * });
 */
export function wrapApiHandler<T>(
  handler: ApiHandler<T>,
  options?: {
    onError?: (error: unknown, request: NextRequest) => void;
    includeStackTrace?: boolean;
    requireAuth?: boolean;
  }
): NextApiHandler {
  return async (request: NextRequest, context?: { params?: Record<string, string | string[]> }) => {
    try {
      // Execute the handler
      const result = await handler(request, context);
      
      // If result is already a NextResponse, return it directly
      if (result instanceof NextResponse) {
        return result;
      }
      
      // Otherwise, wrap in JSON response
      return NextResponse.json(result, {
        headers: {
          'X-API-Version': API_VERSION,
        },
      });
    } catch (error) {
      // Call custom error handler if provided
      if (options?.onError) {
        options.onError(error, request);
      }
      
      // Handle the error and return response
      return handleApiError(error, request, {
        includeStackTrace: options?.includeStackTrace,
      });
    }
  };
}

/**
 * Wrap an API handler with authentication check
 * 
 * Combines authentication verification with error handling.
 * Returns 401 Unauthorized if no valid session is found.
 * 
 * @example
 * export const GET = withAuth(async (request, { userId }) => {
 *   const userData = await fetchUserData(userId);
 *   return { success: true, data: userData };
 * });
 */
export function withAuth<T>(
  handler: (request: NextRequest, context: { userId: string; params?: Record<string, string | string[]> }) => Promise<T>,
  options?: {
    onError?: (error: unknown, request: NextRequest) => void;
    includeStackTrace?: boolean;
  }
): NextApiHandler {
  return wrapApiHandler(async (request, context) => {
    // Extract user ID from session (this would typically come from session validation)
    // For now, we'll check the header set by middleware
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      throw new AuthenticationError('Authentication required. Please log in to continue.');
    }
    
    return handler(request, { userId, params: context?.params });
  }, options);
}

/**
 * Wrap an API handler with admin role check
 * 
 * Combines authentication and admin role verification with error handling.
 * Returns 403 Forbidden if user is not an admin.
 * 
 * @example
 * export const POST = withAdminAuth(async (request, { userId }) => {
 *   await performAdminAction(userId);
 *   return { success: true };
 * });
 */
export function withAdminAuth<T>(
  handler: (request: NextRequest, context: { userId: string; params?: Record<string, string | string[]> }) => Promise<T>,
  options?: {
    onError?: (error: unknown, request: NextRequest) => void;
    includeStackTrace?: boolean;
  }
): NextApiHandler {
  return wrapApiHandler(async (request, context) => {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    
    if (!userId) {
      throw new AuthenticationError('Authentication required. Please log in to continue.');
    }
    
    if (userRole !== 'ADMIN') {
      throw new AuthorizationError('Admin access required for this operation.');
    }
    
    return handler(request, { userId, params: context?.params });
  }, options);
}

// ============================================
// Error Creation Helpers
// ============================================

/**
 * Create a validation error from field errors
 * 
 * @example
 * throw createValidationError({ email: 'Invalid email format', password: 'Must be at least 8 characters' });
 */
export function createValidationError(
  message: string | Record<string, string>,
  additionalDetails?: Record<string, unknown>
): ValidationError {
  if (typeof message === 'string') {
    return new ValidationError(message, additionalDetails);
  }
  
  return new ValidationError('Validation failed', {
    fields: message,
    ...additionalDetails,
  });
}

/**
 * Create a not found error for a resource
 * 
 * @example
 * throw createNotFoundError('Tournament', tournamentId);
 */
export function createNotFoundError(
  resourceType: string,
  identifier?: string | number
): NotFoundError {
  const message = identifier
    ? `${resourceType} with identifier "${identifier}" not found`
    : `${resourceType} not found`;
  
  return new NotFoundError(message, {
    resourceType,
    identifier,
  });
}

/**
 * Create a conflict error for duplicate resources
 * 
 * @example
 * throw createConflictError('Email already registered', { field: 'email' });
 */
export function createConflictError(
  message: string,
  details?: Record<string, unknown>
): ConflictError {
  return new ConflictError(message, details);
}

/**
 * Create an optimistic lock error
 * 
 * @example
 * throw createOptimisticLockError(currentVersion, providedVersion);
 */
export function createOptimisticLockError(
  expectedVersion: number,
  actualVersion: number
): OptimisticLockError {
  return new OptimisticLockError(
    'This record was modified by another process. Please refresh and try again.',
    expectedVersion,
    actualVersion
  );
}

/**
 * Create an idempotency error
 * 
 * @example
 * throw createIdempotencyError(idempotencyKey, previousRequestId);
 */
export function createIdempotencyError(
  idempotencyKey: string,
  previousRequestId?: string
): IdempotencyError {
  return new IdempotencyError(
    'A request with this idempotency key has already been processed.',
    idempotencyKey,
    previousRequestId
  );
}

/**
 * Create a rate limit error
 * 
 * @example
 * throw createRateLimitError(60); // Retry after 60 seconds
 */
export function createRateLimitError(retryAfterSeconds: number): RateLimitError {
  return new RateLimitError(
    'Too many requests. Please wait before trying again.',
    retryAfterSeconds
  );
}

// ============================================
// Prisma Error Handlers
// ============================================

/**
 * Check if error is a Prisma unique constraint error
 */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

/**
 * Check if error is a Prisma record not found error
 */
export function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  );
}

/**
 * Check if error is a Prisma foreign key constraint error
 */
export function isPrismaForeignKeyError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2003'
  );
}

/**
 * Convert Prisma errors to AppErrors
 */
export function convertPrismaError(
  error: unknown,
  context?: { resourceType?: string; identifier?: string }
): AppError {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return new InternalServerError('Database operation failed');
  }
  
  const prismaError = error as { code: string; meta?: Record<string, unknown> };
  
  switch (prismaError.code) {
    case 'P2002': {
      const target = prismaError.meta?.target as string[] | undefined;
      const field = target?.join(', ') || 'field';
      return new ConflictError(`A record with this ${field} already exists`, {
        field,
        code: ErrorCodes.DUPLICATE_ENTRY,
      });
    }
    
    case 'P2025':
      return new NotFoundError(
        context?.resourceType
          ? `${context.resourceType} not found`
          : 'Record not found',
        { resourceType: context?.resourceType, identifier: context?.identifier }
      );
    
    case 'P2003':
      return new ValidationError(
        'Related record not found. Please ensure all referenced records exist.',
        { meta: prismaError.meta }
      );
    
    case 'P2016':
      return new ValidationError('Query interpretation error', {
        meta: prismaError.meta,
      });
    
    default:
      console.error('[Prisma Error]', prismaError);
      return new InternalServerError('Database operation failed');
  }
}

// ============================================
// Async Error Boundary
// ============================================

/**
 * Execute an async function with error boundary
 * 
 * Useful for wrapping Promise.all or other async operations
 * that might throw unexpected errors.
 * 
 * @example
 * const [users, tournaments] = await asyncErrorBoundary(
 *   Promise.all([fetchUsers(), fetchTournaments()]),
 *   'Failed to fetch data'
 * );
 */
export async function asyncErrorBoundary<T>(
  promise: Promise<T>,
  fallbackMessage: string = 'Operation failed'
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    // Convert to AppError if needed
    if (isAppError(error)) {
      throw error;
    }
    
    // Log unexpected errors
    console.error('[Async Error Boundary]', error);
    
    // Convert Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      throw convertPrismaError(error);
    }
    
    // Wrap other errors
    throw new InternalServerError(fallbackMessage);
  }
}

// ============================================
// Exports
// ============================================

export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  StateTransitionError,
  OptimisticLockError,
  IdempotencyError,
  PaymentRequiredError,
  ServiceUnavailableError,
  DatabaseError,
  InternalServerError,
  isAppError,
  isOperationalError,
  errorToHttpStatus,
  getErrorCode,
  getSafeErrorMessage,
  serializeError,
  ErrorCodes,
} from './errors';
