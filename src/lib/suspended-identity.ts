/**
 * Suspended Identity Service for VALORHIVE
 * 
 * Cross-sport ban propagation system.
 * When a user is banned in one sport, their email/phone is added to this table,
 * preventing them from registering for any other sport using the same identity.
 * 
 * This fixes the "sport-separated identity fragmentation" problem where a banned
 * user could simply register for another sport with the same email/phone.
 */

import { db } from '@/lib/db';

export type IdentifierType = 'EMAIL' | 'PHONE';

export interface SuspensionDetails {
  id: string;
  identifier: string;
  identifierType: IdentifierType;
  reason: string;
  suspendedAt: Date;
  expiresAt: Date | null;
  suspendedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuspensionResult {
  success: boolean;
  suspensionId?: string;
  error?: string;
  alreadySuspended?: boolean;
}

/**
 * Normalize an email address for consistent storage
 * - Lowercase
 * - Trim whitespace
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize a phone number for consistent storage
 * - Remove all non-digit characters
 * - Ensure consistent format
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If the number starts with country code (e.g., +91), keep the last 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  
  return digits;
}

/**
 * Add an identity to the suspension list
 * This should be called when a user is banned
 */
export async function suspendIdentity(
  identifier: string,
  type: IdentifierType,
  reason: string,
  adminId: string,
  expiresAt?: Date
): Promise<SuspensionResult> {
  try {
    // Normalize the identifier
    const normalizedIdentifier = type === 'EMAIL' 
      ? normalizeEmail(identifier) 
      : normalizePhone(identifier);

    if (!normalizedIdentifier) {
      return {
        success: false,
        error: `Invalid ${type.toLowerCase()} format`,
      };
    }

    // Check if already suspended
    const existing = await db.suspendedIdentity.findUnique({
      where: {
        identifier_identifierType: {
          identifier: normalizedIdentifier,
          identifierType: type,
        },
      },
    });

    if (existing) {
      // If already suspended and not expired, return
      if (!existing.expiresAt || existing.expiresAt > new Date()) {
        return {
          success: true,
          suspensionId: existing.id,
          alreadySuspended: true,
        };
      }
      
      // If expired, update the suspension
      await db.suspendedIdentity.update({
        where: { id: existing.id },
        data: {
          reason,
          suspendedAt: new Date(),
          expiresAt,
          suspendedById: adminId,
        },
      });

      return {
        success: true,
        suspensionId: existing.id,
      };
    }

    // Create new suspension
    const suspension = await db.suspendedIdentity.create({
      data: {
        identifier: normalizedIdentifier,
        identifierType: type,
        reason,
        expiresAt,
        suspendedById: adminId,
      },
    });

    return {
      success: true,
      suspensionId: suspension.id,
    };
  } catch (error) {
    console.error('Failed to suspend identity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if an identity is currently suspended
 */
export async function isSuspended(
  identifier: string,
  type: IdentifierType
): Promise<boolean> {
  try {
    // Normalize the identifier
    const normalizedIdentifier = type === 'EMAIL' 
      ? normalizeEmail(identifier) 
      : normalizePhone(identifier);

    if (!normalizedIdentifier) {
      return false;
    }

    const suspension = await db.suspendedIdentity.findUnique({
      where: {
        identifier_identifierType: {
          identifier: normalizedIdentifier,
          identifierType: type,
        },
      },
    });

    if (!suspension) {
      return false;
    }

    // Check if suspension has expired
    if (suspension.expiresAt && suspension.expiresAt < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to check suspension status:', error);
    return false;
  }
}

/**
 * Remove an identity from the suspension list
 * This should be called when a user is unbanned
 */
export async function removeSuspension(
  identifier: string,
  type: IdentifierType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalize the identifier
    const normalizedIdentifier = type === 'EMAIL' 
      ? normalizeEmail(identifier) 
      : normalizePhone(identifier);

    if (!normalizedIdentifier) {
      return {
        success: false,
        error: `Invalid ${type.toLowerCase()} format`,
      };
    }

    await db.suspendedIdentity.delete({
      where: {
        identifier_identifierType: {
          identifier: normalizedIdentifier,
          identifierType: type,
        },
      },
    });

    return { success: true };
  } catch (error) {
    // If the suspension doesn't exist, that's fine
    if (error instanceof Error && error.message.includes('not found')) {
      return { success: true };
    }
    
    console.error('Failed to remove suspension:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get suspension details for an identity
 */
export async function getSuspension(
  identifier: string,
  type: IdentifierType
): Promise<SuspensionDetails | null> {
  try {
    // Normalize the identifier
    const normalizedIdentifier = type === 'EMAIL' 
      ? normalizeEmail(identifier) 
      : normalizePhone(identifier);

    if (!normalizedIdentifier) {
      return null;
    }

    const suspension = await db.suspendedIdentity.findUnique({
      where: {
        identifier_identifierType: {
          identifier: normalizedIdentifier,
          identifierType: type,
        },
      },
    });

    if (!suspension) {
      return null;
    }

    // Check if suspension has expired
    if (suspension.expiresAt && suspension.expiresAt < new Date()) {
      return null;
    }

    return {
      id: suspension.id,
      identifier: suspension.identifier,
      identifierType: suspension.identifierType as IdentifierType,
      reason: suspension.reason,
      suspendedAt: suspension.suspendedAt,
      expiresAt: suspension.expiresAt,
      suspendedById: suspension.suspendedById,
      createdAt: suspension.createdAt,
      updatedAt: suspension.updatedAt,
    };
  } catch (error) {
    console.error('Failed to get suspension:', error);
    return null;
  }
}

/**
 * Check if either email or phone is suspended
 * Useful for registration checks
 */
export async function checkIdentitySuspended(
  email?: string,
  phone?: string
): Promise<{ suspended: boolean; type?: IdentifierType; reason?: string }> {
  // Check email first
  if (email) {
    const suspension = await getSuspension(email, 'EMAIL');
    if (suspension) {
      return {
        suspended: true,
        type: 'EMAIL',
        reason: suspension.reason,
      };
    }
  }

  // Check phone
  if (phone) {
    const suspension = await getSuspension(phone, 'PHONE');
    if (suspension) {
      return {
        suspended: true,
        type: 'PHONE',
        reason: suspension.reason,
      };
    }
  }

  return { suspended: false };
}

/**
 * Suspend both email and phone for a user
 * Convenience function for banning users
 */
export async function suspendUserIdentity(
  email: string | null | undefined,
  phone: string | null | undefined,
  reason: string,
  adminId: string,
  expiresAt?: Date
): Promise<{ success: boolean; emailSuspended?: boolean; phoneSuspended?: boolean; errors?: string[] }> {
  const errors: string[] = [];
  let emailSuspended = false;
  let phoneSuspended = false;

  // Suspend email if provided
  if (email) {
    const result = await suspendIdentity(email, 'EMAIL', reason, adminId, expiresAt);
    if (result.success) {
      emailSuspended = true;
    } else {
      errors.push(`Email suspension failed: ${result.error}`);
    }
  }

  // Suspend phone if provided
  if (phone) {
    const result = await suspendIdentity(phone, 'PHONE', reason, adminId, expiresAt);
    if (result.success) {
      phoneSuspended = true;
    } else {
      errors.push(`Phone suspension failed: ${result.error}`);
    }
  }

  return {
    success: emailSuspended || phoneSuspended,
    emailSuspended,
    phoneSuspended,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Remove suspension for both email and phone
 * Convenience function for unbanning users
 */
export async function removeUserIdentitySuspension(
  email: string | null | undefined,
  phone: string | null | undefined
): Promise<{ success: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // Remove email suspension if provided
  if (email) {
    const result = await removeSuspension(email, 'EMAIL');
    if (!result.success) {
      errors.push(`Email suspension removal failed: ${result.error}`);
    }
  }

  // Remove phone suspension if provided
  if (phone) {
    const result = await removeSuspension(phone, 'PHONE');
    if (!result.success) {
      errors.push(`Phone suspension removal failed: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get all active suspensions (for admin UI)
 */
export async function getAllSuspensions(options?: {
  limit?: number;
  offset?: number;
  identifierType?: IdentifierType;
  includeExpired?: boolean;
}): Promise<{ suspensions: SuspensionDetails[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const now = new Date();

  const where: any = {};

  if (options?.identifierType) {
    where.identifierType = options.identifierType;
  }

  if (!options?.includeExpired) {
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ];
  }

  const [suspensions, total] = await Promise.all([
    db.suspendedIdentity.findMany({
      where,
      orderBy: { suspendedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.suspendedIdentity.count({ where }),
  ]);

  return {
    suspensions: suspensions.map(s => ({
      id: s.id,
      identifier: s.identifier,
      identifierType: s.identifierType as IdentifierType,
      reason: s.reason,
      suspendedAt: s.suspendedAt,
      expiresAt: s.expiresAt,
      suspendedById: s.suspendedById,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    total,
  };
}

/**
 * Clean up expired suspensions
 * Can be called by a cron job
 */
export async function cleanupExpiredSuspensions(): Promise<{ count: number }> {
  const now = new Date();
  
  const result = await db.suspendedIdentity.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  return { count: result.count };
}
