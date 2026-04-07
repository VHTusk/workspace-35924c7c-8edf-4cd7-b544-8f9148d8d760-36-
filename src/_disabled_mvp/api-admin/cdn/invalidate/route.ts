import { NextRequest, NextResponse } from 'next/server';
import { invalidateCDN, CDN_PATHS } from '@/lib/cdn-invalidation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { AuditAction } from '@prisma/client';

/**
 * POST /api/admin/cdn/invalidate
 * 
 * Manually invalidate CDN cache (admin only)
 * 
 * Body:
 * - type: 'user' | 'tournament' | 'org' | 'leaderboard' | 'custom'
 * - ids: string[] (resource IDs to invalidate)
 * - paths: string[] (custom paths - only for 'custom' type)
 * 
 * Headers:
 * - Authorization: Bearer <session_token>
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { user } = auth;

    // Check if user is admin
    if (!['ADMIN', 'SUB_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { type, ids, paths } = body;

    let result: { success: boolean; errors: string[]; pathsInvalidated?: string[] };

    switch (type) {
      case 'user':
        result = await handleUserInvalidation(ids);
        break;
      case 'tournament':
        result = await handleTournamentInvalidation(ids);
        break;
      case 'org':
        result = await handleOrgInvalidation(ids);
        break;
      case 'leaderboard':
        result = await handleLeaderboardInvalidation(ids);
        break;
      case 'custom':
        if (!paths || !Array.isArray(paths)) {
          return NextResponse.json({ error: 'paths array required for custom type' }, { status: 400 });
        }
        const customResult = await invalidateCDN(paths);
        result = { success: customResult.success, errors: customResult.error ? [customResult.error] : [], pathsInvalidated: paths };
        break;
      default:
        return NextResponse.json({ error: 'Invalid type. Use: user, tournament, org, leaderboard, or custom' }, { status: 400 });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: user.sport || 'CORNHOLE',
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role,
        targetType: 'CDN_CACHE',
        targetId: type || 'custom',
        metadata: JSON.stringify({
          type,
          ids,
          pathsInvalidated: result.pathsInvalidated,
          success: result.success,
        }),
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Invalidated ${result.pathsInvalidated?.length || 0} paths`
        : 'Invalidation failed',
      errors: result.errors,
      pathsInvalidated: result.pathsInvalidated,
    });

  } catch (error) {
    console.error('[CDN API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate CDN cache' },
      { status: 500 }
    );
  }
}

async function handleUserInvalidation(userIds: string[]): Promise<{ success: boolean; errors: string[]; pathsInvalidated: string[] }> {
  const allPaths: string[] = [];
  
  for (const userId of userIds) {
    allPaths.push(...CDN_PATHS.userProfile(userId));
  }

  const result = await invalidateCDN(allPaths);
  return {
    success: result.success,
    errors: result.error ? [result.error] : [],
    pathsInvalidated: allPaths,
  };
}

async function handleTournamentInvalidation(tournamentIds: string[]): Promise<{ success: boolean; errors: string[]; pathsInvalidated: string[] }> {
  const allPaths: string[] = [];
  
  for (const tournamentId of tournamentIds) {
    allPaths.push(...CDN_PATHS.tournamentBracket(tournamentId));
  }

  const result = await invalidateCDN(allPaths);
  return {
    success: result.success,
    errors: result.error ? [result.error] : [],
    pathsInvalidated: allPaths,
  };
}

async function handleOrgInvalidation(orgIds: string[]): Promise<{ success: boolean; errors: string[]; pathsInvalidated: string[] }> {
  const allPaths: string[] = [];
  
  for (const orgId of orgIds) {
    allPaths.push(...CDN_PATHS.orgProfile(orgId));
  }

  const result = await invalidateCDN(allPaths);
  return {
    success: result.success,
    errors: result.error ? [result.error] : [],
    pathsInvalidated: allPaths,
  };
}

async function handleLeaderboardInvalidation(sports: string[]): Promise<{ success: boolean; errors: string[]; pathsInvalidated: string[] }> {
  const allPaths: string[] = [];
  
  for (const sport of sports) {
    allPaths.push(...CDN_PATHS.leaderboard(sport.toUpperCase()));
  }

  const result = await invalidateCDN(allPaths);
  return {
    success: result.success,
    errors: result.error ? [result.error] : [],
    pathsInvalidated: allPaths,
  };
}

/**
 * GET /api/admin/cdn/invalidate
 * 
 * Get CDN configuration and cache status
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const auth = await getAuthenticatedAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { user } = auth;

  if (!['ADMIN', 'SUB_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  return NextResponse.json({
    configured: !!(
      process.env.CDN_URL ||
      process.env.CLOUDFRONT_DISTRIBUTION_ID ||
      process.env.CLOUDFLARE_ZONE_ID
    ),
    provider: process.env.CDN_PROVIDER || 'none',
    cdnUrl: process.env.CDN_URL || null,
    cloudfrontConfigured: !!process.env.CLOUDFRONT_DISTRIBUTION_ID,
    cloudflareConfigured: !!(process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN),
    supportedTypes: ['user', 'tournament', 'org', 'leaderboard', 'custom'],
    pathTemplates: Object.keys(CDN_PATHS),
  });
}
