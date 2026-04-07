import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WaitlistStatus, TournamentStatus } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

// Join tournament waitlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const { id: tournamentId } = await params;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { registrations: true, waitlist: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check tournament is open for registration
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return NextResponse.json(
        { error: 'Tournament is not open for registration' },
        { status: 400 }
      );
    }

    // Check if tournament is full (waitlist only available when full)
    if (tournament._count.registrations < tournament.maxPlayers) {
      return NextResponse.json(
        { error: 'Tournament has available slots. Register directly instead.' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingRegistration = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Already registered for this tournament' },
        { status: 400 }
      );
    }

    // Check if already on waitlist
    const existingWaitlist = await db.tournamentWaitlist.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (existingWaitlist && existingWaitlist.status === WaitlistStatus.WAITING) {
      return NextResponse.json(
        { error: 'Already on waitlist' },
        { status: 400 }
      );
    }

    // Add to waitlist
    const waitlistEntry = await db.tournamentWaitlist.create({
      data: {
        tournamentId,
        userId: user.id,
        status: WaitlistStatus.WAITING,
        position: tournament._count.waitlist + 1,
        expiresAt: null, // No expiry while waiting
      },
    });

    return NextResponse.json({
      success: true,
      waitlist: {
        id: waitlistEntry.id,
        position: waitlistEntry.position,
        status: waitlistEntry.status,
      },
      message: `Added to waitlist at position ${waitlistEntry.position}`,
    });
  } catch (error) {
    console.error('Waitlist join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get waitlist status for tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        waitlist: {
          where: { status: WaitlistStatus.WAITING },
          orderBy: { position: 'asc' },
        },
        _count: { select: { registrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check user's waitlist status
    const auth = await getAuthenticatedUser(request);

    let userWaitlistStatus = null;
    if (auth) {
      const { user } = auth;
      const waitlistEntry = await db.tournamentWaitlist.findUnique({
        where: {
          tournamentId_userId: { tournamentId, userId: user.id },
        },
      });

      if (waitlistEntry) {
        userWaitlistStatus = {
          position: waitlistEntry.position,
          status: waitlistEntry.status,
          promotedAt: waitlistEntry.promotedAt,
          expiresAt: waitlistEntry.expiresAt,
        };
      }
    }

    const waitlistUserIds = tournament.waitlist.map((entry) => entry.userId);
    const waitlistUsers = waitlistUserIds.length
      ? await db.user.findMany({
          where: { id: { in: waitlistUserIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            hiddenElo: true,
          },
        })
      : [];

    const userMap = new Map(waitlistUsers.map((entry) => [entry.id, entry]));

    return NextResponse.json({
      waitlist: tournament.waitlist
        .map((entry) => {
          const waitlistUser = userMap.get(entry.userId);
          if (!waitlistUser) {
            return null;
          }

          return {
            id: entry.id,
            position: entry.position,
            status: entry.status,
            user: {
              id: waitlistUser.id,
              name: `${waitlistUser.firstName} ${waitlistUser.lastName}`,
              city: waitlistUser.city,
              elo: Math.round(waitlistUser.hiddenElo),
            },
            createdAt: entry.createdAt,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      userStatus: userWaitlistStatus,
      spotsAvailable: tournament.maxPlayers - tournament._count.registrations,
      waitlistCount: tournament.waitlist.length,
    });
  } catch (error) {
    console.error('Get waitlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Cancel waitlist entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const { id: tournamentId } = await params;

    // Find and cancel waitlist entry
    const waitlistEntry = await db.tournamentWaitlist.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (!waitlistEntry) {
      return NextResponse.json({ error: 'Not on waitlist' }, { status: 404 });
    }

    // Update status to cancelled
    await db.tournamentWaitlist.update({
      where: { id: waitlistEntry.id },
      data: { status: WaitlistStatus.CANCELLED },
    });

    // Recalculate positions for remaining entries
    const remainingEntries = await db.tournamentWaitlist.findMany({
      where: {
        tournamentId,
        status: WaitlistStatus.WAITING,
        position: { gt: waitlistEntry.position },
      },
      orderBy: { position: 'asc' },
    });

    for (const entry of remainingEntries) {
      await db.tournamentWaitlist.update({
        where: { id: entry.id },
        data: { position: entry.position - 1 },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from waitlist',
    });
  } catch (error) {
    console.error('Cancel waitlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
