import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateSession, validateOrgSession } from '@/lib/auth';

// Email notification settings
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
      settings = await db.emailNotificationSetting.findUnique({
        where: { userId_sport: { userId: session.user.id, sport: sport as any } },
      });
    } else {
      if (!orgSession?.orgId) {
        return NextResponse.json({ error: 'Organization session not found' }, { status: 401 });
      }

      settings = await db.emailNotificationSetting.findUnique({
        where: { orgId_sport: { orgId: orgSession.orgId, sport: sport as any } },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update email notification settings
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
    const { sport, matchResults, tournamentUpdates, rankChanges, milestones, weeklyDigest, announcements } = body;

    let settings;
    if (session?.user) {
      settings = await db.emailNotificationSetting.upsert({
        where: { userId_sport: { userId: session.user.id, sport } },
        create: {
          userId: session.user.id,
          orgId: null,
          sport,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? true,
          weeklyDigest: weeklyDigest ?? true,
          announcements: announcements ?? true,
        },
        update: {
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? true,
          weeklyDigest: weeklyDigest ?? true,
          announcements: announcements ?? true,
        }
      });
    } else {
      if (!orgSession?.orgId) {
        return NextResponse.json({ error: 'Organization session not found' }, { status: 401 });
      }

      settings = await db.emailNotificationSetting.upsert({
        where: { orgId_sport: { orgId: orgSession.orgId, sport } },
        create: {
          userId: null,
          orgId: orgSession.orgId,
          sport,
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? true,
          weeklyDigest: weeklyDigest ?? true,
          announcements: announcements ?? true,
        },
        update: {
          matchResults: matchResults ?? true,
          tournamentUpdates: tournamentUpdates ?? true,
          rankChanges: rankChanges ?? true,
          milestones: milestones ?? true,
          weeklyDigest: weeklyDigest ?? true,
          announcements: announcements ?? true,
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating email settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Send email notification (internal endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, type } = body;

    // In production, integrate with email service like SendGrid, Mailgun, or AWS SES
    // For now, log the email
    console.log('📧 Email Notification:', {
      to,
      subject,
      type,
      body: emailBody.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // FUTURE: Production email integration
    // The email service is available at @/lib/email - use sendEmail() for production
    // Example with SendGrid:
    // await sgMail.send({
    //   to,
    //   from: 'notifications@valorhive.com',
    //   subject,
    //   html: emailBody,
    // });

    return NextResponse.json({ success: true, message: 'Email queued' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
