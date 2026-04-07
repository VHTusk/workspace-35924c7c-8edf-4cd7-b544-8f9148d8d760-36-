/**
 * Email Job Handler for VALORHIVE
 * 
 * Handles email-related background jobs:
 * - Send transactional emails
 * - Send tournament notifications
 * - Send password reset emails
 * - Send welcome emails
 * - Send match result notifications
 * 
 * @version v3.83.0
 */

import { Job } from 'bullmq';
import { db } from '../db';
import { log } from '../logger';
import type { EmailJobData, JobResult } from '../job-queue';

// ============================================
// Types and Interfaces
// ============================================

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface EmailPayload {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  attachments?: EmailAttachment[];
}

// ============================================
// Email Templates
// ============================================

const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to VALORHIVE!',
    priority: 5,
  },
  tournament_confirmation: {
    subject: 'Tournament Registration Confirmed',
    priority: 3,
  },
  match_result: {
    subject: 'Match Result Notification',
    priority: 2,
  },
  password_reset: {
    subject: 'Password Reset Request',
    priority: 1, // High priority
  },
  email_verification: {
    subject: 'Verify Your Email Address',
    priority: 1,
  },
  tournament_reminder: {
    subject: 'Tournament Starting Soon',
    priority: 2,
  },
  leaderboard_update: {
    subject: 'Leaderboard Update',
    priority: 4,
  },
  subscription_expiry: {
    subject: 'Subscription Expiring Soon',
    priority: 3,
  },
  refund_processed: {
    subject: 'Refund Processed',
    priority: 2,
  },
  prize_payout: {
    subject: 'Prize Payout Notification',
    priority: 2,
  },
} as const;

// ============================================
// Email Service Integration
// ============================================

/**
 * Send an email using the configured email service
 */
async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Import email service dynamically to avoid circular dependencies
    const { emailService } = await import('../email-service');
    
    const result = await emailService.send({
      to: payload.to,
      subject: payload.subject,
      template: payload.template,
      data: payload.data,
      attachments: payload.attachments,
    });
    
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    // Fallback: Log the email if service fails
    log.error('[EmailJob] Failed to send email:', error);
    
    // In development, log the email content
    if (process.env.NODE_ENV !== 'production') {
      log.info('[EmailJob] Email content (dev mode):', {
        to: payload.to,
        subject: payload.subject,
        template: payload.template,
      });
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Email Job Handlers
// ============================================

/**
 * Handle send email job
 */
export async function handleSendEmail(job: Job<EmailJobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { to, subject, template, data, attachments } = job.data;
  
  log.info(`[EmailJob] Processing email job ${job.id}`, {
    to: Array.isArray(to) ? `${to.length} recipients` : to,
    template,
  });
  
  try {
    const result = await sendEmail({
      to,
      subject,
      template,
      data,
      attachments,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }
    
    // Log successful email
    await logEmailSent({
      to,
      subject,
      template,
      messageId: result.messageId,
      jobId: job.id,
    });
    
    return {
      success: true,
      data: { messageId: result.messageId },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    log.error(`[EmailJob] Failed to send email for job ${job.id}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle welcome email
 */
export async function handleWelcomeEmail(
  userId: string,
  userEmail: string,
  userName: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const result = await sendEmail({
      to: userEmail,
      subject: EMAIL_TEMPLATES.welcome.subject,
      template: 'welcome',
      data: {
        name: userName,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      },
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle tournament confirmation email
 */
export async function handleTournamentConfirmationEmail(
  userId: string,
  tournamentId: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    // Get user and tournament details
    const [user, tournament] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      }),
      db.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true, startDate: true, location: true, venueGoogleMapsUrl: true },
      }),
    ]);
    
    if (!user?.email || !tournament) {
      throw new Error('User or tournament not found');
    }
    
    const result = await sendEmail({
      to: user.email,
      subject: `${EMAIL_TEMPLATES.tournament_confirmation.subject} - ${tournament.name}`,
      template: 'tournament-confirmation',
      data: {
        name: `${user.firstName} ${user.lastName}`,
        tournamentName: tournament.name,
        startDate: tournament.startDate.toLocaleDateString(),
        location: tournament.location,
        venueUrl: tournament.venueGoogleMapsUrl,
        tournamentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tournaments/${tournamentId}`,
      },
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle match result email
 */
export async function handleMatchResultEmail(
  userId: string,
  matchId: string,
  result: 'win' | 'loss' | 'draw'
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    // Get user and match details
    const [user, match] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      }),
      db.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: { select: { name: true } },
          playerA: { select: { firstName: true, lastName: true } },
          playerB: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    
    if (!user?.email || !match) {
      throw new Error('User or match not found');
    }
    
    const opponent = match.playerAId === userId ? match.playerB : match.playerA;
    const score = match.playerAId === userId 
      ? `${match.scoreA} - ${match.scoreB}`
      : `${match.scoreB} - ${match.scoreA}`;
    
    const result = await sendEmail({
      to: user.email,
      subject: EMAIL_TEMPLATES.match_result.subject,
      template: 'match-result',
      data: {
        name: `${user.firstName} ${user.lastName}`,
        tournamentName: match.tournament?.name || 'Tournament',
        opponent: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown',
        result: result.toUpperCase(),
        score,
        matchUrl: `${process.env.NEXT_PUBLIC_APP_URL}/matches/${matchId}`,
      },
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle password reset email
 */
export async function handlePasswordResetEmail(
  userId: string,
  resetToken: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    
    if (!user?.email) {
      throw new Error('User not found');
    }
    
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    
    const result = await sendEmail({
      to: user.email,
      subject: EMAIL_TEMPLATES.password_reset.subject,
      template: 'password-reset',
      data: {
        name: user.firstName,
        resetUrl,
        expiresIn: '1 hour',
      },
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Handle email verification
 */
export async function handleEmailVerification(
  userId: string,
  verificationToken: string
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    
    if (!user?.email) {
      throw new Error('User not found');
    }
    
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
    
    const result = await sendEmail({
      to: user.email,
      subject: EMAIL_TEMPLATES.email_verification.subject,
      template: 'email-verification',
      data: {
        name: user.firstName,
        verificationUrl,
        expiresIn: '24 hours',
      },
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Log email sent to database (optional, for analytics)
 */
async function logEmailSent(data: {
  to: string | string[];
  subject: string;
  template: string;
  messageId?: string;
  jobId?: string;
}): Promise<void> {
  try {
    // Could log to a separate analytics table
    log.info('[EmailJob] Email sent:', {
      to: Array.isArray(data.to) ? data.to.length : 1,
      template: data.template,
      messageId: data.messageId,
    });
  } catch (error) {
    // Don't fail the job if logging fails
    log.error('[EmailJob] Failed to log email:', error);
  }
}

// ============================================
// Export Default Handler
// ============================================

export default handleSendEmail;
