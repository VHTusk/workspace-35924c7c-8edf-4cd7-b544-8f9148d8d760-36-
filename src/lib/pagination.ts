/**
 * Cursor Pagination Helper
 *
 * Provides stable cursor-based pagination for v1 API routes.
 * Unlike offset pagination, cursor pagination is stable under concurrent requests
 * and provides consistent results even when data is being inserted/deleted.
 *
 * @module pagination
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

// ============================================
// Types
// ============================================

/**
 * Result of cursor pagination
 */
export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Options for cursor pagination
 */
export interface CursorPaginationOptions {
  /** Base64 encoded cursor from previous page */
  cursor?: string | null;
  /** Number of results per page (default 20, max 100) */
  limit?: number;
  /** Field to use for cursor (default 'createdAt') */
  cursorField?: 'id' | 'createdAt';
  /** Sort order (default 'desc') */
  order?: 'asc' | 'desc';
}

/**
 * Decoded cursor data
 */
export interface CursorData {
  /** The cursor field value (id or createdAt timestamp) */
  value: string | number;
  /** Optional secondary field for tie-breaking (usually id) */
  id?: string;
  /** The field that was used for the cursor */
  field: string;
}

/**
 * Response format for paginated API responses
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================
// Constants (exported for external use)
// ============================================

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ============================================
// Cursor Encoding/Decoding
// ============================================

/**
 * Encode cursor data to a base64 string
 *
 * @param data - The cursor data to encode
 * @returns Base64 encoded cursor string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode a base64 cursor string to cursor data
 *
 * @param cursor - Base64 encoded cursor string
 * @returns Decoded cursor data or null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const data = JSON.parse(json) as CursorData;

    // Validate required fields
    if (!data.value || !data.field) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// ============================================
// Pagination Helper Functions
// ============================================

/**
 * Parse and validate pagination options from query parameters
 *
 * @param searchParams - URL search params
 * @returns Validated pagination options
 */
export function parsePaginationOptions(
  searchParams: URLSearchParams
): CursorPaginationOptions {
  const cursor = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');
  const cursorField = searchParams.get('cursorField') as 'id' | 'createdAt' | null;
  const order = searchParams.get('order') as 'asc' | 'desc' | null;

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  return {
    cursor: cursor || undefined,
    limit,
    cursorField: cursorField === 'id' ? 'id' : 'createdAt',
    order: order === 'asc' ? 'asc' : 'desc',
  };
}

/**
 * Build a Prisma where clause for cursor pagination
 *
 * @param decodedCursor - The decoded cursor data
 * @param cursorField - The field used for cursoring
 * @param order - Sort order
 * @returns Prisma where clause for cursor filtering
 */
export function buildCursorWhere<T extends Record<string, unknown>>(
  decodedCursor: CursorData | null,
  cursorField: 'id' | 'createdAt',
  order: 'asc' | 'desc'
): T {
  if (!decodedCursor) {
    return {} as T;
  }

  const { value, id } = decodedCursor;
  const operator = order === 'desc' ? 'lt' : 'gt';

  // For createdAt cursor with id tiebreaker
  if (cursorField === 'createdAt' && id) {
    const cursorDate = new Date(value as string);

    return {
      OR: [
        {
          [cursorField]: { [operator]: cursorDate },
        },
        {
          [cursorField]: { equals: cursorDate },
          id: { [operator]: id },
        },
      ],
    } as unknown as T;
  }

  // For simple id-based cursor
  if (cursorField === 'id') {
    return {
      [cursorField]: { [operator]: value },
    } as unknown as T;
  }

  // Default: just use the field
  return {
    [cursorField]: { [operator]: new Date(value as string) },
  } as unknown as T;
}

/**
 * Build Prisma orderBy clause for cursor pagination
 *
 * @param cursorField - The field used for cursoring
 * @param order - Sort order
 * @returns Prisma orderBy clause
 */
export function buildCursorOrderBy(
  cursorField: 'id' | 'createdAt',
  order: 'asc' | 'desc'
): Array<Record<string, Prisma.SortOrder>> {
  if (cursorField === 'createdAt') {
    // For createdAt, also sort by id for consistent tie-breaking
    return [
      { [cursorField]: order },
      { id: order },
    ];
  }

  return [{ [cursorField]: order }];
}

// ============================================
// Main Pagination Function
// ============================================

/**
 * Generic cursor pagination for Prisma queries
 *
 * This is a low-level helper. For most use cases, use the higher-level
 * `cursorPaginate` function which handles the full pagination flow.
 *
 * @param items - Array of items returned from Prisma query (should be limit + 1)
 * @param options - Pagination options
 * @returns Paginated result with next cursor
 */
export function processPaginationResults<T extends { id: string; createdAt?: Date | null }>(
  items: T[],
  options: Required<CursorPaginationOptions>
): CursorPaginationResult<T> {
  const { limit, cursorField, order } = options;

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;

  // Get the last item for the next cursor
  const lastItem = results[results.length - 1];
  let nextCursor: string | null = null;

  if (hasMore && lastItem) {
    const cursorValue = cursorField === 'createdAt'
      ? (lastItem.createdAt?.toISOString() ?? lastItem.id)
      : lastItem.id;

    nextCursor = encodeCursor({
      value: cursorValue,
      id: lastItem.id,
      field: cursorField,
    });
  }

  return {
    items: results,
    nextCursor,
    hasMore,
  };
}

/**
 * Create a paginated API response in v1 format
 *
 * @param items - Array of items to return
 * @param nextCursor - Next page cursor
 * @param hasMore - Whether more results exist
 * @returns NextResponse with paginated data
 */
export function createPaginatedResponse<T>(
  items: T[],
  nextCursor: string | null,
  hasMore: boolean
): NextResponse<PaginatedResponse<T>> {
  const response = NextResponse.json({
    success: true,
    data: items,
    meta: {
      nextCursor,
      hasMore,
    },
  });

  response.headers.set('X-API-Version', 'v1');
  response.headers.set('X-API-Immutable', 'true');

  return response;
}

// ============================================
// Backward Compatibility Helper
// ============================================

/**
 * Handle backward compatibility for clients using offset pagination
 *
 * If a 'page' parameter is provided, returns offset pagination info.
 * Otherwise, returns cursor pagination info.
 *
 * @param searchParams - URL search params
 * @returns Either cursor options or offset pagination params
 */
export function detectPaginationMode(
  searchParams: URLSearchParams
): { mode: 'cursor'; options: CursorPaginationOptions } | { mode: 'offset'; page: number; limit: number } {
  const page = searchParams.get('page');

  if (page) {
    // Legacy offset pagination
    const pageNum = parseInt(page, 10) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), MAX_LIMIT);

    return {
      mode: 'offset',
      page: pageNum,
      limit,
    };
  }

  // Cursor pagination (default)
  return {
    mode: 'cursor',
    options: parsePaginationOptions(searchParams),
  };
}

/**
 * Build offset pagination info for response
 *
 * @param total - Total count of items
 * @param page - Current page
 * @param limit - Items per page
 * @returns Offset pagination metadata
 */
export function buildOffsetPaginationMeta(
  total: number,
  page: number,
  limit: number
): { page: number; limit: number; total: number; totalPages: number; hasMore: boolean } {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

// ============================================
// Utility for Prisma Query Building
// ============================================

/**
 * Type-safe cursor pagination helper for Prisma findMany
 *
 * Usage:
 * ```typescript
 * const { where, orderBy, take } = buildPrismaPagination(
 *   decodedCursor,
 *   { cursorField: 'createdAt', order: 'desc', limit: 20 }
 * );
 *
 * const items = await db.model.findMany({
 *   where: { ...baseWhere, ...where },
 *   orderBy,
 *   take,
 * });
 * ```
 *
 * @param decodedCursor - Decoded cursor or null for first page
 * @param options - Pagination options
 * @returns Prisma query parameters for pagination
 */
export function buildPrismaPagination(
  decodedCursor: CursorData | null,
  options: CursorPaginationOptions
): {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, Prisma.SortOrder>>;
  take: number;
} {
  const { cursorField = 'createdAt', order = 'desc', limit = DEFAULT_LIMIT } = options;

  return {
    where: buildCursorWhere(decodedCursor, cursorField, order),
    orderBy: buildCursorOrderBy(cursorField, order),
    take: limit + 1, // Take one extra to check hasMore
  };
}

/**
 * Complete cursor pagination flow
 *
 * This helper orchestrates the full pagination flow:
 * 1. Parse options from search params
 * 2. Decode cursor if provided
 * 3. Build Prisma query parameters
 * 4. Process results and generate next cursor
 *
 * @param searchParams - URL search params
 * @param executeQuery - Function to execute the Prisma query with pagination params
 * @returns Paginated result
 */
export async function cursorPaginate<T extends { id: string; createdAt?: Date | null }>(
  searchParams: URLSearchParams,
  executeQuery: (params: {
    cursorWhere: Record<string, unknown>;
    orderBy: Array<Record<string, Prisma.SortOrder>>;
    take: number;
    cursorField: 'id' | 'createdAt';
    order: 'asc' | 'desc';
  }) => Promise<T[]>
): Promise<CursorPaginationResult<T>> {
  const options = parsePaginationOptions(searchParams);
  const { cursor, limit = DEFAULT_LIMIT, cursorField = 'createdAt', order = 'desc' } = options;

  // Decode cursor if provided
  const decodedCursor = cursor ? decodeCursor(cursor) : null;

  // Build query parameters
  const { where, orderBy, take } = buildPrismaPagination(decodedCursor, {
    limit,
    cursorField,
    order,
  });

  // Execute query
  const items = await executeQuery({
    cursorWhere: where,
    orderBy,
    take,
    cursorField,
    order,
  });

  // Process results
  return processPaginationResults(items, {
    cursor: cursor || null,
    limit,
    cursorField,
    order,
  });
}
