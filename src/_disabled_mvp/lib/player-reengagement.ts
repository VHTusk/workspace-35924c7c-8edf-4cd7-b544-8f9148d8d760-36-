/**
 * VALORHIVE Player Re-engagement Engine (v3.51.0)
 * 
 * Detects inactive players and triggers re-engagement campaigns:
 * - Inactive player detection (no login in 30/60/90 days)
 * - Re-engagement email templates
 * - "We miss you" notifications
 * - Incentive offer automation
 */

import { db } from './db';
import { SportType } from '@prisma/client';
import { sendEmail } from './email';
import { sendPushNotification } from './push-notifications';

// ============================================
// TYPES
// ============================================

export interface InactivePlayer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  sport: SportType;
  daysInactive: number;
  lastLoginAt?: Date;
  lastTournamentAt?: Date;
  totalTournaments: number;
  bestRank?: number;
  inactiveTier: 'MILD' | 'MODERATE' | 'SEVERE';
}

export interface ReengagementResult {
  processed: number;
  emailed: number;
  pushed: number;
  incentived: number;
  errors: string[];
}

export interface ReengagementConfig {
  mildThreshold: number; // days - send gentle nudge
  moderateThreshold: number; // days - send incentive
  severeThreshold: number; // days - last chance email
  incentiveCredits: number; // credits to offer
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: ReengagementConfig = {
  mildThreshold: 30,
  moderateThreshold: 60,
  severeThreshold: 90,
  incentiveCredits: 100,
};

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Detect and process inactive players
 * Called by cron job weekly
 */
export async function processInactivePlayers(
  sport: SportType,
  config: ReengagementConfig = DEFAULT_CONFIG
): Promise<ReengagementResult> {
  const result: ReengagementResult = {
    processed: 0,
    emailed: 0,
    pushed: 0,
    incentived: 0,
    errors: [],
  };

  try {
    // Find inactive players
    const inactivePlayers = await findInactivePlayers(sport, config);

    for (const player of inactivePlayers) {
      result.processed++;

      try {
        // Check if we've already sent a re-engagement recently
        const recentReengagement = await db.reengagementLog.findFirst({
          where: {
            userId: player.userId,
            sport,
            sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, // 14 days
          },
        });

        if (recentReengagement) {
          continue; // Skip if we've reached out recently
        }

        // Send re-engagement based on tier
        const sentResult = await sendReengagementMessage(player);

        if (sentResult.emailed) result.emailed++;
        if (sentResult.pushed) result.pushed++;
        if (sentResult.incentived) result.incentived++;

        // Log the re-engagement
        await db.reengagementLog.create({
          data: {
            userId: player.userId,
            sport,
            tier: player.inactiveTier,
            daysInactive: player.daysInactive,
            incentiveOffered: sentResult.incentived,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        result.errors.push(`Error processing ${player.userId}: ${error}`);
      }
    }

    console.log(`[Reengagement] Sport: ${sport}, Processed: ${result.processed}, Emailed: ${result.emailed}`);
    return result;
  } catch (error) {
    result.errors.push(`Batch error: ${error}`);
    return result;
  }
}

/**
 * Find all inactive players for a sport
 */
async function findInactivePlayers(
  sport: SportType,
  config: ReengagementConfig
): Promise<InactivePlayer[]> {
  const now = new Date();
  const players: InactivePlayer[] = [];

  // Get users who haven't logged in for at least mildThreshold days
  const mildThresholdDate = new Date(now.getTime() - config.mildThreshold * 24 * 60 * 60 * 1000);

  const inactiveUsers = await db.user.findMany({
    where: {
      sport,
      isActive: true,
      lastLoginAt: { lt: mildThresholdDate },
      email: { not: null },
    },
    include: {
      tournamentRegs: {
        where: { tournament: { status: 'COMPLETED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: { tournamentRegs: true },
      },
      tournamentResults: {
        where: { rank: { lte: 3 } },
        orderBy: { rank: 'asc' },
        take: 1,
      },
    },
  });

  for (const user of inactiveUsers) {
    const lastLoginAt = user.lastLoginAt ?? undefined;
    const lastTournamentAt = user.tournamentRegs[0]?.createdAt;
    const totalTournaments = user._count.tournamentRegs;
    const bestRank = user.tournamentResults[0]?.rank;

    // Calculate days inactive (from last login or last tournament, whichever is more recent)
    const lastActivity = lastLoginAt && lastTournamentAt
      ? new Date(Math.max(lastLoginAt.getTime(), lastTournamentAt.getTime()))
      : lastLoginAt ?? lastTournamentAt ?? new Date(0);

    const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));

    // Determine tier
    let inactiveTier: 'MILD' | 'MODERATE' | 'SEVERE';
    if (daysInactive >= config.severeThreshold) {
      inactiveTier = 'SEVERE';
    } else if (daysInactive >= config.moderateThreshold) {
      inactiveTier = 'MODERATE';
    } else {
      inactiveTier = 'MILD';
    }

    players.push({
      userId: user.id,
      email: user.email!,
      firstName: user.firstName,
      lastName: user.lastName,
      sport,
      daysInactive,
      lastLoginAt,
      lastTournamentAt,
      totalTournaments,
      bestRank,
      inactiveTier,
    });
  }

  // Sort by days inactive (most inactive first)
  return players.sort((a, b) => b.daysInactive - a.daysInactive);
}

/**
 * Send re-engagement message based on inactive tier
 */
async function sendReengagementMessage(
  player: InactivePlayer
): Promise<{ emailed: boolean; pushed: boolean; incentived: boolean }> {
  const result = { emailed: false, pushed: false, incentived: false };

  // Generate email content based on tier
  const emailContent = generateReengagementEmail(player);

  // Send email
  try {
    await sendEmail({
      to: player.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    result.emailed = true;
  } catch (error) {
    console.error('Re-engagement email error:', error);
  }

  // Send push notification
  try {
    const pushResult = await sendPushNotification(
      player.userId,
      emailContent.pushTitle,
      emailContent.pushBody,
      { type: 'REENGAGEMENT', tier: player.inactiveTier }
    );
    result.pushed = pushResult.sentCount > 0;
  } catch (error) {
    console.error('Re-engagement push error:', error);
  }

  // Offer incentive for moderate/severe tiers
  if (player.inactiveTier === 'MODERATE' || player.inactiveTier === 'SEVERE') {
    try {
      // Create incentive record
      await db.playerIncentive.create({
        data: {
          userId: player.userId,
          sport: player.sport,
          type: 'REENGAGEMENT_CREDITS',
          value: DEFAULT_CONFIG.incentiveCredits,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          claimed: false,
        },
      });
      result.incentived = true;
    } catch (error) {
      console.error('Incentive creation error:', error);
    }
  }

  // Create in-app notification
  try {
    await db.notification.create({
      data: {
        userId: player.userId,
        sport: player.sport,
        type: 'TOURNAMENT_REGISTERED', // Reuse type
        title: emailContent.pushTitle,
        message: emailContent.pushBody,
        link: `/${player.sport.toLowerCase()}/tournaments`,
      },
    });
  } catch (error) {
    console.error('In-app notification error:', error);
  }

  return result;
}

/**
 * Generate re-engagement email content based on tier
 */
function generateReengagementEmail(player: InactivePlayer): {
  subject: string;
  html: string;
  pushTitle: string;
  pushBody: string;
} {
  const name = player.firstName;
  const sportLabel = player.sport.charAt(0) + player.sport.slice(1).toLowerCase();

  switch (player.inactiveTier) {
    case 'SEVERE':
      return {
        subject: `We miss you, ${name}! 🎯 Last chance to return`,
        html: `
          <h2>Hey ${name},</h2>
          <p>It's been ${player.daysInactive} days since we last saw you on VALORHIVE!</p>
          <p>We've saved your profile and stats, but we really miss having you in the ${sportLabel} community.</p>
          <p><strong>🎁 Special Welcome Back Offer:</strong></p>
          <p>We've added ${DEFAULT_CONFIG.incentiveCredits} credits to your account! Use them for your next tournament.</p>
          <p>This offer expires in 30 days.</p>
          <a href="https://valorhive.com/${player.sport.toLowerCase()}/tournaments" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Find Tournaments</a>
          <p>Your VALORHIVE team</p>
        `,
        pushTitle: '🎯 Last chance to return!',
        pushBody: `We've saved ${DEFAULT_CONFIG.incentiveCredits} credits for you. Come back and play!`,
      };

    case 'MODERATE':
      return {
        subject: `${name}, the ${sportLabel} courts are waiting! 🏆`,
        html: `
          <h2>Hey ${name},</h2>
          <p>It's been ${player.daysInactive} days since your last visit!</p>
          <p>There are exciting new tournaments happening in your area. Don't miss out!</p>
          ${player.bestRank ? `<p>🏆 Reminder: Your best rank was #${player.bestRank}! You've got what it takes.</p>` : ''}
          <p><strong>🎁 Welcome Back Bonus:</strong></p>
          <p>We've added ${DEFAULT_CONFIG.incentiveCredits} credits to encourage your return!</p>
          <a href="https://valorhive.com/${player.sport.toLowerCase()}/tournaments" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">See Upcoming Tournaments</a>
          <p>Your VALORHIVE team</p>
        `,
        pushTitle: '🏆 The courts are waiting!',
        pushBody: `New tournaments available. +${DEFAULT_CONFIG.incentiveCredits} credits waiting for you!`,
      };

    case 'MILD':
    default:
      return {
        subject: `Hey ${name}, we miss you! 👋`,
        html: `
          <h2>Hey ${name},</h2>
          <p>It's been ${player.daysInactive} days since you last played ${sportLabel} with us!</p>
          <p>We wanted to check in and let you know about some exciting tournaments coming up.</p>
          <p>Your profile and stats are still here, ready when you are.</p>
          <a href="https://valorhive.com/${player.sport.toLowerCase()}/tournaments" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Browse Tournaments</a>
          <p>Your VALORHIVE team</p>
        `,
        pushTitle: '👋 We miss you!',
        pushBody: `It's been ${player.daysInactive} days. Come back and play!`,
      };
  }
}

/**
 * Check if a player is eligible for re-engagement
 */
export async function checkReengagementEligibility(
  userId: string,
  sport: SportType
): Promise<{ eligible: boolean; tier?: 'MILD' | 'MODERATE' | 'SEVERE'; daysInactive?: number }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lastLoginAt: true },
  });

  if (!user) {
    return { eligible: false };
  }

  const now = new Date();
  const daysInactive = user.lastLoginAt
    ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  if (daysInactive < DEFAULT_CONFIG.mildThreshold) {
    return { eligible: false };
  }

  let tier: 'MILD' | 'MODERATE' | 'SEVERE';
  if (daysInactive >= DEFAULT_CONFIG.severeThreshold) {
    tier = 'SEVERE';
  } else if (daysInactive >= DEFAULT_CONFIG.moderateThreshold) {
    tier = 'MODERATE';
  } else {
    tier = 'MILD';
  }

  return { eligible: true, tier, daysInactive };
}

/**
 * Claim a re-engagement incentive
 */
export async function claimReengagementIncentive(
  userId: string,
  sport: SportType
): Promise<{ success: boolean; credits?: number; message: string }> {
  const incentive = await db.playerIncentive.findFirst({
    where: {
      userId,
      sport,
      type: 'REENGAGEMENT_CREDITS',
      claimed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!incentive) {
    return { success: false, message: 'No active incentive found' };
  }

  // Mark as claimed
  await db.playerIncentive.update({
    where: { id: incentive.id },
    data: { claimed: true, claimedAt: new Date() },
  });

  // Add credits to wallet (if wallet system exists)
  // await db.wallet.update({
  //   where: { userId },
  //   data: { balance: { increment: incentive.value } },
  // });

  return {
    success: true,
    credits: incentive.value,
    message: `${incentive.value} credits added to your account!`,
  };
}

/**
 * Get re-engagement statistics
 */
export async function getReengagementStats(sport: SportType): Promise<{
  totalInactive: number;
  mildTier: number;
  moderateTier: number;
  severeTier: number;
  reengagedThisMonth: number;
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const mildDate = new Date(now.getTime() - DEFAULT_CONFIG.mildThreshold * 24 * 60 * 60 * 1000);
  const moderateDate = new Date(now.getTime() - DEFAULT_CONFIG.moderateThreshold * 24 * 60 * 60 * 1000);
  const severeDate = new Date(now.getTime() - DEFAULT_CONFIG.severeThreshold * 24 * 60 * 60 * 1000);

  const [mildCount, moderateCount, severeCount, reengagedCount] = await Promise.all([
    db.user.count({
      where: { sport, isActive: true, lastLoginAt: { gte: moderateDate, lt: mildDate } },
    }),
    db.user.count({
      where: { sport, isActive: true, lastLoginAt: { gte: severeDate, lt: moderateDate } },
    }),
    db.user.count({
      where: { sport, isActive: true, lastLoginAt: { lt: severeDate } },
    }),
    db.reengagementLog.count({
      where: { sport, sentAt: { gte: monthStart }, incentiveOffered: true },
    }),
  ]);

  return {
    totalInactive: mildCount + moderateCount + severeCount,
    mildTier: mildCount,
    moderateTier: moderateCount,
    severeTier: severeCount,
    reengagedThisMonth: reengagedCount,
  };
}
