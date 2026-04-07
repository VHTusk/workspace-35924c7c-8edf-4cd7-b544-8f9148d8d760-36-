/**
 * VALORHIVE Self-Healing Service (v3.51.0)
 * 
 * Comprehensive data integrity monitoring and automatic repair system.
 * Detects and fixes common data inconsistencies to maintain platform health.
 * 
 * Capabilities:
 * - Orphaned records detection and cleanup
 * - Incomplete transaction recovery
 * - Missing notification detection and remediation
 * - Bracket integrity verification
 */

import { db } from './db';
import { AuditAction, SportType, TournamentStatus, BracketMatchStatus, MatchOutcome, NotificationType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface HealthCheck {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message?: string;
  lastCheck: Date;
}

export interface HealingAction {
  type: string;
  description: string;
  autoFixable: boolean;
  executedAt?: Date;
  success?: boolean;
  details?: Record<string, unknown>;
}

interface OrphanedRecord {
  type: 'registration' | 'match' | 'bracket_match';
  id: string;
  parentId?: string;
  reason: string;
}

interface IncompleteTransaction {
  matchId: string;
  tournamentId: string;
  playerAId: string;
  playerBId: string;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  pointsAwarded: boolean;
  issue: string;
}

interface MissingNotification {
  type: 'winner' | 'match_result' | 'tournament_complete';
  entityId: string;
  userId: string;
  tournamentId?: string;
  matchId?: string;
  issue: string;
}

interface BracketInconsistency {
  bracketMatchId: string;
  bracketId: string;
  roundNumber: number;
  matchNumber: number;
  playerAId: string | null;
  playerBId: string | null;
  issue: string;
}

// ============================================
// LOGGING
// ============================================

function logHealing(
  action: string,
  status: 'STARTED' | 'COMPLETED' | 'FAILED',
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][SelfHealing][${action}] ${status}${details ? `: ${JSON.stringify(details)}` : ''}`);
}

// ============================================
// HEALTH CHECKS
// ============================================

/**
 * Run all health checks to detect data integrity issues
 */
export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const now = new Date();

  // 1. Check for orphaned registrations
  checks.push(await checkOrphanedRegistrations(now));

  // 2. Check for matches without brackets in tournament
  checks.push(await checkMatchesWithoutBrackets(now));

  // 3. Check for incomplete transactions
  checks.push(await checkIncompleteTransactions(now));

  // 4. Check for missing winner notifications
  checks.push(await checkMissingNotifications(now));

  // 5. Check bracket integrity
  checks.push(await checkBracketIntegrity(now));

  return checks;
}

async function checkOrphanedRegistrations(now: Date): Promise<HealthCheck> {
  try {
    // Find registrations that reference deleted tournaments
    // Since SQLite doesn't enforce FK constraints by default, this can happen
    const registrationsWithoutTournament = await db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM "TournamentRegistration" tr
      WHERE NOT EXISTS (
        SELECT 1 FROM "Tournament" t WHERE t.id = tr."tournamentId"
      )
    `;

    const count = registrationsWithoutTournament[0]?.count ?? 0;

    return {
      name: 'Orphaned Registrations',
      status: count === 0 ? 'HEALTHY' : count < 10 ? 'DEGRADED' : 'UNHEALTHY',
      message: count === 0 
        ? 'No orphaned registrations found' 
        : `Found ${count} registrations without valid tournament`,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name: 'Orphaned Registrations',
      status: 'UNHEALTHY',
      message: `Check failed: ${error}`,
      lastCheck: now,
    };
  }
}

async function checkMatchesWithoutBrackets(now: Date): Promise<HealthCheck> {
  try {
    // Find bracket matches where the parent bracket doesn't exist
    const matchesWithoutBracket = await db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM "BracketMatch" bm
      WHERE NOT EXISTS (
        SELECT 1 FROM "Bracket" b WHERE b.id = bm."bracketId"
      )
    `;

    const count = matchesWithoutBracket[0]?.count ?? 0;

    return {
      name: 'Orphaned Bracket Matches',
      status: count === 0 ? 'HEALTHY' : count < 10 ? 'DEGRADED' : 'UNHEALTHY',
      message: count === 0 
        ? 'No orphaned bracket matches found' 
        : `Found ${count} bracket matches without valid bracket`,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name: 'Orphaned Bracket Matches',
      status: 'UNHEALTHY',
      message: `Check failed: ${error}`,
      lastCheck: now,
    };
  }
}

async function checkIncompleteTransactions(now: Date): Promise<HealthCheck> {
  try {
    // Find matches that are completed but points weren't updated
    const incompleteMatches = await db.match.count({
      where: {
        winnerId: { not: null },
        OR: [
          { pointsA: null },
          { pointsB: null },
        ],
        tournament: {
          status: { in: [TournamentStatus.COMPLETED, TournamentStatus.IN_PROGRESS] },
        },
      },
    });

    return {
      name: 'Incomplete Transactions',
      status: incompleteMatches === 0 ? 'HEALTHY' : incompleteMatches < 5 ? 'DEGRADED' : 'UNHEALTHY',
      message: incompleteMatches === 0 
        ? 'All match transactions complete' 
        : `Found ${incompleteMatches} matches with incomplete point updates`,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name: 'Incomplete Transactions',
      status: 'UNHEALTHY',
      message: `Check failed: ${error}`,
      lastCheck: now,
    };
  }
}

async function checkMissingNotifications(now: Date): Promise<HealthCheck> {
  try {
    // Find completed tournaments where winners weren't notified
    const tournamentsWithoutWinnerNotifications = await db.tournament.count({
      where: {
        status: TournamentStatus.COMPLETED,
        results: {
          some: {
            rank: 1,
            user: {
              notifications: {
                none: {
                  type: NotificationType.POINTS_EARNED,
                  link: { contains: '/tournament/' },
                },
              },
            },
          },
        },
      },
    });

    return {
      name: 'Missing Notifications',
      status: tournamentsWithoutWinnerNotifications === 0 ? 'HEALTHY' : 'DEGRADED',
      message: tournamentsWithoutWinnerNotifications === 0 
        ? 'All required notifications sent' 
        : `Found ${tournamentsWithoutWinnerNotifications} tournaments with missing winner notifications`,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name: 'Missing Notifications',
      status: 'UNHEALTHY',
      message: `Check failed: ${error}`,
      lastCheck: now,
    };
  }
}

async function checkBracketIntegrity(now: Date): Promise<HealthCheck> {
  try {
    // Find bracket matches with missing players that should have players
    const incompleteBrackets = await db.bracketMatch.count({
      where: {
        status: { in: [BracketMatchStatus.PENDING, BracketMatchStatus.LIVE] },
        OR: [
          { playerAId: null, playerBId: null },
        ],
        bracket: {
          tournament: {
            status: { in: [TournamentStatus.IN_PROGRESS, TournamentStatus.BRACKET_GENERATED] },
          },
        },
      },
    });

    return {
      name: 'Bracket Integrity',
      status: incompleteBrackets === 0 ? 'HEALTHY' : 'DEGRADED',
      message: incompleteBrackets === 0 
        ? 'All brackets have valid player assignments' 
        : `Found ${incompleteBrackets} bracket matches with missing players`,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name: 'Bracket Integrity',
      status: 'UNHEALTHY',
      message: `Check failed: ${error}`,
      lastCheck: now,
    };
  }
}

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect all orphaned records in the system
 */
async function detectOrphanedRecords(): Promise<OrphanedRecord[]> {
  const orphans: OrphanedRecord[] = [];

  // 1. Registrations without tournaments
  try {
    const orphanedRegs = await db.$queryRaw<{ id: string; tournamentId: string }[]>`
      SELECT tr.id, tr."tournamentId" FROM "TournamentRegistration" tr
      WHERE NOT EXISTS (
        SELECT 1 FROM "Tournament" t WHERE t.id = tr."tournamentId"
      )
    `;

    for (const reg of orphanedRegs) {
      orphans.push({
        type: 'registration',
        id: reg.id,
        parentId: reg.tournamentId,
        reason: 'Tournament does not exist',
      });
    }
  } catch (error) {
    logHealing('DetectOrphanedRegistrations', 'FAILED', { error: String(error) });
  }

  // 2. Bracket matches without brackets
  try {
    const orphanedMatches = await db.$queryRaw<{ id: string; bracketId: string }[]>`
      SELECT bm.id, bm."bracketId" FROM "BracketMatch" bm
      WHERE NOT EXISTS (
        SELECT 1 FROM "Bracket" b WHERE b.id = bm."bracketId"
      )
    `;

    for (const match of orphanedMatches) {
      orphans.push({
        type: 'bracket_match',
        id: match.id,
        parentId: match.bracketId,
        reason: 'Bracket does not exist',
      });
    }
  } catch (error) {
    logHealing('DetectOrphanedBracketMatches', 'FAILED', { error: String(error) });
  }

  // 3. Matches without valid tournaments (for tournament matches)
  try {
    const orphanedTournamentMatches = await db.$queryRaw<{ id: string; tournamentId: string }[]>`
      SELECT m.id, m."tournamentId" FROM "Match" m
      WHERE m."tournamentId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Tournament" t WHERE t.id = m."tournamentId"
      )
    `;

    for (const match of orphanedTournamentMatches) {
      orphans.push({
        type: 'match',
        id: match.id,
        parentId: match.tournamentId,
        reason: 'Tournament does not exist',
      });
    }
  } catch (error) {
    logHealing('DetectOrphanedMatches', 'FAILED', { error: String(error) });
  }

  return orphans;
}

/**
 * Detect incomplete transactions (matches with winners but no points)
 */
async function detectIncompleteTransactions(): Promise<IncompleteTransaction[]> {
  const incomplete: IncompleteTransaction[] = [];

  try {
    const matches = await db.match.findMany({
      where: {
        winnerId: { not: null },
        OR: [
          { pointsA: null },
          { pointsB: null },
        ],
        tournament: {
          status: { in: [TournamentStatus.COMPLETED, TournamentStatus.IN_PROGRESS] },
        },
      },
      include: {
        tournament: {
          select: { id: true, scope: true, sport: true },
        },
      },
    });

    for (const match of matches) {
      incomplete.push({
        matchId: match.id,
        tournamentId: match.tournamentId ?? '',
        playerAId: match.playerAId ?? '',
        playerBId: match.playerBId ?? '',
        winnerId: match.winnerId,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        pointsAwarded: false,
        issue: !match.pointsA || !match.pointsB ? 'Missing points' : 'Unknown',
      });
    }
  } catch (error) {
    logHealing('DetectIncompleteTransactions', 'FAILED', { error: String(error) });
  }

  return incomplete;
}

/**
 * Detect missing notifications for tournament winners
 */
async function detectMissingNotifications(): Promise<MissingNotification[]> {
  const missing: MissingNotification[] = [];

  try {
    // Find tournament results where winner wasn't notified
    const resultsWithoutNotification = await db.tournamentResult.findMany({
      where: {
        rank: { lte: 3 }, // Top 3 placements
        user: {
          notifications: {
            none: {
              type: NotificationType.POINTS_EARNED,
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Within last 7 days
            },
          },
        },
      },
      include: {
        tournament: { select: { id: true, name: true, sport: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    for (const result of resultsWithoutNotification) {
      missing.push({
        type: 'winner',
        entityId: result.id,
        userId: result.userId,
        tournamentId: result.tournamentId,
        issue: `Tournament ${result.tournament?.name ?? 'unknown'} - Rank ${result.rank} - No points notification sent`,
      });
    }
  } catch (error) {
    logHealing('DetectMissingNotifications', 'FAILED', { error: String(error) });
  }

  return missing;
}

/**
 * Detect bracket inconsistencies
 */
async function detectBracketInconsistencies(): Promise<BracketInconsistency[]> {
  const inconsistencies: BracketInconsistency[] = [];

  try {
    // Find bracket matches in active tournaments with both players missing
    const problemMatches = await db.bracketMatch.findMany({
      where: {
        status: { in: [BracketMatchStatus.PENDING, BracketMatchStatus.LIVE] },
        AND: [
          { playerAId: null },
          { playerBId: null },
        ],
        bracket: {
          tournament: {
            status: { in: [TournamentStatus.IN_PROGRESS, TournamentStatus.BRACKET_GENERATED] },
          },
        },
      },
      include: {
        bracket: { select: { id: true, tournamentId: true } },
      },
    });

    for (const match of problemMatches) {
      inconsistencies.push({
        bracketMatchId: match.id,
        bracketId: match.bracketId,
        roundNumber: match.roundNumber,
        matchNumber: match.matchNumber,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        issue: 'Both players missing in active tournament bracket match',
      });
    }

    // Find bracket matches where only one player is set but match should have started
    const onePlayerMatches = await db.bracketMatch.findMany({
      where: {
        status: BracketMatchStatus.PENDING,
        OR: [
          { playerAId: null, playerBId: { not: null } },
          { playerAId: { not: null }, playerBId: null },
        ],
        bracket: {
          tournament: {
            status: TournamentStatus.IN_PROGRESS,
          },
        },
      },
      include: {
        bracket: { select: { id: true, tournamentId: true } },
      },
    });

    for (const match of onePlayerMatches) {
      inconsistencies.push({
        bracketMatchId: match.id,
        bracketId: match.bracketId,
        roundNumber: match.roundNumber,
        matchNumber: match.matchNumber,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        issue: 'Only one player assigned in an in-progress tournament',
      });
    }
  } catch (error) {
    logHealing('DetectBracketInconsistencies', 'FAILED', { error: String(error) });
  }

  return inconsistencies;
}

// ============================================
// MAIN HEALING FUNCTIONS
// ============================================

/**
 * Main function to detect and heal all issues
 */
export async function detectAndHealIssues(): Promise<HealingAction[]> {
  const actions: HealingAction[] = [];

  logHealing('DetectAndHealIssues', 'STARTED');

  // 1. Fix orphaned records
  const orphanAction = await fixOrphanedRecords();
  actions.push(orphanAction);

  // 2. Fix incomplete transactions
  const transactionAction = await fixIncompleteTransactions();
  actions.push(transactionAction);

  // 3. Fix missing notifications
  const notificationAction = await fixMissingNotifications();
  actions.push(notificationAction);

  // 4. Fix bracket inconsistencies
  const bracketAction = await fixBracketInconsistencies();
  actions.push(bracketAction);

  logHealing('DetectAndHealIssues', 'COMPLETED', { totalActions: actions.length });

  return actions;
}

/**
 * Fix orphaned records - registrations and matches without parent entities
 */
export async function fixOrphanedRecords(): Promise<HealingAction> {
  const action: HealingAction = {
    type: 'ORPHANED_RECORDS',
    description: 'Remove orphaned registrations, matches, and bracket matches',
    autoFixable: true,
  };

  logHealing('FixOrphanedRecords', 'STARTED');

  const errors: string[] = [];
  let fixed = 0;

  try {
    const orphans = await detectOrphanedRecords();

    for (const orphan of orphans) {
      try {
        if (orphan.type === 'registration') {
          // Delete orphaned registration
          await db.tournamentRegistration.delete({
            where: { id: orphan.id },
          });
          fixed++;
        } else if (orphan.type === 'bracket_match') {
          // Delete orphaned bracket match
          await db.bracketMatch.delete({
            where: { id: orphan.id },
          });
          fixed++;
        } else if (orphan.type === 'match') {
          // Delete orphaned match
          await db.match.delete({
            where: { id: orphan.id },
          });
          fixed++;
        }
      } catch (error) {
        errors.push(`Failed to delete ${orphan.type} ${orphan.id}: ${error}`);
      }
    }

    action.executedAt = new Date();
    action.success = errors.length === 0;
    action.details = { fixed, errors: errors.length, orphanedFound: orphans.length };

    // Log to audit
    if (fixed > 0) {
      await db.auditLog.create({
        data: {
          sport: SportType.CORNHOLE,
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: 'SYSTEM_SELF_HEALING',
          actorRole: 'ADMIN',
          targetType: 'SELF_HEALING',
          targetId: 'orphaned_records',
          metadata: JSON.stringify({ fixed, errors }),
        },
      });
    }

    logHealing('FixOrphanedRecords', 'COMPLETED', { fixed, errors: errors.length });
  } catch (error) {
    action.success = false;
    action.details = { error: String(error) };
    errors.push(String(error));
    logHealing('FixOrphanedRecords', 'FAILED', { error: String(error) });
  }

  return action;
}

/**
 * Fix incomplete transactions - matches with winners but missing points
 */
export async function fixIncompleteTransactions(): Promise<HealingAction> {
  const action: HealingAction = {
    type: 'INCOMPLETE_TRANSACTIONS',
    description: 'Award missing points for completed matches',
    autoFixable: true,
  };

  logHealing('FixIncompleteTransactions', 'STARTED');

  const errors: string[] = [];
  let fixed = 0;

  try {
    const incomplete = await detectIncompleteTransactions();

    // Get sport rules for points calculation
    const sportRules = await db.sportRules.findMany();

    for (const match of incomplete) {
      try {
        const tournament = await db.tournament.findUnique({
          where: { id: match.tournamentId },
          select: { scope: true, sport: true },
        });

        if (!tournament) {
          errors.push(`Tournament not found for match ${match.matchId}`);
          continue;
        }

        const rules = sportRules.find(r => r.sport === tournament.sport);
        if (!rules) {
          errors.push(`Sport rules not found for match ${match.matchId}`);
          continue;
        }

        // Calculate points based on tournament scope
        let participationPoints = 1;
        let winPoints = 2;

        if (tournament.scope === 'CITY') {
          participationPoints = rules.cityParticipation;
          winPoints = rules.cityWin;
        } else if (tournament.scope === 'DISTRICT') {
          participationPoints = rules.districtParticipation;
          winPoints = rules.districtWin;
        } else if (tournament.scope === 'STATE') {
          participationPoints = rules.stateParticipation;
          winPoints = rules.stateWin;
        } else if (tournament.scope === 'NATIONAL') {
          participationPoints = rules.nationalParticipation;
          winPoints = rules.nationalWin;
        }

        // Determine points for each player
        const pointsA = match.winnerId === match.playerAId ? winPoints : participationPoints;
        const pointsB = match.winnerId === match.playerBId ? winPoints : participationPoints;

        // Update match with points
        await db.match.update({
          where: { id: match.matchId },
          data: {
            pointsA,
            pointsB,
            tournamentScope: tournament.scope,
          },
        });

        // Update user visible points
        if (match.playerAId) {
          await db.user.update({
            where: { id: match.playerAId },
            data: { visiblePoints: { increment: pointsA } },
          });
        }

        if (match.playerBId) {
          await db.user.update({
            where: { id: match.playerBId },
            data: { visiblePoints: { increment: pointsB } },
          });
        }

        fixed++;
      } catch (error) {
        errors.push(`Failed to fix match ${match.matchId}: ${error}`);
      }
    }

    action.executedAt = new Date();
    action.success = errors.length === 0;
    action.details = { fixed, errors: errors.length, incompleteFound: incomplete.length };

    logHealing('FixIncompleteTransactions', 'COMPLETED', { fixed, errors: errors.length });
  } catch (error) {
    action.success = false;
    action.details = { error: String(error) };
    errors.push(String(error));
    logHealing('FixIncompleteTransactions', 'FAILED', { error: String(error) });
  }

  return action;
}

/**
 * Fix missing notifications for tournament winners and top placements
 */
export async function fixMissingNotifications(): Promise<HealingAction> {
  const action: HealingAction = {
    type: 'MISSING_NOTIFICATIONS',
    description: 'Send missing notifications to tournament winners',
    autoFixable: true,
  };

  logHealing('FixMissingNotifications', 'STARTED');

  const errors: string[] = [];
  let fixed = 0;

  try {
    const missing = await detectMissingNotifications();

    for (const notification of missing) {
      try {
        const result = await db.tournamentResult.findUnique({
          where: { id: notification.entityId },
          include: {
            tournament: { select: { name: true, sport: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        });

        if (!result) {
          errors.push(`Tournament result not found: ${notification.entityId}`);
          continue;
        }

        // Create notification
        await db.notification.create({
          data: {
            userId: notification.userId,
            sport: result.tournament?.sport ?? SportType.CORNHOLE,
            type: NotificationType.POINTS_EARNED,
            title: `🏆 Tournament Placement: Rank #${result.rank}`,
            message: `Congratulations! You placed #${result.rank} in ${result.tournament?.name ?? 'the tournament'} and earned ${result.bonusPoints} bonus points!`,
            link: `/tournament/${notification.tournamentId}`,
          },
        });

        fixed++;
      } catch (error) {
        errors.push(`Failed to create notification for result ${notification.entityId}: ${error}`);
      }
    }

    action.executedAt = new Date();
    action.success = errors.length === 0;
    action.details = { fixed, errors: errors.length, missingFound: missing.length };

    logHealing('FixMissingNotifications', 'COMPLETED', { fixed, errors: errors.length });
  } catch (error) {
    action.success = false;
    action.details = { error: String(error) };
    errors.push(String(error));
    logHealing('FixMissingNotifications', 'FAILED', { error: String(error) });
  }

  return action;
}

/**
 * Fix bracket inconsistencies - matches with missing players
 */
export async function fixBracketInconsistencies(): Promise<HealingAction> {
  const action: HealingAction = {
    type: 'BRACKET_INCONSISTENCIES',
    description: 'Fix bracket matches with missing or inconsistent player assignments',
    autoFixable: true,
  };

  logHealing('FixBracketInconsistencies', 'STARTED');

  const errors: string[] = [];
  let fixed = 0;

  try {
    const inconsistencies = await detectBracketInconsistencies();

    for (const issue of inconsistencies) {
      try {
        // Get the bracket match with context
        const bracketMatch = await db.bracketMatch.findUnique({
          where: { id: issue.bracketMatchId },
          include: {
            bracket: {
              include: {
                tournament: {
                  include: {
                    registrations: {
                      where: { status: 'CONFIRMED' },
                      include: { user: { select: { id: true } } },
                    },
                  },
                },
              },
            },
          },
        });

        if (!bracketMatch) {
          errors.push(`Bracket match not found: ${issue.bracketMatchId}`);
          continue;
        }

        // Case 1: Both players missing - check if this should be a bye
        if (!issue.playerAId && !issue.playerBId) {
          // If this is round 1, it might be a bye slot
          if (bracketMatch.roundNumber === 1) {
            // Mark as bye match
            await db.bracketMatch.update({
              where: { id: issue.bracketMatchId },
              data: {
                status: BracketMatchStatus.BYE,
              },
            });
            fixed++;
          } else {
            // For later rounds, this needs manual intervention
            errors.push(`Round ${bracketMatch.roundNumber} match ${issue.bracketMatchId} has no players - needs manual review`);
          }
        }

        // Case 2: One player missing - check if opponent should advance
        if ((issue.playerAId && !issue.playerBId) || (!issue.playerAId && issue.playerBId)) {
          const presentPlayerId = issue.playerAId ?? issue.playerBId;

          if (presentPlayerId) {
            // Check if there's a next match to advance to
            if (bracketMatch.nextMatchId) {
              // Advance player to next match
              await db.$transaction([
                // Mark current match as completed (walkover)
                db.bracketMatch.update({
                  where: { id: issue.bracketMatchId },
                  data: {
                    status: BracketMatchStatus.COMPLETED,
                    winnerId: presentPlayerId,
                  },
                }),
                // Create match result
                db.match.create({
                  data: {
                    sport: bracketMatch.bracket.tournament.sport,
                    tournamentId: bracketMatch.bracket.tournamentId,
                    playerAId: presentPlayerId,
                    playerBId: null,
                    winnerId: presentPlayerId,
                    outcome: MatchOutcome.WALKOVER,
                    outcomeReason: 'Opponent missing - automatic advancement',
                  },
                }),
              ]);
              fixed++;
            } else {
              errors.push(`Match ${issue.bracketMatchId} has only one player but no next match to advance to`);
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to fix bracket match ${issue.bracketMatchId}: ${error}`);
      }
    }

    action.executedAt = new Date();
    action.success = errors.length === 0;
    action.details = { fixed, errors: errors.length, inconsistenciesFound: inconsistencies.length };

    logHealing('FixBracketInconsistencies', 'COMPLETED', { fixed, errors: errors.length });
  } catch (error) {
    action.success = false;
    action.details = { error: String(error) };
    errors.push(String(error));
    logHealing('FixBracketInconsistencies', 'FAILED', { error: String(error) });
  }

  return action;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get a summary of all self-healing activities
 */
export async function getSelfHealingSummary(): Promise<{
  lastRun: Date | null;
  healthChecks: HealthCheck[];
  recentActions: HealingAction[];
}> {
  const healthChecks = await runHealthChecks();

  // Get recent audit logs for self-healing actions
  const recentLogs = await db.auditLog.findMany({
    where: {
      targetType: 'SELF_HEALING',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentActions: HealingAction[] = recentLogs.map(log => ({
    type: log.targetId.replace(/_/g, ' ').toUpperCase(),
    description: `Self-healing action: ${log.targetId}`,
    autoFixable: true,
    executedAt: log.createdAt,
    success: true,
    details: log.metadata ? JSON.parse(log.metadata) : undefined,
  }));

  return {
    lastRun: recentLogs.length > 0 ? recentLogs[0].createdAt : null,
    healthChecks,
    recentActions,
  };
}

/**
 * Run all self-healing checks and fixes (for cron job)
 */
export async function runSelfHealingCycle(): Promise<{
  healthChecks: HealthCheck[];
  healingActions: HealingAction[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    issuesFixed: number;
    errors: string[];
  };
}> {
  logHealing('SelfHealingCycle', 'STARTED');

  // Run health checks first
  const healthChecks = await runHealthChecks();

  // Only run healing if there are issues
  let healingActions: HealingAction[] = [];
  const needsHealing = healthChecks.some(c => c.status !== 'HEALTHY');

  if (needsHealing) {
    healingActions = await detectAndHealIssues();
  }

  // Compile summary
  const healthy = healthChecks.filter(c => c.status === 'HEALTHY').length;
  const degraded = healthChecks.filter(c => c.status === 'DEGRADED').length;
  const unhealthy = healthChecks.filter(c => c.status === 'UNHEALTHY').length;
  const issuesFixed = healingActions.reduce((sum, a) => (a.details?.fixed as number ?? 0) + sum, 0);
  const errors: string[] = healingActions
    .filter(a => a.details?.errors)
    .flatMap(a => Array.isArray(a.details?.errors) ? a.details?.errors as string[] : []);

  logHealing('SelfHealingCycle', 'COMPLETED', {
    healthy,
    degraded,
    unhealthy,
    issuesFixed,
    errorsCount: errors.length,
  });

  return {
    healthChecks,
    healingActions,
    summary: {
      healthy,
      degraded,
      unhealthy,
      issuesFixed,
      errors,
    },
  };
}
