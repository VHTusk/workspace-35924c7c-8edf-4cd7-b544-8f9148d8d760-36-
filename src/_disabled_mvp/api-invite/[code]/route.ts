/**
 * Tournament Invite Link Handler API
 * GET /api/invite/[code] - Get invite details and track click
 * POST /api/invite/[code]/accept - Accept invite and register
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { nanoid } from 'nanoid';

// GET - Get invite details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: inviteCode } = await params;
    const { searchParams } = new URL(request.url);
    const trackClick = searchParams.get('track') !== 'false';

    // Find the invite
    const invite = await db.tournamentInvite.findUnique({
      where: { id: inviteCode },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            location: true,
            startDate: true,
            endDate: true,
            regDeadline: true,
            entryFee: true,
            prizePool: true,
            maxPlayers: true,
            format: true,
            status: true,
            gender: true,
            ageMin: true,
            ageMax: true,
            registrations: { select: { id: true } },
            _count: { select: { registrations: true } },
          },
        },
        inviter: {
          select: { firstName: true, lastName: true },
        },
        team: {
          select: { id: true, name: true, sport: true },
        },
        organization: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite link', valid: false },
        { status: 404 }
      );
    }

    // Check if invite has expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await db.tournamentInvite.update({
        where: { id: inviteCode },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json({
        valid: false,
        error: 'This invite link has expired',
        tournament: {
          id: invite.tournament.id,
          name: invite.tournament.name,
        },
      });
    }

    // Check if invite is still active
    if (invite.status !== 'ACTIVE') {
      return NextResponse.json({
        valid: false,
        error: `This invite link is ${invite.status.toLowerCase()}`,
        tournament: {
          id: invite.tournament.id,
          name: invite.tournament.name,
        },
      });
    }

    // Track click
    if (trackClick) {
      await db.tournamentInvite.update({
        where: { id: inviteCode },
        data: {
          clickCount: { increment: 1 },
          lastClickedAt: new Date(),
        },
      });
    }

    // Check if tournament is still open for registration
    const isRegistrationOpen = 
      invite.tournament.status === 'REGISTRATION_OPEN' ||
      invite.tournament.status === 'DRAFT';

    // Check spots remaining
    const spotsRemaining = invite.tournament.maxPlayers - invite.tournament._count.registrations;

    // Build response
    const response = {
      valid: true,
      invite: {
        code: invite.id,
        type: invite.type,
        customMessage: invite.customMessage,
        inviter: invite.inviter ? {
          name: `${invite.inviter.firstName} ${invite.inviter.lastName}`,
        } : null,
        team: invite.team ? {
          id: invite.team.id,
          name: invite.team.name,
        } : null,
        organization: invite.organization ? {
          id: invite.organization.id,
          name: invite.organization.name,
          type: invite.organization.type,
        } : null,
      },
      tournament: {
        id: invite.tournament.id,
        name: invite.tournament.name,
        sport: invite.tournament.sport,
        location: invite.tournament.location,
        startDate: invite.tournament.startDate,
        endDate: invite.tournament.endDate,
        regDeadline: invite.tournament.regDeadline,
        entryFee: invite.tournament.entryFee,
        prizePool: invite.tournament.prizePool,
        format: invite.tournament.format,
        gender: invite.tournament.gender,
        ageMin: invite.tournament.ageMin,
        ageMax: invite.tournament.ageMax,
        spotsRemaining,
        isRegistrationOpen,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing invite:', error);
    return NextResponse.json(
      { error: 'Failed to process invite' },
      { status: 500 }
    );
  }
}

// POST - Accept invite and register
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: inviteCode } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Please login to accept this invite', requiresAuth: true },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Please login to accept this invite', requiresAuth: true },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { partnerId } = body; // For doubles tournaments

    // Find and validate invite
    const invite = await db.tournamentInvite.findUnique({
      where: { id: inviteCode },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            status: true,
            maxPlayers: true,
            entryFee: true,
            format: true,
            registrations: { select: { userId: true } },
          },
        },
        team: { select: { id: true, members: { select: { userId: true } } } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    if (invite.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `This invite link is ${invite.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 });
    }

    // Check tournament status
    if (invite.tournament.status !== 'REGISTRATION_OPEN') {
      return NextResponse.json(
        { error: 'Tournament registration is closed' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingRegistration = invite.tournament.registrations.find(
      r => r.userId === userId
    );

    if (existingRegistration) {
      return NextResponse.json({
        success: true,
        message: 'You are already registered for this tournament',
        alreadyRegistered: true,
      });
    }

    // Check spots
    const spotsRemaining = invite.tournament.maxPlayers - invite.tournament.registrations.length;
    if (spotsRemaining <= 0) {
      return NextResponse.json(
        { error: 'Tournament is full', waitlistAvailable: true },
        { status: 400 }
      );
    }

    // Create registration with invite attribution
    const registration = await db.tournamentRegistration.create({
      data: {
        tournamentId: invite.tournamentId,
        userId,
        status: 'PENDING',
        amount: invite.tournament.entryFee,
        declaredProfession: null, // Will be filled from user profile
      },
    });

    // Update invite stats
    await db.tournamentInvite.update({
      where: { id: inviteCode },
      data: {
        registrationCount: { increment: 1 },
        status: 'USED',
      },
    });

    // Track referral if this is a new user
    await db.referral.upsert({
      where: {
        referrerId_refereeId: {
          referrerId: invite.inviterId,
          refereeId: userId,
        },
      },
      create: {
        referrerId: invite.inviterId!,
        refereeId: userId,
        source: 'TOURNAMENT_INVITE',
        sourceId: inviteCode,
        status: 'REGISTERED',
        rewardPoints: 0, // Points awarded after first tournament
      },
      update: {
        source: 'TOURNAMENT_INVITE',
        sourceId: inviteCode,
      },
    });

    // Log attribution
    await db.tournamentInviteAttribution.create({
      data: {
        tournamentId: invite.tournamentId,
        inviteId: inviteCode,
        inviterId: invite.inviterId!,
        refereeId: userId,
        registeredAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for tournament!',
      data: {
        registrationId: registration.id,
        tournament: {
          id: invite.tournament.id,
          name: invite.tournament.name,
          sport: invite.tournament.sport,
        },
        requiresPayment: invite.tournament.entryFee > 0,
        amount: invite.tournament.entryFee,
      },
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}
