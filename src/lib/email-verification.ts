/**
 * Email Verification Library for VALORHIVE
 * Handles email verification token generation, sending, and verification
 * 
 * v4.3.0 - Email Verification Enforcement
 */

import { db } from '@/lib/db';
import { sendTemplatedEmail, EmailTemplates } from '@/lib/email';
import { SportType } from '@prisma/client';

// Token expiration time in milliseconds (24 hours)
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Lock reason for unverified accounts
const LOCK_REASON_UNVERIFIED_EMAIL = 'Account locked: Email not verified within 24 hours';

// Base URL for the application
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

/**
 * Generate a secure random verification token
 * Uses Web Crypto API for cryptographically secure random bytes
 * 
 * @returns A 64-character hex string token
 */
export function generateVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send a verification email to the user
 * 
 * @param email - User's email address
 * @param token - Verification token
 * @param sport - Sport type (CORNHOLE or DARTS)
 * @param firstName - User's first name for personalization
 * @returns Promise resolving to the send result
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  sport: SportType,
  firstName: string = 'there'
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
  
  try {
    const result = await sendTemplatedEmail(
      email,
      EmailTemplates.EMAIL_VERIFICATION,
      {
        playerName: firstName,
        verifyUrl,
        otp: '', // We're using link-based verification, not OTP
        sport,
        subject: 'Verify Your Email Address - VALORHIVE',
      }
    );
    
    if (!result.success) {
      console.error('Failed to send verification email:', result.error);
      return { success: false, error: result.error };
    }
    
    console.log(`Verification email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Verify an email verification token
 * Validates the token exists, hasn't expired, and marks the email as verified
 * 
 * @param token - The verification token to verify
 * @returns Promise resolving to verification result
 */
export async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  sport?: SportType;
  error?: string;
}> {
  if (!token || token.length !== 64) {
    return { success: false, error: 'Invalid verification token format' };
  }
  
  try {
    // Find user with this verification token
    const user = await db.user.findFirst({
      where: {
        emailVerificationToken: token,
      },
      select: {
        id: true,
        email: true,
        sport: true,
        firstName: true,
        emailVerificationSentAt: true,
      },
    });
    
    if (!user) {
      return { success: false, error: 'Invalid or expired verification token' };
    }
    
    // Check if token has expired (24 hours from when it was sent)
    if (user.emailVerificationSentAt) {
      const tokenAge = Date.now() - user.emailVerificationSentAt.getTime();
      if (tokenAge > VERIFICATION_TOKEN_EXPIRY_MS) {
        // Clear the expired token
        await db.user.update({
          where: { id: user.id },
          data: {
            emailVerificationToken: null,
            emailVerificationSentAt: null,
          },
        });
        return { success: false, error: 'Verification token has expired. Please request a new one.' };
      }
    }
    
    // Mark email as verified
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationSentAt: null,
        // Also update legacy fields for backward compatibility
        verified: true,
        verifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    // Unlock account if it was locked due to unverified email
    await unlockAccountAfterVerification(user.id);

    console.log(`Email verified for user ${user.id} (${user.email})`);
    
    return {
      success: true,
      userId: user.id,
      email: user.email ?? undefined,
      sport: user.sport,
    };
  } catch (error) {
    console.error('Error verifying email token:', error);
    return { success: false, error: 'An error occurred while verifying your email' };
  }
}

/**
 * Create a new verification token for a user and send the verification email
 * This is used during registration and when resending verification emails
 * 
 * @param userId - The user's ID
 * @param email - The user's email address
 * @param sport - The sport type
 * @param firstName - The user's first name
 * @returns Promise resolving to the result
 */
export async function createAndSendVerificationToken(
  userId: string,
  email: string,
  sport: SportType,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate a new verification token
    const token = generateVerificationToken();
    const now = new Date();
    
    // Update user with the new token
    await db.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationSentAt: now,
      },
    });
    
    // Send the verification email
    return await sendVerificationEmail(email, token, sport, firstName);
  } catch (error) {
    console.error('Error creating verification token:', error);
    return { success: false, error: 'Failed to create verification token' };
  }
}

/**
 * Check if a user's email is verified
 * 
 * @param userId - The user's ID to check
 * @returns Promise resolving to verification status
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, email: true },
    });
    
    // If user has no email (phone-only registration), consider them verified
    if (!user || !user.email) {
      return true;
    }
    
    return user.emailVerified;
  } catch (error) {
    console.error('Error checking email verification status:', error);
    return false;
  }
}

/**
 * Check if a user can request a new verification email
 * Prevents spam by limiting how often verification emails can be sent
 * 
 * @param userId - The user's ID to check
 * @returns Promise resolving to whether they can resend
 */
export async function canResendVerification(userId: string): Promise<{
  canResend: boolean;
  waitTimeSeconds?: number;
}> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { emailVerificationSentAt: true },
    });
    
    if (!user || !user.emailVerificationSentAt) {
      return { canResend: true };
    }
    
    // Minimum 60 seconds between resend requests
    const MIN_RESEND_INTERVAL_MS = 60 * 1000;
    const timeSinceLastSent = Date.now() - user.emailVerificationSentAt.getTime();
    
    if (timeSinceLastSent < MIN_RESEND_INTERVAL_MS) {
      const waitTimeSeconds = Math.ceil((MIN_RESEND_INTERVAL_MS - timeSinceLastSent) / 1000);
      return { canResend: false, waitTimeSeconds };
    }
    
    return { canResend: true };
  } catch (error) {
    console.error('Error checking resend eligibility:', error);
    return { canResend: true };
  }
}

/**
 * Check if a user account is locked due to unverified email
 * 
 * @param userId - The user's ID to check
 * @returns Promise resolving to lock status
 */
export async function isAccountLockedForUnverifiedEmail(userId: string): Promise<{
  isLocked: boolean;
  reason?: string;
}> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        email: true,
        isActive: true,
        deactivationReason: true,
      },
    });
    
    if (!user) {
      return { isLocked: false };
    }
    
    // If no email (phone-only registration), not locked for this reason
    if (!user.email) {
      return { isLocked: false };
    }
    
    // Check if locked specifically for unverified email
    if (!user.isActive && user.deactivationReason === LOCK_REASON_UNVERIFIED_EMAIL) {
      return { isLocked: true, reason: user.deactivationReason };
    }
    
    return { isLocked: false };
  } catch (error) {
    console.error('Error checking account lock status:', error);
    return { isLocked: false };
  }
}

/**
 * Lock accounts that haven't verified their email within 24 hours
 * This should be called by a cron job
 * 
 * @returns Number of accounts locked
 */
export async function lockUnverifiedAccounts(): Promise<{
  lockedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let lockedCount = 0;
  
  try {
    const expiryThreshold = new Date(Date.now() - VERIFICATION_TOKEN_EXPIRY_MS);
    
    // Find users with expired verification tokens who haven't verified
    const expiredUsers = await db.user.findMany({
      where: {
        emailVerificationToken: { not: null },
        emailVerificationSentAt: { lt: expiryThreshold },
        emailVerified: false,
        email: { not: null }, // Only lock email-based accounts
        isActive: true, // Only lock active accounts
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        sport: true,
      },
    });
    
    console.log(`[EmailVerification] Found ${expiredUsers.length} accounts to lock`);
    
    // Lock each account
    for (const user of expiredUsers) {
      try {
        await db.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: LOCK_REASON_UNVERIFIED_EMAIL,
            emailVerificationToken: null,
            emailVerificationSentAt: null,
          },
        });
        
        lockedCount++;
        console.log(`[EmailVerification] Locked account ${user.id} (${user.email})`);
        
        // Send notification email about account lock
        try {
          await sendTemplatedEmail(
            user.email!,
            EmailTemplates.ACCOUNT_LOCKED,
            {
              playerName: user.firstName || 'there',
              lockReason: LOCK_REASON_UNVERIFIED_EMAIL,
              supportUrl: `${getBaseUrl()}/support`,
              sport: user.sport,
              subject: 'Your Account Has Been Locked - VALORHIVE',
            }
          );
        } catch (emailError) {
          console.error(`[EmailVerification] Failed to send lock notification to ${user.email}:`, emailError);
          // Don't count this as an error that affects the lock process
        }
      } catch (updateError) {
        const errorMsg = `Failed to lock account ${user.id}: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`;
        console.error(`[EmailVerification] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    return { lockedCount, errors };
  } catch (error) {
    const errorMsg = `Error in lockUnverifiedAccounts: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[EmailVerification] ${errorMsg}`);
    errors.push(errorMsg);
    return { lockedCount, errors };
  }
}

/**
 * Unlock an account that was locked due to unverified email
 * Called when user successfully verifies their email
 * 
 * @param userId - The user's ID to unlock
 */
async function unlockAccountAfterVerification(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { deactivationReason: true },
    });
    
    // Only unlock if locked for unverified email reason
    if (user?.deactivationReason === LOCK_REASON_UNVERIFIED_EMAIL) {
      await db.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          deactivatedAt: null,
          deactivationReason: null,
        },
      });
      console.log(`[EmailVerification] Unlocked account ${userId} after email verification`);
    }
  } catch (error) {
    console.error(`[EmailVerification] Error unlocking account ${userId}:`, error);
  }
}

/**
 * Clean up expired verification tokens (without locking accounts)
 * This only clears tokens for accounts that are already locked or verified
 * 
 * @returns Number of tokens cleaned up
 */
export async function cleanupExpiredVerificationTokens(): Promise<number> {
  try {
    const expiryThreshold = new Date(Date.now() - VERIFICATION_TOKEN_EXPIRY_MS);
    
    const result = await db.user.updateMany({
      where: {
        emailVerificationToken: { not: null },
        emailVerificationSentAt: { lt: expiryThreshold },
        // Only clear tokens for already inactive or verified accounts
        OR: [
          { isActive: false },
          { emailVerified: true },
        ],
      },
      data: {
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      },
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired verification tokens:', error);
    return 0;
  }
}
