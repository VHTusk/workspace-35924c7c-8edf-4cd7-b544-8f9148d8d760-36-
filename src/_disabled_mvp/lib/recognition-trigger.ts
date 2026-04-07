/**
 * VALORHIVE - Recognition Trigger Service (v3.48.0)
 * 
 * Handles automatic title awards and ranking updates when tournaments complete.
 * Part of the Completion & Trust Layer.
 * 
 * Key Features:
 * - Auto title assignment based on tournament scope and placement
 * - Geographic title management (City Champion, State Champion, etc.)
 * - Ranking points distribution
 * - Achievement badge awarding
 * - Integration with existing Recognition Layer (v3.44.0)
 */

import { db } from '@/lib/db';
import { RecognitionType, TournamentScope, CompletionAction } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface RecognitionResult {
  success: boolean;
  awardsCreated: number;
  errors: string[];
}

interface TitleDefinition {
  title: string;
  scope: TournamentScope;
  scopeValue: string;
  validForMonths?: number;
}

interface RankingDistribution {
  position: number;
  points: number;
  description: string;
}

// Title templates by scope
const TITLE_TEMPLATES: Record<TournamentScope, (scopeValue: string) => string> = {
  CITY: (city) => `${city} Champion`,
  DISTRICT: (district) => `${district} District Champion`,
  STATE: (state) => `${state} State Champion`,
  NATIONAL: () => 'National Champion'
};

// Ranking points distribution by scope
const RANKING_POINTS: Record<TournamentScope, RankingDistribution[]> = {
  CITY: [
    { position: 1, points: 10, description: 'City Champion' },
    { position: 2, points: 6, description: 'City Runner-up' },
    { position: 3, points: 4, description: 'City Third Place' }
  ],
  DISTRICT: [
    { position: 1, points: 15, description: 'District Champion' },
    { position: 2, points: 10, description: 'District Runner-up' },
    { position: 3, points: 6, description: 'District Third Place' }
  ],
  STATE: [
    { position: 1, points: 25, description: 'State Champion' },
    { position: 2, points: 18, description: 'State Runner-up' },
    { position: 3, points: 12, description: 'State Third Place' }
  ],
  NATIONAL: [
    { position: 1, points: 50, description: 'National Champion' },
    { position: 2, points: 35, description: 'National Runner-up' },
    { position: 3, points: 25, description: 'National Third Place' }
  ]
};

// ============================================
// MAIN TRIGGER
// ============================================

/**
 * Trigger recognition awards after tournament completion
 */
export async function triggerRecognitionAwards(
  tournamentId: string
): Promise<RecognitionResult> {
  const errors: string[] = [];
  let awardsCreated = 0;

  try {
    // Get tournament with results
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        snapshot: true
      }
    });

    if (!tournament) {
      return { success: false, awardsCreated: 0, errors: ['Tournament not found'] };
    }

    if (!tournament.scope) {
      return { success: true, awardsCreated: 0, errors: ['No scope defined - skipping titles'] };
    }

    const scope = tournament.scope;
    const scopeValue = tournament.state || tournament.district || tournament.city || 'Unknown';

    // Get standings from snapshot
    let standings: any[] = [];
    if (tournament.snapshot) {
      standings = JSON.parse(tournament.snapshot.finalStandings);
    }

    // Process top 3 placements
    for (const result of tournament.results) {
      try {
        // Award title
        const titleAwarded = await awardTitle(
          result.userId,
          tournamentId,
          tournament.sport,
          scope,
          scopeValue,
          result.rank
        );

        if (titleAwarded) awardsCreated++;

        // Award ranking points
        await awardRankingPoints(
          result.userId,
          tournamentId,
          tournament.sport,
          scope,
          result.rank
        );

        // Check for achievements
        const achievements = await checkAndAwardAchievements(
          result.userId,
          tournamentId,
          tournament.sport,
          result.rank
        );

        awardsCreated += achievements;

      } catch (error) {
        errors.push(`Failed to process rank ${result.rank}: ${error}`);
      }
    }

    // Update player completion stats
    await updatePlayerCompletionStats(tournamentId, tournament.sport);

    // Log action
    await logRecognitionAction(tournamentId, CompletionAction.RECOGNITION_AWARDED, {
      awardsCreated,
      scope,
      scopeValue
    });

    return {
      success: true,
      awardsCreated,
      errors
    };

  } catch (error) {
    console.error('Error triggering recognition awards:', error);
    return {
      success: false,
      awardsCreated,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

// ============================================
// TITLE AWARDING
// ============================================

/**
 * Award a geographic title to a player
 */
async function awardTitle(
  playerId: string,
  tournamentId: string,
  sport: any,
  scope: TournamentScope,
  scopeValue: string,
  rank: number
): Promise<boolean> {
  // Only champion (rank 1) gets title
  if (rank !== 1) return false;

  const titleTemplate = TITLE_TEMPLATES[scope];
  if (!titleTemplate) return false;

  const title = titleTemplate(scopeValue);

  // Check if player already holds this title
  const existingTitle = await db.recognitionAward.findFirst({
    where: {
      recipientId: playerId,
      recipientType: 'PLAYER',
      recognitionType: RecognitionType.TITLE,
      scope,
      scopeValue,
      isActive: true
    }
  });

  if (existingTitle) {
    // Update validity
    await db.recognitionAward.update({
      where: { id: existingTitle.id },
      data: {
        validFrom: new Date(),
        validUntil: getTitleExpiry(12), // 12 months
        metadata: JSON.stringify({ 
          previousTournamentId: existingTitle.tournamentId,
          retainedAt: new Date().toISOString()
        })
      }
    });
    return false; // Title updated, not created
  }

  // Create new title
  await db.recognitionAward.create({
    data: {
      tournamentId,
      sport,
      recipientId: playerId,
      recipientType: 'PLAYER',
      recognitionType: RecognitionType.TITLE,
      title,
      description: `Earned by winning the ${scopeValue} ${scope.toLowerCase()} tournament`,
      scope,
      scopeValue,
      validFrom: new Date(),
      validUntil: getTitleExpiry(12), // 12 months
      isActive: true,
      triggeredBy: 'TOURNAMENT_COMPLETION'
    }
  });

  // Send notification
  await sendTitleNotification(playerId, title);

  return true;
}

/**
 * Get title expiry date
 */
function getTitleExpiry(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

// ============================================
// RANKING POINTS
// ============================================

/**
 * Award ranking points to a player
 */
async function awardRankingPoints(
  playerId: string,
  tournamentId: string,
  sport: any,
  scope: TournamentScope,
  rank: number
): Promise<boolean> {
  const distributions = RANKING_POINTS[scope];
  if (!distributions) return false;

  const distribution = distributions.find(d => d.position === rank);
  if (!distribution) return false;

  // Create ranking points award
  await db.recognitionAward.create({
    data: {
      tournamentId,
      sport,
      recipientId: playerId,
      recipientType: 'PLAYER',
      recognitionType: RecognitionType.RANKING_POINTS,
      title: `+${distribution.points} Ranking Points`,
      description: distribution.description,
      scope,
      isActive: true,
      triggeredBy: 'TOURNAMENT_COMPLETION',
      metadata: JSON.stringify({ points: distribution.points })
    }
  });

  // Update user's visible points
  await db.user.update({
    where: { id: playerId },
    data: {
      visiblePoints: { increment: distribution.points }
    }
  });

  return true;
}

// ============================================
// ACHIEVEMENT BADGES
// ============================================

/**
 * Check and award achievements based on player history
 */
async function checkAndAwardAchievements(
  playerId: string,
  tournamentId: string,
  sport: any,
  rank: number
): Promise<number> {
  let achievementsAwarded = 0;

  // Get player stats
  const stats = await db.playerCompletionStats.findUnique({
    where: { playerId }
  });

  if (!stats) return 0;

  // Check for milestone achievements
  const milestones = [
    { type: 'FIRST_WIN', condition: stats.tournamentsWon === 1 && rank === 1, title: 'First Victory', description: 'Won your first tournament!' },
    { type: 'FIVE_WINS', condition: stats.tournamentsWon === 5, title: 'Rising Star', description: 'Won 5 tournaments!' },
    { type: 'TEN_WINS', condition: stats.tournamentsWon === 10, title: 'Tournament Master', description: 'Won 10 tournaments!' },
    { type: 'TWENTY_WINS', condition: stats.tournamentsWon === 20, title: 'Champion Legend', description: 'Won 20 tournaments!' },
    { type: 'FIRST_PODIUM', condition: stats.tournamentsPodium === 1 && rank <= 3, title: 'Podium Finisher', description: 'First top 3 finish!' },
    { type: 'FIVE_PODIUMS', condition: stats.tournamentsPodium === 5, title: 'Consistent Performer', description: '5 top 3 finishes!' },
    { type: 'TEN_PODIUMS', condition: stats.tournamentsPodium === 10, title: 'Podium Regular', description: '10 top 3 finishes!' }
  ];

  for (const milestone of milestones) {
    if (milestone.condition) {
      const exists = await db.recognitionAward.findFirst({
        where: {
          recipientId: playerId,
          title: milestone.title,
          recognitionType: RecognitionType.MILESTONE
        }
      });

      if (!exists) {
        await db.recognitionAward.create({
          data: {
            tournamentId,
            sport,
            recipientId: playerId,
            recipientType: 'PLAYER',
            recognitionType: RecognitionType.MILESTONE,
            title: milestone.title,
            description: milestone.description,
            isActive: true,
            triggeredBy: 'MILESTONE_REACHED',
            metadata: JSON.stringify({ type: milestone.type })
          }
        });

        achievementsAwarded++;

        // Send notification
        await sendAchievementNotification(playerId, milestone.title);
      }
    }
  }

  return achievementsAwarded;
}

// ============================================
// PLAYER STATS UPDATE
// ============================================

/**
 * Update player completion statistics
 */
async function updatePlayerCompletionStats(
  tournamentId: string,
  sport: any
): Promise<void> {
  const results = await db.tournamentResult.findMany({
    where: { tournamentId }
  });

  for (const result of results) {
    const existing = await db.playerCompletionStats.findUnique({
      where: { playerId: result.userId }
    });

    if (existing) {
      // Update existing stats
      await db.playerCompletionStats.update({
        where: { playerId: result.userId },
        data: {
          tournamentsPlayed: { increment: 1 },
          tournamentsWon: result.rank === 1 ? { increment: 1 } : undefined,
          tournamentsPodium: result.rank <= 3 ? { increment: 1 } : undefined,
          firstPlace: result.rank === 1 ? { increment: 1 } : undefined,
          secondPlace: result.rank === 2 ? { increment: 1 } : undefined,
          thirdPlace: result.rank === 3 ? { increment: 1 } : undefined,
          lastTournamentAt: new Date()
        }
      });
    } else {
      // Create new stats record
      await db.playerCompletionStats.create({
        data: {
          playerId: result.userId,
          sport,
          tournamentsPlayed: 1,
          tournamentsWon: result.rank === 1 ? 1 : 0,
          tournamentsPodium: result.rank <= 3 ? 1 : 0,
          firstPlace: result.rank === 1 ? 1 : 0,
          secondPlace: result.rank === 2 ? 1 : 0,
          thirdPlace: result.rank === 3 ? 1 : 0,
          lastTournamentAt: new Date()
        }
      });
    }

    // Update titles count
    const activeTitles = await db.recognitionAward.count({
      where: {
        recipientId: result.userId,
        recipientType: 'PLAYER',
        recognitionType: RecognitionType.TITLE,
        isActive: true
      }
    });

    await db.playerCompletionStats.update({
      where: { playerId: result.userId },
      data: { titlesHeld: activeTitles }
    });
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

async function sendTitleNotification(playerId: string, title: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: playerId },
    select: { sport: true }
  });

  if (!user) return;

  await db.notification.create({
    data: {
      userId: playerId,
      sport: user.sport,
      type: 'POINTS_EARNED',
      title: 'New Title Earned!',
      message: `Congratulations! You've earned the title: "${title}"`,
      isRead: false,
      link: '/profile/titles'
    }
  });
}

async function sendAchievementNotification(playerId: string, achievementTitle: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: playerId },
    select: { sport: true }
  });

  if (!user) return;

  await db.notification.create({
    data: {
      userId: playerId,
      sport: user.sport,
      type: 'POINTS_EARNED',
      title: 'Achievement Unlocked!',
      message: `You've unlocked: "${achievementTitle}"`,
      isRead: false,
      link: '/profile/achievements'
    }
  });
}

// ============================================
// HELPERS
// ============================================

async function logRecognitionAction(
  tournamentId: string,
  action: CompletionAction,
  details: Record<string, any>
): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { sport: true }
  });

  if (!tournament) return;

  await db.tournamentCompletionLog.create({
    data: {
      tournamentId,
      sport: tournament.sport,
      action,
      status: 'SUCCESS',
      details: JSON.stringify(details),
      actorId: null,
      actorRole: 'SYSTEM',
      executedAt: new Date()
    }
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get player's active titles
 */
export async function getPlayerTitles(playerId: string): Promise<any[]> {
  return db.recognitionAward.findMany({
    where: {
      recipientId: playerId,
      recipientType: 'PLAYER',
      recognitionType: RecognitionType.TITLE,
      isActive: true,
      OR: [
        { validUntil: null },
        { validUntil: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get player's achievements
 */
export async function getPlayerAchievements(playerId: string): Promise<any[]> {
  return db.recognitionAward.findMany({
    where: {
      recipientId: playerId,
      recipientType: 'PLAYER',
      recognitionType: { in: [RecognitionType.ACHIEVEMENT, RecognitionType.MILESTONE] },
      isActive: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get player's completion stats
 */
export async function getPlayerStats(playerId: string): Promise<any> {
  return db.playerCompletionStats.findUnique({
    where: { playerId }
  });
}

// ============================================
// EXPORTS
// ============================================

export const RecognitionTriggerService = {
  trigger: triggerRecognitionAwards,
  getTitles: getPlayerTitles,
  getAchievements: getPlayerAchievements,
  getStats: getPlayerStats
};
