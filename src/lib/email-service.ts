// VALORHIVE Email Service
// SendGrid integration for transactional emails

import { SportType } from '@prisma/client';
import { emailTemplates, getWhatsAppTemplates, TournamentReminderData, MatchResultData, TournamentRecapData, RegistrationConfirmData, WeeklyDigestData, MilestoneData, SubscriptionExpiryData } from './email-templates';
import { getAppUrl } from './app-url';

// Email configuration
interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

// Default configuration from environment
const getEmailConfig = (): EmailConfig => ({
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'notifications@valorhive.com',
  fromName: process.env.SENDGRID_FROM_NAME || 'VALORHIVE',
  replyTo: process.env.SENDGRID_REPLY_TO || 'support@valorhive.com',
});

// Email address interface
interface EmailAddress {
  email: string;
  name?: string;
}

// Send email request
interface SendEmailRequest {
  to: EmailAddress | EmailAddress[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  categories?: string[];
  customArgs?: Record<string, string>;
}

// Send email response
interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// SENDGRID API CLIENT
// ============================================

const sendWithSendGrid = async (request: SendEmailRequest): Promise<SendEmailResponse> => {
  const config = getEmailConfig();
  
  if (!config.apiKey) {
    console.warn('📧 SendGrid API key not configured. Email would have been sent:', {
      to: Array.isArray(request.to) ? request.to.map(t => t.email) : request.to.email,
      subject: request.subject,
    });
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  const personalizations = {
    to: Array.isArray(request.to) ? request.to : [request.to],
    subject: request.subject,
    dynamic_template_data: request.dynamicTemplateData,
  };

  const payload = {
    personalizations: [personalizations],
    from: {
      email: config.fromEmail,
      name: config.fromName,
    },
    reply_to: {
      email: config.replyTo,
    },
    content: [
      {
        type: 'text/plain',
        value: request.textBody || 'Please view this email in an HTML client.',
      },
      {
        type: 'text/html',
        value: request.htmlBody,
      },
    ],
    categories: request.categories,
    custom_args: request.customArgs,
    mail_settings: {
      sandbox_mode: {
        enable: process.env.NODE_ENV === 'test',
      },
      footer: {
        enable: true,
        html: '<p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px;">You received this email because you registered on VALORHIVE. <a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
      },
    },
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const messageId = response.headers.get('X-Message-Id');
      return { success: true, messageId: messageId || undefined };
    }

    const errorData = await response.json().catch(() => ({}));
    console.error('📧 SendGrid error:', errorData);
    return { success: false, error: JSON.stringify(errorData) };
  } catch (error) {
    console.error('📧 SendGrid request failed:', error);
    return { success: false, error: String(error) };
  }
};

// ============================================
// EMAIL SERVICE CLASS
// ============================================

export class EmailService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = getAppUrl();
  }

  // Generate URLs for email templates
  private generateUrls(userId: string, sport: SportType): { unsubscribeUrl: string; preferencesUrl: string; privacyUrl: string } {
    return {
      unsubscribeUrl: `${this.baseUrl}/${sport.toLowerCase()}/settings/notifications?unsubscribe=true&user=${userId}`,
      preferencesUrl: `${this.baseUrl}/${sport.toLowerCase()}/settings/notifications`,
      privacyUrl: `${this.baseUrl}/legal/privacy`,
    };
  }

  // Send tournament reminder email
  async sendTournamentReminder(
    to: EmailAddress,
    data: Omit<TournamentReminderData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: TournamentReminderData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.tournamentReminder(templateData);
    const textBody = getWhatsAppTemplates.tournamentReminder(templateData);

    return sendWithSendGrid({
      to,
      subject: `${data.hoursUntilStart} hours until ${data.tournamentName}`,
      htmlBody,
      textBody,
      categories: ['tournament', 'reminder', data.sport.toLowerCase()],
      customArgs: {
        tournament_id: data.tournamentName.replace(/\s+/g, '-').toLowerCase(),
        reminder_type: `${data.hoursUntilStart}hr`,
      },
    });
  }

  // Send match result notification
  async sendMatchResult(
    to: EmailAddress,
    data: Omit<MatchResultData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string; matchId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: MatchResultData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.matchResult(templateData);
    const textBody = getWhatsAppTemplates.matchResult(templateData);

    return sendWithSendGrid({
      to,
      subject: `${data.isWinner ? '🏆 Victory!' : 'Match Result'} vs ${data.opponentName}`,
      htmlBody,
      textBody,
      categories: ['match', 'result', data.sport.toLowerCase()],
      customArgs: {
        match_id: data.matchId,
        result: data.isWinner ? 'win' : 'loss',
      },
    });
  }

  // Send tournament recap email
  async sendTournamentRecap(
    to: EmailAddress,
    data: Omit<TournamentRecapData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string; tournamentId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: TournamentRecapData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.tournamentRecap(templateData);

    return sendWithSendGrid({
      to,
      subject: `Tournament Complete: You finished #${data.finalRank} in ${data.tournamentName}!`,
      htmlBody,
      textBody: `You finished #${data.finalRank} in ${data.tournamentName}!\n\nMatches: ${data.matchesWon}/${data.matchesPlayed} won\nPoints: +${data.pointsEarned}\n\nView results: ${data.tournamentUrl}`,
      categories: ['tournament', 'recap', data.sport.toLowerCase()],
      customArgs: {
        tournament_id: data.tournamentId,
        final_rank: String(data.finalRank),
      },
    });
  }

  // Send registration confirmation
  async sendRegistrationConfirmation(
    to: EmailAddress,
    data: Omit<RegistrationConfirmData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string; tournamentId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: RegistrationConfirmData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.registrationConfirm(templateData);

    return sendWithSendGrid({
      to,
      subject: `✅ Registered for ${data.tournamentName}`,
      htmlBody,
      textBody: `You're registered for ${data.tournamentName}!\n\nDate: ${data.tournamentDate}\nVenue: ${data.venue}\nEntry Fee: ₹${data.entryFee}\n\nView tournament: ${data.tournamentUrl}`,
      categories: ['tournament', 'registration', data.sport.toLowerCase()],
      customArgs: {
        tournament_id: data.tournamentId,
        transaction_id: data.transactionId,
      },
    });
  }

  // Send weekly digest
  async sendWeeklyDigest(
    to: EmailAddress,
    data: Omit<WeeklyDigestData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: WeeklyDigestData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.weeklyDigest(templateData);

    return sendWithSendGrid({
      to,
      subject: `📊 Your Weekly ${data.sport.charAt(0) + data.sport.slice(1).toLowerCase()} Summary`,
      htmlBody,
      textBody: `Weekly Summary (${data.weekStart} - ${data.weekEnd})\n\nMatches: ${data.matchesPlayed} played, ${data.matchesWon} won\nPoints: +${data.pointsEarned}\nRank: #${data.currentRank}\n\nView leaderboard: ${data.leaderboardUrl}`,
      categories: ['digest', 'weekly', data.sport.toLowerCase()],
      customArgs: {
        week: data.weekStart,
      },
    });
  }

  // Send milestone achievement
  async sendMilestoneAchievement(
    to: EmailAddress,
    data: Omit<MilestoneData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: MilestoneData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.milestone(templateData);
    const textBody = getWhatsAppTemplates.milestone(templateData);

    return sendWithSendGrid({
      to,
      subject: `🎉 Achievement Unlocked: ${data.milestoneTitle}!`,
      htmlBody,
      textBody,
      categories: ['milestone', 'achievement', data.sport.toLowerCase()],
      customArgs: {
        milestone_type: data.milestoneType,
      },
    });
  }

  // Send subscription expiry warning
  async sendSubscriptionExpiryWarning(
    to: EmailAddress,
    data: Omit<SubscriptionExpiryData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'> & { userId: string }
  ): Promise<SendEmailResponse> {
    const urls = this.generateUrls(data.userId, data.sport);
    const templateData: SubscriptionExpiryData = { ...data, ...urls };
    
    const htmlBody = emailTemplates.subscriptionExpiry(templateData);
    const textBody = getWhatsAppTemplates.subscriptionExpiry(templateData);

    return sendWithSendGrid({
      to,
      subject: `${data.daysRemaining <= 3 ? '⚠️ Final Notice' : 'Subscription Reminder'}: ${data.daysRemaining} days remaining`,
      htmlBody,
      textBody,
      categories: ['subscription', 'expiry-warning', data.sport.toLowerCase()],
      customArgs: {
        days_remaining: String(data.daysRemaining),
      },
    });
  }

  // Send bulk reminder emails (for cron jobs)
  async sendBulkReminders(
    reminders: Array<{
      email: string;
      name: string;
      data: Omit<TournamentReminderData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl' | 'recipientName'> & { userId: string };
    }>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Process in batches of 100 (SendGrid limit)
    const batchSize = 100;
    
    for (let i = 0; i < reminders.length; i += batchSize) {
      const batch = reminders.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(reminder =>
          this.sendTournamentReminder(
            { email: reminder.email, name: reminder.name },
            { ...reminder.data, recipientName: reminder.name }
          )
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++;
        } else {
          failed++;
          console.error('📧 Failed to send reminder:', result);
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < reminders.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { sent, failed };
  }
}

// ============================================
// WHATSAPP BUSINESS API SERVICE
// ============================================

export class WhatsAppService {
  private apiKey: string;
  private apiEndpoint: string;
  private fromNumber: string;
  
  constructor() {
    // Support multiple providers: Twilio, MSG91, Gupshup
    this.apiKey = process.env.WHATSAPP_API_KEY || process.env.TWILIO_AUTH_TOKEN || '';
    this.apiEndpoint = process.env.WHATSAPP_API_ENDPOINT || 'https://api.twilio.com/2010-04-01/Accounts';
    this.fromNumber = process.env.WHATSAPP_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '';
  }

  // Send WhatsApp message via Twilio
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey || !this.fromNumber) {
      console.warn('📱 WhatsApp not configured. Message would have been sent:', { to, message: message.substring(0, 50) + '...' });
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
      const authString = Buffer.from(`${accountSid}:${this.apiKey}`).toString('base64');
      
      const response = await fetch(
        `${this.apiEndpoint}/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: `whatsapp:${this.fromNumber}`,
            Body: message,
            To: `whatsapp:${to}`,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return { success: true, messageId: data.sid };
      }

      const errorData = await response.json();
      console.error('📱 WhatsApp error:', errorData);
      return { success: false, error: JSON.stringify(errorData) };
    } catch (error) {
      console.error('📱 WhatsApp request failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // Send tournament reminder via WhatsApp
  async sendTournamentReminder(
    to: string,
    data: Omit<TournamentReminderData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = getWhatsAppTemplates.tournamentReminder(data);
    return this.sendMessage(to, message);
  }

  // Send match result via WhatsApp
  async sendMatchResult(
    to: string,
    data: Omit<MatchResultData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = getWhatsAppTemplates.matchResult(data);
    return this.sendMessage(to, message);
  }

  // Send milestone via WhatsApp
  async sendMilestone(
    to: string,
    data: Omit<MilestoneData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = getWhatsAppTemplates.milestone(data);
    return this.sendMessage(to, message);
  }
}

// ============================================
// NOTIFICATION ORCHESTRATOR
// ============================================

export class NotificationService {
  private emailService: EmailService;
  private whatsAppService: WhatsAppService;
  
  constructor() {
    this.emailService = new EmailService();
    this.whatsAppService = new WhatsAppService();
  }

  // Send notification based on user preferences
  async sendTournamentReminder(
    user: { id: string; email: string | null; phone?: string | null; firstName: string; lastName: string },
    data: Omit<TournamentReminderData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl' | 'recipientName' | 'userId'>,
    preferences: { emailEnabled: boolean; whatsappEnabled: boolean }
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const results = { emailSent: false, whatsappSent: false };

    // Send email if enabled
    if (preferences.emailEnabled && user.email) {
      const result = await this.emailService.sendTournamentReminder(
        { email: user.email, name: `${user.firstName} ${user.lastName}` },
        {
          ...data,
          recipientName: `${user.firstName} ${user.lastName}`,
          userId: user.id,
        }
      );
      results.emailSent = result.success;
    }

    // Send WhatsApp if enabled and phone exists
    if (preferences.whatsappEnabled && user.phone) {
      const result = await this.whatsAppService.sendTournamentReminder(user.phone, {
        ...data,
        recipientName: `${user.firstName} ${user.lastName}`,
      });
      results.whatsappSent = result.success;
    }

    return results;
  }

  // Send match result notification
  async sendMatchResult(
    user: { id: string; email: string | null; phone?: string | null; firstName: string; lastName: string },
    data: Omit<MatchResultData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl' | 'recipientName' | 'userId'> & { matchId: string },
    preferences: { emailEnabled: boolean; whatsappEnabled: boolean }
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const results = { emailSent: false, whatsappSent: false };

    if (preferences.emailEnabled && user.email) {
      const result = await this.emailService.sendMatchResult(
        { email: user.email, name: `${user.firstName} ${user.lastName}` },
        { ...data, recipientName: `${user.firstName} ${user.lastName}`, userId: user.id }
      );
      results.emailSent = result.success;
    }

    if (preferences.whatsappEnabled && user.phone) {
      const result = await this.whatsAppService.sendMatchResult(user.phone, {
        ...data,
        recipientName: `${user.firstName} ${user.lastName}`,
      });
      results.whatsappSent = result.success;
    }

    return results;
  }

  // Send match reminder (v3.45.0) - 2h, 30m, 5m before match
  async sendMatchReminder(
    user: { id: string; email: string | null; phone?: string | null; firstName: string; lastName: string },
    data: {
      matchId: string;
      tournamentName: string;
      opponentName: string;
      scheduledTime: Date;
      court?: string | null;
      minutesBefore: number;
      matchUrl: string;
    }
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const results = { emailSent: false, whatsappSent: false };

    const timeLabel = 
      data.minutesBefore >= 120 ? '2 hours' :
      data.minutesBefore >= 30 ? '30 minutes' :
      '5 minutes';

    const scheduledTimeStr = data.scheduledTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // Send email
    if (user.email) {
      const subject = data.minutesBefore <= 5 
        ? `🔴 MATCH STARTING SOON vs ${data.opponentName}`
        : `⏰ Match in ${timeLabel} vs ${data.opponentName}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Match Reminder</h2>
          <p style="font-size: 16px;">Hi ${user.firstName},</p>
          <p style="font-size: 16px;">Your match starts in <strong>${timeLabel}</strong>!</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px;"><strong>Tournament:</strong> ${data.tournamentName}</p>
            <p style="margin: 0 0 10px;"><strong>Opponent:</strong> ${data.opponentName}</p>
            <p style="margin: 0 0 10px;"><strong>Time:</strong> ${scheduledTimeStr}</p>
            ${data.court ? `<p style="margin: 0;"><strong>Court:</strong> ${data.court}</p>` : ''}
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Be at your assigned court a few minutes early. Good luck! 🏆
          </p>
          
          <a href="${data.matchUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            View Match Details
          </a>
        </div>
      `;

      const textBody = `Match Reminder: Your match vs ${data.opponentName} starts in ${timeLabel}!
        
Tournament: ${data.tournamentName}
Time: ${scheduledTimeStr}
${data.court ? `Court: ${data.court}` : ''}

Be at your assigned court a few minutes early. Good luck!

View match: ${data.matchUrl}`;

      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
              subject,
            }],
            from: {
              email: process.env.SENDGRID_FROM_EMAIL || 'notifications@valorhive.com',
              name: process.env.SENDGRID_FROM_NAME || 'VALORHIVE',
            },
            content: [
              { type: 'text/plain', value: textBody },
              { type: 'text/html', value: htmlBody },
            ],
          }),
        });
        results.emailSent = response.ok;
      } catch (error) {
        console.error('Failed to send match reminder email:', error);
      }
    }

    // Send WhatsApp
    if (user.phone) {
      const message = `🏆 VALORHIVE Match Reminder

Your match vs ${data.opponentName} starts in ${timeLabel}!

📅 Tournament: ${data.tournamentName}
⏰ Time: ${scheduledTimeStr}
${data.court ? `🏟️ Court: ${data.court}` : ''}

Be at your court early. Good luck! 🍀`;

      try {
        const result = await this.whatsAppService.sendMessage(user.phone, message);
        results.whatsappSent = result.success;
      } catch (error) {
        console.error('Failed to send match reminder WhatsApp:', error);
      }
    }

    return results;
  }
}

// Export singleton instances
export const emailService = new EmailService();
export const whatsAppService = new WhatsAppService();
export const notificationService = new NotificationService();
