/**
 * V1 User Notification Settings API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/users/me/notification-settings - Get notification settings
 * PUT /api/v1/users/me/notification-settings - Update notification settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-request';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { SportType } from '@prisma/client';

// Valid digest frequency values
const VALID_DIGEST_FREQUENCIES = ['daily', 'weekly'] as const;
type DigestFrequency = typeof VALID_DIGEST_FREQUENCIES[number];

// Default notification settings
const DEFAULT_EMAIL_SETTINGS = {
  matchResults: true,
  tournamentUpdates: true,
  rankChanges: true,
  milestones: true,
  weeklyDigest: true,
  announcements: true,
  promotional: true,
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  quietHoursTimezone: 'Asia/Kolkata',
  digestMode: false,
  digestFrequency: 'daily' as DigestFrequency,
};

const DEFAULT_PUSH_SETTINGS = {
  matchResults: true,
  tournamentUpdates: true,
  rankChanges: true,
  milestones: true,
  announcements: true,
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  quietHoursTimezone: 'Asia/Kolkata',
};

// GET /api/v1/users/me/notification-settings
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;
    const sport = auth.user.sport;

    if (!sport) {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Sport not found in session', undefined, 400);
    }

    // Fetch existing settings
    const [emailSettings, pushSettings] = await Promise.all([
      db.emailNotificationSetting.findUnique({
        where: { userId_sport: { userId, sport: sport as SportType } },
      }),
      db.pushNotificationSetting.findUnique({
        where: { userId_sport: { userId, sport: sport as SportType } },
      }),
    ]);

    // Create default settings if not exist
    const email = emailSettings || await db.emailNotificationSetting.create({
      data: { userId, sport: sport as SportType, ...DEFAULT_EMAIL_SETTINGS },
    });

    const push = pushSettings || await db.pushNotificationSetting.create({
      data: { userId, sport: sport as SportType, ...DEFAULT_PUSH_SETTINGS },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        email: {
          matchResults: email.matchResults,
          tournamentUpdates: email.tournamentUpdates,
          rankChanges: email.rankChanges,
          milestones: email.milestones,
          weeklyDigest: email.weeklyDigest,
          announcements: email.announcements,
          promotional: email.promotional,
          quietHours: email.quietHoursStart !== null ? {
            start: email.quietHoursStart,
            end: email.quietHoursEnd,
            timezone: email.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
          digestMode: email.digestMode,
          digestFrequency: email.digestFrequency,
        },
        push: {
          matchResults: push.matchResults,
          tournamentUpdates: push.tournamentUpdates,
          rankChanges: push.rankChanges,
          milestones: push.milestones,
          announcements: push.announcements,
          quietHours: push.quietHoursStart !== null ? {
            start: push.quietHoursStart,
            end: push.quietHoursEnd,
            timezone: push.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
        },
        sport,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Notification Settings] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to fetch notification settings', undefined, 500);
  }
}

// PUT /api/v1/users/me/notification-settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;
    const sport = auth.user.sport;

    if (!sport) {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Sport not found in session', undefined, 400);
    }

    const body = await request.json();
    const { type, settings } = body;

    if (!type || !settings) {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Type and settings required', undefined, 400);
    }

    if (!['email', 'push'].includes(type)) {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Type must be "email" or "push"', undefined, 400);
    }

    // Validate quiet hours if provided
    if (settings.quietHoursStart !== undefined || settings.quietHoursEnd !== undefined) {
      if (settings.quietHours && typeof settings.quietHours === 'object') {
        settings.quietHoursStart = settings.quietHours.start;
        settings.quietHoursEnd = settings.quietHours.end;
        settings.quietHoursTimezone = settings.quietHours.timezone;
        delete settings.quietHours;
      }

      const { quietHoursStart, quietHoursEnd } = settings;
      if (quietHoursStart !== null && quietHoursEnd !== null) {
        if (
          typeof quietHoursStart !== 'number' ||
          typeof quietHoursEnd !== 'number' ||
          quietHoursStart < 0 ||
          quietHoursStart > 23 ||
          quietHoursEnd < 0 ||
          quietHoursEnd > 23
        ) {
          return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Invalid quiet hours values', undefined, 400);
        }
      }
    }

    // Prepare update data
    const booleanFields = [
      'matchResults', 'tournamentUpdates', 'rankChanges', 'milestones',
      'weeklyDigest', 'announcements', 'promotional', 'digestMode',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of booleanFields) {
      if (settings[field] !== undefined) {
        updateData[field] = settings[field];
      }
    }

    // Handle quiet hours
    if (settings.quietHoursStart !== undefined) {
      updateData.quietHoursStart = settings.quietHoursStart;
    }
    if (settings.quietHoursEnd !== undefined) {
      updateData.quietHoursEnd = settings.quietHoursEnd;
    }
    if (settings.quietHoursTimezone !== undefined) {
      updateData.quietHoursTimezone = settings.quietHoursTimezone;
    }
    if (settings.digestFrequency !== undefined) {
      updateData.digestFrequency = settings.digestFrequency;
    }

    let updatedSettings;
    if (type === 'email') {
      updatedSettings = await db.emailNotificationSetting.upsert({
        where: { userId_sport: { userId, sport: sport as SportType } },
        create: { userId, sport: sport as SportType, ...DEFAULT_EMAIL_SETTINGS, ...updateData },
        update: updateData,
      });
    } else {
      updatedSettings = await db.pushNotificationSetting.upsert({
        where: { userId_sport: { userId, sport: sport as SportType } },
        create: { userId, sport: sport as SportType, ...DEFAULT_PUSH_SETTINGS, ...updateData },
        update: updateData,
      });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        type,
        updated: true,
        settings: {
          matchResults: updatedSettings.matchResults,
          tournamentUpdates: updatedSettings.tournamentUpdates,
          rankChanges: updatedSettings.rankChanges,
          milestones: updatedSettings.milestones,
          announcements: updatedSettings.announcements,
        },
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;
  } catch (error) {
    console.error('[V1 Notification Settings] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to update notification settings', undefined, 500);
  }
}
