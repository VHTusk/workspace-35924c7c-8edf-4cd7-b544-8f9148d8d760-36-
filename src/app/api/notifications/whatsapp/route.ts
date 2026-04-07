import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateSession, validateOrgSession } from '@/lib/auth';

// WhatsApp notification settings
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Try to validate as player session first, then org session
    let session = await validateSession(sessionToken);
    let orgSession = null;

    if (!session) {
      orgSession = await validateOrgSession(sessionToken);
    }

    if (!session && !orgSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');

    if (!sport) {
      return NextResponse.json({ error: 'Sport required' }, { status: 400 });
    }

    let settings;
    if (session?.user) {
      settings = await db.whatsAppNotificationSetting.findUnique({
        where: { userId_sport: { userId: session.user.id, sport: sport as any } }
      });
    } else {
      if (!orgSession?.orgId) {
        return NextResponse.json({ error: 'Organization session not found' }, { status: 401 });
      }

      settings = await db.whatsAppNotificationSetting.findUnique({
        where: { orgId_sport: { orgId: orgSession.orgId, sport: sport as any } }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching WhatsApp settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update WhatsApp notification settings
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Try to validate as player session first, then org session
    let session = await validateSession(sessionToken);
    let orgSession = null;

    if (!session) {
      orgSession = await validateOrgSession(sessionToken);
    }

    if (!session && !orgSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sport,
      phoneNumber,
      matchResults,
      tournamentUpdates,
      rankChanges,
      milestones,
      weeklyDigest
    } = body;

    let settings;
    if (session?.user) {
      settings = await db.whatsAppNotificationSetting.upsert({
        where: { userId_sport: { userId: session.user.id, sport } },
        create: {
          userId: session.user.id,
          orgId: null,
          sport,
          phoneNumber,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? false,
          weeklyDigest: weeklyDigest ?? false,
        },
        update: {
          phoneNumber,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? false,
          weeklyDigest: weeklyDigest ?? false,
        }
      });
    } else {
      if (!orgSession?.orgId) {
        return NextResponse.json({ error: 'Organization session not found' }, { status: 401 });
      }

      settings = await db.whatsAppNotificationSetting.upsert({
        where: { orgId_sport: { orgId: orgSession.orgId, sport } },
        create: {
          userId: null,
          orgId: orgSession.orgId,
          sport,
          phoneNumber,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? false,
          weeklyDigest: weeklyDigest ?? false,
        },
        update: {
          phoneNumber,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? false,
          weeklyDigest: weeklyDigest ?? false,
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating WhatsApp settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Send WhatsApp notification (internal endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, message, type } = body;

    // In production, integrate with WhatsApp Business API
    // Options: Twilio, MSG91, Gupshup, WATI, etc.

    // For now, log the WhatsApp message
    console.log('📱 WhatsApp Notification:', {
      to,
      type,
      message: message.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: 'WhatsApp queued' });
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify WhatsApp phone number
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Try to validate as player session first, then org session
    let session = await validateSession(sessionToken);
    let orgSession = null;

    if (!session) {
      orgSession = await validateOrgSession(sessionToken);
    }

    if (!session && !orgSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const body = await request.json();
    const { sport, otp } = body;

    // FUTURE: Verify OTP sent to WhatsApp number via WhatsApp Business API
    // For now, mark as verified (development mode)
    // In production, integrate with Twilio/WhatsApp Business API for OTP verification
    let settings;
    if (session?.user) {
      settings = await db.whatsAppNotificationSetting.update({
        where: { userId_sport: { userId: session.user.id, sport } },
        data: { verified: true }
      });
    } else {
      if (!orgSession?.orgId) {
        return NextResponse.json({ error: 'Organization session not found' }, { status: 401 });
      }

      settings = await db.whatsAppNotificationSetting.update({
        where: { orgId_sport: { orgId: orgSession.orgId, sport } },
        data: { verified: true }
      });
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error('Error verifying WhatsApp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
