/**
 * VALORHIVE Feedback Auto-Collect System (v3.51.0)
 * 
 * Automatically collects feedback after:
 * - Tournament completion
 * - Match completion
 * - User experiences (good or bad)
 * 
 * Features:
 * - Rating collection (1-5 stars)
 * - Feedback forms
 * - NPS (Net Promoter Score) surveys
 * - Feedback analytics
 */

import { db } from './db';
import { SportType } from '@prisma/client';
import { sendEmail } from './email';
import { sendPushNotification } from './push-notifications';

// ============================================
// TYPES
// ============================================

export interface FeedbackRequest {
  userId: string;
  sport: SportType;
  feedbackType: 'TOURNAMENT' | 'MATCH' | 'PLATFORM' | 'NPS';
  referenceId: string; // tournamentId, matchId, etc.
  referenceName: string;
  triggeredBy: 'COMPLETION' | 'RE_ENGAGEMENT' | 'SCHEDULED' | 'MANUAL';
}

export interface FeedbackSubmission {
  feedbackId: string;
  rating: number; // 1-5
  category?: string;
  comment?: string;
  wouldRecommend?: boolean;
  npsScore?: number; // 0-10
  tags?: string[];
}

export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  npsScore: number;
  categories: Record<string, { count: number; avgRating: number }>;
  recentTrends: Array<{ date: string; avgRating: number; count: number }>;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Trigger feedback collection after tournament completion
 */
export async function triggerTournamentFeedback(
  tournamentId: string
): Promise<{ triggered: number; errors: string[] }> {
  const errors: string[] = [];
  let triggered = 0;

  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          include: { user: true },
        },
      },
    });

    if (!tournament) {
      return { triggered: 0, errors: ['Tournament not found'] };
    }

    for (const registration of tournament.registrations) {
      try {
        // Check if feedback already requested
        const existingRequest = await db.feedbackRequest.findFirst({
          where: {
            userId: registration.userId,
            referenceId: tournamentId,
            feedbackType: 'TOURNAMENT',
          },
        });

        if (existingRequest) continue;

        // Create feedback request
        const request = await db.feedbackRequest.create({
          data: {
            userId: registration.userId,
            sport: tournament.sport,
            feedbackType: 'TOURNAMENT',
            referenceId: tournamentId,
            referenceName: tournament.name,
            triggeredBy: 'COMPLETION',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // Send feedback request notification
        await sendFeedbackRequest({
          userId: registration.userId,
          sport: tournament.sport,
          feedbackType: 'TOURNAMENT',
          referenceId: tournamentId,
          referenceName: tournament.name,
          triggeredBy: 'COMPLETION',
        });

        triggered++;
      } catch (error) {
        errors.push(`Error for user ${registration.userId}: ${error}`);
      }
    }

    return { triggered, errors };
  } catch (error) {
    errors.push(`Batch error: ${error}`);
    return { triggered, errors };
  }
}

/**
 * Trigger feedback collection after match
 */
export async function triggerMatchFeedback(
  matchId: string,
  playerIds: string[]
): Promise<{ triggered: number; errors: string[] }> {
  const errors: string[] = [];
  let triggered = 0;

  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match || !match.tournament) {
      return { triggered: 0, errors: ['Match not found'] };
    }

    for (const userId of playerIds) {
      try {
        // Check if feedback already exists
        const existing = await db.feedbackRequest.findFirst({
          where: {
            userId,
            referenceId: matchId,
            feedbackType: 'MATCH',
          },
        });

        if (existing) continue;

        await db.feedbackRequest.create({
          data: {
            userId,
            sport: match.sport,
            feedbackType: 'MATCH',
            referenceId: matchId,
            referenceName: `Match at ${match.tournament.name}`,
            triggeredBy: 'COMPLETION',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          },
        });

        triggered++;
      } catch (error) {
        errors.push(`Error for user ${userId}: ${error}`);
      }
    }

    return { triggered, errors };
  } catch (error) {
    errors.push(`Batch error: ${error}`);
    return { triggered, errors };
  }
}

/**
 * Send feedback request notification
 */
async function sendFeedbackRequest(request: FeedbackRequest): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: request.userId },
    select: { email: true, firstName: true },
  });

  if (!user) return;

  // Determine notification content based on type
  let title: string;
  let body: string;
  let link: string;

  switch (request.feedbackType) {
    case 'TOURNAMENT':
      title = '🏆 How was your tournament?';
      body = `Share your feedback about ${request.referenceName}`;
      link = `/feedback/tournament/${request.referenceId}`;
      break;
    case 'MATCH':
      title = '⚔️ Rate your match';
      body = 'Quick 30-second feedback helps us improve';
      link = `/feedback/match/${request.referenceId}`;
      break;
    case 'NPS':
      title = '📊 Quick survey';
      body = 'Help shape VALORHIVE\'s future';
      link = '/feedback/nps';
      break;
    default:
      title = '📝 Share your feedback';
      body = 'Your opinion matters to us';
      link = '/feedback';
  }

  // Send push notification
  await sendPushNotification(request.userId, title, body, {
    type: 'FEEDBACK_REQUEST',
    feedbackType: request.feedbackType,
    referenceId: request.referenceId,
  });

  // Create in-app notification
  await db.notification.create({
    data: {
      userId: request.userId,
      sport: request.sport,
      type: 'TOURNAMENT_REGISTERED', // Reuse
      title,
      message: body,
      link,
    },
  });

  // Send email for tournament feedback
  if (request.feedbackType === 'TOURNAMENT' && user.email) {
    await sendEmail({
      to: user.email,
      subject: title,
      html: `
        <h2>Hi ${user.firstName},</h2>
        <p>We'd love to hear about your experience at <strong>${request.referenceName}</strong>!</p>
        <p>Your feedback helps us improve future tournaments.</p>
        <a href="https://valorhive.com${link}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Share Feedback</a>
        <p>Thank you for being part of VALORHIVE!</p>
      `,
    });
  }
}

/**
 * Submit feedback
 */
export async function submitFeedback(
  requestId: string,
  submission: Omit<FeedbackSubmission, 'feedbackId'>
): Promise<{ success: boolean; message: string }> {
  try {
    const request = await db.feedbackRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false, message: 'Feedback request not found' };
    }

    if (request.status === 'COMPLETED') {
      return { success: false, message: 'Feedback already submitted' };
    }

    if (request.expiresAt && request.expiresAt < new Date()) {
      return { success: false, message: 'Feedback request expired' };
    }

    // Create feedback record
    await db.feedback.create({
      data: {
        userId: request.userId,
        sport: request.sport,
        feedbackType: request.feedbackType,
        referenceId: request.referenceId,
        rating: submission.rating,
        category: submission.category,
        comment: submission.comment,
        wouldRecommend: submission.wouldRecommend,
        npsScore: submission.npsScore,
        tags: submission.tags ? JSON.stringify(submission.tags) : null,
      },
    });

    // Mark request as completed
    await db.feedbackRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Thank the user
    await db.notification.create({
      data: {
        userId: request.userId,
        sport: request.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: '🙏 Thank you!',
        message: 'Your feedback helps us improve VALORHIVE',
        link: '/',
      },
    });

    return { success: true, message: 'Feedback submitted successfully' };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, message: 'Failed to submit feedback' };
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(
  sport: SportType,
  options?: {
    startDate?: Date;
    endDate?: Date;
    feedbackType?: string;
  }
): Promise<FeedbackStats> {
  const where: Record<string, unknown> = { sport };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options?.startDate) where.createdAt.gte = options.startDate;
    if (options?.endDate) where.createdAt.lte = options.endDate;
  }

  if (options?.feedbackType) {
    where.feedbackType = options.feedbackType;
  }

  const feedbacks = await db.feedback.findMany({
    where,
    select: {
      rating: true,
      npsScore: true,
      category: true,
      createdAt: true,
    },
  });

  const totalFeedback = feedbacks.length;
  const averageRating = totalFeedback > 0
    ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
    : 0;

  const npsScores = feedbacks.filter(f => f.npsScore !== null);
  const avgNps = npsScores.length > 0
    ? npsScores.reduce((sum, f) => sum + (f.npsScore || 0), 0) / npsScores.length
    : 0;

  // Calculate NPS (percentage of promoters - percentage of detractors)
  const promoters = npsScores.filter(f => (f.npsScore || 0) >= 9).length;
  const detractors = npsScores.filter(f => (f.npsScore || 0) <= 6).length;
  const npsScore = npsScores.length > 0
    ? Math.round(((promoters - detractors) / npsScores.length) * 100)
    : 0;

  // Category breakdown
  const categories: Record<string, { count: number; avgRating: number }> = {};
  for (const feedback of feedbacks) {
    if (feedback.category) {
      if (!categories[feedback.category]) {
        categories[feedback.category] = { count: 0, avgRating: 0 };
      }
      categories[feedback.category].count++;
    }
  }

  // Calculate averages for each category
  for (const cat of Object.keys(categories)) {
    const catFeedbacks = feedbacks.filter(f => f.category === cat);
    categories[cat].avgRating = catFeedbacks.reduce((sum, f) => sum + f.rating, 0) / catFeedbacks.length;
  }

  // Recent trends (last 7 days)
  const recentTrends: Array<{ date: string; avgRating: number; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayFeedbacks = feedbacks.filter(f =>
      f.createdAt.toISOString().split('T')[0] === dateStr
    );

    recentTrends.push({
      date: dateStr,
      avgRating: dayFeedbacks.length > 0
        ? dayFeedbacks.reduce((sum, f) => sum + f.rating, 0) / dayFeedbacks.length
        : 0,
      count: dayFeedbacks.length,
    });
  }

  return {
    totalFeedback,
    averageRating: Math.round(averageRating * 10) / 10,
    npsScore,
    categories,
    recentTrends,
  };
}

/**
 * Get pending feedback requests for a user
 */
export async function getPendingFeedbackRequests(
  userId: string
): Promise<Array<{
  id: string;
  feedbackType: string;
  referenceName: string;
  createdAt: Date;
  expiresAt: Date | null;
}>> {
  return db.feedbackRequest.findMany({
    where: {
      userId,
      status: 'PENDING',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      feedbackType: true,
      referenceName: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Process expired feedback requests
 */
export async function processExpiredFeedbackRequests(): Promise<{ expired: number }> {
  const result = await db.feedbackRequest.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return { expired: result.count };
}

/**
 * Generate NPS survey for random users
 */
export async function generateNPSSurvey(
  sport: SportType,
  sampleSize: number = 100
): Promise<{ created: number }> {
  // Get active users who haven't received NPS survey recently
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const eligibleUsers = await db.user.findMany({
    where: {
      sport,
      isActive: true,
      feedbackRequests: {
        none: {
          feedbackType: 'NPS',
          createdAt: { gte: threeMonthsAgo },
        },
      },
    },
    take: sampleSize,
    select: { id: true },
  });

  let created = 0;

  for (const user of eligibleUsers) {
    try {
      await db.feedbackRequest.create({
        data: {
          userId: user.id,
          sport,
          feedbackType: 'NPS',
          referenceId: 'nps-survey',
          referenceName: 'Platform Experience Survey',
          triggeredBy: 'SCHEDULED',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });

      await sendFeedbackRequest({
        userId: user.id,
        sport,
        feedbackType: 'NPS',
        referenceId: 'nps-survey',
        referenceName: 'Platform Experience Survey',
        triggeredBy: 'SCHEDULED',
      });

      created++;
    } catch (error) {
      console.error('Error creating NPS survey:', error);
    }
  }

  return { created };
}
