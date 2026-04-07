/**
 * VALORHIVE Typed Error Classes
 * 
 * Centralized error handling with typed error classes for consistent
 * error management across the application.
 * 
 * Features:
 * - Base AppError class with statusCode, code, and isOperational
 * - Specific error types with appropriate HTTP status codes
 * - Type guard for error detection
 * - HTTP status mapper for API responses
 */

/**
 * Base application error class
 * 
 * All custom errors should extend this class to ensure consistent
 * error handling throughout the application.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (exclude constructor from stack)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Validation Error (400 Bad Request)
 * 
 * Use for input validation failures, malformed requests,
 * or any client-side data issues.
 */
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, unknown>
  ) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * 
 * Use for authentication failures such as:
 * - Invalid credentials
 * - Missing/expired tokens
 * - Session invalidation
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    details?: Record<string, unknown>
  ) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, details);
  }
}

/**
 * Authorization Error (403 Forbidden)
 * 
 * Use for authorization failures such as:
 * - Insufficient permissions
 * - Resource access denied
 * - Role-based restrictions
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Access denied',
    details?: Record<string, unknown>
  ) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, details);
  }
}

/**
 * Not Found Error (404 Not Found)
 * 
 * Use when a requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    details?: Record<string, unknown>
  ) {
    super(message, 404, 'NOT_FOUND_ERROR', true, details);
  }
}

/**
 * Conflict Error (409 Conflict)
 * 
 * Use for resource conflicts such as:
 * - Duplicate entries
 * - Concurrent modifications
 * - State conflicts
 */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>
  ) {
    super(message, 409, 'CONFLICT_ERROR', true, details);
  }
}

/**
 * Rate Limit Error (429 Too Many Requests)
 * 
 * Use when rate limiting is triggered.
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Too many requests',
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR', true, details);
    this.retryAfter = retryAfter;
  }
}

/**
 * State Transition Error (400 Bad Request)
 * 
 * Use for invalid state transitions in the tournament state machine.
 * Specifically for cases where an operation is not allowed in the current state.
 */
export class StateTransitionError extends AppError {
  public readonly currentState: string;
  public readonly targetState?: string;
  public readonly allowedTransitions?: string[];

  constructor(
    message: string,
    currentState: string,
    targetState?: string,
    allowedTransitions?: string[],
    details?: Record<string, unknown>
  ) {
    super(message, 400, 'STATE_TRANSITION_ERROR', true, {
      ...details,
      currentState,
      targetState,
      allowedTransitions,
    });
    this.currentState = currentState;
    this.targetState = targetState;
    this.allowedTransitions = allowedTransitions;
  }
}

/**
 * Optimistic Lock Error (409 Conflict)
 * 
 * Use for optimistic locking failures during concurrent updates.
 * Indicates that the resource was modified by another process.
 */
export class OptimisticLockError extends AppError {
  public readonly expectedVersion?: number;
  public readonly actualVersion?: number;

  constructor(
    message: string = 'Resource was modified by another process',
    expectedVersion?: number,
    actualVersion?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 409, 'OPTIMISTIC_LOCK_ERROR', true, {
      ...details,
      expectedVersion,
      actualVersion,
    });
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Idempotency Error (409 Conflict)
 * 
 * Use for idempotency key conflicts.
 * Indicates that a request with the same idempotency key is already processed/processing.
 */
export class IdempotencyError extends AppError {
  public readonly idempotencyKey?: string;
  public readonly previousRequestId?: string;

  constructor(
    message: string = 'Duplicate request detected',
    idempotencyKey?: string,
    previousRequestId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 409, 'IDEMPOTENCY_ERROR', true, {
      ...details,
      idempotencyKey,
      previousRequestId,
    });
    this.idempotencyKey = idempotencyKey;
    this.previousRequestId = previousRequestId;
  }
}

/**
 * Payment Required Error (402 Payment Required)
 * 
 * Use for subscription/payment related issues.
 */
export class PaymentRequiredError extends AppError {
  constructor(
    message: string = 'Payment required',
    details?: Record<string, unknown>
  ) {
    super(message, 402, 'PAYMENT_REQUIRED_ERROR', true, details);
  }
}

/**
 * Service Unavailable Error (503 Service Unavailable)
 * 
 * Use for temporary service unavailability.
 */
export class ServiceUnavailableError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Service temporarily unavailable',
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR', true, details);
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error (500 Internal Server Error)
 * 
 * Use for database-related errors.
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database operation failed',
    details?: Record<string, unknown>
  ) {
    super(message, 500, 'DATABASE_ERROR', false, details);
  }
}

/**
 * Internal Server Error (500 Internal Server Error)
 * 
 * Use for unexpected internal errors.
 * These are non-operational errors that indicate a bug or system issue.
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = 'Internal server error',
    details?: Record<string, unknown>
  ) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, details);
  }
}

// ============================================
// Error Code Constants
// ============================================

export const ErrorCodes = {
  // 400 errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STATE_TRANSITION_ERROR: 'STATE_TRANSITION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // 401 errors
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // 402 errors
  PAYMENT_REQUIRED_ERROR: 'PAYMENT_REQUIRED_ERROR',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  
  // 403 errors
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  
  // 404 errors
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TOURNAMENT_NOT_FOUND: 'TOURNAMENT_NOT_FOUND',
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  
  // 409 errors
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  OPTIMISTIC_LOCK_ERROR: 'OPTIMISTIC_LOCK_ERROR',
  IDEMPOTENCY_ERROR: 'IDEMPOTENCY_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  
  // 429 errors
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  
  // 500 errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  
  // 503 errors
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// Type Guard and Utility Functions
// ============================================

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Map error to HTTP status code
 * 
 * Returns the appropriate HTTP status code for any error type.
 */
export function errorToHttpStatus(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string };
    switch (prismaError.code) {
      case 'P2002': // Unique constraint violation
        return 409;
      case 'P2025': // Record not found
        return 404;
      case 'P2003': // Foreign key constraint violation
        return 400;
      case 'P2016': // Query interpretation error
        return 400;
      default:
        return 500;
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for specific error names
    if (error.name === 'ValidationError') {
      return 400;
    }
    if (error.name === 'UnauthorizedError') {
      return 401;
    }
    if (error.name === 'ForbiddenError') {
      return 403;
    }
    if (error.name === 'NotFoundError') {
      return 404;
    }
  }
  
  // Default to 500 for unknown errors
  return 500;
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string };
    switch (prismaError.code) {
      case 'P2002':
        return ErrorCodes.DUPLICATE_ENTRY;
      case 'P2025':
        return ErrorCodes.NOT_FOUND_ERROR;
      default:
        return ErrorCodes.DATABASE_ERROR;
    }
  }
  
  return ErrorCodes.INTERNAL_SERVER_ERROR;
}

/**
 * Convert any error to AppError
 * 
 * Useful for normalizing caught errors.
 */
export function toAppError(error: unknown, defaultMessage: string = 'An unexpected error occurred'): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  const message = error instanceof Error ? error.message : defaultMessage;
  const statusCode = errorToHttpStatus(error);
  const code = getErrorCode(error);
  
  // Create appropriate error type based on status code
  switch (statusCode) {
    case 400:
      return new ValidationError(message);
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError(message);
    case 409:
      return new ConflictError(message);
    case 429:
      return new RateLimitError(message);
    default:
      return new InternalServerError(message);
  }
}

/**
 * Get safe error message for client response
 * 
 * Only includes operational error messages for clients.
 * Non-operational errors return a generic message.
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (error.isOperational) {
      return error.message;
    }
    // Non-operational errors should not expose internal details
    return 'An unexpected error occurred. Please try again later.';
  }
  
  if (error instanceof Error) {
    // Only expose message for known safe error types
    if (error.name === 'ValidationError') {
      return error.message;
    }
  }
  
  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Serialize error for logging (includes all details)
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      details: error.details,
      stack: error.stack,
    };
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { error: String(error) };
}
