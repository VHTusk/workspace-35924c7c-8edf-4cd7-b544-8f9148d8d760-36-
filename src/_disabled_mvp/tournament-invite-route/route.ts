/**
 * Tournament Invitation API
 * POST /api/tournaments/[id]/invite - Generate tournament invite link
 * GET /api/tournaments/[id]/invite - Get invite link details
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import {
  generateTournamentInviteLink,
} from '@/lib/tournament-invite';

// POST - Generate invite link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { type = 'DIRECT', teamId, orgId, customMessage, expiresInDays } = body;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Verify tournament exists and user can invite
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        maxPlayers: true,
        registrations: { select: { id: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if tournament is open for registration
    if (!['REGISTRATION_OPEN', 'DRAFT'].includes(tournament.status)) {
      return NextResponse.json(
        { error: 'Tournament is not accepting registrations' },
        { status: 400 }
      );
    }

    // Generate invite link
    const invite = await generateTournamentInviteLink({
      tournamentId,
      inviterId: userId,
      type,
      teamId,
      orgId,
      customMessage,
      expiresInDays,
    });

    return NextResponse.json({
      success: true,
      data: invite,
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    return NextResponse.json(
      { error: 'Failed to generate invite link' },
      { status: 500 }
    );
  }
}

// GET - Get invite stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const inviterId = searchParams.get('inviterId');

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invite statistics
    const invites = await db.tournamentInvite.findMany({
      where: {
        tournamentId,
        inviterId: inviterId || session.user.id,
      },
      include: {
        registrations: {
          select: {
            id: true,
            userId: true,
            user: { select: { firstName: true, lastName: true } },
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalInvites: invites.length,
      totalClicks: invites.reduce((sum, i) => sum + (i.clickCount || 0), 0),
      totalRegistrations: invites.reduce((sum, i) => sum + (i.registrationCount || 0), 0),
      invites: invites.map(invite => ({
        code: invite.id,
        type: invite.type,
        status: invite.status,
        clicks: invite.clickCount,
        registrations: invite.registrationCount,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        recentRegistrations: invite.registrations?.slice(0, 5).map((r: { id: string; user: { firstName: string; lastName: string }; createdAt: Date }) => ({
          id: r.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          registeredAt: r.createdAt,
        })),
      })),
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching invite stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invite stats' },
      { status: 500 }
    );
  }
}
