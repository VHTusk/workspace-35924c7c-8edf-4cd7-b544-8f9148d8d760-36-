import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/public/watchers/my-tournaments
 * Get all tournaments a spectator is following by email or phone
 * 
 * Query params: email? or phone?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    // Find all watchers with this email or phone
    const watchers = await db.tournamentWatcher.findMany({
      where: {
        OR: [
          { email: email || undefined },
          { phone: phone || undefined },
        ],
        unsubscribedAt: null,
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            sport: true,
            location: true,
            city: true,
            state: true,
            startDate: true,
            endDate: true,
            prizePool: true,
            maxPlayers: true,
            _count: {
              select: { registrations: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data for response
    const tournaments = watchers.map(watcher => ({
      watcherId: watcher.id,
      tournamentId: watcher.tournament.id,
      tournamentName: watcher.tournament.name,
      tournamentStatus: watcher.tournament.status,
      sport: watcher.tournament.sport,
      location: watcher.tournament.location,
      city: watcher.tournament.city,
      state: watcher.tournament.state,
      startDate: watcher.tournament.startDate,
      endDate: watcher.tournament.endDate,
      registeredPlayers: watcher.tournament._count.registrations,
      maxPlayers: watcher.tournament.maxPlayers,
      prizePool: watcher.tournament.prizePool,
      contactMethod: watcher.email ? 'email' : 'phone',
      contactValue: watcher.email || watcher.phone,
      verified: watcher.emailVerified || watcher.phoneVerified,
      subscribedAt: watcher.createdAt,
    }));

    return NextResponse.json({
      success: true,
      tournaments,
      count: tournaments.length,
    });
  } catch (error) {
    console.error('Get my tournaments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
