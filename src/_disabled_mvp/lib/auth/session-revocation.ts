/**
 * Session Revocation Service
 * Handles session invalidation on password change and other security events
 */

import { db } from '@/lib/db';

/**
 * Increment user's session version to invalidate all existing sessions
 * Called when:
 * - Password is changed
 * - Account is compromised
 * - Admin forces logout
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.$transaction([
    // Increment session version on user
    db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    }),
    // Delete all existing sessions for this user
    db.session.deleteMany({
      where: { userId },
    }),
  ]);
  
  console.log(`All sessions invalidated for user: ${userId}`);
}

/**
 * Increment organization's session version to invalidate all sessions
 */
export async function invalidateAllOrgSessions(orgId: string): Promise<void> {
  // Delete all existing sessions for this org
  await db.session.deleteMany({
    where: { orgId },
  });
  
  console.log(`All sessions invalidated for org: ${orgId}`);
}

/**
 * Validate session version matches user's current version
 * This prevents use of old sessions after password change
 */
export async function validateSessionVersion(
  sessionId: string
): Promise<{ valid: boolean; userId?: string; orgId?: string }> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      orgId: true,
      sessionVersion: true,
      user: {
        select: { sessionVersion: true },
      },
    },
  });
  
  if (!session) {
    return { valid: false };
  }
  
  // For user sessions, check version match
  if (session.userId && session.user) {
    if (session.sessionVersion !== session.user.sessionVersion) {
      // Session version mismatch - session is invalid
      // Delete the invalid session
      await db.session.delete({
        where: { id: sessionId },
      });
      console.log(`Session invalidated due to version mismatch: ${sessionId}`);
      return { valid: false };
    }
    return { valid: true, userId: session.userId };
  }
  
  // For org sessions, they don't have version tracking (simpler model)
  if (session.orgId) {
    return { valid: true, orgId: session.orgId };
  }
  
  return { valid: false };
}

/**
 * Create a new session with proper version tracking
 */
export async function createUserSession(
  userId: string,
  token: string,
  sport: string,
  expiresAt: Date,
  deviceInfo?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<void> {
  // Get user's current session version
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  await db.session.create({
    data: {
      token,
      userId,
      sport: sport as any,
      accountType: 'PLAYER',
      expiresAt,
      sessionVersion: user.sessionVersion,
      userAgent: deviceInfo?.userAgent,
      ipAddress: deviceInfo?.ipAddress,
      deviceId: deviceInfo?.deviceId,
    },
  });
}

/**
 * Create a new organization session
 */
export async function createOrgSession(
  orgId: string,
  token: string,
  sport: string,
  expiresAt: Date,
  operatorInfo?: { name?: string; email?: string }
): Promise<void> {
  await db.session.create({
    data: {
      token,
      orgId,
      sport: sport as any,
      accountType: 'ORG',
      expiresAt,
      sessionVersion: 1,
      operatorName: operatorInfo?.name,
      operatorEmail: operatorInfo?.email,
    },
  });
}
