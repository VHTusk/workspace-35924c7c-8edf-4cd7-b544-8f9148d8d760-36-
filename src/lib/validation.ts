/**
 * Common validation utilities for API routes
 * Provides Zod schemas and helper functions for consistent input validation
 */

import { z } from 'zod';

// Common pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Common ID validation
export const idSchema = z.string().cuid();
export const idParamSchema = z.object({ id: z.string().cuid() });

// Sport type validation
export const sportSchema = z.enum(['CORNHOLE', 'DARTS']);

// Safe parseInt with validation
export function safeParseInt(value: string | null, defaultValue: number, min?: number, max?: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;
  return parsed;
}

// Safe parseFloat with validation
export function safeParseFloat(value: string | null, defaultValue: number, min?: number, max?: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;
  return parsed;
}

// Common field schemas
export const emailSchema = z.string().email().max(255);
export const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number');
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(100);
export const citySchema = z.string().min(1).max(100).optional();
export const stateSchema = z.string().min(1).max(100).optional();

// Tournament status enum
export const tournamentStatusSchema = z.enum([
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'BRACKET_GENERATED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

// Match outcome enum
export const matchOutcomeSchema = z.enum(['PLAYED', 'WALKOVER', 'NO_SHOW', 'FORFEIT', 'BYE']);

// Bracket format enum
export const bracketFormatSchema = z.enum([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
]);

// Gender category enum
export const genderCategorySchema = z.enum(['MALE', 'FEMALE', 'MIXED']);

// Result validation helper
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodIssue[] };

// Validate request body with Zod schema
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: 'Validation failed',
    details: result.error.issues,
  };
}

// Validate query params with Zod schema
export function validateQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams): ValidationResult<T> {
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return validateBody(schema, obj);
}

// Validate route params with Zod schema
export function validateParams<T>(schema: z.ZodSchema<T>, params: Record<string, string | undefined>): ValidationResult<T> {
  return validateBody(schema, params);
}

// Format validation errors for API response
export function formatValidationErrors(errors: z.ZodIssue[]): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const error of errors) {
    const path = error.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  }
  return formatted;
}

// Common API response helper for validation errors
export function validationErrorResponse(result: ValidationResult<unknown>): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: result.success ? undefined : formatValidationErrors(result.details || []),
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Score validation for matches
export const scoreSchema = z.number().int().min(0).max(100);
export const matchScoreSchema = z.object({
  scoreA: scoreSchema,
  scoreB: scoreSchema,
  outcome: matchOutcomeSchema.optional(),
});

// Tournament creation validation
export const createTournamentSchema = z.object({
  name: z.string().min(3).max(200),
  sport: sportSchema,
  type: z.enum(['INDIVIDUAL', 'INTER_ORG', 'INTRA_ORG']),
  scope: z.enum(['CITY', 'DISTRICT', 'STATE', 'NATIONAL']).optional(),
  location: z.string().min(1).max(500),
  startDate: z.string().transform((v) => new Date(v)),
  endDate: z.string().transform((v) => new Date(v)),
  regDeadline: z.string().transform((v) => new Date(v)),
  entryFee: z.number().int().min(0).default(0),
  maxPlayers: z.number().int().positive().max(1000),
  bracketFormat: bracketFormatSchema.optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  isPublic: z.boolean().default(false),
  managerName: z.string().min(1).max(200),
  managerPhone: z.string().regex(/^[6-9]\d{9}$/),
  managerWhatsApp: z.string().regex(/^[6-9]\d{9}$/).optional(),
});

// User profile update validation
export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  dob: z.string().transform((v) => new Date(v)).optional(),
  gender: genderCategorySchema.optional(),
  city: citySchema,
  state: stateSchema,
  district: z.string().max(100).optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
});

// Organization creation validation
export const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['SCHOOL', 'COLLEGE', 'CLUB', 'ASSOCIATION', 'CORPORATE', 'GOVT_ORGANISATION', 'ACADEMY', 'OTHER']),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  city: citySchema,
  district: z.string().max(100).optional(),
  state: stateSchema,
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  sport: sportSchema,
  tosAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
});
