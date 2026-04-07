/**
 * GDPR Compliance Module
 * Implements GDPR Articles 7, 17, 20 for VALORHIVE
 * Version: v3.26.0
 * 
 * Features:
 * - Right to Erasure (Art. 17) - User self-delete with grace period
 * - Data Portability (Art. 20) - Export all user data as JSON/CSV
 * - Consent Management (Art. 7) - Track and manage consent
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// GDPR Configuration
const GDPR_CONFIG = {
  deletionGracePeriodDays: 30, // Days before permanent deletion
  dataRetentionYears: 7, // For legal/audit purposes
  exportFormats: ['json', 'csv'] as const,
};

/**
 * Request data deletion (Right to Erasure - Art. 17)
 * Initiates a grace period before permanent deletion
 */
export async function requestDataDeletion(
  userId: string,
  sport: SportType,
  reason?: string
): Promise<{
  success: boolean;
  deletionDate: Date;
  gracePeriodEnds: Date;
  error?: string;
}> {
  // Check if user has active registrations or disputes
  const activeRegistrations = await db.tournamentRegistration.count({
    where: {
      userId,
      status: 'CONFIRMED',
      tournament: {
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      },
    },
  });

  if (activeRegistrations > 0) {
    return {
      success: false,
      deletionDate: new Date(),
      gracePeriodEnds: new Date(),
      error: 'Cannot delete account while registered for active tournaments. Please withdraw from all tournaments first.',
    };
  }

  // Check for active disputes
  const activeDisputes = await db.dispute.count({
    where: {
      OR: [
        { initiatorId: userId },
        { respondentId: userId },
      ],
      status: { in: ['OPEN', 'REVIEWING'] },
    },
  });

  if (activeDisputes > 0) {
    return {
      success: false,
      deletionDate: new Date(),
      gracePeriodEnds: new Date(),
      error: 'Cannot delete account while involved in active disputes.',
    };
  }

  // Check for pending payments
  const pendingPayments = await db.paymentLedger.count({
    where: {
      userId,
      status: { in: ['INITIATED', 'PENDING'] },
    },
  });

  if (pendingPayments > 0) {
    return {
      success: false,
      deletionDate: new Date(),
      gracePeriodEnds: new Date(),
      error: 'Cannot delete account with pending payments.',
    };
  }

  const now = new Date();
  const gracePeriodEnds = new Date(now.getTime() + GDPR_CONFIG.deletionGracePeriodDays * 24 * 60 * 60 * 1000);

  // Mark user for deletion
  await db.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivationReason: `GDPR deletion request: ${reason || 'User requested'}`,
      deactivatedAt: now,
      // Store deletion request metadata
      gdprDeletionRequestedAt: now,
      gdprDeletionScheduledFor: gracePeriodEnds,
    } as any, // Type assertion for new fields
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      action: 'GDPR_DELETION_REQUESTED',
      actorId: userId,
      targetType: 'USER',
      targetId: userId,
      metadata: {
        reason,
        gracePeriodEnds: gracePeriodEnds.toISOString(),
        sport,
      },
    },
  });

  // Send confirmation email would be done via notification service

  return {
    success: true,
    deletionDate: gracePeriodEnds,
    gracePeriodEnds,
  };
}

/**
 * Cancel a pending deletion request
 */
export async function cancelDeletionRequest(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { gdprDeletionRequestedAt: true, gdprDeletionScheduledFor: true } as any,
  });

  if (!user || !(user as any).gdprDeletionRequestedAt) {
    return { success: false, error: 'No pending deletion request found' };
  }

  // Restore account
  await db.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      deactivationReason: null,
      deactivatedAt: null,
      gdprDeletionRequestedAt: null,
      gdprDeletionScheduledFor: null,
    } as any,
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      action: 'GDPR_DELETION_CANCELLED',
      actorId: userId,
      targetType: 'USER',
      targetId: userId,
    },
  });

  return { success: true };
}

/**
 * Permanently delete user data
 * Called by cron job after grace period
 */
export async function permanentlyDeleteUser(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      gdprDeletionScheduledFor: true,
    } as any,
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const scheduledDeletion = (user as any).gdprDeletionScheduledFor as Date | null;
  if (scheduledDeletion && new Date() < scheduledDeletion) {
    return { success: false, error: 'Grace period has not ended' };
  }

  // Anonymize user data instead of hard delete
  // This preserves match history integrity while removing PII
  const anonymizedData = {
    email: null,
    phone: null,
    password: null,
    googleId: null,
    firstName: 'Deleted',
    lastName: 'User',
    dob: null,
    gender: null,
    city: null,
    district: null,
    state: null,
    pinCode: null,
    isAnonymized: true,
    anonymizedAt: new Date(),
    gdprDeletionRequestedAt: null,
    gdprDeletionScheduledFor: null,
  };

  await db.user.update({
    where: { id: userId },
    data: anonymizedData,
  });

  // Delete related PII data
  await Promise.all([
    // Delete sessions
    db.session.deleteMany({ where: { userId } }),
    // Delete notifications
    db.notification.deleteMany({ where: { userId } }),
    // Delete MFA data
    db.mfaSecret.deleteMany({ where: { userId } }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
    // Delete follows
    db.userFollow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    // Delete messages (GDPR requirement)
    db.message.deleteMany({ where: { senderId: userId } }),
    // Delete device tokens
    db.deviceToken.deleteMany({ where: { userId } }),
    // Delete notification preferences
    db.emailNotificationSetting.deleteMany({ where: { userId } }),
    // Delete ID verification documents
    db.playerIdVerification.deleteMany({ where: { userId } }),
    // Delete wallet
    db.wallet.deleteMany({ where: { userId } }),
    // Delete consent records (after audit)
    db.gdprConsent.deleteMany({ where: { userId } }),
  ]);

  // Create audit log before deletion
  await db.auditLog.create({
    data: {
      action: 'GDPR_DATA_DELETED',
      actorId: userId,
      targetType: 'USER',
      targetId: userId,
      metadata: {
        deletedAt: new Date().toISOString(),
        anonymized: true,
      },
    },
  });

  return { success: true };
}

/**
 * Export all user data (Data Portability - Art. 20)
 * Returns user data in specified format
 */
export async function exportUserData(
  userId: string,
  format: 'json' | 'csv' = 'json'
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      sessions: {
        select: {
          id: true,
          sport: true,
          createdAt: true,
          expiresAt: true,
        },
      },
      subscriptions: true,
      tournamentRegs: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              sport: true,
              startDate: true,
              endDate: true,
              location: true,
            },
          },
        },
      },
      matchesAsA: {
        include: {
          playerB: { select: { id: true, firstName: true, lastName: true } },
          tournament: { select: { id: true, name: true } },
        },
      },
      matchesAsB: {
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          tournament: { select: { id: true, name: true } },
        },
      },
      achievements: true,
      notifications: {
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          createdAt: true,
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
      },
      followers: {
        include: {
          follower: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      following: {
        include: {
          following: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      messages: {
        take: 100,
        orderBy: { createdAt: 'desc' },
      },
      paymentLedgers: true,
      tournamentResults: {
        include: {
          tournament: { select: { id: true, name: true } },
        },
      },
      gdprConsents: true,
    },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Remove sensitive fields
  const exportData = {
    exportDate: new Date().toISOString(),
    exportFormat: format,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      dob: user.dob,
      gender: user.gender,
      city: user.city,
      district: user.district,
      state: user.state,
      pinCode: user.pinCode,
      sport: user.sport,
      hiddenElo: user.hiddenElo,
      visiblePoints: user.visiblePoints,
      createdAt: user.createdAt,
    },
    sessions: user.sessions,
    subscriptions: user.subscriptions,
    tournamentRegistrations: user.tournamentRegs,
    matches: [...user.matchesAsA, ...user.matchesAsB],
    achievements: user.achievements,
    notifications: user.notifications,
    followers: user.followers,
    following: user.following,
    messages: user.messages,
    payments: user.paymentLedgers,
    tournamentResults: user.tournamentResults,
    consents: user.gdprConsents,
  };

  if (format === 'csv') {
    // Convert to CSV format
    return {
      success: true,
      data: convertToCSV(exportData),
    };
  }

  return { success: true, data: exportData };
}

/**
 * Convert nested JSON to flattened CSV format
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // User basic info
  lines.push('=== USER PROFILE ===');
  lines.push('Field,Value');
  Object.entries(data.user).forEach(([key, value]) => {
    lines.push(`${key},"${value}"`);
  });
  
  // Tournament registrations
  lines.push('\n=== TOURNAMENT REGISTRATIONS ===');
  if (data.tournamentRegistrations.length > 0) {
    lines.push('Tournament Name,Sport,Start Date,Status');
    data.tournamentRegistrations.forEach((reg: any) => {
      lines.push(`"${reg.tournament?.name || 'N/A'}",${reg.tournament?.sport || 'N/A'},${reg.tournament?.startDate || 'N/A'},${reg.status}`);
    });
  }
  
  // Matches
  lines.push('\n=== MATCHES ===');
  if (data.matches.length > 0) {
    lines.push('Tournament,Opponent,Score,Result,Date');
    data.matches.forEach((match: any) => {
      const opponent = match.playerB || match.playerA;
      lines.push(`"${match.tournament?.name || 'N/A'}","${opponent?.firstName || 'N/A'} ${opponent?.lastName || ''}",${match.scoreA || 0}-${match.scoreB || 0},${match.outcome || 'N/A'},${match.playedAt || 'N/A'}`);
    });
  }
  
  // Payments
  lines.push('\n=== PAYMENTS ===');
  if (data.payments.length > 0) {
    lines.push('Amount,Status,Type,Date');
    data.payments.forEach((payment: any) => {
      lines.push(`${payment.amount},${payment.status},${payment.paymentType},${payment.createdAt}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Record consent (Art. 7)
 */
export async function recordConsent(
  userId: string,
  consentType: 'TOS' | 'PRIVACY_POLICY' | 'MARKETING' | 'DATA_PROCESSING' | 'COOKIES',
  granted: boolean,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    source?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  await db.gdprConsent.create({
    data: {
      userId,
      consentType,
      granted,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      source: metadata?.source,
    },
  });

  // Update user record for specific consent types
  if (consentType === 'TOS') {
    await db.user.update({
      where: { id: userId },
      data: { tosAcceptedAt: granted ? new Date() : null },
    });
  }
  
  if (consentType === 'PRIVACY_POLICY') {
    await db.user.update({
      where: { id: userId },
      data: { privacyAcceptedAt: granted ? new Date() : null },
    });
  }

  return { success: true };
}

/**
 * Get consent history for a user
 */
export async function getConsentHistory(userId: string): Promise<any[]> {
  return db.gdprConsent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Withdraw consent
 */
export async function withdrawConsent(
  userId: string,
  consentType: 'MARKETING' | 'COOKIES'
): Promise<{
  success: boolean;
  error?: string;
}> {
  // Record withdrawal
  await recordConsent(userId, consentType, false, { source: 'withdrawal' });

  // For marketing, update notification preferences
  if (consentType === 'MARKETING') {
    await db.emailNotificationSetting.updateMany({
      where: { userId },
      data: { promotional: false },
    });
  }

  return { success: true };
}

/**
 * Get deletion status for a user
 */
export async function getDeletionStatus(userId: string): Promise<{
  hasPendingDeletion: boolean;
  deletionDate?: Date;
  daysRemaining?: number;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      gdprDeletionRequestedAt: true,
      gdprDeletionScheduledFor: true,
    } as any,
  });

  if (!user || !(user as any).gdprDeletionRequestedAt) {
    return { hasPendingDeletion: false };
  }

  const scheduledFor = (user as any).gdprDeletionScheduledFor as Date;
  const daysRemaining = Math.ceil((scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    hasPendingDeletion: true,
    deletionDate: scheduledFor,
    daysRemaining: Math.max(0, daysRemaining),
  };
}
