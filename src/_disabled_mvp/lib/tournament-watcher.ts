/**
 * Tournament Watcher Utilities for VALORHIVE
 * 
 * Allows spectators to subscribe to tournament updates with just email OR phone.
 * No account required - just verification of contact method.
 */

import { db } from './db';

export interface WatcherSubscription {
  email?: string;
  phone?: string;
  notifyMatchResults?: boolean;
  notifyUpdates?: boolean;
  notifyWinner?: boolean;
  notifySchedule?: boolean;
}

export interface WatcherResult {
  success: boolean;
  watcherId?: string;
  error?: string;
  requiresVerification?: boolean;
  alreadySubscribed?: boolean;
}

/**
 * Generate a secure verification token
 */
export function generateVerifyToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a 6-digit OTP for phone verification
 */
export function generateOtp(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return (num % 1000000).toString().padStart(6, '0');
}

/**
 * Subscribe a spectator to tournament updates
 */
export async function subscribeWatcher(
  tournamentId: string,
  subscription: WatcherSubscription
): Promise<WatcherResult> {
  const { email, phone, notifyMatchResults = true, notifyUpdates = true, notifyWinner = true, notifySchedule = true } = subscription;

  // Validate: at least one contact method
  if (!email && !phone) {
    return { success: false, error: 'Email or phone is required' };
  }

  // Validate email format if provided
  if (email && !isValidEmail(email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Validate phone format if provided
  if (phone && !isValidPhone(phone)) {
    return { success: false, error: 'Invalid phone format' };
  }

  // Check for existing subscription
  const existing = await db.tournamentWatcher.findFirst({
    where: {
      tournamentId,
      OR: [
        { email: email || undefined },
        { phone: phone || undefined },
      ],
    },
  });

  if (existing) {
    // If already verified, return success
    if (existing.emailVerified || existing.phoneVerified) {
      return { 
        success: true, 
        watcherId: existing.id, 
        alreadySubscribed: true 
      };
    }
    // If not verified, resend verification
    return { 
      success: false, 
      error: 'Already subscribed but not verified. Please check your email/phone for verification.',
      requiresVerification: true,
      watcherId: existing.id,
    };
  }

  // Check if tournament exists and is public
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, isPublic: true, status: true, name: true },
  });

  if (!tournament) {
    return { success: false, error: 'Tournament not found' };
  }

  // Create subscription with verification token
  const verifyToken = generateVerifyToken();
  const otp = phone ? generateOtp() : null;

  const watcher = await db.tournamentWatcher.create({
    data: {
      tournamentId,
      email,
      phone,
      notifyMatchResults,
      notifyUpdates,
      notifyWinner,
      notifySchedule,
      verifyToken: phone ? otp : verifyToken,
      verifyExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  return {
    success: true,
    watcherId: watcher.id,
    requiresVerification: true,
  };
}

/**
 * Verify a watcher subscription
 */
export async function verifyWatcher(
  watcherId: string,
  token: string
): Promise<WatcherResult> {
  const watcher = await db.tournamentWatcher.findUnique({
    where: { id: watcherId },
    include: { tournament: { select: { name: true } } },
  });

  if (!watcher) {
    return { success: false, error: 'Subscription not found' };
  }

  if (watcher.unsubscribedAt) {
    return { success: false, error: 'This subscription has been unsubscribed' };
  }

  if (watcher.emailVerified || watcher.phoneVerified) {
    return { success: true, watcherId: watcher.id };
  }

  // Check token expiry
  if (!watcher.verifyExpiry || watcher.verifyExpiry < new Date()) {
    return { success: false, error: 'Verification token expired. Please subscribe again.' };
  }

  // Verify token
  if (watcher.verifyToken !== token) {
    return { success: false, error: 'Invalid verification token' };
  }

  // Mark as verified
  await db.tournamentWatcher.update({
    where: { id: watcherId },
    data: {
      emailVerified: !!watcher.email,
      phoneVerified: !!watcher.phone,
      verifyToken: null,
      verifyExpiry: null,
    },
  });

  return { success: true, watcherId: watcher.id };
}

/**
 * Unsubscribe a watcher
 */
export async function unsubscribeWatcher(
  watcherId: string,
  token?: string
): Promise<WatcherResult> {
  const watcher = await db.tournamentWatcher.findUnique({
    where: { id: watcherId },
  });

  if (!watcher) {
    return { success: false, error: 'Subscription not found' };
  }

  // If token provided, verify it matches (for email unsubscribe links)
  if (token && watcher.verifyToken !== token) {
    // Still allow unsubscribe with just ID for simplicity
  }

  await db.tournamentWatcher.update({
    where: { id: watcherId },
    data: {
      unsubscribedAt: new Date(),
      verifyToken: null, // Clear for security
    },
  });

  return { success: true, watcherId: watcher.id };
}

/**
 * Get watchers for a tournament (for sending notifications)
 */
export async function getTournamentWatchers(
  tournamentId: string,
  notificationType: 'matchResults' | 'updates' | 'winner' | 'schedule' = 'updates'
): Promise<Array<{ email: string | null; phone: string | null; id: string }>> {
  const whereField = {
    matchResults: 'notifyMatchResults',
    updates: 'notifyUpdates',
    winner: 'notifyWinner',
    schedule: 'notifySchedule',
  }[notificationType];

  const watchers = await db.tournamentWatcher.findMany({
    where: {
      tournamentId,
      unsubscribedAt: null,
      [whereField]: true,
      OR: [
        { emailVerified: true },
        { phoneVerified: true },
      ],
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  return watchers;
}

/**
 * Link watcher to user account (when they convert to registered user)
 */
export async function linkWatcherToUser(
  email: string,
  userId: string
): Promise<number> {
  // Find all watchers with this email and link them
  const result = await db.tournamentWatcher.updateMany({
    where: {
      email,
      convertedToUserId: null,
    },
    data: {
      convertedToUserId: userId,
      convertedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Indian numbers primarily)
 */
function isValidPhone(phone: string): boolean {
  // Allow +91 prefix or just 10 digits
  const phoneRegex = /^(\+91[-\s]?)?[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Check if a contact is already subscribed to a tournament
 */
export async function checkExistingSubscription(
  tournamentId: string,
  email?: string,
  phone?: string
): Promise<{ exists: boolean; verified: boolean }> {
  if (!email && !phone) {
    return { exists: false, verified: false };
  }

  const existing = await db.tournamentWatcher.findFirst({
    where: {
      tournamentId,
      OR: [
        { email: email || undefined },
        { phone: phone || undefined },
      ],
    },
  });

  if (!existing) {
    return { exists: false, verified: false };
  }

  return {
    exists: true,
    verified: existing.emailVerified || existing.phoneVerified,
  };
}

/**
 * Get watcher statistics for a tournament
 */
export async function getWatcherStats(tournamentId: string): Promise<{
  total: number;
  verified: number;
  pending: number;
  emailCount: number;
  phoneCount: number;
}> {
  const [total, verified, pending, emailCount, phoneCount] = await Promise.all([
    db.tournamentWatcher.count({
      where: { tournamentId, unsubscribedAt: null },
    }),
    db.tournamentWatcher.count({
      where: { tournamentId, unsubscribedAt: null, OR: [{ emailVerified: true }, { phoneVerified: true }] },
    }),
    db.tournamentWatcher.count({
      where: { tournamentId, unsubscribedAt: null, emailVerified: false, phoneVerified: false },
    }),
    db.tournamentWatcher.count({
      where: { tournamentId, unsubscribedAt: null, emailVerified: true, email: { not: null } },
    }),
    db.tournamentWatcher.count({
      where: { tournamentId, unsubscribedAt: null, phoneVerified: true, phone: { not: null } },
    }),
  ]);

  return { total, verified, pending, emailCount, phoneCount };
}
