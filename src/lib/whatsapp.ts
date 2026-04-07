/**
 * WhatsApp Business API Library
 * Supports WhatsApp notifications for VALORHIVE
 * 
 * For production, configure environment variables:
 * - WHATSAPP_PROVIDER: 'twilio' | 'msg91' | 'gupshup' | 'console' (default: console)
 * - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * - MSG91_AUTH_KEY, MSG91_SENDER_ID
 * - GUPSHUP_API_KEY, GUPSHUP_APP_NAME
 */

interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'text' | 'template';
  templateName?: string;
  templateParams?: string[];
  mediaUrl?: string;
}

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// WhatsApp templates (must be pre-approved in WhatsApp Business Manager)
export const WhatsAppTemplates = {
  TOURNAMENT_REMINDER: 'tournament_reminder',
  MATCH_RESULT: 'match_result',
  OTP_VERIFICATION: 'otp_verification',
  WAITLIST_PROMOTED: 'waitlist_promoted',
  MATCH_REMINDER: 'match_reminder',
  MATCH_STARTING: 'match_starting',
} as const;

// Format phone number for WhatsApp (E.164 format)
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add India country code if not present
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '91' + cleaned.substring(1);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

// Generate WhatsApp message text
export function generateWhatsAppMessage(template: string, data: Record<string, any>): string {
  const templates: Record<string, (d: Record<string, any>) => string> = {
    [WhatsAppTemplates.TOURNAMENT_REMINDER]: (d) => 
      `🎯 *${d.tournamentName}*\n\n` +
      `Hi ${d.playerName}! Your match is coming up:\n\n` +
      `🏆 Round: ${d.roundName}\n` +
      `🎯 Opponent: ${d.opponentName}\n` +
      `📅 Time: ${d.scheduledTime}\n` +
      `${d.courtName ? `🏟️ Court: ${d.courtName}\n` : ''}\n` +
      `Please check in 15 minutes before your match.\n\n` +
      `_VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India_`,

    [WhatsAppTemplates.MATCH_RESULT]: (d) => 
      `📊 *Match Result*\n\n` +
      `Hi ${d.playerName}, your result has been recorded:\n\n` +
      `🎯 vs ${d.opponentName}\n` +
      `📊 Score: ${d.scoreA} - ${d.scoreB}\n` +
      `${d.result === 'WIN' ? '✅ *You Won!*' : '❌ You Lost'}\n` +
      `${d.pointsEarned ? `⭐ Points: +${d.pointsEarned}\n` : ''}` +
      `${d.eloChange ? `📈 ELO: ${d.eloChange > 0 ? '+' : ''}${d.eloChange}\n` : ''}\n` +
      `_VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India_`,

    [WhatsAppTemplates.OTP_VERIFICATION]: (d) => 
      `🔐 *VALORHIVE Verification*\n\n` +
      `Your verification code is:\n\n` +
      `*${d.otp}*\n\n` +
      `This code expires in 10 minutes.\n\n` +
      `Do not share this code with anyone.\n\n` +
      `_VALORHIVE - Tournament Platform_`,

    [WhatsAppTemplates.WAITLIST_PROMOTED]: (d) => 
      `🎉 *You're In!*\n\n` +
      `Hi ${d.playerName}!\n\n` +
      `A spot opened up for:\n\n` +
      `🎯 *${d.tournamentName}*\n` +
      `📅 ${d.date}\n` +
      `📍 ${d.location}\n\n` +
      `⏰ You have ${d.holdHours || 24} hours to confirm.\n\n` +
      `Confirm now: ${d.confirmUrl}\n\n` +
      `_VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India_`,

    [WhatsAppTemplates.MATCH_REMINDER]: (d) => 
      `⚔️ *Match Reminder*\n\n` +
      `Hi ${d.playerName}!\n\n` +
      `Your match is coming up:\n\n` +
      `🏆 Tournament: ${d.tournamentName}\n` +
      `🎯 Opponent: ${d.opponentName}\n` +
      `📅 Time: ${d.matchTime}\n` +
      `📍 Venue: ${d.venue}\n` +
      `${d.courtName ? `🏟️ Court: ${d.courtName}\n` : ''}` +
      `${d.checkInCode ? `🔢 Check-in Code: *${d.checkInCode}*\n` : ''}\n` +
      `⏰ Please check in 15 minutes before your match.\n\n` +
      `_VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India_`,

    [WhatsAppTemplates.MATCH_STARTING]: (d) => 
      `🔔 *Match Starting NOW!*\n\n` +
      `Hi ${d.playerName}!\n\n` +
      `Your match is starting immediately:\n\n` +
      `🏆 Tournament: ${d.tournamentName}\n` +
      `🎯 Opponent: ${d.opponentName}\n` +
      `📍 Venue: ${d.venue}\n` +
      `${d.courtName ? `🏟️ Court: ${d.courtName}\n` : ''}` +
      `${d.checkInCode ? `🔢 Check-in Code: *${d.checkInCode}*\n` : ''}\n` +
      `⚡ Head to your court now!\n\n` +
      `_VALORHIVE - ${d.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} India_`,

    // Default message template
    '_default_': (d) => d.message || 'Notification from VALORHIVE',
  };

  const generator = templates[template] || templates['_default_'];
  return generator(data);
}

// Send WhatsApp message
export async function sendWhatsAppMessage(options: WhatsAppMessage): Promise<WhatsAppResult> {
  const provider = process.env.WHATSAPP_PROVIDER || 'console';
  const formattedPhone = formatPhoneNumber(options.to);
  
  // CRITICAL: Check if WhatsApp is properly configured
  const isConfigured = 
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) ||
    process.env.MSG91_AUTH_KEY ||
    (process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_APP_NAME);

  try {
    switch (provider) {
      case 'twilio':
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
          console.error('❌ [WhatsApp] Twilio provider selected but credentials not set');
          return { 
            success: false, 
            error: 'WhatsApp service not configured: Twilio credentials missing'
          };
        }
        // Production: Twilio WhatsApp API
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const message = await twilio.messages.create({
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            body: options.message,
            to: `whatsapp:+${formattedPhone}`,
          });
          return { success: true, messageId: message.sid };
        } catch (requireError) {
          console.error('❌ [WhatsApp] Twilio package not installed');
          return { 
            success: false, 
            error: 'WhatsApp service not available: Twilio package not installed'
          };
        }

      case 'msg91':
        if (!process.env.MSG91_AUTH_KEY) {
          console.error('❌ [WhatsApp] MSG91 provider selected but MSG91_AUTH_KEY not set');
          return { 
            success: false, 
            error: 'WhatsApp service not configured: MSG91_AUTH_KEY missing'
          };
        }
        // Production: MSG91 WhatsApp API
        const msg91Response = await fetch('https://api.msg91.com/api/v5/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': process.env.MSG91_AUTH_KEY!,
          },
          body: JSON.stringify({
            mobile: formattedPhone,
            message: options.message,
            sender: process.env.MSG91_SENDER_ID,
          }),
        });
        const msg91Data = await msg91Response.json();
        return { success: true, messageId: msg91Data.request_id };

      case 'gupshup':
        if (!process.env.GUPSHUP_API_KEY || !process.env.GUPSHUP_APP_NAME) {
          console.error('❌ [WhatsApp] Gupshup provider selected but credentials not set');
          return { 
            success: false, 
            error: 'WhatsApp service not configured: Gupshup credentials missing'
          };
        }
        // Production: Gupshup WhatsApp API
        const gupshupResponse = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': process.env.GUPSHUP_API_KEY!,
          },
          body: new URLSearchParams({
            channel: 'whatsapp',
            source: process.env.GUPSHUP_PHONE_NUMBER!,
            destination: formattedPhone,
            message: options.message,
            'app.name': process.env.GUPSHUP_APP_NAME!,
          }),
        });
        const gupshupData = await gupshupResponse.json();
        return { success: true, messageId: gupshupData.messageId };

      case 'console':
      default:
        // DEVELOPMENT ONLY: Log to console with explicit warning
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ [WhatsApp] Console provider used in production - messages will NOT be sent!');
          return { 
            success: false, 
            error: 'WhatsApp service disabled for testing. Configure WHATSAPP_PROVIDER environment variable.'
          };
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 WHATSAPP NOTIFICATION (DEVELOPMENT MODE - NOT SENT)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`To: +${formattedPhone}`);
        console.log(`Type: ${options.type || 'text'}`);
        console.log(`Template: ${options.templateName || 'custom'}`);
        console.log('--- Message ---');
        console.log(options.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log('⚠️  This message was NOT actually sent. Configure WHATSAPP_PROVIDER for real delivery.');
        console.log('');
        return { 
          success: true, 
          messageId: `console-${Date.now()}`,
          error: 'WhatsApp logged to console only - configure provider for production'
        };
    }
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error.message };
  }
}

// Send templated WhatsApp message
export async function sendTemplatedWhatsApp(
  to: string,
  template: string,
  data: Record<string, any>
): Promise<WhatsAppResult> {
  const message = generateWhatsAppMessage(template, data);
  return sendWhatsAppMessage({ to, message, type: 'text' });
}

// Send OTP via WhatsApp
export async function sendWhatsAppOTP(phone: string, otp: string): Promise<WhatsAppResult> {
  return sendTemplatedWhatsApp(phone, WhatsAppTemplates.OTP_VERIFICATION, { otp });
}

// Batch send WhatsApp messages
export async function sendBatchWhatsApp(
  recipients: Array<{ phone: string; data: Record<string, any> }>,
  template: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendTemplatedWhatsApp(recipient.phone, template, recipient.data);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    // Rate limiting: WhatsApp has strict rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { sent, failed };
}

// Verify WhatsApp number (send test message)
export async function verifyWhatsAppNumber(phone: string): Promise<{ valid: boolean; error?: string }> {
  const formattedPhone = formatPhoneNumber(phone);
  
  // Basic validation
  if (formattedPhone.length < 10 || formattedPhone.length > 15) {
    return { valid: false, error: 'Invalid phone number length' };
  }

  // In production, you might want to check with WhatsApp Business API
  // if the number is on WhatsApp before marking as valid
  
  return { valid: true };
}
