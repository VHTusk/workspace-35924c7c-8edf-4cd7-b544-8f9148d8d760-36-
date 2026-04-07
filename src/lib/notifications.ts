/**
 * Notification Service
 * Handles creation and delivery of notifications (in-app + email)
 */

import { db } from '@/lib/db';
import { sendNotificationEmail, NotificationEmailData } from '@/lib/email';
import { NotificationType, SportType } from '@prisma/client';

interface CreateNotificationParams {
  userId: string;
  sport: SportType;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  sendEmail?: boolean;
  emailData?: Record<string, unknown>;
}

/**
 * Create a notification and optionally send an email
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  // Create in-app notification
  await db.notification.create({
    data: {
      userId: params.userId,
      sport: params.sport,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });

  // Send email if requested
  if (params.sendEmail) {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { email: true, firstName: true },
    });

    if (user?.email) {
      await sendNotificationEmail({
        type: params.type as NotificationEmailData['type'],
        recipientEmail: user.email,
        recipientName: user.firstName,
        data: params.emailData || {},
      });
    }
  }
}

/**
 * Create tournament registration notification
 */
export async function notifyTournamentRegistered(
  userId: string,
  sport: SportType,
  tournament: { id: string; name: string; startDate: Date; location: string; entryFee?: number }
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'TOURNAMENT_REGISTERED',
    title: 'Registration Confirmed',
    message: `You have been registered for ${tournament.name}`,
    link: `/tournaments/${tournament.id}`,
    sendEmail: true,
    emailData: {
      tournamentName: tournament.name,
      date: tournament.startDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      location: tournament.location,
      entryFee: tournament.entryFee,
    },
  });
}

/**
 * Create match result notification
 */
export async function notifyMatchResult(
  userId: string,
  sport: SportType,
  match: {
    tournamentName: string;
    opponentName: string;
    yourScore: number;
    opponentScore: number;
    won: boolean;
    pointsEarned?: number;
  }
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'MATCH_RESULT',
    title: 'Match Result Published',
    message: `Your match against ${match.opponentName}: ${match.yourScore}-${match.opponentScore} (${match.won ? 'Won' : 'Lost'})`,
    sendEmail: true,
    emailData: match,
  });
}

/**
 * Create points earned notification
 */
export async function notifyPointsEarned(
  userId: string,
  sport: SportType,
  points: number,
  reason: string
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'POINTS_EARNED',
    title: 'Points Earned',
    message: `You earned ${points} points: ${reason}`,
  });
}

/**
 * Create waitlist promotion notification
 */
export async function notifyWaitlistPromoted(
  userId: string,
  sport: SportType,
  tournament: { id: string; name: string; startDate: Date },
  deadline: Date
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'WAITLIST_PROMOTED',
    title: 'Waitlist Promotion',
    message: `A spot opened up for ${tournament.name}! Complete payment by ${deadline.toLocaleDateString()}`,
    link: `/tournaments/${tournament.id}`,
    sendEmail: true,
    emailData: {
      tournamentName: tournament.name,
      date: tournament.startDate.toLocaleDateString('en-IN'),
      deadline: deadline.toLocaleString('en-IN'),
      paymentUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/${sport.toLowerCase()}/tournaments/${tournament.id}`,
    },
  });
}

/**
 * Create tournament cancelled notification
 */
export async function notifyTournamentCancelled(
  userId: string,
  sport: SportType,
  tournament: { id: string; name: string },
  reason?: string,
  refundAmount?: number
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'TOURNAMENT_CANCELLED',
    title: 'Tournament Cancelled',
    message: `${tournament.name} has been cancelled. ${refundAmount ? `Refund of ₹${refundAmount} will be processed.` : ''}`,
    sendEmail: true,
    emailData: {
      tournamentName: tournament.name,
      reason,
      refundAmount,
      refundStatus: refundAmount ? 'Processing' : undefined,
    },
  });
}

/**
 * Create dispute update notification
 */
export async function notifyDisputeUpdate(
  userId: string,
  sport: SportType,
  matchInfo: string,
  status: string,
  resolution?: string
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'DISPUTE_UPDATE',
    title: 'Dispute Update',
    message: `Your dispute has been ${status}`,
    sendEmail: true,
    emailData: {
      matchInfo,
      status,
      resolution,
    },
  });
}

/**
 * Create subscription expiry notification
 */
export async function notifySubscriptionExpiry(
  userId: string,
  sport: SportType,
  daysRemaining: number,
  endDate: Date,
  plan: string
): Promise<void> {
  await createNotification({
    userId,
    sport,
    type: 'SUBSCRIPTION_EXPIRY',
    title: 'Subscription Expiring Soon',
    message: `Your subscription expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} (${endDate.toLocaleDateString()})`,
    link: '/subscription',
    sendEmail: true,
    emailData: {
      daysRemaining,
      expiryDate: endDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      plan,
    },
  });
}

/**
 * Send OTP email
 */
export async function sendOtpEmail(
  email: string,
  firstName: string,
  otp: string
): Promise<{ success: boolean }> {
  const result = await sendNotificationEmail({
    type: 'OTP',
    recipientEmail: email,
    recipientName: firstName,
    data: { otp },
  });
  
  return result;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(userId: string, notificationIds?: string[]): Promise<void> {
  await db.notification.updateMany({
    where: {
      userId,
      ...(notificationIds && { id: { in: notificationIds } }),
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

// Re-export additional notification functions from /notifications/index.ts
export {
  createMilestone,
  checkRankMilestones,
  checkTierMilestone,
  checkStreakMilestone,
  getNotificationPreferences,
} from './notifications/index';
