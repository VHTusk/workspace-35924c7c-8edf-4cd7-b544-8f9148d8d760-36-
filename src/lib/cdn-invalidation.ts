/**
 * CDN Cache Invalidation Service
 * 
 * Handles cache invalidation for CDN-cached assets.
 * Supports CloudFront (AWS) and Cloudflare.
 * 
 * CRITICAL: Without proper invalidation, users see stale:
 * - Profile images
 * - Tournament brackets
 * - Organization logos
 * - Player cards
 */

// CDN Provider type
type CDNProvider = 'cloudfront' | 'cloudflare' | 'none';

// Get CDN provider from environment
function getCDNProvider(): CDNProvider {
  const provider = process.env.CDN_PROVIDER?.toLowerCase();
  if (provider === 'cloudfront') return 'cloudfront';
  if (provider === 'cloudflare') return 'cloudflare';
  return 'none';
}

// Invalidation paths for different resource types
export const CDN_PATHS = {
  // User profile images
  userAvatar: (userId: string) => [`/profiles/${userId}/*`, `/avatars/${userId}/*`],
  userProfile: (userId: string) => [`/profiles/${userId}/*`, `/cards/${userId}/*`],
  
  // Tournament brackets (HIGH PRIORITY - competitive integrity)
  tournamentBracket: (tournamentId: string) => [
    `/brackets/${tournamentId}/*`,
    `/tournaments/${tournamentId}/bracket/*`,
    `/api/public/bracket/${tournamentId}/*`,
  ],
  tournament: (tournamentId: string) => [
    `/tournaments/${tournamentId}/*`,
    `/brackets/${tournamentId}/*`,
  ],
  
  // Organization assets
  orgLogo: (orgId: string) => [`/orgs/${orgId}/*`, `/logos/${orgId}/*`],
  orgProfile: (orgId: string) => [`/orgs/${orgId}/*`],
  
  // Player cards
  playerCard: (userId: string) => [`/cards/${userId}/*`, `/profiles/${userId}/card/*`],
  
  // Leaderboard (invalidate all sport leaderboards)
  leaderboard: (sport: string) => [
    `/leaderboards/${sport}/*`,
    `/api/public/leaderboard/${sport}/*`,
  ],
};

/**
 * Invalidate CDN cache for given paths
 * 
 * @param paths - Array of paths to invalidate (supports wildcards)
 * @param options - Optional configuration
 */
export async function invalidateCDN(
  paths: string[],
  options?: {
    provider?: CDNProvider;
    waitForCompletion?: boolean;
  }
): Promise<{ success: boolean; invalidationId?: string; error?: string }> {
  const provider = options?.provider || getCDNProvider();

  // No-op in development or when CDN is not configured
  if (provider === 'none') {
    console.log(`[CDN] Skipping invalidation (no CDN configured):`, paths);
    return { success: true };
  }

  try {
    switch (provider) {
      case 'cloudfront':
        return await invalidateCloudFront(paths);
      case 'cloudflare':
        return await invalidateCloudflare(paths);
      default:
        return { success: true };
    }
  } catch (error) {
    console.error('[CDN] Invalidation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * CloudFront invalidation (AWS)
 * 
 * Requires:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - CLOUDFRONT_DISTRIBUTION_ID
 */
async function invalidateCloudFront(paths: string[]): Promise<{ success: boolean; invalidationId?: string; error?: string }> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  
  if (!distributionId) {
    console.warn('[CDN] CloudFront distribution ID not configured');
    return { success: false, error: 'CloudFront not configured' };
  }

  // Use AWS SDK if available, otherwise use API
  // Note: In production, use @aws-sdk/client-cloudfront
  const response = await fetch(
    `https://cloudfront.amazonaws.com/2020-05-31/distribution/${distributionId}/invalidation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // AWS Signature V4 authentication required
        // In production, use AWS SDK which handles auth
      },
      body: JSON.stringify({
        InvalidationBatch: {
          CallerReference: `valorhive-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths.map(p => p.startsWith('/') ? p : `/${p}`),
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`CloudFront API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    invalidationId: data.Invalidation?.Id,
  };
}

/**
 * Cloudflare invalidation
 * 
 * Requires:
 * - CLOUDFLARE_ZONE_ID
 * - CLOUDFLARE_API_TOKEN
 */
async function invalidateCloudflare(paths: string[]): Promise<{ success: boolean; invalidationId?: string; error?: string }> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    console.warn('[CDN] Cloudflare credentials not configured');
    return { success: false, error: 'Cloudflare not configured' };
  }

  // Cloudflare purge cache API
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: paths.map(p => {
          // Convert relative paths to full URLs
          const cdnUrl = process.env.CDN_URL || '';
          if (p.includes('*')) {
            // Cloudflare supports wildcards with 'prefixes' or 'tags'
            return { prefix: p.replace('/*', '') };
          }
          return cdnUrl ? `${cdnUrl}${p}` : p;
        }),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    success: true,
    invalidationId: data.result?.id,
  };
}

/**
 * Batch invalidation for multiple resources
 * Useful for bulk operations like tournament completion
 */
export async function invalidateCDNBatch(
  resources: Array<{ type: keyof typeof CDN_PATHS; id: string }>
): Promise<{ success: boolean; errors: string[] }> {
  const allPaths: string[] = [];
  
  for (const { type, id } of resources) {
    const pathFn = CDN_PATHS[type];
    if (pathFn) {
      allPaths.push(...pathFn(id));
    }
  }

  // Deduplicate paths
  const uniquePaths = [...new Set(allPaths)];

  if (uniquePaths.length === 0) {
    return { success: true, errors: [] };
  }

  const result = await invalidateCDN(uniquePaths);
  
  return {
    success: result.success,
    errors: result.error ? [result.error] : [],
  };
}

/**
 * Invalidate on tournament bracket update
 * HIGH PRIORITY - called after match result entry
 */
export async function invalidateBracketCache(tournamentId: string): Promise<void> {
  const result = await invalidateCDN(CDN_PATHS.tournamentBracket(tournamentId));
  
  if (!result.success) {
    console.error(`[CDN] Failed to invalidate bracket for tournament ${tournamentId}:`, result.error);
    // Don't throw - bracket update should not fail due to CDN issues
  } else {
    console.log(`[CDN] Invalidated bracket cache for tournament ${tournamentId}`);
  }
}

/**
 * Invalidate on profile image update
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
  const result = await invalidateCDN(CDN_PATHS.userProfile(userId));
  
  if (!result.success) {
    console.error(`[CDN] Failed to invalidate profile for user ${userId}:`, result.error);
  } else {
    console.log(`[CDN] Invalidated profile cache for user ${userId}`);
  }
}

/**
 * Invalidate on organization logo update
 */
export async function invalidateOrgCache(orgId: string): Promise<void> {
  const result = await invalidateCDN(CDN_PATHS.orgProfile(orgId));
  
  if (!result.success) {
    console.error(`[CDN] Failed to invalidate org ${orgId}:`, result.error);
  } else {
    console.log(`[CDN] Invalidated org cache for ${orgId}`);
  }
}

/**
 * Invalidate player card after stats update
 */
export async function invalidatePlayerCardCache(userId: string): Promise<void> {
  const result = await invalidateCDN(CDN_PATHS.playerCard(userId));
  
  if (!result.success) {
    console.error(`[CDN] Failed to invalidate player card for ${userId}:`, result.error);
  } else {
    console.log(`[CDN] Invalidated player card cache for ${userId}`);
  }
}

/**
 * Invalidate leaderboard after tournament completion
 */
export async function invalidateLeaderboardCache(sport: string): Promise<void> {
  const result = await invalidateCDN(CDN_PATHS.leaderboard(sport));
  
  if (!result.success) {
    console.error(`[CDN] Failed to invalidate leaderboard for ${sport}:`, result.error);
  } else {
    console.log(`[CDN] Invalidated leaderboard cache for ${sport}`);
  }
}

const cdnInvalidationService = {
  invalidateCDN,
  invalidateCDNBatch,
  invalidateBracketCache,
  invalidateProfileCache,
  invalidateOrgCache,
  invalidatePlayerCardCache,
  invalidateLeaderboardCache,
  CDN_PATHS,
};

export default cdnInvalidationService;
