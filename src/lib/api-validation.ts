/**
 * API Validation Utilities
 * 
 * This module provides standardized input validation for all API routes.
 * Every API route MUST use these utilities to ensure:
 * - Type safety
 * - Clean error responses
 * - Protection against malformed input
 * - Protection against oversized payloads
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

// Maximum request body size (100KB)
const MAX_BODY_SIZE = 100 * 1024;

/**
 * Validation error response helper
 */
export function validationError(message: string, field?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation error',
      message,
      field,
    },
    { status: 400 }
  );
}

/**
 * Parse and validate request body with Zod schema
 * Returns either the validated data or a NextResponse error
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<
  { success: true; data: z.infer<T> } | { success: false; error: NextResponse }
> {
  try {
    // Check content-length header
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return {
        success: false,
        error: validationError('Request body too large. Maximum size is 100KB.'),
      };
    }

    // Clone request to read body
    const clonedRequest = request.clone();
    const text = await clonedRequest.text();

    // Check actual body size
    if (text.length > MAX_BODY_SIZE) {
      return {
        success: false,
        error: validationError('Request body too large. Maximum size is 100KB.'),
      };
    }

    // Check if body is empty when it shouldn't be
    if (!text || text.trim() === '') {
      // Try with empty object for schemas that allow it
      const emptyResult = schema.safeParse({});
      if (emptyResult.success) {
        return { success: true, data: emptyResult.data };
      }
      return {
        success: false,
        error: validationError('Request body is required.'),
      };
    }

    // Parse JSON
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: validationError('Invalid JSON in request body.'),
      };
    }

    // Validate with Zod
    const result = schema.safeParse(json);
    
    if (!result.success) {
      const firstError = result.error.issues[0];
      const field = firstError?.path?.join('.') || undefined;
      const message = firstError?.message || 'Validation failed';
      
      return {
        success: false,
        error: validationError(message, field),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('parseBody error:', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Internal server error during validation' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Safely parse a number from query params with validation
 * Returns NaN if invalid, with optional default value
 */
export function parseNumber(
  value: string | null,
  options?: {
    min?: number;
    max?: number;
    default?: number;
    integer?: boolean;
  }
): number {
  if (value === null || value === undefined || value === '') {
    return options?.default ?? NaN;
  }

  const parsed = options?.integer !== false 
    ? parseInt(value, 10) 
    : parseFloat(value);

  if (isNaN(parsed)) {
    return options?.default ?? NaN;
  }

  if (options?.min !== undefined && parsed < options.min) {
    return options.default ?? options.min;
  }

  if (options?.max !== undefined && parsed > options.max) {
    return options.default ?? options.max;
  }

  return parsed;
}

/**
 * Safely parse a boolean from query params
 */
export function parseBoolean(
  value: string | null,
  defaultValue = false
): boolean {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const lower = value.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Validate required string param
 */
export function parseRequiredString(
  value: string | null,
  fieldName: string
): { success: true; data: string } | { success: false; error: NextResponse } {
  if (!value || value.trim() === '') {
    return {
      success: false,
      error: validationError(`${fieldName} is required`, fieldName),
    };
  }
  return { success: true, data: value.trim() };
}

/**
 * Validate pagination params
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = parseNumber(searchParams.get('page'), { min: 1, default: 1 });
  const limit = parseNumber(searchParams.get('limit'), { min: 1, max: 100, default: 20 });
  
  return {
    page: isNaN(page) ? 1 : page,
    limit: isNaN(limit) ? 20 : limit,
    skip: (isNaN(page) ? 0 : (page - 1)) * (isNaN(limit) ? 20 : limit),
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // ID validation (cuid format)
  cuid: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid ID format'),
  
  // Email validation
  email: z.string().email('Invalid email address'),
  
  // Phone validation (Indian format)
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  
  // Name validation
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  
  // City validation
  city: z.string().min(1, 'City is required').max(100),
  
  // State validation  
  state: z.string().min(1, 'State is required').max(100),
  
  // PIN code validation (Indian)
  pinCode: z.string().regex(/^\d{6}$/, 'Invalid PIN code'),
  
  // Amount validation (in paise)
  amount: z.number().int().min(0).max(1000000000), // Max 1 crore in paise
  
  // Sport type validation
  sportType: z.enum(['CORNHOLE', 'DARTS']),
  
  // Tournament status validation
  tournamentStatus: z.enum([
    'DRAFT',
    'REGISTRATION_OPEN',
    'REGISTRATION_CLOSED',
    'BRACKET_GENERATED',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETED',
    'CANCELLED',
  ]),
};

/**
 * Create a validated API handler wrapper
 */
export function withValidation<T extends z.ZodTypeAny>(
  schema: T,
  handler: (
    data: z.infer<T>,
    context: { request: Request; params?: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (request: Request, context?: { params: Record<string, string> }) => {
    const result = await parseBody(request, schema);
    
    if (!result.success) {
      return result.error;
    }
    
    return handler(result.data, { request, params: context?.params });
  };
}

/**
 * Validate that the user is authenticated
 */
export function requireAuth(
  user: { id: string } | null | undefined
): { success: true; userId: string } | { success: false; error: NextResponse } {
  if (!user?.id) {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  return { success: true, userId: user.id };
}

/**
 * Validate that the user has admin role
 */
export function requireAdmin(
  user: { id: string; role: string } | null | undefined
): { success: true; userId: string } | { success: false; error: NextResponse } {
  const authResult = requireAuth(user);
  if (!authResult.success) return authResult;
  
  if (user!.role !== 'ADMIN' && user!.role !== 'SUPER_ADMIN') {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      ),
    };
  }
  
  return authResult;
}
