import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { sendTemplatedEmail, EmailTemplates } from '@/lib/email';
import { sendTemplatedWhatsApp, WhatsAppTemplates, formatPhoneNumber } from '@/lib/whatsapp';

// Notification types
export type NotificationType = 
  | 'MATCH_RESULT'
  | 'NEXT_MATCH'
  | 'TOURNAMENT_REGISTERED'
  | 'TOURNAMENT_WIN'
  | 'POINTS_EARNED'
  | 'SUBSCRIPTION_EXPIRY'
  | 'DISPUTE_UPDATE'
  | 'WAITLIST_PROMOTED'
  | 'EMAIL_VERIFIED'
  | 'TOURNAMENT_CANCELLED'
  | 'REFUND_PROCESSED'
  | 'NEW_FOLLOWER'
  | 'RANK_CHANGE'
  | 'MILESTONE'
  | 'WEEKLY_DIGEST'
  | 'TOURNAMENT_REMINDER';

// Notification options for multi-channel delivery
export interface NotificationOptions {
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
  sendPush?: boolean;
  emailData?: Record<string, any>;
  whatsappData?: Record<string, any>;
}

// Create in-app notification with optional multi-channel delivery
export async function createNotification(
  params: {
    userId?: string;
    orgId?: string;
    sport: SportType;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  },
  options?: NotificationOptions
) {
  try {
    if (!params.userId) {
      return null;
    }

    // Create in-app notification
    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        sport: params.sport,
        type: params.type as any,
        title: params.title,
        message: params.message,
        link: params.link,
      }
    });

    // Send multi-channel notifications if requested
    if (options && params.userId) {
      await sendMultiChannelNotification(params, options);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Send notifications across multiple channels
async function sendMultiChannelNotification(
  params: {
    userId?: string;
    orgId?: string;
    sport: SportType;
    type: NotificationType;
    title: string;
    message: string;
  },
  options: NotificationOptions
) {
  try {
    // Get user contact info
    const user = params.userId ? await db.user.findUnique({
      where: { id: params.userId },
      select: { email: true, phone: true, firstName: true },
    }) : null;

    if (!user) return;

    // Get notification preferences
    const preferences = await getNotificationPreferences(params.userId!, params.sport);

    // Send email if enabled and user has email
    if (options.sendEmail && user.email && preferences.email.matchResults) {
      const emailTemplate = mapNotificationToEmailTemplate(params.type);
      if (emailTemplate) {
        await sendTemplatedEmail(user.email, emailTemplate, {
          playerName: user.firstName,
          sport: params.sport,
          ...options.emailData,
        });
      }
    }

    // Send WhatsApp if enabled and user has phone
    if (options.sendWhatsApp && user.phone && preferences.whatsapp.matchResults) {
      const waTemplate = mapNotificationToWhatsAppTemplate(params.type);
      if (waTemplate) {
        await sendTemplatedWhatsApp(user.phone, waTemplate, {
          playerName: user.firstName,
          sport: params.sport,
          ...options.whatsappData,
        });
      }
    }
  } catch (error) {
    console.error('Error sending multi-channel notification:', error);
    // Don't throw - notification was created, just failed to send
  }
}

// Map notification types to email templates
function mapNotificationToEmailTemplate(type: NotificationType): string | null {
  const mapping: Record<NotificationType, string | null> = {
    MATCH_RESULT: EmailTemplates.MATCH_RESULT,
    NEXT_MATCH: EmailTemplates.MATCH_REMINDER,
    TOURNAMENT_REGISTERED: null,
    TOURNAMENT_WIN: EmailTemplates.TOURNAMENT_WIN,
    POINTS_EARNED: null,
    SUBSCRIPTION_EXPIRY: EmailTemplates.SUBSCRIPTION_EXPIRING,
    DISPUTE_UPDATE: null,
    WAITLIST_PROMOTED: EmailTemplates.WAITLIST_PROMOTED,
    EMAIL_VERIFIED: EmailTemplates.EMAIL_VERIFICATION,
    TOURNAMENT_CANCELLED: null,
    REFUND_PROCESSED: null,
    NEW_FOLLOWER: null,
    RANK_CHANGE: null,
    MILESTONE: null,
    WEEKLY_DIGEST: EmailTemplates.WEEKLY_DIGEST,
    TOURNAMENT_REMINDER: EmailTemplates.MATCH_REMINDER,
  };
  return mapping[type];
}

// Map notification types to WhatsApp templates
function mapNotificationToWhatsAppTemplate(type: NotificationType): string | null {
  const mapping: Record<NotificationType, string | null> = {
    MATCH_RESULT: WhatsAppTemplates.MATCH_RESULT,
    NEXT_MATCH: WhatsAppTemplates.TOURNAMENT_REMINDER,
    TOURNAMENT_REGISTERED: null,
    TOURNAMENT_WIN: null,
    POINTS_EARNED: null,
    SUBSCRIPTION_EXPIRY: null,
    DISPUTE_UPDATE: null,
    WAITLIST_PROMOTED: WhatsAppTemplates.WAITLIST_PROMOTED,
    EMAIL_VERIFIED: null,
    TOURNAMENT_CANCELLED: null,
    REFUND_PROCESSED: null,
    NEW_FOLLOWER: null,
    RANK_CHANGE: null,
    MILESTONE: null,
    WEEKLY_DIGEST: null,
    TOURNAMENT_REMINDER: WhatsAppTemplates.TOURNAMENT_REMINDER,
  };
  return mapping[type];
}

// Create milestone and notification
export async function createMilestone(params: {
  userId?: string;
  orgId?: string;
  sport: SportType;
  type: string;
  title: string;
  description: string;
  metadata?: string;
}) {
  try {
    const milestone = await db.milestone.create({
      data: {
        userId: params.userId,
        orgId: params.orgId,
        sport: params.sport,
        type: params.type,
        title: params.title,
        description: params.description,
        metadata: params.metadata
      }
    });

    // Create notification for milestone
    await createNotification({
      userId: params.userId,
      orgId: params.orgId,
      sport: params.sport,
      type: 'MILESTONE',
      title: '🎉 ' + params.title,
      message: params.description,
    });

    return milestone;
  } catch (error) {
    console.error('Error creating milestone:', error);
    return null;
  }
}

// Check and create rank milestones
export async function checkRankMilestones(
  userId: string,
  sport: SportType,
  newRank: number,
  previousRank: number | null
) {
  const milestones: Array<{ type: string; title: string; description: string }> = [];

  // Top 100
  if (newRank <= 100 && (previousRank === null || previousRank > 100)) {
    milestones.push({
      type: 'RANK_TOP_100',
      title: 'Top 100 Player!',
      description: `You've entered the Top 100 rankings at #${newRank}!`
    });
  }

  // Top 50
  if (newRank <= 50 && (previousRank === null || previousRank > 50)) {
    milestones.push({
      type: 'RANK_TOP_50',
      title: 'Top 50 Player!',
      description: `You've cracked the Top 50 at #${newRank}!`
    });
  }

  // Top 10
  if (newRank <= 10 && (previousRank === null || previousRank > 10)) {
    milestones.push({
      type: 'RANK_TOP_10',
      title: 'Top 10 Player!',
      description: `Amazing! You're now #${newRank} in the rankings!`
    });
  }

  // Top 3
  if (newRank <= 3 && (previousRank === null || previousRank > 3)) {
    milestones.push({
      type: 'RANK_TOP_3',
      title: 'Podium Position!',
      description: `Incredible! You're #${newRank} on the leaderboard!`
    });
  }

  // #1
  if (newRank === 1 && previousRank !== 1) {
    milestones.push({
      type: 'RANK_1',
      title: '🏆 #1 Ranked Player!',
      description: 'You are now the top-ranked player!'
    });
  }

  // Create all milestones
  for (const m of milestones) {
    await createMilestone({
      userId,
      sport,
      type: m.type,
      title: m.title,
      description: m.description,
      metadata: JSON.stringify({ rank: newRank, previousRank })
    });
  }

  return milestones;
}

// Check and create tier milestones
export async function checkTierMilestone(
  userId: string,
  sport: SportType,
  newTier: string,
  previousTier: string | null
) {
  const tierOrder = ['UNRANKED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const newTierIndex = tierOrder.indexOf(newTier);
  const prevTierIndex = previousTier ? tierOrder.indexOf(previousTier) : -1;

  if (newTierIndex > prevTierIndex && newTierIndex > 0) {
    const tierEmojis: Record<string, string> = {
      BRONZE: '🥉',
      SILVER: '🥈',
      GOLD: '🥇',
      PLATINUM: '💎',
      DIAMOND: '💠'
    };

    await createMilestone({
      userId,
      sport,
      type: `TIER_${newTier}`,
      title: `${tierEmojis[newTier] || '⭐'} ${newTier} Tier Achieved!`,
      description: `Congratulations! You've reached ${newTier} tier!`,
      metadata: JSON.stringify({ newTier, previousTier })
    });

    return true;
  }

  return false;
}

// Check streak milestones
export async function checkStreakMilestone(
  userId: string,
  sport: SportType,
  currentStreak: number
) {
  const streakMilestones = [3, 5, 10, 15, 20, 25];

  if (streakMilestones.includes(currentStreak)) {
    await createMilestone({
      userId,
      sport,
      type: `WIN_STREAK_${currentStreak}`,
      title: `🔥 ${currentStreak} Win Streak!`,
      description: `You're on fire! ${currentStreak} wins in a row!`,
      metadata: JSON.stringify({ streak: currentStreak })
    });

    return true;
  }

  return false;
}

// Get user notification preferences
export async function getNotificationPreferences(userId: string, sport: SportType) {
  const emailSettings = await db.emailNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } }
  });

  const whatsappSettings = await db.whatsAppNotificationSetting.findUnique({
    where: { userId_sport: { userId, sport } }
  });

  return {
    email: emailSettings || {
      matchResults: true,
      tournamentUpdates: true,
      rankChanges: true,
      milestones: true,
      weeklyDigest: true,
    },
    whatsapp: whatsappSettings || {
      matchResults: true,
      tournamentUpdates: true,
      rankChanges: true,
      milestones: false,
      weeklyDigest: false,
    }
  };
}
