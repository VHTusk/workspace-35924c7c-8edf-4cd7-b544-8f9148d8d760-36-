/**
 * CDN URL Helper
 * 
 * Converts relative URLs to absolute CDN URLs for mobile app compatibility.
 * Mobile apps need absolute URLs to load images directly from CDN.
 * 
 * Usage:
 *   getCDNUrl('/uploads/avatar.png')
 *   // Returns: 'https://cdn.valorhive.com/uploads/avatar.png'
 * 
 *   getCDNUrl('https://example.com/image.png')
 *   // Returns: 'https://example.com/image.png' (already absolute)
 */

/**
 * Get the CDN base URL from environment
 */
export function getCDNBaseURL(): string {
  return process.env.CDN_URL || '';
}

/**
 * Check if CDN is configured
 */
export function isCDNConfigured(): boolean {
  return Boolean(process.env.CDN_URL && process.env.CDN_PROVIDER);
}

/**
 * Convert a relative URL to an absolute CDN URL
 * 
 * @param url - Relative or absolute URL
 * @param fallback - Fallback base URL if CDN is not configured (defaults to NEXT_PUBLIC_BASE_URL)
 * @returns Absolute URL
 */
export function getCDNUrl(url: string | null | undefined, fallback?: string): string | null {
  if (!url) return null;
  
  // Already absolute URL - return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Get base URL
  const cdnBase = getCDNBaseURL();
  const fallbackBase = fallback || process.env.NEXT_PUBLIC_BASE_URL || '';
  
  // Use CDN if configured, otherwise use fallback
  const baseUrl = cdnBase || fallbackBase;
  
  if (!baseUrl) {
    // No base URL configured - return original URL
    return url;
  }
  
  // Ensure URL starts with /
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  
  // Remove trailing slash from base URL
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Convert multiple URLs to absolute CDN URLs
 * Useful for objects with multiple image fields
 * 
 * @param urls - Object with URL values
 * @returns Object with absolute URLs
 */
export function getCDNUrls<T extends Record<string, string | null | undefined>>(
  urls: T
): { [K in keyof T]: string | null } {
  const result: Record<string, string | null> = {};
  
  for (const [key, value] of Object.entries(urls)) {
    result[key] = getCDNUrl(value);
  }
  
  return result as { [K in keyof T]: string | null };
}

/**
 * Transform user profile data to include absolute CDN URLs
 */
export function transformUserUrls(user: {
  avatar?: string | null;
  idDocumentUrl?: string | null;
  [key: string]: unknown;
}) {
  return {
    ...user,
    avatar: getCDNUrl(user.avatar),
    idDocumentUrl: getCDNUrl(user.idDocumentUrl),
  };
}

/**
 * Transform organization data to include absolute CDN URLs
 */
export function transformOrgUrls(org: {
  logo?: string | null;
  bannerImage?: string | null;
  [key: string]: unknown;
}) {
  return {
    ...org,
    logo: getCDNUrl(org.logo),
    bannerImage: getCDNUrl(org.bannerImage),
  };
}

/**
 * Transform tournament data to include absolute CDN URLs
 */
export function transformTournamentUrls(tournament: {
  bannerImage?: string | null;
  qrCodeUrl?: string | null;
  [key: string]: unknown;
}) {
  return {
    ...tournament,
    bannerImage: getCDNUrl(tournament.bannerImage),
    qrCodeUrl: getCDNUrl(tournament.qrCodeUrl),
  };
}

// Default export
const cdnUrlHelper = {
  getCDNUrl,
  getCDNUrls,
  getCDNBaseURL,
  isCDNConfigured,
  transformUserUrls,
  transformOrgUrls,
  transformTournamentUrls,
};

export default cdnUrlHelper;
