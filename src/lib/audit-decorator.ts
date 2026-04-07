/**
 * VALORHIVE Audit Decorator for API Routes
 * 
 * This module provides a Higher-Order Function (HOF) that wraps API handlers
 * to automatically log actions based on the route and HTTP method.
 * 
 * Usage:
 * ```typescript
 * // In your API route handler
 * import { withAuditLogging } from '@/lib/audit-decorator';
 * 
 * async function handler(request: NextRequest) {
 *   // Your handler logic
 *   return NextResponse.json({ success: true });
 * }
 * 
 * export const POST = withAuditLogging(handler, {
 *   action: 'MATCH_RESULT_ENTERED',
 *   resourceType: 'match',
 *   getResourceId: (body) => body.matchId,
 * });
 * ```
 * 
 * @module audit-decorator
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuditAction, SportType } from '@prisma/client';
import {
  logAction,
  extractIpAddress,
  extractUserAgent,
  type LogActionParams,
} from './audit-helper';
import { getAuthenticatedUser, getAuthenticatedOrg } from './auth';

// ============================================
// TYPES
// ============================================

export interface AuditDecoratorConfig {
  /** The audit action to log */
  action: AuditAction | string;
  /** Type of resource being acted upon */
  resourceType: string;
  /** Function to extract resource ID from request */
  getResourceId?: (body: any, request: NextRequest) => string | Promise<string>;
  /** Function to extract sport from request */
  getSport?: (body: any, request: NextRequest) => SportType | Promise<SportType>;
  /** Function to extract tournament ID from request */
  getTournamentId?: (body: any, request: NextRequest) => string | undefined | Promise<string | undefined>;
  /** Whether to log before the action (for before/after comparison) */
  logBefore?: boolean;
  /** Function to get the "before" state of the resource */
  getBeforeState?: (resourceId: string, request: NextRequest) => any | Promise<any>;
  /** Whether to extract actor from session automatically */
  autoExtractActor?: boolean;
  /** Custom function to determine if action should be logged */
  shouldLog?: (response: NextResponse, body: any) => boolean | Promise<boolean>;
  /** Additional metadata to include */
  metadata?: Record<string, any>;
  /** Whether to log only on success (2xx responses) */
  logOnlyOnSuccess?: boolean;
}

export interface AuditContext {
  userId?: string;
  orgId?: string;
  operatorName?: string;
  operatorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditedNextRequest = NextRequest & {
  auditContext?: AuditContext;
};

type APIHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

type AuditedAPIHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

// ============================================
// AUDIT DECORATOR
// ============================================

/**
 * Higher-Order Function that wraps an API handler with audit logging
 * 
 * @param handler - The API handler to wrap
 * @param config - Configuration for the audit log
 * @returns Wrapped handler with audit logging
 */
export function withAuditLogging(
  handler: APIHandler,
  config: AuditDecoratorConfig
): AuditedAPIHandler {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    let body: any = null;
    let resourceId: string | undefined;
    let sport: SportType | undefined;
    let tournamentId: string | undefined;
    let beforeState: any = undefined;

    // Extract request body for parsing
    try {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        // Clone the request so we can read the body without consuming it
        const clonedRequest = request.clone();
        body = await clonedRequest.json();
      }
    } catch {
      // Body may not be valid JSON or not present
    }

    // Extract context from params if available
    const params = context?.params ? await context.params : {};

    // Extract audit context
    const auditContext = await extractAuditContext(request);

    // Get resource ID
    if (config.getResourceId) {
      resourceId = await config.getResourceId({ ...body, ...params }, request);
    } else if (params.id) {
      resourceId = params.id;
    }

    // Get sport
    if (config.getSport) {
      sport = await config.getSport({ ...body, ...params }, request);
    }

    // Get tournament ID
    if (config.getTournamentId) {
      tournamentId = await config.getTournamentId({ ...body, ...params }, request);
    }

    // Get before state if configured
    if (config.logBefore && config.getBeforeState && resourceId) {
      try {
        beforeState = await config.getBeforeState(resourceId, request);
      } catch (error) {
        console.error('[AuditDecorator] Failed to get before state:', error);
      }
    }

    // Execute the handler
    let response: NextResponse;
    try {
      response = await handler(request, context);
    } catch (error) {
      // Log the error and re-throw
      console.error('[AuditDecorator] Handler error:', error);
      throw error;
    }

    // Check if we should log
    const shouldLog = config.shouldLog
      ? await config.shouldLog(response, body)
      : true;

    // Check success condition
    const isSuccess = response.status >= 200 && response.status < 300;
    if (config.logOnlyOnSuccess !== false && !isSuccess) {
      return response;
    }

    if (!shouldLog) {
      return response;
    }

    // Get after state from response if possible
    let afterState: any = undefined;
    try {
      const responseClone = response.clone();
      const responseBody = await responseClone.json();
      afterState = responseBody.data || responseBody;
    } catch {
      // Response body may not be JSON
    }

    // Log the action
    try {
      await logAction({
        actorId: auditContext.userId || 'system',
        action: config.action,
        resourceType: config.resourceType,
        resourceId: resourceId || 'unknown',
        sport,
        tournamentId,
        before: beforeState,
        after: afterState,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        operatorName: auditContext.operatorName,
        operatorEmail: auditContext.operatorEmail,
        metadata: {
          ...config.metadata,
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          duration: Date.now() - startTime,
          params,
        },
      });
    } catch (error) {
      // Don't fail the request if logging fails
      console.error('[AuditDecorator] Failed to log action:', error);
    }

    return response;
  };
}

// ============================================
// SPECIALIZED DECORATORS
// ============================================

/**
 * Decorator for match-related actions
 */
export function withMatchAudit(
  handler: APIHandler,
  action: 'score_entered' | 'score_edited' | 'score_reverted' | 'disputed' | 'resolved'
): AuditedAPIHandler {
  return withAuditLogging(handler, {
    action: `MATCH_RESULT_${action.toUpperCase()}` as AuditAction,
    resourceType: 'match',
    getResourceId: (body) => body.matchId,
    getTournamentId: (body) => body.tournamentId,
    logOnlyOnSuccess: true,
  });
}

/**
 * Decorator for tournament-related actions
 */
export function withTournamentAudit(
  handler: APIHandler,
  action: 'created' | 'updated' | 'published' | 'started' | 'completed' | 'cancelled'
): AuditedAPIHandler {
  return withAuditLogging(handler, {
    action: action === 'completed' 
      ? 'TOURNAMENT_COMPLETED' 
      : action === 'cancelled'
        ? 'TOURNAMENT_CANCELLED'
        : 'BRACKET_GENERATED',
    resourceType: 'tournament',
    getResourceId: (body, request) => {
      const url = new URL(request.url);
      return body.tournamentId || url.pathname.split('/').pop() || '';
    },
    logOnlyOnSuccess: true,
  });
}

/**
 * Decorator for admin actions
 */
export function withAdminAudit(
  handler: APIHandler,
  action: string,
  resourceType: string
): AuditedAPIHandler {
  return withAuditLogging(handler, {
    action: 'ADMIN_OVERRIDE',
    resourceType,
    logOnlyOnSuccess: true,
    metadata: {
      adminAction: action,
    },
  });
}

/**
 * Decorator for user ban/unban actions
 */
export function withUserBanAudit(handler: APIHandler, isBan: boolean): AuditedAPIHandler {
  return withAuditLogging(handler, {
    action: isBan ? 'USER_BANNED' : 'USER_UNBANNED',
    resourceType: 'user',
    getResourceId: (body) => body.userId,
    logOnlyOnSuccess: true,
  });
}

// ============================================
// ROUTE-BASED AUDIT CONFIGURATIONS
// ============================================

/**
 * Pre-configured audit settings for common routes
 */
export const AUDIT_ROUTE_CONFIGS: Record<string, AuditDecoratorConfig> = {
  // Match routes
  'POST:/api/matches': {
    action: 'MATCH_RESULT_ENTERED',
    resourceType: 'match',
    getResourceId: (body) => body.matchId || body.id,
    logOnlyOnSuccess: true,
  },
  'PUT:/api/matches': {
    action: 'MATCH_RESULT_EDITED',
    resourceType: 'match',
    getResourceId: (body) => body.matchId || body.id,
    logBefore: true,
    logOnlyOnSuccess: true,
  },
  'DELETE:/api/matches': {
    action: 'MATCH_RESULT_REVERTED',
    resourceType: 'match',
    getResourceId: (body, request) => {
      const url = new URL(request.url);
      return url.pathname.split('/').pop() || '';
    },
    logOnlyOnSuccess: true,
  },

  // Tournament routes
  'POST:/api/tournaments': {
    action: 'BRACKET_GENERATED',
    resourceType: 'tournament',
    getResourceId: (body) => body.id,
    logOnlyOnSuccess: true,
  },
  'PUT:/api/tournaments': {
    action: 'BRACKET_GENERATED',
    resourceType: 'tournament',
    getResourceId: (body, request) => {
      const url = new URL(request.url);
      return body.tournamentId || url.pathname.split('/').pop() || '';
    },
    logOnlyOnSuccess: true,
  },

  // Dispute routes
  'POST:/api/disputes': {
    action: 'MATCH_RESULT_EDITED',
    resourceType: 'dispute',
    getResourceId: (body) => body.disputeId || body.id,
    logOnlyOnSuccess: true,
  },
  'PUT:/api/disputes': {
    action: 'DISPUTE_RESOLVED',
    resourceType: 'dispute',
    getResourceId: (body, request) => {
      const url = new URL(request.url);
      return body.disputeId || url.pathname.split('/').pop() || '';
    },
    logOnlyOnSuccess: true,
  },
};

/**
 * Create an audit decorator from a route pattern
 * 
 * @param method - HTTP method
 * @param path - Route path pattern
 * @returns Configured audit decorator
 */
export function createRouteAuditDecorator(
  method: string,
  path: string
): ((handler: APIHandler) => AuditedAPIHandler) | null {
  const key = `${method.toUpperCase()}:${path}`;
  const config = AUDIT_ROUTE_CONFIGS[key];
  
  if (!config) {
    return null;
  }

  return (handler: APIHandler) => withAuditLogging(handler, config);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract audit context from a request
 */
async function extractAuditContext(request: NextRequest): Promise<AuditContext> {
  const context: AuditContext = {
    ipAddress: extractIpAddress(request) || undefined,
    userAgent: extractUserAgent(request) || undefined,
  };

  // Try to get user session
  try {
    const userAuth = await getAuthenticatedUser(request);
    if (userAuth?.user) {
      context.userId = userAuth.user.id;
    }
  } catch {
    // Not authenticated as user
  }

  // Try to get org session
  if (!context.userId) {
    try {
      const orgAuth = await getAuthenticatedOrg(request);
      if (orgAuth?.org) {
        context.orgId = orgAuth.org.id;
        // Check for operator info in session
        if (orgAuth.session.operatorName) {
          context.operatorName = orgAuth.session.operatorName;
        }
        if (orgAuth.session.operatorEmail) {
          context.operatorEmail = orgAuth.session.operatorEmail;
        }
      }
    } catch {
      // Not authenticated as org
    }
  }

  return context;
}

/**
 * Combine multiple audit decorators
 * Useful when an action should be logged in multiple ways
 */
export function combineAuditDecorators(
  ...decorators: Array<(handler: APIHandler) => AuditedAPIHandler>
): (handler: APIHandler) => AuditedAPIHandler {
  return (handler: APIHandler): AuditedAPIHandler => {
    return decorators.reduceRight(
      (acc, decorator) => decorator(acc),
      handler as AuditedAPIHandler
    );
  };
}

/**
 * Conditional audit decorator
 * Only applies audit logging if condition is met
 */
export function conditionalAudit(
  condition: (request: NextRequest) => boolean | Promise<boolean>,
  config: AuditDecoratorConfig
): (handler: APIHandler) => AuditedAPIHandler {
  return (handler: APIHandler): AuditedAPIHandler => {
    return async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
      if (await condition(request)) {
        return withAuditLogging(handler, config)(request, context);
      }
      return handler(request, context);
    };
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create a response with audit context
 * Adds audit context to the response for client-side tracking
 */
export function createAuditedResponse(
  data: any,
  status: number = 200,
  auditInfo?: { actionId?: string; loggedAt?: Date }
): NextResponse {
  return NextResponse.json(
    {
      ...data,
      _audit: auditInfo || { loggedAt: new Date().toISOString() },
    },
    { status }
  );
}

/**
 * Middleware to add audit context to all requests
 * Can be used in middleware.ts for global audit context
 */
export function addAuditContextToRequest(request: NextRequest): NextRequest {
  const auditContext: AuditContext = {
    ipAddress: extractIpAddress(request) || undefined,
    userAgent: extractUserAgent(request) || undefined,
  };

  // Attach to request for later use
  (request as AuditedNextRequest).auditContext = auditContext;
  
  return request;
}

// Re-export types
export type { AuditAction, SportType };
