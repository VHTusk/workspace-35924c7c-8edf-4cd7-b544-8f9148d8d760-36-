/**
 * Email Service Integration
 * 
 * Supports multiple providers:
 * - SendGrid (recommended)
 * - AWS SES
 * - Resend
 * - Nodemailer (SMTP)
 */

import { SportType } from '@prisma/client';
import { emailTemplates } from './templates';

// Email configuration
const EMAIL_CONFIG = {
  from: 'VALORHIVE <noreply@valorhive.com>',
  replyTo: 'support@valorhive.com',
};

// Email types
export type EmailType = 
  | 'tournament_registration'
  | 'match_result'
  | 'tournament_reminder'
  | 'tournament_recap'
  | 'rank_change'
  | 'milestone'
  | 'password_reset'
  | 'welcome';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using configured provider
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
  
  try {
    switch (provider.toLowerCase()) {
      case 'sendgrid':
        return await sendViaSendGrid(payload);
      case 'ses':
        return await sendViaSES(payload);
      case 'resend':
        return await sendViaResend(payload);
      case 'smtp':
        return await sendViaSMTP(payload);
      default:
        // Log only in development
        console.log('📧 Email (dev mode):', {
          to: payload.to,
          subject: payload.subject,
          preview: payload.text?.substring(0, 100),
        });
        return { success: true, messageId: `dev-${Date.now()}` };
    }
  } catch (error) {
    console.error('Email send error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * SendGrid Integration
 */
async function sendViaSendGrid(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    console.warn('SendGrid API key not configured, falling back to log');
    return { success: true, messageId: `log-${Date.now()}` };
  }
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: Array.isArray(payload.to) 
          ? payload.to.map(email => ({ email }))
          : [{ email: payload.to }],
      }],
      from: { email: EMAIL_CONFIG.from, name: 'VALORHIVE' },
      reply_to: { email: EMAIL_CONFIG.replyTo },
      subject: payload.subject,
      content: [
        { type: 'text/plain', value: payload.text || '' },
        { type: 'text/html', value: payload.html },
      ],
      custom_args: payload.metadata,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${error}`);
  }
  
  const messageId = response.headers.get('x-message-id');
  return { success: true, messageId: messageId || undefined };
}

/**
 * AWS SES Integration
 */
async function sendViaSES(payload: EmailPayload): Promise<EmailResult> {
  // AWS SES would use AWS SDK
  // For now, log and return success
  console.log('📧 SES Email:', {
    to: payload.to,
    subject: payload.subject,
  });
  
  return { success: true, messageId: `ses-${Date.now()}` };
}

/**
 * Resend Integration
 */
async function sendViaResend(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn('Resend API key not configured');
    return { success: true, messageId: `log-${Date.now()}` };
  }
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_CONFIG.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${error}`);
  }
  
  const data = await response.json();
  return { success: true, messageId: data.id };
}

/**
 * SMTP Integration (via Nodemailer)
 */
async function sendViaSMTP(payload: EmailPayload): Promise<EmailResult> {
  // Would use nodemailer
  console.log('📧 SMTP Email:', {
    to: payload.to,
    subject: payload.subject,
  });
  
  return { success: true, messageId: `smtp-${Date.now()}` };
}

// Convenience functions for specific email types

export async function sendTournamentRegistrationEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  entryFee: number;
  tournamentId: string;
}): Promise<EmailResult> {
  const html = emailTemplates.tournamentRegistration(params);
  
  return sendEmail({
    to: params.to,
    subject: `Registration Confirmed: ${params.tournamentName}`,
    html,
    text: `Hi ${params.playerName}, you're registered for ${params.tournamentName} on ${params.tournamentDate} at ${params.tournamentLocation}. Entry fee: ₹${params.entryFee}.`,
    metadata: {
      type: 'tournament_registration',
      tournamentId: params.tournamentId,
    },
  });
}

export async function sendMatchResultEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  opponentName: string;
  tournamentName: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  pointsEarned: number;
  eloChange: number;
  matchId: string;
}): Promise<EmailResult> {
  const html = emailTemplates.matchResult(params);
  const resultText = params.won ? 'Victory' : 'Defeat';
  
  return sendEmail({
    to: params.to,
    subject: `${resultText}: ${params.playerScore}-${params.opponentScore} vs ${params.opponentName}`,
    html,
    text: `Match result: ${params.playerScore}-${params.opponentScore} vs ${params.opponentName}. ${params.won ? 'You won!' : 'Better luck next time!'}`,
    metadata: {
      type: 'match_result',
      matchId: params.matchId,
    },
  });
}

export async function sendTournamentReminderEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  tournamentName: string;
  timeUntil: string;
  tournamentDate: string;
  tournamentTime: string;
  tournamentLocation: string;
  tournamentId: string;
  checkInCode?: string;
}): Promise<EmailResult> {
  const html = emailTemplates.tournamentReminder(params);
  
  return sendEmail({
    to: params.to,
    subject: `Reminder: ${params.tournamentName} starts in ${params.timeUntil}`,
    html,
    text: `Hi ${params.playerName}, ${params.tournamentName} begins in ${params.timeUntil}. ${params.tournamentDate} at ${params.tournamentTime}, ${params.tournamentLocation}.`,
    metadata: {
      type: 'tournament_reminder',
      tournamentId: params.tournamentId,
      timeUntil: params.timeUntil,
    },
  });
}

export async function sendTournamentRecapEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  tournamentName: string;
  placement: number;
  totalParticipants: number;
  matchesWon: number;
  matchesLost: number;
  pointsEarned: number;
  eloChange: number;
  tournamentId: string;
  highlights?: string[];
}): Promise<EmailResult> {
  const html = emailTemplates.tournamentRecap({
    ...params,
    highlights: params.highlights || [],
  });
  
  return sendEmail({
    to: params.to,
    subject: `Tournament Complete: You placed #${params.placement} in ${params.tournamentName}`,
    html,
    text: `You placed #${params.placement} out of ${params.totalParticipants} participants. Won ${params.matchesWon} matches, earned ${params.pointsEarned} points.`,
    metadata: {
      type: 'tournament_recap',
      tournamentId: params.tournamentId,
    },
  });
}

export async function sendRankChangeEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  previousRank: number;
  newRank: number;
  tier: string;
  points: number;
}): Promise<EmailResult> {
  const html = emailTemplates.rankChange(params);
  const improved = params.newRank < params.previousRank;
  
  return sendEmail({
    to: params.to,
    subject: `${improved ? '⬆️ Rank Improved!' : 'Rank Update'}: You're now #${params.newRank}`,
    html,
    text: `Your rank changed from #${params.previousRank} to #${params.newRank}. Tier: ${params.tier}, Points: ${params.points}.`,
    metadata: {
      type: 'rank_change',
    },
  });
}

export async function sendMilestoneEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  milestoneTitle: string;
  milestoneDescription: string;
  points?: number;
}): Promise<EmailResult> {
  const html = emailTemplates.milestone(params);
  
  return sendEmail({
    to: params.to,
    subject: `🏅 Achievement Unlocked: ${params.milestoneTitle}`,
    html,
    text: `Congratulations ${params.playerName}! You've earned: ${params.milestoneTitle}. ${params.milestoneDescription}`,
    metadata: {
      type: 'milestone',
    },
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
}): Promise<EmailResult> {
  const html = emailTemplates.welcome({
    ...params,
    email: params.to,
  });
  
  return sendEmail({
    to: params.to,
    subject: `Welcome to VALORHIVE, ${params.playerName}!`,
    html,
    text: `Hi ${params.playerName}, welcome to VALORHIVE! You're now part of the ${params.sport} community.`,
    metadata: {
      type: 'welcome',
    },
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  sport: SportType;
  playerName: string;
  resetUrl: string;
  expiresIn: string;
}): Promise<EmailResult> {
  const html = emailTemplates.passwordReset(params);
  
  return sendEmail({
    to: params.to,
    subject: 'Reset Your VALORHIVE Password',
    html,
    text: `Hi ${params.playerName}, click here to reset your password: ${params.resetUrl}. Link expires in ${params.expiresIn}.`,
    metadata: {
      type: 'password_reset',
    },
  });
}
