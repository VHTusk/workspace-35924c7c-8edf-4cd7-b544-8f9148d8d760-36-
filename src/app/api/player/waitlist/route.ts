import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

/**
 * GET /api/player/waitlist
 * Get all waitlist entries for the current player
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findFirst({
      where: {
        token: sessionToken,
        accountType: 'PLAYER',
        expiresAt: { gte: new Date() },
      },
    });

    if (!session?.userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    // Get all waitlist entries for the user
    const waitlistEntries = await db.tournamentWaitlist.findMany({
      where: {
        userId: session.userId,
        status: 'WAITING',
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            startDate: true,
            location: true,
            maxPlayers: true,
            status: true,
            _count: {
              select: { registrations: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get total waitlist size for each tournament
    const entriesWithStats = await Promise.all(
      waitlistEntries.map(async (entry) => {
        const totalWaitlist = await db.tournamentWaitlist.count({
          where: {
            tournamentId: entry.tournamentId,
            status: 'WAITING',
          },
        });

        return {
          ...entry,
          totalWaitlist,
          spotsFilled: entry.tournament._count.registrations,
          spotsLeft: entry.tournament.maxPlayers - entry.tournament._count.registrations,
        };
      })
    );

    return NextResponse.json({ waitlist: entriesWithStats });
  } catch (error) {
    console.error('Get player waitlist error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waitlist' },
      { status: 500 }
    );
  }
}
