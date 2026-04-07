/**
 * VALORHIVE Push Notification Service (v3.81.0)
 * Infrastructure for Firebase Cloud Messaging (FCM) push notifications
 * 
 * Features:
 * - Database-backed device token storage
 * - Multi-platform support (iOS, Android, Web)
 * - Quiet hours support
 * - Notification preferences per device
 * 
 * Mobile Support:
 * - iOS: Uses APNS via FCM with content_available for background wake
 * - Android: Uses FCM with high priority for immediate delivery
 * - Web: Uses VAPID for browser push notifications
 */

import { db } from '@/lib/db';

// Device platform types
type Platform = 'ios' | 'android' | 'web';

// Push notification payload
interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: number;
  image?: string;
  data?: Record<string, string>;
  click_action?: string;
  // Mobile-specific fields
  content_available?: boolean;  // iOS: Wake app in background
  mutable_content?: boolean;    // iOS: Allow notification extension
  priority?: 'normal' | 'high'; // Android/iOS: Delivery priority
  sound?: string;               // Notification sound
}

// FCM configuration
const FCM_CONFIG = {
  projectId: process.env.FCM_PROJECT_ID || '',
  serverKey: process.env.FCM_SERVER_KEY || '',
  senderId: process.env.FCM_SENDER_ID || '',
  vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '',
};

/**
 * Check if FCM is configured
 */
export function isFCMConfigured(): boolean {
  return Boolean(FCM_CONFIG.projectId && FCM_CONFIG.serverKey);
}

/**
 * Check if push notifications are configured (alias for isFCMConfigured)
 */
export function isPushNotificationsConfigured(): boolean {
  return isFCMConfigured();
}

/**
 * Register a device token for push notifications
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: Platform,
  deviceName?: string,
  deviceId?: string
): Promise<{ success: boolean; deviceRecordId?: string; error?: string }> {
  try {
    // Check if token already exists
    const existingDevice = await db.pushDevice.findUnique({
      where: { token },
    });

    if (existingDevice) {
      // Update existing device
      const updated = await db.pushDevice.update({
        where: { token },
        data: {
          userId,
          platform,
          deviceName,
          deviceId,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
      return { success: true, deviceRecordId: updated.id };
    }

    // Create new device
    const device = await db.pushDevice.create({
      data: {
        userId,
        token,
        platform,
        deviceName,
        deviceId,
        lastUsedAt: new Date(),
      },
    });

    return { success: true, deviceRecordId: device.id };
  } catch (error) {
    console.error('Error registering device token:', error);
    return { success: false, error: 'Failed to register device' };
  }
}

/**
 * Unregister a device token
 */
export async function unregisterDeviceToken(token: string): Promise<boolean> {
  try {
    await db.pushDevice.update({
      where: { token },
      data: { isActive: false },
    });
    return true;
  } catch {
    // Token might not exist, that's fine
    return true;
  }
}

/**
 * Get all active devices for a user
 */
export async function getUserDevices(userId: string): Promise<Array<{
  id: string;
  platform: Platform;
  deviceName: string | null;
  lastUsedAt: Date | null;
  notificationsEnabled: boolean;
  createdAt: Date;
}>> {
  const devices = await db.pushDevice.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      platform: true,
      deviceName: true,
      lastUsedAt: true,
      notificationsEnabled: true,
      createdAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });

  return devices.map(d => ({
    id: d.id,
    platform: d.platform as Platform,
    deviceName: d.deviceName,
    lastUsedAt: d.lastUsedAt,
    notificationsEnabled: d.notificationsEnabled,
    createdAt: d.createdAt,
  }));
}

/**
 * Check if user is in quiet hours
 */
function isInQuietHours(device: { quietHoursStart: number | null; quietHoursEnd: number | null }): boolean {
  if (device.quietHoursStart === null || device.quietHoursEnd === null) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();

  if (device.quietHoursStart < device.quietHoursEnd) {
    // Quiet hours don't cross midnight (e.g., 22:00 - 06:00)
    return currentHour >= device.quietHoursStart && currentHour < device.quietHoursEnd;
  } else {
    // Quiet hours cross midnight (e.g., 22:00 - 06:00)
    return currentHour >= device.quietHoursStart || currentHour < device.quietHoursEnd;
  }
}

/**
 * Send push notification to a specific user (all their devices)
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: {
    priority?: 'normal' | 'high';
    contentAvailable?: boolean;
    badge?: number;
    bypassQuietHours?: boolean;
  }
): Promise<{ success: boolean; sentCount: number; skippedCount: number }> {
  try {
    const devices = await db.pushDevice.findMany({
      where: {
        userId,
        isActive: true,
        notificationsEnabled: true,
      },
    });

    if (devices.length === 0) {
      return { success: true, sentCount: 0, skippedCount: 0 };
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const device of devices) {
      // Check quiet hours
      if (!options?.bypassQuietHours && isInQuietHours(device)) {
        skippedCount++;
        continue;
      }

      const payload: PushNotificationPayload = {
        title,
        body,
        icon: '/icons/icon-192x192.png',
        badge: options?.badge ?? 1,
        data: data || {},
        content_available: options?.contentAvailable ?? true,
        priority: options?.priority ?? 'high',
        mutable_content: true,
        sound: 'default',
      };

      const result = await sendToDevice(device.token, payload, device.platform as Platform);
      if (result) {
        sentCount++;
        // Update last used
        await db.pushDevice.update({
          where: { id: device.id },
          data: { lastUsedAt: new Date() },
        });
      }
    }

    // Log notification
    await db.pushNotificationLog.create({
      data: {
        userId,
        token: 'multiple',
        title,
        body,
        data: data ? JSON.stringify(data) : null,
        status: 'sent',
      },
    });

    return { success: true, sentCount, skippedCount };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, sentCount: 0, skippedCount: 0 };
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendBulkPushNotifications(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; totalSent: number }> {
  let totalSent = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, title, body, data);
    totalSent += result.sentCount;
  }

  return { success: true, totalSent };
}

/**
 * Send notification to a single device token
 * Uses FCM HTTP v1 API in production
 */
async function sendToDevice(
  token: string,
  payload: PushNotificationPayload,
  platform: Platform
): Promise<boolean> {
  try {
    if (!isFCMConfigured()) {
      // Development mode - log notification
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Push - ${platform.toUpperCase()}] ${payload.title}: ${payload.body}`);
      }
      return true;
    }

    // In production, use Firebase Admin SDK:
    // const message = buildFCMMessage(token, payload, platform);
    // await admin.messaging().send(message);

    // For now, use FCM HTTP v1 API via fetch
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_CONFIG.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FCM_CONFIG.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: payload.title,
              body: payload.body,
              image: payload.image,
            },
            data: payload.data,
            android: platform === 'android' ? {
              priority: 'high',
              notification: {
                icon: payload.icon || 'ic_notification',
                sound: 'default',
                tag: payload.data?.type,
              },
            } : undefined,
            apns: platform === 'ios' ? {
              payload: {
                aps: {
                  badge: payload.badge,
                  sound: 'default',
                  'content-available': payload.content_available ? 1 : 0,
                  'mutable-content': payload.mutable_content ? 1 : 0,
                },
              },
            } : undefined,
            webpush: platform === 'web' ? {
              notification: {
                icon: payload.icon,
                badge: payload.badge,
              },
            } : undefined,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('FCM error:', error);
      
      // Mark token as inactive if it's invalid
      if (response.status === 404 || response.status === 400) {
        await db.pushDevice.update({
          where: { token },
          data: { isActive: false },
        });
      }
      
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending to device:', error);
    return false;
  }
}

/**
 * Notification helper functions
 */

export async function sendMatchResultNotification(
  userId: string,
  opponentName: string,
  score: string,
  won: boolean
): Promise<void> {
  const title = won ? '🎉 Victory!' : 'Match Result';
  const body = won 
    ? `You defeated ${opponentName} ${score}`
    : `You lost to ${opponentName} ${score}`;

  await sendPushNotification(userId, title, body, {
    type: 'MATCH_RESULT',
    opponent: opponentName,
    result: won ? 'won' : 'lost',
  });
}

export async function sendTournamentReminderNotification(
  userId: string,
  tournamentName: string,
  timeUntil: string
): Promise<void> {
  const title = '🏆 Tournament Starting Soon';
  const body = `${tournamentName} starts in ${timeUntil}`;

  await sendPushNotification(userId, title, body, {
    type: 'TOURNAMENT_REMINDER',
    tournament: tournamentName,
  }, { bypassQuietHours: true }); // Always send tournament reminders
}

export async function sendPointsEarnedNotification(
  userId: string,
  points: number,
  reason: string
): Promise<void> {
  const title = '⭐ Points Earned!';
  const body = `+${points} points: ${reason}`;

  await sendPushNotification(userId, title, body, {
    type: 'POINTS_EARNED',
    points: points.toString(),
    reason,
  });
}

export async function sendRankChangeNotification(
  userId: string,
  newRank: number,
  previousRank: number,
  leaderboardType: string
): Promise<void> {
  const improved = newRank < previousRank;
  const title = improved ? '📈 Rank Improved!' : '📉 Rank Changed';
  const body = improved
    ? `You moved up to #${newRank} (${previousRank - newRank} places)`
    : `You are now #${newRank} in ${leaderboardType}`;

  await sendPushNotification(userId, title, body, {
    type: 'RANK_CHANGE',
    newRank: newRank.toString(),
    previousRank: previousRank.toString(),
  });
}

export async function sendTournamentRegistrationNotification(
  userId: string,
  tournamentName: string
): Promise<void> {
  const title = '✅ Registration Confirmed';
  const body = `You're registered for ${tournamentName}`;

  await sendPushNotification(userId, title, body, {
    type: 'TOURNAMENT_REGISTERED',
    tournament: tournamentName,
  });
}

export async function sendWaitlistPromotedNotification(
  userId: string,
  tournamentName: string
): Promise<void> {
  const title = '🎉 You\'re In!';
  const body = `You've been promoted from waitlist for ${tournamentName}`;

  await sendPushNotification(userId, title, body, {
    type: 'WAITLIST_PROMOTED',
    tournament: tournamentName,
  }, { bypassQuietHours: true });
}

/**
 * Get push notification statistics
 */
export async function getPushNotificationStats(): Promise<{
  totalDevices: number;
  activeDevices: number;
  devicesByPlatform: Record<Platform, number>;
}> {
  const [total, active, platformStats] = await Promise.all([
    db.pushDevice.count(),
    db.pushDevice.count({ where: { isActive: true } }),
    db.pushDevice.groupBy({
      by: ['platform'],
      where: { isActive: true },
      _count: true,
    }),
  ]);

  const devicesByPlatform: Record<Platform, number> = {
    ios: 0,
    android: 0,
    web: 0,
  };

  for (const stat of platformStats) {
    devicesByPlatform[stat.platform as Platform] = stat._count;
  }

  return { totalDevices: total, activeDevices: active, devicesByPlatform };
}

/**
 * Clean up old/invalid device tokens
 */
export async function cleanupInvalidTokens(): Promise<number> {
  // Remove tokens not used in 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const result = await db.pushDevice.updateMany({
    where: {
      lastUsedAt: { lt: ninetyDaysAgo },
      isActive: true,
    },
    data: { isActive: false },
  });

  return result.count;
}

/**
 * Update notification preferences for a device
 */
export async function updateDevicePreferences(
  deviceId: string,
  userId: string,
  preferences: {
    notificationsEnabled?: boolean;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  }
): Promise<boolean> {
  try {
    await db.pushDevice.update({
      where: {
        id: deviceId,
        userId, // Ensure user owns this device
      },
      data: preferences,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get FCM config for client
 */
export function getFCMClientConfig(): {
  projectId: string;
  senderId: string;
  vapidKey: string;
} {
  return {
    projectId: FCM_CONFIG.projectId,
    senderId: FCM_CONFIG.senderId,
    vapidKey: FCM_CONFIG.vapidKey,
  };
}
