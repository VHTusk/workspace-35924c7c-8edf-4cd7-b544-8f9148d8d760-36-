/**
 * @valorhive/auth
 * 
 * Authentication module for VALORHIVE services.
 * Self-contained auth functions for mini-services.
 * 
 * @example
 * // In a mini-service
 * import { validateSessionToken, getAuthUser } from '@valorhive/auth';
 * 
 * // Validate a session token
 * const session = await validateSessionToken(token);
 * 
 * // Get authenticated user from request
 * const auth = await getAuthUser(request);
 */

// ============================================
// Core Authentication Functions
// ============================================

export {
  // Token extraction
  extractTokenFromRequest,
  extractTokenFromSocketHandshake,
  
  // Token hashing
  hashSessionToken,
  hashToken,
} from './tokens';

// ============================================
// Session Types
// ============================================

export type {
  SessionUser,
  SessionWithUser,
  AdminSessionResult,
  WebSocketAuthResult,
  SessionOrg,
  SessionWithOrg,
} from './session';

export {
  validateSessionToken,
  validateAdminSessionToken,
  validateOrgSessionToken,
  validateWebSocketAuth,
} from './session';

// ============================================
// Request Helper Functions
// ============================================

export {
  // Simple auth patterns
  getAuthUser,
  requireAuth,
  getAuthAdmin,
  requireAdmin,
  getAuthOrg,
  requireOrg,
  getAuthEntity,
  requireEntity,
  
  // Response helpers
  unauthorizedResponse,
  forbiddenResponse,
  
  // Direct request helpers
  getAuthenticatedFromRequest,
  getAuthenticatedAdminFromRequest,
  getAuthenticatedOrgFromRequest,
  getAuthenticatedEntityFromRequest,
} from './request';

// ============================================
// Request Types
// ============================================

export type {
  AuthResult,
  OrgAuthResult,
  EntityAuthResult,
} from './request';
