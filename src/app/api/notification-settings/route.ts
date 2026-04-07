import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/notification-settings - Get notification settings
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [emailSettings, whatsappSettings] = await Promise.all([
      db.emailNotificationSetting.findUnique({
        where: { userId_sport: { userId: session.user.id, sport: session.user.sport } },
      }),
      db.whatsAppNotificationSetting.findUnique({
        where: { userId_sport: { userId: session.user.id, sport: session.user.sport } },
      }),
    ]);

    // Create default settings if not exist
    const email = emailSettings || {
      matchResults: true,
      tournamentUpdates: true,
      rankChanges: true,
      milestones: true,
      weeklyDigest: true,
      announcements: true,
    };

    const whatsapp = whatsappSettings || {
      matchResults: true,
      tournamentUpdates: true,
      rankChanges: true,
      milestones: false,
      weeklyDigest: false,
      phoneNumber: null,
      verified: false,
    };

    return NextResponse.json({ email, whatsapp });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/notification-settings - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, settings } = body; // type: 'email' or 'whatsapp'

    if (!type || !settings) {
      return NextResponse.json({ error: 'Type and settings required' }, { status: 400 });
    }

    if (type === 'email') {
      const emailSettings = await db.emailNotificationSetting.upsert({
        where: { userId_sport: { userId: session.user.id, sport: session.user.sport } },
        create: {
          userId: session.user.id,
          sport: session.user.sport,
          ...settings,
        },
        update: settings,
      });
      return NextResponse.json({ emailSettings });
    } else if (type === 'whatsapp') {
      const whatsappSettings = await db.whatsAppNotificationSetting.upsert({
        where: { userId_sport: { userId: session.user.id, sport: session.user.sport } },
        create: {
          userId: session.user.id,
          sport: session.user.sport,
          ...settings,
        },
        update: settings,
      });
      return NextResponse.json({ whatsappSettings });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Update notification settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
