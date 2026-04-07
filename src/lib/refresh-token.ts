/**
 * Refresh Token Authentication System for VALORHIVE
 * 
 * Features:
 * - Secure random token generation
 * - Database storage with 30-day expiry
 * - Token validation and rotation
 * - Device tracking and fingerprinting
 * - Multi-device session management
 * - Token revocation support
 * 
 * @version v3.83.0
 */

import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

// ============================================
// Constants
// ============================================

/** Refresh token expiry duration in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/** Refresh token length in bytes (before encoding) */
export const REFRESH_TOKEN_BYTES = 64;

/** Token hash algorithm */
const HASH_ALGORITHM = 'sha256';

// ============================================
// Types and Interfaces
// ============================================

export interface RefreshTokenData {
  id: string;
  token: string;
  userId: string;
  deviceInfo?: DeviceInfo;
  deviceName?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
}

export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  os?: string;
  browser?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
}

export interface CreateRefreshTokenOptions {
  userId: string;
  deviceInfo?: DeviceInfo;
  deviceName?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
}

export interface ValidateRefreshTokenResult {
  valid: boolean;
  token?: RefreshTokenData;
  error?: string;
  needsRotation?: boolean;
}

export interface RotateRefreshTokenResult {
  success: boolean;
  newToken?: string;
  newTokenId?: string;
  error?: string;
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate a secure random token
 * @returns URL-safe base64 encoded token
 */
export function generateRefreshToken(): string {
  const buffer = randomBytes(REFRESH_TOKEN_BYTES);
  return buffer.toString('base64url');
}

/**
 * Hash a token for storage comparison
 * @param token - Plain text token
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return createHash(HASH_ALGORITHM).update(token).digest('hex');
}

/**
 * Calculate expiry date for a new refresh token
 * @returns Date object representing expiry
 */
export function calculateExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiryDate;
}

// ============================================
// Token Storage
// ============================================

/**
 * Create and store a new refresh token
 * @param options - Token creation options
 * @returns Created token data
 */
export async function createRefreshToken(
  options: CreateRefreshTokenOptions
): Promise<RefreshTokenData> {
  const { userId, deviceInfo, deviceName, deviceFingerprint, ipAddress } = options;
  
  // Generate token
  const plainToken = generateRefreshToken();
  const hashedToken = hashToken(plainToken);
  const expiresAt = calculateExpiryDate();
  
  // Store in database
  const refreshToken = await db.refreshToken.create({
    data: {
      token: hashedToken,
      userId,
      deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
      deviceName,
      deviceFingerprint,
      ipAddress,
      expiresAt,
    },
  });
  
  return {
    id: refreshToken.id,
    token: plainToken, // Return plain token (only time it's visible)
    userId: refreshToken.userId,
    deviceInfo,
    deviceName: refreshToken.deviceName || undefined,
    deviceFingerprint: refreshToken.deviceFingerprint || undefined,
    ipAddress: refreshToken.ipAddress || undefined,
    expiresAt: refreshToken.expiresAt,
    createdAt: refreshToken.createdAt,
    lastUsedAt: refreshToken.lastUsedAt || undefined,
    isRevoked: refreshToken.isRevoked,
  };
}

/**
 * Get all active refresh tokens for a user
 * @param userId - User ID
 * @returns List of active tokens
 */
export async function getUserRefreshTokens(userId: string): Promise<RefreshTokenData[]> {
  const tokens = await db.refreshToken.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return tokens.map(token => ({
    id: token.id,
    token: '***', // Don't expose actual token
    userId: token.userId,
    deviceInfo: token.deviceInfo ? JSON.parse(token.deviceInfo) : undefined,
    deviceName: token.deviceName || undefined,
    deviceFingerprint: token.deviceFingerprint || undefined,
    ipAddress: token.ipAddress || undefined,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt || undefined,
    isRevoked: token.isRevoked,
  }));
}

/**
 * Get refresh token count for a user
 * @param userId - User ID
 * @returns Count of active tokens
 */
export async function getUserTokenCount(userId: string): Promise<number> {
  return db.refreshToken.count({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
  });
}

// ============================================
// Token Validation
// ============================================

/**
 * Validate a refresh token
 * @param plainToken - Plain text token to validate
 * @returns Validation result
 */
export async function validateRefreshToken(
  plainToken: string
): Promise<ValidateRefreshTokenResult> {
  const hashedToken = hashToken(plainToken);
  
  const token = await db.refreshToken.findUnique({
    where: { token: hashedToken },
  });
  
  if (!token) {
    return {
      valid: false,
      error: 'TOKEN_NOT_FOUND',
    };
  }
  
  if (token.isRevoked) {
    return {
      valid: false,
      error: 'TOKEN_REVOKED',
    };
  }
  
  if (token.expiresAt < new Date()) {
    return {
      valid: false,
      error: 'TOKEN_EXPIRED',
    };
  }
  
  // Check if token needs rotation (expires in less than 7 days)
  const daysUntilExpiry = Math.floor(
    (token.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Update last used timestamp
  await db.refreshToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });
  
  return {
    valid: true,
    token: {
      id: token.id,
      token: '***',
      userId: token.userId,
      deviceInfo: token.deviceInfo ? JSON.parse(token.deviceInfo) : undefined,
      deviceName: token.deviceName || undefined,
      deviceFingerprint: token.deviceFingerprint || undefined,
      ipAddress: token.ipAddress || undefined,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt || undefined,
      isRevoked: token.isRevoked,
    },
    needsRotation: daysUntilExpiry < 7,
  };
}

// ============================================
// Token Rotation
// ============================================

/**
 * Rotate a refresh token (create new, revoke old)
 * @param oldPlainToken - Current refresh token to rotate
 * @param options - Options for new token
 * @returns Rotation result with new token
 */
export async function rotateRefreshToken(
  oldPlainToken: string,
  options?: Partial<CreateRefreshTokenOptions>
): Promise<RotateRefreshTokenResult> {
  // Validate old token
  const validation = await validateRefreshToken(oldPlainToken);
  
  if (!validation.valid || !validation.token) {
    return {
      success: false,
      error: validation.error,
    };
  }
  
  // Create new token
  const newTokenData = await createRefreshToken({
    userId: validation.token.userId,
    deviceInfo: options?.deviceInfo || validation.token.deviceInfo,
    deviceName: options?.deviceName || validation.token.deviceName,
    deviceFingerprint: options?.deviceFingerprint || validation.token.deviceFingerprint,
    ipAddress: options?.ipAddress || validation.token.ipAddress,
  });
  
  // Revoke old token
  await db.refreshToken.update({
    where: { id: validation.token.id },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: 'TOKEN_ROTATION',
    },
  });
  
  return {
    success: true,
    newToken: newTokenData.token,
    newTokenId: newTokenData.id,
  };
}

// ============================================
// Token Revocation
// ============================================

/**
 * Revoke a specific refresh token
 * @param plainToken - Token to revoke
 * @param reason - Reason for revocation
 * @returns Success status
 */
export async function revokeRefreshToken(
  plainToken: string,
  reason: string = 'USER_LOGOUT'
): Promise<boolean> {
  const hashedToken = hashToken(plainToken);
  
  const result = await db.refreshToken.updateMany({
    where: { token: hashedToken, isRevoked: false },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
  
  return result.count > 0;
}

/**
 * Revoke all refresh tokens for a user
 * @param userId - User ID
 * @param reason - Reason for revocation
 * @returns Count of revoked tokens
 */
export async function revokeAllUserTokens(
  userId: string,
  reason: string = 'USER_LOGOUT_ALL'
): Promise<number> {
  const result = await db.refreshToken.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
  
  return result.count;
}

/**
 * Revoke all refresh tokens for a specific device
 * @param userId - User ID
 * @param deviceFingerprint - Device fingerprint
 * @param reason - Reason for revocation
 * @returns Count of revoked tokens
 */
export async function revokeDeviceTokens(
  userId: string,
  deviceFingerprint: string,
  reason: string = 'DEVICE_LOGOUT'
): Promise<number> {
  const result = await db.refreshToken.updateMany({
    where: {
      userId,
      deviceFingerprint,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
  
  return result.count;
}

// ============================================
// Cleanup
// ============================================

/**
 * Delete expired tokens from database
 * @returns Count of deleted tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  
  return result.count;
}

/**
 * Get device sessions summary for a user
 * @param userId - User ID
 * @returns List of device sessions
 */
export async function getUserDeviceSessions(
  userId: string
): Promise<Array<{
  deviceFingerprint: string | null;
  deviceName: string | null;
  lastUsedAt: Date | null;
  isActive: boolean;
}>> {
  const tokens = await db.refreshToken.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    select: {
      deviceFingerprint: true,
      deviceName: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });
  
  // Group by device fingerprint
  const deviceMap = new Map<string, {
    deviceFingerprint: string | null;
    deviceName: string | null;
    lastUsedAt: Date | null;
    isActive: boolean;
  }>();
  
  for (const token of tokens) {
    const key = token.deviceFingerprint || 'unknown';
    const existing = deviceMap.get(key);
    
    if (!existing || (token.lastUsedAt && (!existing.lastUsedAt || token.lastUsedAt > existing.lastUsedAt))) {
      deviceMap.set(key, {
        deviceFingerprint: token.deviceFingerprint,
        deviceName: token.deviceName,
        lastUsedAt: token.lastUsedAt,
        isActive: true,
      });
    }
  }
  
  return Array.from(deviceMap.values());
}

// ============================================
// Export Types
// ============================================

export type {
  RefreshTokenData as RefreshTokenType,
  DeviceInfo as DeviceInfoType,
  CreateRefreshTokenOptions as CreateRefreshTokenOptionsType,
};
