/**
 * VALORHIVE Cross-Sport Ban Enforcement System
 * 
 * SECURITY: Bans propagate across all sports using identity hashing.
 * When a user is banned in one sport, their identity (email/phone) is
 * suspended across ALL sports to prevent circumvention.
 * 
 * This enforces "one strike and you're out across the platform" policy.
 */

import { db } from './db';
import crypto from 'crypto';

// ============================================
// Identity Hash Functions
// ============================================

/**
 * Generate a consistent hash for an identity (email or phone)
 * Uses SHA-256 for cryptographic security
 */
export function generateIdentityHash(identifier: string): string {
  const normalized = identifier.toLowerCase().trim();
  return crypto
    .createHash('sha256')
    .update(normalized + (process.env.IDENTITY_HASH_SALT || 'valorhive-salt'))
    .digest('hex');
}

/**
 * Generate identity hashes for a user's email and phone
 */
export function generateUserIdentityHashes(
  email: string | null,
  phone: string | null
): { emailHash: string | null; phoneHash: string | null } {
  return {
    emailHash: email ? generateIdentityHash(email) : null,
    phoneHash: phone ? generateIdentityHash(phone) : null,
  };
}

// ============================================
// Cross-Sport Ban Functions
// ============================================

/**
 * Check if an identity (email or phone) is suspended across all sports
 * 
 * @param identifier - Email or phone to check
 * @param identifierType - 'EMAIL' or 'PHONE'
 * @returns Object with suspension status and details
 */
export async function checkCrossSportBan(
  identifier: string,
  identifierType: 'EMAIL' | 'PHONE'
): Promise<{
  isSuspended: boolean;
  reason?: string;
  suspendedAt?: Date;
  expiresAt?: Date;
}> {
  try {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    
    const suspension = await db.suspendedIdentity.findUnique({
      where: {
        identifier_identifierType: {
          identifier: normalizedIdentifier,
          identifierType,
        },
      },
    });

    if (!suspension) {
      return { isSuspended: false };
    }

    // Check if suspension has expired
    if (suspension.expiresAt && suspension.expiresAt < new Date()) {
      // Auto-remove expired suspension
      await db.suspendedIdentity.delete({
        where: { id: suspension.id },
      });
      return { isSuspended: false };
    }

    return {
      isSuspended: true,
      reason: suspension.reason,
      suspendedAt: suspension.suspendedAt,
      expiresAt: suspension.expiresAt || undefined,
    };
  } catch (error) {
    console.error('[CrossSportBan] Error checking suspension:', error);
    // Fail open - don't block on error
    return { isSuspended: false };
  }
}

/**
 * Check both email and phone for cross-sport suspension
 * 
 * @param email - User's email (optional)
 * @param phone - User's phone (optional)
 * @returns Object with overall suspension status
 */
export async function checkUserIdentitySuspension(
  email: string | null,
  phone: string | null
): Promise<{
  isSuspended: boolean;
  suspensionSource: 'EMAIL' | 'PHONE' | null;
  reason?: string;
  suspendedAt?: Date;
  expiresAt?: Date;
}> {
  const defaultSuspensionCheck: Awaited<ReturnType<typeof checkCrossSportBan>> = {
    isSuspended: false,
  };

  const checks = await Promise.all([
    email ? checkCrossSportBan(email, 'EMAIL') : Promise.resolve(defaultSuspensionCheck),
    phone ? checkCrossSportBan(phone, 'PHONE') : Promise.resolve(defaultSuspensionCheck),
  ]);

  const [emailResult, phoneResult] = checks;

  if (emailResult.isSuspended) {
    return {
      isSuspended: true,
      suspensionSource: 'EMAIL',
      reason: emailResult.reason,
      suspendedAt: emailResult.suspendedAt,
      expiresAt: emailResult.expiresAt,
    };
  }

  if (phoneResult.isSuspended) {
    return {
      isSuspended: true,
      suspensionSource: 'PHONE',
      reason: phoneResult.reason,
      suspendedAt: phoneResult.suspendedAt,
      expiresAt: phoneResult.expiresAt,
    };
  }

  return { isSuspended: false, suspensionSource: null };
}

/**
 * Issue a cross-sport ban for a user
 * This should be called when banning a user in one sport
 * 
 * @param userId - The user to ban
 * @param reason - Reason for the ban
 * @param adminId - Admin who issued the ban
 * @param expiresAt - Optional expiration for temporary bans
 */
export async function issueCrossSportBan(
  userId: string,
  reason: string,
  adminId: string,
  expiresAt?: Date
): Promise<{
  success: boolean;
  emailSuspended: boolean;
  phoneSuspended: boolean;
  error?: string;
}> {
  try {
    // Get user's current email and phone
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        sport: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      return {
        success: false,
        emailSuspended: false,
        phoneSuspended: false,
        error: 'User not found',
      };
    }

    const results = { emailSuspended: false, phoneSuspended: false };

    // Suspend email if exists
    if (user.email) {
      try {
        await db.suspendedIdentity.create({
          data: {
            identifier: user.email.toLowerCase().trim(),
            identifierType: 'EMAIL',
            reason,
            suspendedById: adminId,
            expiresAt,
          },
        });
        results.emailSuspended = true;
      } catch (e: any) {
        // May already exist - that's fine
        if (!e.code || e.code !== 'P2002') {
          console.warn('[CrossSportBan] Failed to suspend email:', e);
        } else {
          results.emailSuspended = true; // Already suspended
        }
      }
    }

    // Suspend phone if exists
    if (user.phone) {
      try {
        await db.suspendedIdentity.create({
          data: {
            identifier: user.phone.toLowerCase().trim(),
            identifierType: 'PHONE',
            reason,
            suspendedById: adminId,
            expiresAt,
          },
        });
        results.phoneSuspended = true;
      } catch (e: any) {
        // May already exist - that's fine
        if (!e.code || e.code !== 'P2002') {
          console.warn('[CrossSportBan] Failed to suspend phone:', e);
        } else {
          results.phoneSuspended = true; // Already suspended
        }
      }
    }

    // Log to audit
    await db.auditLog.create({
      data: {
        sport: user.sport,
        action: 'USER_BANNED',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'user',
        targetId: userId,
        reason: `Cross-sport ban issued: ${reason}`,
        metadata: JSON.stringify({
          emailSuspended: results.emailSuspended,
          phoneSuspended: results.phoneSuspended,
          expiresAt: expiresAt?.toISOString() || null,
        }),
      },
    });

    console.log(
      `[CrossSportBan] Ban issued for user ${userId} by ${adminId}: email=${results.emailSuspended}, phone=${results.phoneSuspended}`
    );

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    console.error('[CrossSportBan] Error issuing ban:', error);
    return {
      success: false,
      emailSuspended: false,
      phoneSuspended: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke a cross-sport ban for a user
 * This should be called when unbanning a user
 * 
 * @param userId - The user to unban
 * @param adminId - Admin who is revoking the ban
 * @param reason - Reason for revocation
 */
export async function revokeCrossSportBan(
  userId: string,
  adminId: string,
  reason: string
): Promise<{
  success: boolean;
  emailRevoked: boolean;
  phoneRevoked: boolean;
  error?: string;
}> {
  try {
    // Get user's current email and phone
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        sport: true,
      },
    });

    if (!user) {
      return {
        success: false,
        emailRevoked: false,
        phoneRevoked: false,
        error: 'User not found',
      };
    }

    const results = { emailRevoked: false, phoneRevoked: false };

    // Remove email suspension if exists
    if (user.email) {
      try {
        await db.suspendedIdentity.deleteMany({
          where: {
            identifier: user.email.toLowerCase().trim(),
            identifierType: 'EMAIL',
          },
        });
        results.emailRevoked = true;
      } catch (e) {
        console.warn('[CrossSportBan] Failed to revoke email suspension:', e);
      }
    }

    // Remove phone suspension if exists
    if (user.phone) {
      try {
        await db.suspendedIdentity.deleteMany({
          where: {
            identifier: user.phone.toLowerCase().trim(),
            identifierType: 'PHONE',
          },
        });
        results.phoneRevoked = true;
      } catch (e) {
        console.warn('[CrossSportBan] Failed to revoke phone suspension:', e);
      }
    }

    // Log to audit
    await db.auditLog.create({
      data: {
        sport: user.sport,
        action: 'USER_UNBANNED',
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'user',
        targetId: userId,
        reason: `Cross-sport ban revoked: ${reason}`,
        metadata: JSON.stringify({
          emailRevoked: results.emailRevoked,
          phoneRevoked: results.phoneRevoked,
        }),
      },
    });

    console.log(
      `[CrossSportBan] Ban revoked for user ${userId} by ${adminId}: email=${results.emailRevoked}, phone=${results.phoneRevoked}`
    );

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    console.error('[CrossSportBan] Error revoking ban:', error);
    return {
      success: false,
      emailRevoked: false,
      phoneRevoked: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all suspended identities for admin review
 */
export async function getSuspendedIdentities(options?: {
  limit?: number;
  offset?: number;
  identifierType?: 'EMAIL' | 'PHONE';
}): Promise<{
  identities: Array<{
    id: string;
    identifier: string;
    identifierType: string;
    reason: string;
    suspendedAt: Date;
    expiresAt: Date | null;
    suspendedById: string;
  }>;
  total: number;
}> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const where = options?.identifierType
    ? { identifierType: options.identifierType }
    : {};

  const [identities, total] = await Promise.all([
    db.suspendedIdentity.findMany({
      where,
      orderBy: { suspendedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.suspendedIdentity.count({ where }),
  ]);

  return {
    identities: identities.map((i) => ({
      id: i.id,
      identifier: i.identifier,
      identifierType: i.identifierType,
      reason: i.reason,
      suspendedAt: i.suspendedAt,
      expiresAt: i.expiresAt,
      suspendedById: i.suspendedById,
    })),
    total,
  };
}
