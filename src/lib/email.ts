/**
 * Email Service Library
 * Supports transactional emails for VALORHIVE
 * 
 * For production, configure environment variables:
 * - EMAIL_PROVIDER: 'sendgrid' | 'ses' | 'mailgun' | 'console' (default: console)
 * - SENDGRID_API_KEY: SendGrid API key
 * - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: For SES
 * - MAILGUN_API_KEY, MAILGUN_DOMAIN: For Mailgun
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const DEFAULT_FROM = 'VALORHIVE <noreply@valorhive.com>';

// Email templates
export const EmailTemplates = {
  TOURNAMENT_REGISTRATION: 'tournament-registration',
  MATCH_REMINDER: 'match-reminder',
  MATCH_RESULT: 'match-result',
  TOURNAMENT_WIN: 'tournament-win',
  PASSWORD_RESET: 'password-reset',
  EMAIL_VERIFICATION: 'email-verification',
  WAITLIST_PROMOTED: 'waitlist-promoted',
  WEEKLY_DIGEST: 'weekly-digest',
  SUBSCRIPTION_EXPIRING: 'subscription-expiring',
  ACCOUNT_LOCKED: 'account-locked',
} as const;

// Generate email HTML from template
export function generateEmailHtml(template: string, data: Record<string, any>): string {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 24px; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
      .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      .highlight { background: #ecfdf5; padding: 16px; border-radius: 6px; margin: 16px 0; }
    </style>
  `;

  const templates: Record<string, (d: Record<string, any>) => string> = {
    [EmailTemplates.TOURNAMENT_REGISTRATION]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>🎯 Tournament Registration Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>You've successfully registered for:</p>
          <div class="highlight">
            <strong>${d.tournamentName}</strong><br>
            📅 ${d.date}<br>
            📍 ${d.location}<br>
            ${d.entryFee > 0 ? `💰 Entry Fee: ₹${d.entryFee}` : ''}
          </div>
          <p>Registration ID: <strong>${d.registrationId}</strong></p>
          <p>We'll notify you when the tournament bracket is generated.</p>
          <a href="${d.tournamentUrl}" class="button">View Tournament</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
          <p>© ${new Date().getFullYear()} VALORHIVE. All rights reserved.</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.MATCH_REMINDER]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>⏰ Upcoming Match Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Your match is coming up soon!</p>
          <div class="highlight">
            <strong>${d.tournamentName}</strong><br>
            🏆 ${d.roundName}<br>
            🎯 vs ${d.opponentName}<br>
            📅 ${d.scheduledTime}<br>
            ${d.courtName ? `🏟️ Court: ${d.courtName}` : ''}
          </div>
          <p>Make sure to check in at least 15 minutes before your match.</p>
          <a href="${d.tournamentUrl}" class="button">View Bracket</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.MATCH_RESULT]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>📊 Match Result Recorded</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Your match result has been recorded:</p>
          <div class="highlight">
            <strong>${d.tournamentName}</strong><br>
            🎯 vs ${d.opponentName}<br>
            📊 Score: ${d.scoreA} - ${d.scoreB}<br>
            ${d.result === 'WIN' ? '✅ You Won!' : '❌ You Lost'}<br>
            ${d.pointsEarned ? `⭐ Points: +${d.pointsEarned}` : ''}
            ${d.eloChange ? `📈 ELO: ${d.eloChange > 0 ? '+' : ''}${d.eloChange}` : ''}
          </div>
          <a href="${d.matchUrl}" class="button">View Match Details</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.TOURNAMENT_WIN]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>🏆 Congratulations, Champion!</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Congratulations on your outstanding performance!</p>
          <div class="highlight">
            <strong>${d.tournamentName}</strong><br>
            🏆 Position: ${d.position}${d.position === 1 ? 'st' : d.position === 2 ? 'nd' : d.position === 3 ? 'rd' : 'th'} Place<br>
            ${d.prizeAmount ? `💰 Prize: ₹${d.prizeAmount}` : ''}<br>
            ⭐ Bonus Points: +${d.bonusPoints}
          </div>
          <p>Your achievement has been recorded and your ranking updated.</p>
          <a href="${d.tournamentUrl}" class="button">View Tournament</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.PASSWORD_RESET]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName || 'there'},</p>
          <p>You requested to reset your password.</p>
          <div class="highlight">
            <p>Click the button below to set a new password. This link will expire in ${d.expiresIn || '1 hour'}.</p>
          </div>
          <a href="${d.resetUrl}" class="button">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>VALORHIVE - Tournament Platform</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.EMAIL_VERIFICATION]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>✉️ Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Welcome to VALORHIVE! Please verify your email address to get started.</p>
          <div class="highlight">
            <p>Your verification code: <strong style="font-size: 24px; letter-spacing: 4px;">${d.otp}</strong></p>
            <p style="font-size: 12px; color: #6b7280;">This code expires in 10 minutes.</p>
          </div>
          <p>Or click the button below to verify automatically:</p>
          <a href="${d.verifyUrl}" class="button">Verify Email</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.WAITLIST_PROMOTED]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>🎉 You're In!</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Great news! A spot opened up and you've been promoted from the waitlist.</p>
          <div class="highlight">
            <strong>${d.tournamentName}</strong><br>
            📅 ${d.date}<br>
            📍 ${d.location}<br>
            ⏰ You have ${d.holdHours || 24} hours to confirm your spot
          </div>
          <a href="${d.confirmUrl}" class="button">Confirm Your Spot</a>
          <p>Act fast - if you don't confirm in time, your spot may go to the next person on the waitlist.</p>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,
    
    [EmailTemplates.WEEKLY_DIGEST]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>📊 Your Weekly Summary</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Here's your performance summary for the past week:</p>
          <div class="highlight">
            <strong>Week ${d.weekNumber} of ${d.year}</strong><br>
            🎯 Matches Played: ${d.matchesPlayed}<br>
            ✅ Wins: ${d.wins}<br>
            ❌ Losses: ${d.losses}<br>
            ⭐ Points Earned: +${d.pointsEarned}<br>
            📈 ELO Change: ${d.eloChange > 0 ? '+' : ''}${d.eloChange}<br>
            🏆 Current Rank: #${d.currentRank}
          </div>
          ${d.upcomingMatches?.length ? `
            <p><strong>Upcoming Matches:</strong></p>
            <ul>
              ${d.upcomingMatches.map((m: any) => `<li>${m.tournamentName} vs ${m.opponent} - ${m.date}</li>`).join('')}
            </ul>
          ` : ''}
          <a href="${d.dashboardUrl}" class="button">View Dashboard</a>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
          <p><a href="${d.unsubscribeUrl}">Unsubscribe from weekly digest</a></p>
        </div>
      </div>
    `,
    
    [EmailTemplates.SUBSCRIPTION_EXPIRING]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header">
          <h1>⏰ Subscription Expiring Soon</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>Your VALORHIVE subscription will expire in ${d.daysRemaining} days.</p>
          <div class="highlight">
            <strong>Current Plan: ${d.planName}</strong><br>
            📅 Expires: ${d.expiryDate}<br>
            ⚠️ After expiry, you'll lose access to tournament registration
          </div>
          <a href="${d.renewUrl}" class="button">Renew Now</a>
          <p>Don't miss out on upcoming tournaments!</p>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
        </div>
      </div>
    `,

    [EmailTemplates.ACCOUNT_LOCKED]: (d) => `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
          <h1>🔒 Account Locked</h1>
        </div>
        <div class="content">
          <p>Hi ${d.playerName},</p>
          <p>We're writing to inform you that your VALORHIVE account has been locked.</p>
          <div class="highlight" style="background: #fef2f2; border-left: 4px solid #dc2626;">
            <strong>Reason:</strong><br>
            ${d.lockReason}
          </div>
          <p><strong>What happened?</strong></p>
          <p>Your account was locked because your email address was not verified within 24 hours of registration. This is a security measure to ensure all accounts have valid email addresses.</p>
          <p><strong>What can you do?</strong></p>
          <ul>
            <li>Contact our support team to verify your email and unlock your account</li>
            <li>If you believe this is an error, please reach out to us immediately</li>
          </ul>
          <a href="${d.supportUrl}" class="button" style="background: #059669;">Contact Support</a>
          <p>We're here to help you get back to playing!</p>
        </div>
        <div class="footer">
          <p>VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India</p>
          <p>Need help? Reply to this email or visit our support page.</p>
        </div>
      </div>
    `,
  };

  const generator = templates[template];
  if (!generator) {
    return `
      ${baseStyles}
      <div class="container">
        <div class="content">
          ${data.message || data.body || ''}
        </div>
      </div>
    `;
  }

  return generator(data);
}

// Send email (development mode logs to console)
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  const from = options.from || DEFAULT_FROM;
  
  // CRITICAL: Check if email is properly configured
  const isConfigured = process.env.SENDGRID_API_KEY || 
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.MAILGUN_API_KEY;

  try {
    switch (provider) {
      case 'sendgrid':
        if (!process.env.SENDGRID_API_KEY) {
          // NOT CONFIGURED: Fail explicitly rather than silent mock success
          console.error('❌ [Email] SendGrid provider selected but SENDGRID_API_KEY not set');
          return { 
            success: false, 
            error: 'Email service not configured: SENDGRID_API_KEY missing',
            messageId: undefined
          };
        }
        // Production: SendGrid integration
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const response = await sgMail.send({
          to: options.to,
          from,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        return { success: true, messageId: response[0].headers['x-message-id'] };

      case 'ses':
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          console.error('❌ [Email] SES provider selected but AWS credentials not set');
          return { 
            success: false, 
            error: 'Email service not configured: AWS credentials missing',
            messageId: undefined
          };
        }
        // Production: AWS SES integration
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
        const client = new SESClient({});
        const command = new SendEmailCommand({
          Source: from,
          Destination: { ToAddresses: Array.isArray(options.to) ? options.to : [options.to] },
          Message: {
            Subject: { Data: options.subject },
            Body: { Html: { Data: options.html }, Text: { Data: options.text } },
          },
        });
        const sesResponse = await client.send(command);
        return { success: true, messageId: sesResponse.MessageId };

      case 'mailgun':
        if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
          console.error('❌ [Email] Mailgun provider selected but credentials not set');
          return { 
            success: false, 
            error: 'Email service not configured: Mailgun credentials missing',
            messageId: undefined
          };
        }
        // Production: Mailgun integration
        const mailgunResponse = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            from,
            to: Array.isArray(options.to) ? options.to.join(',') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || '',
          }),
        });
        if (!mailgunResponse.ok) {
          return { success: false, error: 'Mailgun API error' };
        }
        const mailgunData = await mailgunResponse.json();
        return { success: true, messageId: mailgunData.id };

      case 'console':
      default:
        // DEVELOPMENT ONLY: Log to console with explicit warning
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ [Email] Console provider used in production - emails will NOT be sent!');
          return { 
            success: false, 
            error: 'Email service disabled for testing. Configure EMAIL_PROVIDER environment variable.',
            messageId: undefined
          };
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 EMAIL NOTIFICATION (DEVELOPMENT MODE - NOT SENT)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`From: ${from}`);
        console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Reply-To: ${options.replyTo || 'N/A'}`);
        console.log('--- HTML Body ---');
        console.log(options.html.substring(0, 500) + (options.html.length > 500 ? '...' : ''));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log('⚠️  This email was NOT actually sent. Configure EMAIL_PROVIDER for real delivery.');
        console.log('');
        return { 
          success: true, 
          messageId: `console-${Date.now()}`,
          error: 'Email logged to console only - configure provider for production'
        };
    }
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Send templated email
export async function sendTemplatedEmail(
  to: string | string[],
  template: string,
  data: Record<string, any>
): Promise<EmailResult> {
  const html = generateEmailHtml(template, data);
  const subjectMap: Record<string, string> = {
    [EmailTemplates.TOURNAMENT_REGISTRATION]: 'Tournament Registration Confirmed',
    [EmailTemplates.MATCH_REMINDER]: 'Upcoming Match Reminder',
    [EmailTemplates.MATCH_RESULT]: 'Match Result Recorded',
    [EmailTemplates.TOURNAMENT_WIN]: 'Congratulations on Your Victory!',
    [EmailTemplates.PASSWORD_RESET]: 'Reset Your Password',
    [EmailTemplates.EMAIL_VERIFICATION]: 'Verify Your Email Address',
    [EmailTemplates.WAITLIST_PROMOTED]: "You're In! Waitlist Promotion",
    [EmailTemplates.WEEKLY_DIGEST]: 'Your Weekly Summary',
    [EmailTemplates.SUBSCRIPTION_EXPIRING]: 'Subscription Expiring Soon',
    [EmailTemplates.ACCOUNT_LOCKED]: 'Your Account Has Been Locked',
  };

  return sendEmail({
    to,
    subject: data.subject || subjectMap[template] || 'VALORHIVE Notification',
    html,
    text: data.text,
  });
}

// Batch send emails (for notifications to multiple users)
export async function sendBatchEmails(
  recipients: Array<{ email: string; data: Record<string, any> }>,
  template: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendTemplatedEmail(recipient.email, template, recipient.data);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    // Rate limiting: small delay between sends
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, failed };
}

// Notification email data interface
export interface NotificationEmailData {
  type: string;
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
}

// Send notification email (wrapper for notification service)
export async function sendNotificationEmail(params: NotificationEmailData): Promise<{ success: boolean }> {
  // Map notification types to email templates
  const templateMap: Record<string, string> = {
    'TOURNAMENT_REGISTERED': EmailTemplates.TOURNAMENT_REGISTRATION,
    'MATCH_REMINDER': EmailTemplates.MATCH_REMINDER,
    'MATCH_RESULT': EmailTemplates.MATCH_RESULT,
    'TOURNAMENT_WIN': EmailTemplates.TOURNAMENT_WIN,
    'PASSWORD_RESET': EmailTemplates.PASSWORD_RESET,
    'EMAIL_VERIFICATION': EmailTemplates.EMAIL_VERIFICATION,
    'WAITLIST_PROMOTED': EmailTemplates.WAITLIST_PROMOTED,
    'WEEKLY_DIGEST': EmailTemplates.WEEKLY_DIGEST,
    'SUBSCRIPTION_EXPIRY': EmailTemplates.SUBSCRIPTION_EXPIRING,
    'OTP': EmailTemplates.EMAIL_VERIFICATION,
    'REFUND_PROCESSED': EmailTemplates.TOURNAMENT_REGISTRATION, // Reuse tournament template
    'DISPUTE_UPDATE': EmailTemplates.MATCH_RESULT,
    'TOURNAMENT_CANCELLED': EmailTemplates.TOURNAMENT_REGISTRATION,
  };

  const template = templateMap[params.type] || EmailTemplates.TOURNAMENT_REGISTRATION;
  
  // Merge recipient name into data for template
  const templateData = {
    ...params.data,
    playerName: params.recipientName,
  };

  const result = await sendTemplatedEmail(params.recipientEmail, template, templateData);
  
  return { success: result.success };
}
