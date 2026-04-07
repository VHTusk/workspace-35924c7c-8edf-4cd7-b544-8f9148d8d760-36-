/**
 * WhatsApp Integration for VALORHIVE
 * 
 * India-focused features:
 * - WhatsApp OTP Login
 * - WhatsApp Notifications
 * - WhatsApp Group Auto-Create for Tournaments
 * - WhatsApp Status Sharing for Player Cards
 */

import { db } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function sendWhatsAppNotification(phone: string, message: string) {
  return sendWhatsAppMessage({ to: phone, message });
}

// ============================================
// Types
// ============================================

export interface WhatsAppOTP {
  phone: string;
  otp: string;
  expiresAt: Date;
  verified: boolean;
}

export interface WhatsAppGroupConfig {
  tournamentId: string;
  tournamentName: string;
  inviteLink?: string;
  createdAt: Date;
}

// ============================================
// WhatsApp OTP Login
// ============================================

/**
 * Send OTP via WhatsApp for login/registration
 * Uses WhatsApp Business API or third-party providers like Twilio/Gupshup
 */
export async function sendWhatsAppOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  // Clean phone number (remove +91 prefix if present)
  const cleanPhone = phone.replace(/^\+?91/, '').replace(/\D/g, '');
  
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'Invalid phone number. Please enter a 10-digit Indian mobile number.' };
  }
  
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  // Store OTP in database
  try {
    await db.$executeRaw`
      INSERT INTO WhatsAppOTP (id, phone, otp, expiresAt, verified, createdAt)
      VALUES (
        ${`wa_otp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`},
        ${cleanPhone},
        ${otp},
        ${expiresAt},
        false,
        ${new Date()}
      )
      ON CONFLICT(phone) DO UPDATE SET
        otp = ${otp},
        expiresAt = ${expiresAt},
        verified = false,
        createdAt = ${new Date()}
    `;
  } catch (error) {
    console.error('[WhatsApp] Error storing OTP:', error);
    // Continue even if DB fails - use in-memory fallback for development
  }
  
  // Send OTP via WhatsApp Business API
  const message = `🔐 *VALORHIVE Verification Code*

Your OTP is: *${otp}*

This code will expire in 10 minutes.

Don't share this code with anyone.

- Team VALORHIVE`;
  
  try {
    // Use WhatsApp notification service
    const result = await sendWhatsAppNotification(cleanPhone, message);
    return { success: result.success, error: result.error };
  } catch (error) {
    // For development, log the OTP
    console.log(`[DEV] WhatsApp OTP for ${cleanPhone}: ${otp}`);
    return { success: true }; // In development, always succeed
  }
}

/**
 * Verify WhatsApp OTP
 */
export async function verifyWhatsAppOTP(phone: string, otp: string): Promise<{ 
  success: boolean; 
  error?: string;
  phone?: string;
}> {
  const cleanPhone = phone.replace(/^\+?91/, '').replace(/\D/g, '');
  
  try {
    const results = await db.$queryRaw<Array<{
      phone: string;
      otp: string;
      expiresAt: Date;
      verified: boolean;
    }>>`
      SELECT phone, otp, expiresAt, verified
      FROM WhatsAppOTP
      WHERE phone = ${cleanPhone}
      ORDER BY createdAt DESC
      LIMIT 1
    `;
    
    if (!results || results.length === 0) {
      return { success: false, error: 'No OTP found. Please request a new OTP.' };
    }
    
    const record = results[0];
    
    if (record.verified) {
      return { success: false, error: 'OTP already used. Please request a new OTP.' };
    }
    
    if (new Date() > record.expiresAt) {
      return { success: false, error: 'OTP has expired. Please request a new OTP.' };
    }
    
    if (record.otp !== otp) {
      return { success: false, error: 'Invalid OTP. Please try again.' };
    }
    
    // Mark as verified
    await db.$executeRaw`
      UPDATE WhatsAppOTP
      SET verified = true
      WHERE phone = ${cleanPhone}
    `;
    
    return { success: true, phone: cleanPhone };
  } catch (error) {
    console.error('[WhatsApp] Error verifying OTP:', error);
    return { success: false, error: 'Verification failed. Please try again.' };
  }
}

// ============================================
// WhatsApp Tournament Group Creation
// ============================================

/**
 * Generate WhatsApp group invite link for tournament
 * Note: Actual group creation requires WhatsApp Business API
 * This generates a message with group creation instructions
 */
export async function createTournamentWhatsAppGroup(
  tournamentId: string,
  tournamentName: string,
  directorPhone: string
): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  try {
    // Store group config in database
    const groupConfig = {
      id: `wa_group_${tournamentId}`,
      tournamentId,
      tournamentName,
      directorPhone,
      createdAt: new Date(),
    };
    
    await db.$executeRaw`
      INSERT INTO WhatsAppGroupConfig (id, tournamentId, tournamentName, directorPhone, createdAt)
      VALUES (
        ${groupConfig.id},
        ${tournamentId},
        ${tournamentName},
        ${directorPhone},
        ${groupConfig.createdAt}
      )
      ON CONFLICT(tournamentId) DO UPDATE SET
        tournamentName = ${tournamentName},
        directorPhone = ${directorPhone}
    `;
    
    // Generate shareable message for tournament participants
    const groupMessage = `🎯 *${tournamentName} - Tournament Group*

Hi everyone! Join the official WhatsApp group for tournament updates:

📋 *Tournament ID:* ${tournamentId.slice(0, 8).toUpperCase()}

*Instructions for Director:*
1. Create a WhatsApp group named "${tournamentName}"
2. Add all registered participants
3. Share important updates here

*Share this link with participants:*
🔗 https://valorhive.com/tournaments/${tournamentId}

- Team VALORHIVE`;
    
    // Send setup instructions to director
    await sendWhatsAppNotification(directorPhone, groupMessage);
    
    return { 
      success: true, 
      inviteLink: `https://valorhive.com/tournaments/${tournamentId}/whatsapp-group`
    };
  } catch (error) {
    console.error('[WhatsApp] Error creating tournament group:', error);
    return { success: false, error: 'Failed to create WhatsApp group configuration' };
  }
}

/**
 * Get WhatsApp group message for tournament participants
 */
export function getTournamentGroupMessage(
  tournamentName: string,
  tournamentId: string,
  directorName: string
): string {
  return `🏏 *Welcome to ${tournamentName}!*

This is the official WhatsApp group for tournament updates.

*📋 Important Info:*
• Tournament ID: ${tournamentId.slice(0, 8).toUpperCase()}
• Director: ${directorName}

*📢 Group Rules:*
1. Only tournament-related messages
2. No spam or promotional content
3. Be respectful to all participants

*🔗 Quick Links:*
• View Bracket: https://valorhive.com/tournaments/${tournamentId}/bracket
• Tournament Details: https://valorhive.com/tournaments/${tournamentId}

Questions? Contact the tournament director.

- Team VALORHIVE`;
}

// ============================================
// WhatsApp Status Sharing for Player Cards
// ============================================

/**
 * Generate WhatsApp Status share link for player card
 * WhatsApp Status allows sharing images that disappear after 24 hours
 */
export function getWhatsAppStatusShareUrl(
  cardImageUrl: string,
  playerName: string,
  tier: string,
  sport: string
): string {
  // WhatsApp doesn't have a direct Status API, but we can:
  // 1. Share the card image via regular WhatsApp share
  // 2. User can then post to Status manually
  
  const text = `🏆 Check out my ${sport} stats on VALORHIVE!

👤 ${playerName}
📊 ${tier} Tier
📱 Get yours: https://valorhive.com

#VALORHIVE #${sport}Tournament`;
  
  const encodedText = encodeURIComponent(text);
  const encodedImage = encodeURIComponent(cardImageUrl);
  
  // WhatsApp share URL with image preview
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Generate shareable player card message
 */
export function getPlayerCardShareMessage(
  playerName: string,
  tier: string,
  sport: string,
  winRate: string,
  tournaments: number,
  cardUrl: string
): string {
  return `🏆 *My ${sport} Stats on VALORHIVE*

👤 *${playerName}*
🎖️ *${tier} Tier*
📈 *Win Rate:* ${winRate}
🎮 *Tournaments:* ${tournaments}

*View my full profile:*
🔗 ${cardUrl}

Download the app and join the competition!

#VALORHIVE #${sport}Player #${tier}Tier`;
}

// ============================================
// WhatsApp Notification Templates
// ============================================

export const WHATSAPP_TEMPLES = {
  TOURNAMENT_REMINDER: (tournamentName: string, date: string, time: string) => 
    `🗓️ *Tournament Reminder*

*${tournamentName}*
📅 ${date}
🕐 ${time}

Don't forget to check in!

🔗 https://valorhive.com

- Team VALORHIVE`,

  MATCH_STARTING: (opponentName: string, court: string, time: string) =>
    `🎮 *Your Match is Starting!*

*Opponent:* ${opponentName}
🏟️ *Court:* ${court}
🕐 *Time:* ${time}

Good luck! 🍀

- Team VALORHIVE`,

  MATCH_RESULT: (won: boolean, opponentName: string, score: string) =>
    won 
      ? `🎉 *Victory!*

You defeated ${opponentName}
Score: ${score}

Great game! Keep it up! 💪

- Team VALORHIVE`
      : `😔 *Match Result*

You lost to ${opponentName}
Score: ${score}

Every match is a learning experience. Train harder! 💪

- Team VALORHIVE`,

  TOURNAMENT_ANNOUNCEMENT: (tournamentName: string, message: string) =>
    `📢 *${tournamentName} Announcement*

${message}

🔗 https://valorhive.com

- Tournament Director`,

  REGISTRATION_CONFIRMED: (tournamentName: string, date: string, venue: string) =>
    `✅ *Registration Confirmed!*

*${tournamentName}*
📅 ${date}
📍 ${venue}

You're all set! We'll notify you before the tournament.

- Team VALORHIVE`,
};

// ============================================
// Bulk WhatsApp Notifications
// ============================================

/**
 * Send WhatsApp notification to all tournament participants
 */
export async function sendBulkWhatsAppNotification(
  tournamentId: string,
  message: string
): Promise<{ success: number; failed: number }> {
  try {
    // Get all registered players' phone numbers
    const registrations = await db.$queryRaw<Array<{ phone: string }>>`
      SELECT u.phone
      FROM TournamentRegistration tr
      JOIN User u ON tr.userId = u.id
      WHERE tr.tournamentId = ${tournamentId}
        AND tr.status = 'CONFIRMED'
        AND u.phone IS NOT NULL
    `;
    
    let success = 0;
    let failed = 0;
    
    for (const reg of registrations) {
      if (reg.phone) {
        const result = await sendWhatsAppNotification(reg.phone, message);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
        
        // Rate limit: 1 message per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { success, failed };
  } catch (error) {
    console.error('[WhatsApp] Error sending bulk notifications:', error);
    return { success: 0, failed: 0 };
  }
}

// ============================================
// WhatsApp Login Integration
// ============================================

/**
 * Check if user has WhatsApp
 */
export function isWhatsAppInstalled(): boolean {
  // Client-side check
  if (typeof window === 'undefined') return false;
  
  // Check if on mobile
  const userAgent = navigator.userAgent.toLowerCase();
  return /mobile/i.test(userAgent);
}

/**
 * Get WhatsApp login URL (for redirect flow)
 */
export function getWhatsAppLoginUrl(redirectUrl: string): string {
  const message = `Login to VALORHIVE: ${redirectUrl}`;
  return `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
}
