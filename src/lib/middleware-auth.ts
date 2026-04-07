/**
 * Middleware Authentication Utilities
 * 
 * These functions are used by the middleware for token validation.
 * They must NOT use Prisma or any database operations since middleware runs on Edge Runtime.
 */

/**
 * Simple token format validation (without database lookup)
 * This only checks if the token looks valid - actual validation happens in API routes
 */
export function isValidTokenFormat(token: string): boolean {
  // Token should be a 64-character hex string (SHA-256 hash length)
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Check if token format is valid (alias for backwards compatibility)
 */
export function isValidTokenFormatAlias(token: string): boolean {
  return isValidTokenFormat(token);
}
