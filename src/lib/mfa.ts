/**
 * TOTP-based Multi-Factor Authentication (MFA) System
 * Implements secure MFA for office admins and tournament directors using otplib.
 *
 * Structured office admins are determined by AdminAssignment.
 * Legacy ADMIN / SUB_ADMIN roles are supported only as compatibility fallback.
 */

import { totp } from 'otplib';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import crypto from 'crypto';

// Legacy fallback roles that require MFA
const MFA_REQUIRED_ROLES: Role[] = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];

/**
 * Check if a role requires MFA
 */
export function isMfaRequiredForRole(role: Role): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

/**
 * Generate a TOTP secret
 * Returns a base32-encoded secret for QR code generation
 */
export function generateMfaSecret(): string {
  return generateRandomSecret();
}

/**
 * Generate a random secret for TOTP
 * Uses crypto.randomBytes for cryptographically secure random generation
 */
function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 chars
  const randomBytes = crypto.randomBytes(32);
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[randomBytes[i] % chars.length];
  }
  return secret;
}

/**
 * Verify a TOTP code against a secret
 * Uses time-based window to allow for clock drift
 */
export function verifyMfaCode(secret: string, code: string): boolean {
  try {
    totp.options = {
      window: 1, // Allow 1 period (30s) drift in either direction
    };
    return totp.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/**
 * Generate OTP auth URL for QR code
 * Format: otpauth://totp/VALORHIVE:email?secret=XXX&issuer=VALORHIVE
 */
export function generateOtpAuthUrl(email: string, secret: string): string {
  const issuer = 'VALORHIVE';
  const label = encodeURIComponent(`${issuer}:${email}`);

  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate 8 recovery codes
 * Returns 8 single-use recovery codes
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(generateRecoveryCode());
  }
  return codes;
}

/**
 * Generate a single recovery code
 * Format: XXXX-XXXX-XXXX (12 alphanumeric characters)
 * Uses crypto.randomBytes for cryptographically secure random generation
 */
function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/**
 * Hash a recovery code for storage using SHA-256
 */
export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Setup MFA for a user
 * Creates secret and recovery codes (not yet enabled)
 */
export async function setupMfa(userId: string, email: string): Promise<{
  secret: string;
  otpAuthUrl: string;
  recoveryCodes: string[];
}> {
  const secret = generateMfaSecret();
  const otpAuthUrl = generateOtpAuthUrl(email, secret);
  const recoveryCodes = generateRecoveryCodes();

  // Store secret temporarily (not yet enabled)
  // Will be enabled after first verification
  await db.mfaSecret.upsert({
    where: { userId },
    create: {
      userId,
      secret,
      enabled: false,
    },
    update: {
      secret,
      enabled: false,
    },
  });

  // Delete old recovery codes and store new hashed ones
  await db.mfaRecoveryCode.deleteMany({
    where: { userId },
  });

  for (const code of recoveryCodes) {
    const hashedCode = hashRecoveryCode(code);
    await db.mfaRecoveryCode.create({
      data: {
        userId,
        codeHash: hashedCode,
      },
    });
  }

  return { secret, otpAuthUrl, recoveryCodes };
}

/**
 * Enable MFA after successful verification
 */
export async function enableMfa(userId: string, code: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const mfaSecret = await db.mfaSecret.findUnique({
    where: { userId },
  });

  if (!mfaSecret) {
    return { success: false, error: 'MFA not set up' };
  }

  const isValid = verifyMfaCode(mfaSecret.secret, code);

  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }

  await db.mfaSecret.update({
    where: { userId },
    data: { enabled: true },
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      sport: 'CORNHOLE', // Default sport for audit
      action: 'ADMIN_OVERRIDE' as any, // Using existing enum
      actorId: userId,
      actorRole: 'ADMIN',
      targetType: 'USER',
      targetId: userId,
      metadata: JSON.stringify({ action: 'MFA_ENABLED', enabledAt: new Date().toISOString() }),
    },
  });

  return { success: true };
}

/**
 * Verify MFA code during login
 * Supports both TOTP codes and recovery codes
 */
export async function verifyMfaLogin(
  userId: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
  usedRecoveryCode?: boolean;
}> {
  const mfaSecret = await db.mfaSecret.findUnique({
    where: { userId },
  });

  if (!mfaSecret || !mfaSecret.enabled) {
    return { success: false, error: 'MFA not enabled' };
  }

  // Try TOTP code first
  const isTotpValid = verifyMfaCode(mfaSecret.secret, code);
  if (isTotpValid) {
    return { success: true };
  }

  // Try recovery code
  const hashedCode = hashRecoveryCode(code);
  const recoveryCode = await db.mfaRecoveryCode.findFirst({
    where: {
      userId,
      codeHash: hashedCode,
      usedAt: null, // Not yet used
    },
  });

  if (recoveryCode) {
    // Mark recovery code as used
    await db.mfaRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: { usedAt: new Date() },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        sport: 'CORNHOLE',
        action: 'ADMIN_OVERRIDE' as any,
        actorId: userId,
        actorRole: 'ADMIN',
        targetType: 'USER',
        targetId: userId,
        metadata: JSON.stringify({ action: 'MFA_RECOVERY_CODE_USED', recoveryCodeId: recoveryCode.id }),
      },
    });

    return { success: true, usedRecoveryCode: true };
  }

  return { success: false, error: 'Invalid verification code' };
}

/**
 * Disable MFA for a user
 */
export async function disableMfa(
  userId: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const mfaSecret = await db.mfaSecret.findUnique({
    where: { userId },
  });

  if (!mfaSecret) {
    return { success: false, error: 'MFA not set up' };
  }

  const isValid = verifyMfaCode(mfaSecret.secret, code);

  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }

  await db.mfaSecret.update({
    where: { userId },
    data: { enabled: false },
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      sport: 'CORNHOLE',
      action: 'ADMIN_OVERRIDE' as any,
      actorId: userId,
      actorRole: 'ADMIN',
      targetType: 'USER',
      targetId: userId,
      metadata: JSON.stringify({ action: 'MFA_DISABLED', disabledAt: new Date().toISOString() }),
    },
  });

  return { success: true };
}

/**
 * Get MFA status for a user
 */
export async function getMfaStatus(userId: string): Promise<{
  enabled: boolean;
  setup: boolean;
  recoveryCodesRemaining: number;
}> {
  const mfaSecret = await db.mfaSecret.findUnique({
    where: { userId },
  });

  const recoveryCodesRemaining = await db.mfaRecoveryCode.count({
    where: {
      userId,
      usedAt: null,
    },
  });

  return {
    enabled: mfaSecret?.enabled ?? false,
    setup: !!mfaSecret,
    recoveryCodesRemaining,
  };
}

/**
 * Regenerate recovery codes
 */
export async function regenerateRecoveryCodes(
  userId: string,
  code: string
): Promise<{
  success: boolean;
  recoveryCodes?: string[];
  error?: string;
}> {
  const mfaSecret = await db.mfaSecret.findUnique({
    where: { userId },
  });

  if (!mfaSecret || !mfaSecret.enabled) {
    return { success: false, error: 'MFA not enabled' };
  }

  const isValid = verifyMfaCode(mfaSecret.secret, code);

  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }

  // Delete old recovery codes
  await db.mfaRecoveryCode.deleteMany({
    where: { userId },
  });

  // Generate new recovery codes
  const recoveryCodes = generateRecoveryCodes();

  for (const newCode of recoveryCodes) {
    const hashedCode = hashRecoveryCode(newCode);
    await db.mfaRecoveryCode.create({
      data: {
        userId,
        codeHash: hashedCode,
      },
    });
  }

  // Create audit log
  await db.auditLog.create({
    data: {
      sport: 'CORNHOLE',
      action: 'ADMIN_OVERRIDE' as any,
      actorId: userId,
      actorRole: 'ADMIN',
      targetType: 'USER',
      targetId: userId,
      metadata: JSON.stringify({ action: 'MFA_RECOVERY_CODES_REGENERATED' }),
    },
  });

  return { success: true, recoveryCodes };
}

/**
 * Check if user requires MFA and has it set up
 */
export async function checkMfaRequirement(userId: string): Promise<{
  required: boolean;
  enabled: boolean;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      adminAssignments: {
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    return { required: false, enabled: false };
  }

  const required = user.adminAssignments.length > 0 || isMfaRequiredForRole(user.role);
  
  if (!required) {
    return { required: false, enabled: true };
  }

  const status = await getMfaStatus(userId);
  
  return { required, enabled: status.enabled };
}
