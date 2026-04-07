/**
 * Worker Service Handlers
 * 
 * These handlers can be called:
 * 1. Directly by the background worker (no HTTP overhead)
 * 2. By API routes if needed for testing/debugging
 * 
 * This eliminates the need for /api/workers/* routes
 * while keeping the logic centralized.
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { calculateEloChange, getEloTier } from '@/lib/auth';
import logger from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================
// EMAIL SERVICE
// ============================================

export async function handleSendEmail(payload: {
  to: string;
  template: string;
  data?: Record<string, unknown>;
}): Promise<JobResult> {
  try {
    const { to, template, data } = payload;
    
    logger.info('Processing send-email job', { to, template });
    
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the email for development
    logger.info('Email would be sent', {
      to,
      template,
      subject: data?.subject || 'No Subject',
    });
    
    // In production, call actual email service here
    // await emailService.send({ to, template, data });
    
    return { success: true, data: { messageId: `mock-${Date.now()}` } };
  } catch (error) {
    logger.error('Failed to send email', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

export async function handleCreateNotification(payload: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<JobResult> {
  try {
    const { userId, type, title, message, data } = payload;
    
    logger.info('Processing create-notification job', { userId, type });
    
    const notification = await db.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        read: false,
      },
    });
    
    return { success: true, data: { notificationId: notification.id } };
  } catch (error) {
    logger.error('Failed to create notification', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// ELO CALCULATION SERVICE
// ============================================

export async function handleCalculateElo(payload: {
  matchId: string;
}): Promise<JobResult> {
  try {
    const { matchId } = payload;
    
    logger.info('Processing calculate-elo job', { matchId });
    
    // Get match details
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        playerA: { include: { rating: true } },
        playerB: { include: { rating: true } },
      },
    });
    
    if (!match) {
      return { success: false, error: 'Match not found' };
    }
    
    if (!match.playerAId || !match.playerBId || match.winnerId === null) {
      return { success: false, error: 'Match is missing required data' };
    }
    
    // Get ratings
    const ratingA = match.playerA?.rating;
    const ratingB = match.playerB?.rating;
    
    if (!ratingA || !ratingB) {
      return { success: false, error: 'Player ratings not found' };
    }
    
    // Calculate ELO changes
    const actualA = match.winnerId === match.playerAId ? 1 : 0;
    const { eloChangeA, eloChangeB } = calculateEloChange(
      ratingA.elo,
      ratingB.elo,
      actualA,
      ratingA.matchCount,
      ratingB.matchCount
    );
    
    // Update ratings in transaction
    await db.$transaction([
      db.playerRating.update({
        where: { userId: match.playerAId },
        data: {
          elo: ratingA.elo + eloChangeA,
          matchCount: ratingA.matchCount + 1,
          wins: { increment: match.winnerId === match.playerAId ? 1 : 0 },
        },
      }),
      db.playerRating.update({
        where: { userId: match.playerBId },
        data: {
          elo: ratingB.elo + eloChangeB,
          matchCount: ratingB.matchCount + 1,
          wins: { increment: match.winnerId === match.playerBId ? 1 : 0 },
        },
      }),
      db.match.update({
        where: { id: matchId },
        data: {
          eloChangeA,
          eloChangeB,
        },
      }),
    ]);
    
    return { success: true, data: { eloChangeA, eloChangeB } };
  } catch (error) {
    logger.error('Failed to calculate ELO', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// BRACKET GENERATION SERVICE
// ============================================

export async function handleGenerateBracket(payload: {
  tournamentId: string;
}): Promise<JobResult> {
  try {
    const { tournamentId } = payload;
    
    logger.info('Processing generate-bracket job', { tournamentId });
    
    // Get tournament with registrations
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
        },
      },
    });
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    // Check if bracket already exists
    const existingBracket = await db.bracket.findFirst({
      where: { tournamentId },
    });
    
    if (existingBracket) {
      return { success: false, error: 'Bracket already exists' };
    }
    
    // Simple bracket generation - create matches from registered players
    const players = tournament.registrations.map(r => r.userId);
    
    if (players.length < 2) {
      return { success: false, error: 'Not enough players for bracket' };
    }
    
    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    // Create bracket record
    const bracket = await db.bracket.create({
      data: {
        tournamentId,
        format: tournament.bracketFormat || 'SINGLE_ELIMINATION',
        generatedById: 'system',
        rounds: Math.ceil(Math.log2(players.length)),
      },
    });
    
    // Create first round matches
    const matches = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId,
          playerAId: shuffled[i],
          playerBId: shuffled[i + 1],
          tournamentScope: tournament.scope,
        },
      });
      matches.push(match);
    }
    
    // Update tournament status
    await db.tournament.update({
      where: { id: tournamentId },
      data: { status: 'BRACKET_GENERATED' },
    });
    
    return { success: true, data: { bracketId: bracket.id, matchCount: matches.length } };
  } catch (error) {
    logger.error('Failed to generate bracket', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// TOURNAMENT AUTOPILOT SERVICE
// ============================================

export async function handleTournamentAutopilot(payload: {
  tournamentId: string;
  action: string;
}): Promise<JobResult> {
  try {
    const { tournamentId, action } = payload;
    
    logger.info('Processing tournament-autopilot job', { tournamentId, action });
    
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    switch (action) {
      case 'close_registration':
        if (tournament.status === 'REGISTRATION_OPEN') {
          await db.tournament.update({
            where: { id: tournamentId },
            data: { 
              status: 'REGISTRATION_CLOSED',
              registrationClosedAt: new Date(),
            },
          });
        }
        break;
        
      case 'start_tournament':
        if (tournament.status === 'BRACKET_GENERATED') {
          await db.tournament.update({
            where: { id: tournamentId },
            data: { 
              status: 'IN_PROGRESS',
              tournamentStartedAt: new Date(),
            },
          });
        }
        break;
        
      default:
        return { success: false, error: `Unknown autopilot action: ${action}` };
    }
    
    // Log autopilot action
    await db.autopilotLog.create({
      data: {
        tournamentId,
        action,
        status: 'SUCCESS',
        executedAt: new Date(),
      },
    });
    
    return { success: true, data: { tournamentId, action } };
  } catch (error) {
    logger.error('Failed to process tournament autopilot', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// ANALYTICS AGGREGATION SERVICE
// ============================================

export async function handleAggregateAnalytics(payload: {
  period: string;
  sport?: SportType;
}): Promise<JobResult> {
  try {
    const { period, sport } = payload;
    
    logger.info('Processing aggregate-analytics job', { period, sport });
    
    // Aggregate various metrics based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    // Count tournaments
    const tournamentCount = await db.tournament.count({
      where: {
        createdAt: { gte: startDate },
        ...(sport && { sport }),
      },
    });
    
    // Count matches
    const matchCount = await db.match.count({
      where: {
        playedAt: { gte: startDate },
        ...(sport && { sport }),
      },
    });
    
    // Count new users
    const newUsersCount = await db.user.count({
      where: {
        createdAt: { gte: startDate },
        ...(sport && { sport }),
      },
    });
    
    return { 
      success: true, 
      data: { 
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        tournamentCount,
        matchCount,
        newUsersCount,
      } 
    };
  } catch (error) {
    logger.error('Failed to aggregate analytics', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// REPORT GENERATION SERVICE
// ============================================

export async function handleGenerateReport(payload: {
  type: string;
  userId: string;
  tournamentId?: string;
}): Promise<JobResult> {
  try {
    const { type, userId, tournamentId } = payload;
    
    logger.info('Processing generate-report job', { type, userId, tournamentId });
    
    // TODO: Implement actual report generation
    // This would generate PDF reports for tournaments, player stats, etc.
    
    return { success: true, data: { reportId: `report-${Date.now()}` } };
  } catch (error) {
    logger.error('Failed to generate report', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// PAYMENT REFUND SERVICE
// ============================================

export async function handleProcessRefund(payload: {
  paymentId: string;
  reason?: string;
}): Promise<JobResult> {
  try {
    const { paymentId, reason } = payload;
    
    logger.info('Processing process-refund job', { paymentId, reason });
    
    // Get payment record
    const payment = await db.paymentLedger.findUnique({
      where: { id: paymentId },
    });
    
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }
    
    if (payment.status !== 'PAID') {
      return { success: false, error: 'Payment is not in a refundable state' };
    }
    
    // TODO: Integrate with actual payment gateway (Razorpay, etc.)
    // For now, just update the status
    
    await db.paymentLedger.update({
      where: { id: paymentId },
      data: { 
        status: 'REFUNDED',
        refundId: `refund-${Date.now()}`,
      },
    });
    
    return { success: true, data: { refundId: `refund-${Date.now()}` } };
  } catch (error) {
    logger.error('Failed to process refund', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// SMS SERVICE
// ============================================

export async function handleSendSms(payload: {
  to: string;
  message: string;
}): Promise<JobResult> {
  try {
    const { to, message } = payload;
    
    logger.info('Processing send-sms job', { to });
    
    // TODO: Integrate with actual SMS service (Twilio, AWS SNS, etc.)
    logger.info('SMS would be sent', { to, messageLength: message.length });
    
    return { success: true, data: { messageId: `sms-${Date.now()}` } };
  } catch (error) {
    logger.error('Failed to send SMS', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// WHATSAPP SERVICE
// ============================================

export async function handleSendWhatsapp(payload: {
  to: string;
  template: string;
  data?: Record<string, unknown>;
}): Promise<JobResult> {
  try {
    const { to, template, data } = payload;
    
    logger.info('Processing send-whatsapp job', { to, template });
    
    // TODO: Integrate with WhatsApp Business API
    logger.info('WhatsApp would be sent', { to, template, data });
    
    return { success: true, data: { messageId: `wa-${Date.now()}` } };
  } catch (error) {
    logger.error('Failed to send WhatsApp', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// HANDLER MAP
// ============================================

export const workerHandlers: Record<string, (payload: Record<string, unknown>) => Promise<JobResult>> = {
  'send-email': handleSendEmail,
  'create-notification': handleCreateNotification,
  'calculate-elo': handleCalculateElo,
  'generate-bracket': handleGenerateBracket,
  'tournament-autopilot': handleTournamentAutopilot,
  'aggregate-analytics': handleAggregateAnalytics,
  'generate-report': handleGenerateReport,
  'process-refund': handleProcessRefund,
  'send-sms': handleSendSms,
  'send-whatsapp': handleSendWhatsapp,
};
