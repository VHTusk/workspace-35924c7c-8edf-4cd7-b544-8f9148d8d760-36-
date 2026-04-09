import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';

// GET - Get organization notification settings
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth || !auth.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { org } = auth;

    // Get email notification settings
    const emailSettings = await db.emailNotificationSetting.findFirst({
      where: { orgId: org.id, sport: org.sport },
    });

    // Get WhatsApp notification settings
    const whatsappSettings = await db.whatsAppNotificationSetting.findFirst({
      where: { orgId: org.id, sport: org.sport },
    });

    return NextResponse.json({
      email: {
        tournamentUpdates: emailSettings?.tournamentUpdates ?? true,
        matchResults: emailSettings?.matchResults ?? true,
        memberActivity: emailSettings?.milestones ?? false,
        announcements: emailSettings?.announcements ?? true,
        weeklyDigest: emailSettings?.weeklyDigest ?? true,
      },
      whatsapp: {
        tournamentUpdates: whatsappSettings?.tournamentUpdates ?? false,
        matchResults: whatsappSettings?.matchResults ?? false,
        announcements: whatsappSettings?.promotional ?? false,
      },
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update organization notification settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth || !auth.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { org } = auth;
    const body = await request.json();
    const { email, whatsapp } = body;

    // Update email settings
    if (email) {
      await db.emailNotificationSetting.upsert({
        where: {
          orgId_sport: {
            orgId: org.id,
            sport: org.sport,
          },
        },
        create: {
          orgId: org.id,
          sport: org.sport,
          tournamentUpdates: email.tournamentUpdates ?? true,
          matchResults: email.matchResults ?? true,
          milestones: email.memberActivity ?? false,
          announcements: email.announcements ?? true,
          weeklyDigest: email.weeklyDigest ?? true,
        },
        update: {
          tournamentUpdates: email.tournamentUpdates ?? true,
          matchResults: email.matchResults ?? true,
          milestones: email.memberActivity ?? false,
          announcements: email.announcements ?? true,
          weeklyDigest: email.weeklyDigest ?? true,
        },
      });
    }

    // Update WhatsApp settings
    if (whatsapp) {
      await db.whatsAppNotificationSetting.upsert({
        where: {
          orgId_sport: {
            orgId: org.id,
            sport: org.sport,
          },
        },
        create: {
          orgId: org.id,
          sport: org.sport,
          tournamentUpdates: whatsapp.tournamentUpdates ?? false,
          matchResults: whatsapp.matchResults ?? false,
          promotional: whatsapp.announcements ?? false,
        },
        update: {
          tournamentUpdates: whatsapp.tournamentUpdates ?? false,
          matchResults: whatsapp.matchResults ?? false,
          promotional: whatsapp.announcements ?? false,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
