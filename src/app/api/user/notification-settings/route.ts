import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession, validateOrgSession } from '@/lib/auth';
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

const DEFAULT_WHATSAPP_SETTINGS = {
  matchResults: true,
  tournamentUpdates: true,
  rankChanges: true,
  milestones: false,
  weeklyDigest: false,
  promotional: false,
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  quietHoursTimezone: 'Asia/Kolkata',
  phoneNumber: null as string | null,
  verified: false,
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

// Validation helpers
function validateQuietHours(start: unknown, end: unknown): { valid: boolean; error?: string } {
  // If both are null/undefined, it's valid (quiet hours disabled)
  if (start === null || start === undefined) {
    if (end !== null && end !== undefined) {
      return { valid: false, error: 'Both quietHoursStart and quietHoursEnd must be set together' };
    }
    return { valid: true };
  }

  if (end === null || end === undefined) {
    return { valid: false, error: 'Both quietHoursStart and quietHoursEnd must be set together' };
  }

  // Validate range (0-23)
  if (typeof start !== 'number' || typeof end !== 'number') {
    return { valid: false, error: 'Quiet hours must be numbers' };
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { valid: false, error: 'Quiet hours must be integers' };
  }

  if (start < 0 || start > 23) {
    return { valid: false, error: 'quietHoursStart must be between 0 and 23' };
  }

  if (end < 0 || end > 23) {
    return { valid: false, error: 'quietHoursEnd must be between 0 and 23' };
  }

  return { valid: true };
}

function validateDigestFrequency(frequency: unknown): { valid: boolean; error?: string } {
  if (frequency === null || frequency === undefined) {
    return { valid: true }; // null is valid (no digest)
  }

  if (typeof frequency !== 'string') {
    return { valid: false, error: 'digestFrequency must be a string' };
  }

  if (!VALID_DIGEST_FREQUENCIES.includes(frequency as DigestFrequency)) {
    return { valid: false, error: 'digestFrequency must be "daily" or "weekly"' };
  }

  return { valid: true };
}

// GET /api/user/notification-settings - Get current user's notification settings
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try player session first
    const userSession = await validateSession(sessionToken);
    const orgSession = !userSession ? await validateOrgSession(sessionToken) : null;
    let isOrg = false;

    if (orgSession) {
      isOrg = true;
    }

    if (!userSession && !orgSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sport = userSession?.user?.sport || orgSession?.org?.sport;
    const userId = userSession?.user?.id;
    const orgId = orgSession?.orgId;
    const accountType = isOrg ? 'ORG' : 'PLAYER';

    if (!sport) {
      return NextResponse.json({ error: 'Sport not found in session' }, { status: 400 });
    }

    // Fetch existing settings
    let emailSettings, whatsappSettings, pushSettings;

    if (accountType === 'PLAYER' && userId) {
      [emailSettings, whatsappSettings, pushSettings] = await Promise.all([
        db.emailNotificationSetting.findUnique({
          where: { userId_sport: { userId, sport: sport as SportType } },
        }),
        db.whatsAppNotificationSetting.findUnique({
          where: { userId_sport: { userId, sport: sport as SportType } },
        }),
        db.pushNotificationSetting.findUnique({
          where: { userId_sport: { userId, sport: sport as SportType } },
        }),
      ]);

      // Create default settings if not exist
      if (!emailSettings) {
        emailSettings = await db.emailNotificationSetting.create({
          data: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_EMAIL_SETTINGS,
          },
        });
      }

      if (!whatsappSettings) {
        whatsappSettings = await db.whatsAppNotificationSetting.create({
          data: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_WHATSAPP_SETTINGS,
          },
        });
      }

      if (!pushSettings) {
        pushSettings = await db.pushNotificationSetting.create({
          data: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_PUSH_SETTINGS,
          },
        });
      }
    } else if (accountType === 'ORG' && orgId) {
      [emailSettings, whatsappSettings, pushSettings] = await Promise.all([
        db.emailNotificationSetting.findUnique({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
        }),
        db.whatsAppNotificationSetting.findUnique({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
        }),
        db.pushNotificationSetting.findUnique({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
        }),
      ]);

      // Create default settings if not exist
      if (!emailSettings) {
        emailSettings = await db.emailNotificationSetting.create({
          data: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_EMAIL_SETTINGS,
          },
        });
      }

      if (!whatsappSettings) {
        whatsappSettings = await db.whatsAppNotificationSetting.create({
          data: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_WHATSAPP_SETTINGS,
          },
        });
      }

      if (!pushSettings) {
        pushSettings = await db.pushNotificationSetting.create({
          data: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_PUSH_SETTINGS,
          },
        });
      }
    } else {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
    }

    // Format response
    const response = {
      success: true,
      data: {
        email: {
          id: emailSettings.id,
          matchResults: emailSettings.matchResults,
          tournamentUpdates: emailSettings.tournamentUpdates,
          rankChanges: emailSettings.rankChanges,
          milestones: emailSettings.milestones,
          weeklyDigest: emailSettings.weeklyDigest,
          announcements: emailSettings.announcements,
          promotional: emailSettings.promotional,
          quietHours: emailSettings.quietHoursStart !== null ? {
            start: emailSettings.quietHoursStart,
            end: emailSettings.quietHoursEnd,
            timezone: emailSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
          digestMode: emailSettings.digestMode,
          digestFrequency: emailSettings.digestFrequency,
        },
        whatsapp: {
          id: whatsappSettings.id,
          matchResults: whatsappSettings.matchResults,
          tournamentUpdates: whatsappSettings.tournamentUpdates,
          rankChanges: whatsappSettings.rankChanges,
          milestones: whatsappSettings.milestones,
          weeklyDigest: whatsappSettings.weeklyDigest,
          promotional: whatsappSettings.promotional,
          quietHours: whatsappSettings.quietHoursStart !== null ? {
            start: whatsappSettings.quietHoursStart,
            end: whatsappSettings.quietHoursEnd,
            timezone: whatsappSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
          phoneNumber: whatsappSettings.phoneNumber,
          verified: whatsappSettings.verified,
        },
        push: {
          id: pushSettings.id,
          matchResults: pushSettings.matchResults,
          tournamentUpdates: pushSettings.tournamentUpdates,
          rankChanges: pushSettings.rankChanges,
          milestones: pushSettings.milestones,
          announcements: pushSettings.announcements,
          quietHours: pushSettings.quietHoursStart !== null ? {
            start: pushSettings.quietHoursStart,
            end: pushSettings.quietHoursEnd,
            timezone: pushSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
        },
        accountType,
        sport,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get notification settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/user/notification-settings - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try player session first
    const userSession = await validateSession(sessionToken);
    const orgSession = !userSession ? await validateOrgSession(sessionToken) : null;
    let isOrg = false;

    if (orgSession) {
      isOrg = true;
    }

    if (!userSession && !orgSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sport = userSession?.user?.sport || orgSession?.org?.sport;
    const userId = userSession?.user?.id;
    const orgId = orgSession?.orgId;
    const accountType = isOrg ? 'ORG' : 'PLAYER';

    if (!sport) {
      return NextResponse.json({ error: 'Sport not found in session' }, { status: 400 });
    }

    const body = await request.json();
    const { type, settings } = body; // type: 'email' or 'whatsapp'

    if (!type || !settings) {
      return NextResponse.json({ error: 'Type and settings required' }, { status: 400 });
    }

    if (!['email', 'whatsapp', 'push'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "email", "whatsapp", or "push"' }, { status: 400 });
    }

    // Validate quiet hours if provided
    if (settings.quietHoursStart !== undefined || settings.quietHoursEnd !== undefined) {
      // Convert quietHours object format if provided
      if (settings.quietHours && typeof settings.quietHours === 'object') {
        settings.quietHoursStart = settings.quietHours.start;
        settings.quietHoursEnd = settings.quietHours.end;
        settings.quietHoursTimezone = settings.quietHours.timezone;
        delete settings.quietHours;
      }

      const quietHoursValidation = validateQuietHours(
        settings.quietHoursStart,
        settings.quietHoursEnd
      );

      if (!quietHoursValidation.valid) {
        return NextResponse.json(
          { error: quietHoursValidation.error },
          { status: 400 }
        );
      }
    }

    // Validate digest frequency if provided
    if (settings.digestFrequency !== undefined) {
      const digestValidation = validateDigestFrequency(settings.digestFrequency);
      if (!digestValidation.valid) {
        return NextResponse.json({ error: digestValidation.error }, { status: 400 });
      }
    }

    // Validate timezone if provided
    if (settings.quietHoursTimezone !== undefined) {
      try {
        // Basic validation - check if timezone string looks valid
        if (typeof settings.quietHoursTimezone !== 'string' || settings.quietHoursTimezone.length === 0) {
          return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
      }
    }

    // Validate boolean fields
    const booleanFields = [
      'matchResults',
      'tournamentUpdates',
      'rankChanges',
      'milestones',
      'weeklyDigest',
      'announcements',
      'promotional',
      'digestMode',
    ];

    for (const field of booleanFields) {
      if (settings[field] !== undefined && typeof settings[field] !== 'boolean') {
        return NextResponse.json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    // Only include fields that are provided
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

    // Handle digest settings
    if (settings.digestMode !== undefined) {
      updateData.digestMode = settings.digestMode;
    }
    if (settings.digestFrequency !== undefined) {
      updateData.digestFrequency = settings.digestFrequency;
    }

    // WhatsApp-specific fields
    if (type === 'whatsapp') {
      if (settings.phoneNumber !== undefined) {
        updateData.phoneNumber = settings.phoneNumber;
      }
      if (settings.verified !== undefined) {
        updateData.verified = settings.verified;
      }
    }

    let updatedSettings;

    if (accountType === 'PLAYER' && userId) {
      if (type === 'email') {
        updatedSettings = await db.emailNotificationSetting.upsert({
          where: { userId_sport: { userId, sport: sport as SportType } },
          create: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_EMAIL_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      } else if (type === 'whatsapp') {
        updatedSettings = await db.whatsAppNotificationSetting.upsert({
          where: { userId_sport: { userId, sport: sport as SportType } },
          create: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_WHATSAPP_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      } else if (type === 'push') {
        updatedSettings = await db.pushNotificationSetting.upsert({
          where: { userId_sport: { userId, sport: sport as SportType } },
          create: {
            userId,
            sport: sport as SportType,
            ...DEFAULT_PUSH_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      }
    } else if (accountType === 'ORG' && orgId) {
      if (type === 'email') {
        updatedSettings = await db.emailNotificationSetting.upsert({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
          create: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_EMAIL_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      } else if (type === 'whatsapp') {
        updatedSettings = await db.whatsAppNotificationSetting.upsert({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
          create: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_WHATSAPP_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      } else if (type === 'push') {
        updatedSettings = await db.pushNotificationSetting.upsert({
          where: { orgId_sport: { orgId, sport: sport as SportType } },
          create: {
            orgId,
            sport: sport as SportType,
            ...DEFAULT_PUSH_SETTINGS,
            ...updateData,
          },
          update: updateData,
        });
      }
    } else {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
    }

    if (!updatedSettings) {
      return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 });
    }

    const serializedSettings = updatedSettings as {
      id: string;
      matchResults: boolean;
      tournamentUpdates: boolean;
      rankChanges: boolean;
      milestones: boolean;
      weeklyDigest?: boolean;
      announcements?: boolean;
      promotional?: boolean;
      quietHoursStart: number | null;
      quietHoursEnd: number | null;
      quietHoursTimezone: string | null;
      digestMode?: boolean;
      digestFrequency?: string | null;
      phoneNumber?: string | null;
      verified?: boolean;
    };

    // Format response
    const response = {
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        type,
        settings: type === 'email' ? {
          id: serializedSettings.id,
          matchResults: serializedSettings.matchResults,
          tournamentUpdates: serializedSettings.tournamentUpdates,
          rankChanges: serializedSettings.rankChanges,
          milestones: serializedSettings.milestones,
          weeklyDigest: serializedSettings.weeklyDigest ?? DEFAULT_EMAIL_SETTINGS.weeklyDigest,
          announcements: serializedSettings.announcements ?? DEFAULT_EMAIL_SETTINGS.announcements,
          promotional: serializedSettings.promotional ?? DEFAULT_EMAIL_SETTINGS.promotional,
          quietHours: serializedSettings.quietHoursStart !== null ? {
            start: serializedSettings.quietHoursStart,
            end: serializedSettings.quietHoursEnd,
            timezone: serializedSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
          digestMode: serializedSettings.digestMode ?? DEFAULT_EMAIL_SETTINGS.digestMode,
          digestFrequency: serializedSettings.digestFrequency ?? DEFAULT_EMAIL_SETTINGS.digestFrequency,
        } : type === 'whatsapp' ? {
          id: serializedSettings.id,
          matchResults: serializedSettings.matchResults,
          tournamentUpdates: serializedSettings.tournamentUpdates,
          rankChanges: serializedSettings.rankChanges,
          milestones: serializedSettings.milestones,
          weeklyDigest: serializedSettings.weeklyDigest ?? DEFAULT_WHATSAPP_SETTINGS.weeklyDigest,
          promotional: serializedSettings.promotional ?? DEFAULT_WHATSAPP_SETTINGS.promotional,
          quietHours: serializedSettings.quietHoursStart !== null ? {
            start: serializedSettings.quietHoursStart,
            end: serializedSettings.quietHoursEnd,
            timezone: serializedSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
          phoneNumber: serializedSettings.phoneNumber ?? DEFAULT_WHATSAPP_SETTINGS.phoneNumber,
          verified: serializedSettings.verified ?? DEFAULT_WHATSAPP_SETTINGS.verified,
        } : {
          id: serializedSettings.id,
          matchResults: serializedSettings.matchResults,
          tournamentUpdates: serializedSettings.tournamentUpdates,
          rankChanges: serializedSettings.rankChanges,
          milestones: serializedSettings.milestones,
          announcements: serializedSettings.announcements ?? DEFAULT_PUSH_SETTINGS.announcements,
          quietHours: serializedSettings.quietHoursStart !== null ? {
            start: serializedSettings.quietHoursStart,
            end: serializedSettings.quietHoursEnd,
            timezone: serializedSettings.quietHoursTimezone || 'Asia/Kolkata',
          } : null,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update notification settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
