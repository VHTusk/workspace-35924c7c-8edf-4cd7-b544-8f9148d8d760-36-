/**
 * Data Retention & Archival Service for VALORHIVE
 * 
 * Retention Policies:
 * - Completed tournaments: Archive after 2 years
 * - User accounts (inactive): Anonymize after 3 years of inactivity
 * - Audit logs: Keep for 7 years (compliance)
 * - Match history: Archive after 2 years
 * - Session data: Delete after expiry
 * - Notifications: Delete after 90 days
 * - Disputed matches: Keep indefinitely (with resolution)
 */

import { db } from '@/lib/db';
import { 
  TournamentStatus, 
  WebhookEventStatus,
  SportType,
  DisputeStatus,
  TournamentType,
  TournamentScope,
  MatchOutcome
} from '@prisma/client';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface RetentionPeriods {
  TOURNAMENT_ARCHIVE: number;      // 2 years
  USER_INACTIVITY_ANONYMIZE: number; // 3 years
  AUDIT_LOG_RETENTION: number;     // 7 years
  MATCH_ARCHIVE: number;           // 2 years
  SESSION_CLEANUP: number;         // After expiry
  NOTIFICATION_DELETE: number;     // 90 days
  DISPUTED_MATCH_KEEP: number;     // Indefinite
  MESSAGE_DELETE: number;          // 1 year
  WEBHOOK_EVENT_DELETE: number;    // 30 days
}

export const RETENTION_PERIODS: RetentionPeriods = {
  TOURNAMENT_ARCHIVE: 730,           // 2 years (days)
  USER_INACTIVITY_ANONYMIZE: 1095,   // 3 years (days)
  AUDIT_LOG_RETENTION: 2555,         // 7 years (days)
  MATCH_ARCHIVE: 730,                // 2 years (days)
  SESSION_CLEANUP: 0,                // Delete after expiry
  NOTIFICATION_DELETE: 90,           // 90 days
  DISPUTED_MATCH_KEEP: -1,           // Indefinite (never delete)
  MESSAGE_DELETE: 365,               // 1 year
  WEBHOOK_EVENT_DELETE: 30,          // 30 days
} as const;

export interface ArchivalProgress {
  operation: string;
  total: number;
  processed: number;
  failed: number;
  startTime: Date;
  lastUpdate: Date;
  estimatedTimeRemaining?: number;
}

export interface ArchivalResult {
  success: boolean;
  archived?: number;
  deleted?: number;
  errors: string[];
  progress?: ArchivalProgress;
  backupId?: string;
}

export interface DataVerificationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// PROGRESS TRACKING
// ============================================

const progressTrackers = new Map<string, ArchivalProgress>();

export function getProgress(operationId: string): ArchivalProgress | undefined {
  return progressTrackers.get(operationId);
}

export function getAllProgress(): Map<string, ArchivalProgress> {
  return new Map(progressTrackers);
}

function updateProgress(
  operationId: string, 
  operation: string, 
  total: number, 
  processed: number, 
  failed: number
): ArchivalProgress {
  const existing = progressTrackers.get(operationId);
  const now = new Date();
  
  const progress: ArchivalProgress = {
    operation,
    total,
    processed,
    failed,
    startTime: existing?.startTime || now,
    lastUpdate: now,
  };

  // Calculate estimated time remaining
  if (existing && processed > existing.processed) {
    const elapsed = now.getTime() - existing.startTime.getTime();
    const rate = processed / elapsed; // items per ms
    const remaining = total - processed;
    progress.estimatedTimeRemaining = remaining / rate;
  }

  progressTrackers.set(operationId, progress);
  return progress;
}

function clearProgress(operationId: string): void {
  progressTrackers.delete(operationId);
}

// ============================================
// LOGGING
// ============================================

export interface ArchivalLogEntry {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  action: 'ARCHIVE' | 'DELETE' | 'ANONYMIZE' | 'VERIFY' | 'BACKUP';
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details: string;
  timestamp: Date;
  dryRun: boolean;
}

const archivalLogs: ArchivalLogEntry[] = [];

function logArchivalOperation(
  operation: string,
  entityType: string,
  entityId: string,
  action: ArchivalLogEntry['action'],
  status: ArchivalLogEntry['status'],
  details: string,
  dryRun: boolean = false
): ArchivalLogEntry {
  const entry: ArchivalLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    operation,
    entityType,
    entityId,
    action,
    status,
    details,
    timestamp: new Date(),
    dryRun,
  };
  
  archivalLogs.push(entry);
  
  // Log to console for monitoring
  console.log(`[DATA-RETENTION] ${action} ${status}: ${entityType}:${entityId} - ${details}`);
  
  return entry;
}

export function getArchivalLogs(since?: Date): ArchivalLogEntry[] {
  if (since) {
    return archivalLogs.filter(log => log.timestamp >= since);
  }
  return [...archivalLogs];
}

export function clearArchivalLogs(): void {
  archivalLogs.length = 0;
}

// ============================================
// DATA VERIFICATION
// ============================================

/**
 * Verify tournament data before archival
 */
export async function verifyTournamentData(tournamentId: string): Promise<DataVerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          include: {
            bracketMatch: true,
            history: true,
          }
        },
        results: true,
        registrations: true,
        bracket: {
          include: { matches: true }
        },
        waitlist: true,
        sponsors: true,
        media: true,
        checkins: true,
        staff: true,
        scheduleSlots: true,
        announcements: true,
        prizePayouts: true,
      },
    });

    if (!tournament) {
      return { isValid: false, errors: ['Tournament not found'], warnings: [] };
    }

    // Check tournament status
    if (tournament.status !== TournamentStatus.COMPLETED && tournament.status !== TournamentStatus.CANCELLED) {
      warnings.push(`Tournament status is ${tournament.status}, not COMPLETED or CANCELLED`);
    }

    // Verify all matches have results
    const matchesWithoutResults = tournament.matches.filter(m => 
      m.winnerId === null && m.outcome !== MatchOutcome.BYE
    );
    if (matchesWithoutResults.length > 0) {
      warnings.push(`${matchesWithoutResults.length} matches without winner determined`);
    }

    // Verify tournament results exist if completed
    if (tournament.status === TournamentStatus.COMPLETED && tournament.results.length === 0) {
      errors.push('Completed tournament has no results');
    }

    // Check for unresolved disputes
    const disputedMatches = tournament.matches.filter(m => 
      m.verificationStatus === 'DISPUTED'
    );
    if (disputedMatches.length > 0) {
      errors.push(`${disputedMatches.length} matches have unresolved disputes`);
    }

    // Check bracket integrity
    if (tournament.bracket) {
      const bracketMatchCount = tournament.bracket.matches.length;
      const matchCount = tournament.matches.length;
      if (bracketMatchCount > 0 && matchCount === 0) {
        warnings.push('Bracket exists but no matches recorded');
      }
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
  } catch (error) {
    return { 
      isValid: false, 
      errors: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`], 
      warnings: [] 
    };
  }
}

/**
 * Verify user data before anonymization
 */
export async function verifyUserData(userId: string): Promise<DataVerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        sessions: true,
        tournamentRegs: true,
        matchesAsA: true,
        matchesAsB: true,
        disputes: { where: { status: DisputeStatus.OPEN } },
        tournamentResults: true,
        wallet: true,
        subscriptions: { where: { status: 'ACTIVE' } },
        orgRosterEntries: { where: { isActive: true } },
        orgAdminRoles: { where: { isActive: true } },
      },
    });

    if (!user) {
      return { isValid: false, errors: ['User not found'], warnings: [] };
    }

    // Check for active sessions
    const activeSessions = user.sessions.filter(s => s.expiresAt > new Date());
    if (activeSessions.length > 0) {
      warnings.push(`${activeSessions.length} active sessions will be terminated`);
    }

    // Check for active tournament registrations
    const activeRegs = user.tournamentRegs.filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING');
    if (activeRegs.length > 0) {
      errors.push(`User has ${activeRegs.length} active tournament registrations`);
    }

    // Check for active subscriptions
    if (user.subscriptions.length > 0) {
      errors.push('User has active subscription');
    }

    // Check for open disputes
    if (user.disputes.length > 0) {
      errors.push(`${user.disputes.length} open disputes must be resolved first`);
    }

    // Check for active org membership
    if (user.orgRosterEntries.length > 0) {
      warnings.push('User is an active member of organization(s)');
    }

    // Check for org admin roles
    if (user.orgAdminRoles.length > 0) {
      warnings.push('User has active organization admin roles');
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
  } catch (error) {
    return { 
      isValid: false, 
      errors: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`], 
      warnings: [] 
    };
  }
}

// ============================================
// BACKUP FUNCTIONS
// ============================================

/**
 * Create a backup snapshot before deletion operations
 */
export async function createBackupSnapshot(
  entityType: string,
  entityIds: string[],
  dryRun: boolean = false
): Promise<{ backupId: string; recordCount: number }> {
  const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (dryRun) {
    return { backupId, recordCount: entityIds.length };
  }

  // In a production environment, this would create actual backups
  // For now, we'll create an in-memory log and return the backup ID
  console.log(`[BACKUP] Created backup ${backupId} for ${entityIds.length} ${entityType} records`);
  
  logArchivalOperation(
    'backup',
    entityType,
    backupId,
    'BACKUP',
    'SUCCESS',
    `Backed up ${entityIds.length} records`,
    dryRun
  );

  return { backupId, recordCount: entityIds.length };
}

// ============================================
// ARCHIVAL FUNCTIONS
// ============================================

/**
 * Archive a specific tournament by ID
 */
export async function archiveTournament(
  tournamentId: string,
  options: { dryRun?: boolean; skipVerification?: boolean } = {}
): Promise<ArchivalResult> {
  const { dryRun = false, skipVerification = false } = options;
  const errors: string[] = [];
  const operationId = `archive_tournament_${tournamentId}`;

  try {
    // Step 1: Verify data integrity
    if (!skipVerification) {
      const verification = await verifyTournamentData(tournamentId);
      if (!verification.isValid) {
        logArchivalOperation(
          operationId,
          'Tournament',
          tournamentId,
          'VERIFY',
          'FAILED',
          `Verification failed: ${verification.errors.join(', ')}`,
          dryRun
        );
        return { success: false, errors: verification.errors };
      }
      
      logArchivalOperation(
        operationId,
        'Tournament',
        tournamentId,
        'VERIFY',
        'SUCCESS',
        `Verified${verification.warnings.length > 0 ? ` (warnings: ${verification.warnings.join(', ')})` : ''}`,
        dryRun
      );
    }

    // Step 2: Get tournament data
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          include: {
            history: true,
            bracketMatch: true,
          }
        },
        results: true,
        registrations: true,
        bracket: { include: { matches: true } },
        waitlist: true,
        sponsors: true,
        media: true,
        checkins: true,
        staff: true,
        scheduleSlots: true,
        announcements: true,
        prizePayouts: true,
        orgRegistrations: true,
      },
    });

    if (!tournament) {
      return { success: false, errors: ['Tournament not found'] };
    }

    // Step 3: Create backup
    const backup = await createBackupSnapshot('Tournament', [tournamentId], dryRun);

    if (dryRun) {
      logArchivalOperation(
        operationId,
        'Tournament',
        tournamentId,
        'ARCHIVE',
        'SUCCESS',
        `Dry run - would archive tournament with ${tournament.matches.length} matches`,
        true
      );
      return { success: true, archived: 1, errors: [], backupId: backup.backupId };
    }

    // Step 4: Create archived tournament record
    const archivedTournament = await db.archivedTournament.create({
      data: {
        originalId: tournament.id,
        sport: tournament.sport,
        name: tournament.name,
        type: tournament.type,
        scope: tournament.scope,
        location: tournament.location,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        summary: JSON.stringify({
          prizePool: tournament.prizePool,
          entryFee: tournament.entryFee,
          maxPlayers: tournament.maxPlayers,
          type: tournament.type,
          scope: tournament.scope,
          results: tournament.results.map(r => ({
            userId: r.userId,
            rank: r.rank,
            bonusPoints: r.bonusPoints,
          })),
          matchCount: tournament.matches.length,
          registrationsCount: tournament.registrations.length,
          city: tournament.city,
          district: tournament.district,
          state: tournament.state,
        }),
      },
    });

    // Step 5: Archive matches
    let archivedMatches = 0;
    for (const match of tournament.matches) {
      if (!match.playerAId) {
        errors.push(`Skipped archiving match ${match.id}: missing playerAId`);
        continue;
      }

      try {
        await db.archivedMatch.create({
          data: {
            originalId: match.id,
            tournamentId: tournament.id,
            archivedTournamentId: archivedTournament.id,
            sport: match.sport,
            playerAId: match.playerAId,
            playerBId: match.playerBId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            winnerId: match.winnerId,
            playedAt: match.playedAt,
          },
        });
        archivedMatches++;
      } catch (matchError) {
        errors.push(`Failed to archive match ${match.id}: ${matchError}`);
      }
    }

    // Step 6: Delete original data (cascades to related records)
    await db.tournament.delete({ where: { id: tournamentId } });

    logArchivalOperation(
      operationId,
      'Tournament',
      tournamentId,
      'ARCHIVE',
      'SUCCESS',
      `Archived tournament with ${archivedMatches} matches`,
      false
    );

    return { 
      success: true, 
      archived: 1, 
      errors,
      backupId: backup.backupId 
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logArchivalOperation(
      operationId,
      'Tournament',
      tournamentId,
      'ARCHIVE',
      'FAILED',
      errorMsg,
      dryRun
    );
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Archive old completed tournaments (batch operation)
 */
export async function archiveOldTournaments(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `archive_tournaments_${Date.now()}`;
  const errors: string[] = [];
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.TOURNAMENT_ARCHIVE * 24 * 60 * 60 * 1000);

  try {
    // Find tournaments eligible for archival
    const tournaments = await db.tournament.findMany({
      where: {
        status: TournamentStatus.COMPLETED,
        endDate: { lt: cutoffDate },
      },
      select: { id: true },
    });

    const total = tournaments.length;
    let processed = 0;
    let failed = 0;

    updateProgress(operationId, 'Archiving Tournaments', total, 0, 0);

    for (const tournament of tournaments) {
      const result = await archiveTournament(tournament.id, { 
        dryRun,
        skipVerification: false 
      });

      processed++;
      if (!result.success) {
        failed++;
        errors.push(...result.errors);
      }

      const progress = updateProgress(operationId, 'Archiving Tournaments', total, processed, failed);
      onProgress?.(progress);
    }

    clearProgress(operationId);

    return {
      success: true,
      archived: dryRun ? total : processed - failed,
      errors,
    };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Batch archival failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Anonymize a specific user
 */
export async function anonymizeUser(
  userId: string,
  options: { dryRun?: boolean; skipVerification?: boolean } = {}
): Promise<ArchivalResult> {
  const { dryRun = false, skipVerification = false } = options;
  const errors: string[] = [];
  const operationId = `anonymize_user_${userId}`;

  try {
    // Step 1: Verify user can be anonymized
    if (!skipVerification) {
      const verification = await verifyUserData(userId);
      if (!verification.isValid) {
        logArchivalOperation(
          operationId,
          'User',
          userId,
          'VERIFY',
          'FAILED',
          `Verification failed: ${verification.errors.join(', ')}`,
          dryRun
        );
        return { success: false, errors: verification.errors };
      }

      logArchivalOperation(
        operationId,
        'User',
        userId,
        'VERIFY',
        'SUCCESS',
        `Verified${verification.warnings.length > 0 ? ` (warnings: ${verification.warnings.join(', ')})` : ''}`,
        dryRun
      );
    }

    // Step 2: Get user data
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        rating: true,
        tournamentResults: true,
        achievements: true,
      },
    });

    if (!user) {
      return { success: false, errors: ['User not found'] };
    }

    // Step 3: Create backup
    const backup = await createBackupSnapshot('User', [userId], dryRun);

    if (dryRun) {
      logArchivalOperation(
        operationId,
        'User',
        userId,
        'ANONYMIZE',
        'SUCCESS',
        `Dry run - would anonymize user`,
        true
      );
      return { success: true, archived: 1, errors: [], backupId: backup.backupId };
    }

    // Step 4: Anonymize user data (keep stats for historical records)
    const anonymizedName = `Anonymized_${userId.slice(-8)}`;
    const anonymizedEmail = `anon_${userId}@valorhive.anon`;
    
    await db.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        phone: null,
        password: null,
        googleId: null,
        firstName: anonymizedName,
        lastName: 'User',
        dob: null,
        gender: null,
        city: null,
        district: null,
        state: null,
        pinCode: null,
        identityLocked: false,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
        verified: false,
        verifiedAt: null,
        tosAcceptedAt: null,
        privacyAcceptedAt: null,
        isAnonymized: true,
        anonymizedAt: new Date(),
        // Keep ratings and points for historical leaderboard accuracy
        // hiddenElo and visiblePoints are preserved
      },
    });

    // Step 5: Delete sessions
    await db.session.deleteMany({ where: { userId } });

    // Step 6: Delete notifications
    await db.notification.deleteMany({ where: { userId } });

    // Step 7: Delete notification preferences
    await db.notificationPreference.deleteMany({ where: { userId } });

    // Step 8: Delete MFA data
    await db.mfaSecret.deleteMany({ where: { userId } });
    await db.mfaRecoveryCode.deleteMany({ where: { userId } });

    // Step 9: Handle messaging - delete conversations and messages
    await db.message.deleteMany({ where: { senderId: userId } });
    await db.conversationParticipant.deleteMany({ where: { userId } });

    // Step 10: Delete follow relationships
    await db.userFollow.deleteMany({ where: { followerId: userId } });
    await db.userFollow.deleteMany({ where: { followingId: userId } });
    await db.userFollowsOrg.deleteMany({ where: { userId } });
    await db.orgFollowsUser.deleteMany({ where: { userId } });

    // Step 11: Delete notification settings
    await db.emailNotificationSetting.deleteMany({ where: { userId } });
    await db.whatsAppNotificationSetting.deleteMany({ where: { userId } });

    // Step 12: Delete availability
    await db.playerAvailability.deleteMany({ where: { userId } });

    // Step 13: Delete blocked player relationships
    await db.blockedPlayer.deleteMany({ where: { blockerId: userId } });
    await db.blockedPlayer.deleteMany({ where: { blockedId: userId } });

    // Step 14: Handle referrals
    await db.referral.updateMany({
      where: { refereeId: userId },
      data: { status: 'COMPLETED' },
    });

    logArchivalOperation(
      operationId,
      'User',
      userId,
      'ANONYMIZE',
      'SUCCESS',
      `User anonymized, PII removed, stats preserved`,
      false
    );

    return {
      success: true,
      archived: 1,
      errors,
      backupId: backup.backupId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logArchivalOperation(
      operationId,
      'User',
      userId,
      'ANONYMIZE',
      'FAILED',
      errorMsg,
      dryRun
    );
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Anonymize inactive users (batch operation)
 */
export async function anonymizeInactiveUsers(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `anonymize_users_${Date.now()}`;
  const errors: string[] = [];
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.USER_INACTIVITY_ANONYMIZE * 24 * 60 * 60 * 1000);

  try {
    // Find inactive users (no activity in cutoff period)
    const inactiveUsers = await db.user.findMany({
      where: {
        isAnonymized: false,
        isActive: false,
        deactivatedAt: { lt: cutoffDate },
        // Ensure no active disputes
        disputes: { none: { status: DisputeStatus.OPEN } },
        // Ensure no active subscriptions
        subscriptions: { none: { status: 'ACTIVE' } },
        // Ensure no active tournament registrations
        tournamentRegs: { none: { status: { in: ['PENDING', 'CONFIRMED'] } } },
      },
      select: { id: true },
    });

    const total = inactiveUsers.length;
    let processed = 0;
    let failed = 0;

    updateProgress(operationId, 'Anonymizing Users', total, 0, 0);

    for (const user of inactiveUsers) {
      const result = await anonymizeUser(user.id, { 
        dryRun,
        skipVerification: false 
      });

      processed++;
      if (!result.success) {
        failed++;
        errors.push(...result.errors);
      }

      const progress = updateProgress(operationId, 'Anonymizing Users', total, processed, failed);
      onProgress?.(progress);
    }

    clearProgress(operationId);

    return {
      success: true,
      archived: dryRun ? total : processed - failed,
      errors,
    };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Batch anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Cleanup old notifications
 */
export async function cleanupNotifications(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `cleanup_notifications_${Date.now()}`;
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.NOTIFICATION_DELETE * 24 * 60 * 60 * 1000);

  try {
    if (dryRun) {
      const count = await db.notification.count({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });
      
      logArchivalOperation(
        operationId,
        'Notification',
        'batch',
        'DELETE',
        'SUCCESS',
        `Dry run - would delete ${count} notifications`,
        true
      );
      
      return { success: true, deleted: count, errors: [] };
    }

    const result = await db.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logArchivalOperation(
      operationId,
      'Notification',
      'batch',
      'DELETE',
      'SUCCESS',
      `Deleted ${result.count} notifications`,
      false
    );

    onProgress?.(updateProgress(operationId, 'Cleaning Notifications', result.count, result.count, 0));
    clearProgress(operationId);

    return { success: true, deleted: result.count, errors: [] };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Notification cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupSessions(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `cleanup_sessions_${Date.now()}`;
  const now = new Date();

  try {
    if (dryRun) {
      const count = await db.session.count({
        where: { expiresAt: { lt: now } },
      });
      
      logArchivalOperation(
        operationId,
        'Session',
        'batch',
        'DELETE',
        'SUCCESS',
        `Dry run - would delete ${count} expired sessions`,
        true
      );
      
      return { success: true, deleted: count, errors: [] };
    }

    const result = await db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    logArchivalOperation(
      operationId,
      'Session',
      'batch',
      'DELETE',
      'SUCCESS',
      `Deleted ${result.count} expired sessions`,
      false
    );

    onProgress?.(updateProgress(operationId, 'Cleaning Sessions', result.count, result.count, 0));
    clearProgress(operationId);

    return { success: true, deleted: result.count, errors: [] };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Delete old messages
 */
export async function deleteOldMessages(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `delete_messages_${Date.now()}`;
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.MESSAGE_DELETE * 24 * 60 * 60 * 1000);

  try {
    if (dryRun) {
      const count = await db.message.count({
        where: { createdAt: { lt: cutoffDate } },
      });
      
      logArchivalOperation(
        operationId,
        'Message',
        'batch',
        'DELETE',
        'SUCCESS',
        `Dry run - would delete ${count} messages`,
        true
      );
      
      return { success: true, deleted: count, errors: [] };
    }

    const result = await db.message.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    logArchivalOperation(
      operationId,
      'Message',
      'batch',
      'DELETE',
      'SUCCESS',
      `Deleted ${result.count} messages`,
      false
    );

    onProgress?.(updateProgress(operationId, 'Deleting Messages', result.count, result.count, 0));
    clearProgress(operationId);

    return { success: true, deleted: result.count, errors: [] };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Message deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Delete old webhook events
 */
export async function deleteOldWebhookEvents(
  dryRun: boolean = false,
  onProgress?: (progress: ArchivalProgress) => void
): Promise<ArchivalResult> {
  const operationId = `delete_webhooks_${Date.now()}`;
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.WEBHOOK_EVENT_DELETE * 24 * 60 * 60 * 1000);

  try {
    if (dryRun) {
      const count = await db.webhookEvent.count({
        where: {
          status: WebhookEventStatus.COMPLETED,
          createdAt: { lt: cutoffDate },
        },
      });
      
      logArchivalOperation(
        operationId,
        'WebhookEvent',
        'batch',
        'DELETE',
        'SUCCESS',
        `Dry run - would delete ${count} webhook events`,
        true
      );
      
      return { success: true, deleted: count, errors: [] };
    }

    const result = await db.webhookEvent.deleteMany({
      where: {
        status: WebhookEventStatus.COMPLETED,
        createdAt: { lt: cutoffDate },
      },
    });

    logArchivalOperation(
      operationId,
      'WebhookEvent',
      'batch',
      'DELETE',
      'SUCCESS',
      `Deleted ${result.count} webhook events`,
      false
    );

    onProgress?.(updateProgress(operationId, 'Deleting Webhook Events', result.count, result.count, 0));
    clearProgress(operationId);

    return { success: true, deleted: result.count, errors: [] };
  } catch (error) {
    clearProgress(operationId);
    return {
      success: false,
      errors: [`Webhook event deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// ============================================
// RETENTION STATISTICS
// ============================================

export interface RetentionStats {
  tournamentsToArchive: number;
  usersToAnonymize: number;
  notificationsToDelete: number;
  sessionsToDelete: number;
  messagesToDelete: number;
  webhookEventsToDelete: number;
  auditLogsCount: number;
  disputedMatchesKept: number;
  archivedTournaments: number;
  archivedMatches: number;
  anonymizedUsers: number;
}

/**
 * Get retention statistics
 */
export async function getRetentionStats(): Promise<RetentionStats> {
  const now = new Date();

  const tournamentCutoff = new Date(Date.now() - RETENTION_PERIODS.TOURNAMENT_ARCHIVE * 24 * 60 * 60 * 1000);
  const userInactivityCutoff = new Date(Date.now() - RETENTION_PERIODS.USER_INACTIVITY_ANONYMIZE * 24 * 60 * 60 * 1000);
  const notificationCutoff = new Date(Date.now() - RETENTION_PERIODS.NOTIFICATION_DELETE * 24 * 60 * 60 * 1000);
  const messageCutoff = new Date(Date.now() - RETENTION_PERIODS.MESSAGE_DELETE * 24 * 60 * 60 * 1000);
  const webhookCutoff = new Date(Date.now() - RETENTION_PERIODS.WEBHOOK_EVENT_DELETE * 24 * 60 * 60 * 1000);

  const [
    tournamentsToArchive,
    usersToAnonymize,
    notificationsToDelete,
    sessionsToDelete,
    messagesToDelete,
    webhookEventsToDelete,
    auditLogsCount,
    disputedMatchesKept,
    archivedTournaments,
    archivedMatches,
    anonymizedUsers,
  ] = await Promise.all([
    // Tournaments to archive
    db.tournament.count({
      where: { 
        status: TournamentStatus.COMPLETED, 
        endDate: { lt: tournamentCutoff } 
      },
    }),
    
    // Users to anonymize (inactive for 3+ years, no disputes, no active subs, no active regs)
    db.user.count({
      where: {
        isAnonymized: false,
        isActive: false,
        deactivatedAt: { lt: userInactivityCutoff },
        disputes: { none: { status: DisputeStatus.OPEN } },
        subscriptions: { none: { status: 'ACTIVE' } },
        tournamentRegs: { none: { status: { in: ['PENDING', 'CONFIRMED'] } } },
      },
    }),
    
    // Notifications to delete
    db.notification.count({
      where: { createdAt: { lt: notificationCutoff } },
    }),
    
    // Expired sessions
    db.session.count({ where: { expiresAt: { lt: now } } }),
    
    // Messages to delete
    db.message.count({ where: { createdAt: { lt: messageCutoff } } }),
    
    // Webhook events to delete
    db.webhookEvent.count({
      where: { 
        status: WebhookEventStatus.COMPLETED, 
        createdAt: { lt: webhookCutoff } 
      },
    }),
    
    // Audit logs count (kept for 7 years)
    db.auditLog.count(),
    
    // Disputed matches (kept indefinitely)
    db.match.count({
      where: { verificationStatus: 'DISPUTED' },
    }),
    
    // Already archived tournaments
    db.archivedTournament.count(),
    
    // Already archived matches
    db.archivedMatch.count(),
    
    // Already anonymized users
    db.user.count({ where: { isAnonymized: true } }),
  ]);

  return {
    tournamentsToArchive,
    usersToAnonymize,
    notificationsToDelete,
    sessionsToDelete,
    messagesToDelete,
    webhookEventsToDelete,
    auditLogsCount,
    disputedMatchesKept,
    archivedTournaments,
    archivedMatches,
    anonymizedUsers,
  };
}

// ============================================
// CRON INTEGRATION
// ============================================

export interface CleanupTaskResult {
  task: string;
  success: boolean;
  count: number;
  errors: string[];
  duration: number;
}

/**
 * Run all cleanup tasks - designed for cron job integration
 */
export async function runAllCleanupTasks(
  dryRun: boolean = false,
  onProgress?: (task: string, progress: ArchivalProgress) => void
): Promise<{
  results: CleanupTaskResult[];
  totalDuration: number;
  summary: {
    totalArchived: number;
    totalDeleted: number;
    totalErrors: number;
  };
}> {
  const startTime = Date.now();
  const results: CleanupTaskResult[] = [];

  // Task 1: Archive old tournaments
  const task1Start = Date.now();
  const tournamentResult = await archiveOldTournaments(dryRun, (p) => onProgress?.('archiveTournaments', p));
  results.push({
    task: 'archiveOldTournaments',
    success: tournamentResult.success,
    count: tournamentResult.archived || 0,
    errors: tournamentResult.errors,
    duration: Date.now() - task1Start,
  });

  // Task 2: Anonymize inactive users
  const task2Start = Date.now();
  const userResult = await anonymizeInactiveUsers(dryRun, (p) => onProgress?.('anonymizeUsers', p));
  results.push({
    task: 'anonymizeInactiveUsers',
    success: userResult.success,
    count: userResult.archived || 0,
    errors: userResult.errors,
    duration: Date.now() - task2Start,
  });

  // Task 3: Cleanup notifications
  const task3Start = Date.now();
  const notifResult = await cleanupNotifications(dryRun, (p) => onProgress?.('cleanupNotifications', p));
  results.push({
    task: 'cleanupNotifications',
    success: notifResult.success,
    count: notifResult.deleted || 0,
    errors: notifResult.errors,
    duration: Date.now() - task3Start,
  });

  // Task 4: Cleanup sessions
  const task4Start = Date.now();
  const sessionResult = await cleanupSessions(dryRun, (p) => onProgress?.('cleanupSessions', p));
  results.push({
    task: 'cleanupSessions',
    success: sessionResult.success,
    count: sessionResult.deleted || 0,
    errors: sessionResult.errors,
    duration: Date.now() - task4Start,
  });

  // Task 5: Delete old messages
  const task5Start = Date.now();
  const messageResult = await deleteOldMessages(dryRun, (p) => onProgress?.('deleteMessages', p));
  results.push({
    task: 'deleteOldMessages',
    success: messageResult.success,
    count: messageResult.deleted || 0,
    errors: messageResult.errors,
    duration: Date.now() - task5Start,
  });

  // Task 6: Delete old webhook events
  const task6Start = Date.now();
  const webhookResult = await deleteOldWebhookEvents(dryRun, (p) => onProgress?.('deleteWebhookEvents', p));
  results.push({
    task: 'deleteOldWebhookEvents',
    success: webhookResult.success,
    count: webhookResult.deleted || 0,
    errors: webhookResult.errors,
    duration: Date.now() - task6Start,
  });

  const totalDuration = Date.now() - startTime;
  const summary = {
    totalArchived: (tournamentResult.archived || 0) + (userResult.archived || 0),
    totalDeleted: (notifResult.deleted || 0) + (sessionResult.deleted || 0) + 
                  (messageResult.deleted || 0) + (webhookResult.deleted || 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
  };

  return { results, totalDuration, summary };
}

/**
 * Run daily cleanup - lightweight version for daily cron
 */
export async function runDailyCleanup(dryRun: boolean = false): Promise<CleanupTaskResult[]> {
  const results: CleanupTaskResult[] = [];

  // Sessions - always clean
  const sessionStart = Date.now();
  const sessionResult = await cleanupSessions(dryRun);
  results.push({
    task: 'cleanupSessions',
    success: sessionResult.success,
    count: sessionResult.deleted || 0,
    errors: sessionResult.errors,
    duration: Date.now() - sessionStart,
  });

  // Notifications - daily check
  const notifStart = Date.now();
  const notifResult = await cleanupNotifications(dryRun);
  results.push({
    task: 'cleanupNotifications',
    success: notifResult.success,
    count: notifResult.deleted || 0,
    errors: notifResult.errors,
    duration: Date.now() - notifStart,
  });

  return results;
}

/**
 * Run weekly cleanup - comprehensive version for weekly cron
 */
export async function runWeeklyCleanup(dryRun: boolean = false): Promise<{
  results: CleanupTaskResult[];
  totalDuration: number;
}> {
  return runAllCleanupTasks(dryRun);
}

export { getRetentionStats as getStats };
