import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// GET /api/player/events - Get player's upcoming events
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session (properly hashes token before lookup)
    const session = await validateSession(sessionToken);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const sport = session.user.sport;
    const now = new Date();

    // Get registered tournaments (upcoming)
    const registrations = await db.tournamentRegistration.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
        tournament: {
          sport,
          status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED'] },
        },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            location: true,
            city: true,
            state: true,
            type: true,
          },
        },
      },
      orderBy: {
        tournament: { startDate: 'asc' },
      },
    });

    // Get active tournaments with matches
    const activeRegistrations = await db.tournamentRegistration.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
        tournament: {
          sport,
          status: 'IN_PROGRESS',
        },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            location: true,
            city: true,
            state: true,
          },
        },
      },
    });

    // Get upcoming matches for active tournaments
    const upcomingMatches = await db.match.findMany({
      where: {
        OR: [{ playerAId: userId }, { playerBId: userId }],
        tournament: { sport },
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      include: {
        tournament: { select: { id: true, name: true } },
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledTime: 'asc' },
      take: 10,
    });

    // Get check-in status
    const checkins = await db.tournamentCheckin.findMany({
      where: {
        userId,
        tournament: { sport },
      },
      select: {
        tournamentId: true,
        checkedInAt: true,
      },
    });

    const checkinStatus: Record<string, boolean> = {};
    for (const c of checkins) {
      checkinStatus[c.tournamentId] = !!c.checkedInAt;
    }

    // Build events array
    const events: Array<{
      id: string;
      type: 'tournament' | 'match' | 'checkin';
      title: string;
      date: string;
      time: string;
      location: string;
      city: string;
      state: string;
      status: string;
      tournamentId: string;
      matchId?: string;
      opponent?: string;
      court?: string;
      requiresCheckin: boolean;
      checkedIn: boolean;
    }> = [];

    // Add tournament events
    for (const reg of registrations) {
      const t = reg.tournament;
      const tournamentDate = new Date(t.startDate);
      
      events.push({
        id: `t-${t.id}`,
        type: 'tournament',
        title: t.name,
        date: t.startDate.toISOString().split('T')[0],
        time: '09:00 AM', // Default start time
        location: t.location || '',
        city: t.city || '',
        state: t.state || '',
        status: t.status,
        tournamentId: t.id,
        requiresCheckin: tournamentDate > now,
        checkedIn: checkinStatus[t.id] || false,
      });

      // Add check-in reminder event (1 hour before)
      if (t.status === 'REGISTRATION_OPEN' || t.status === 'REGISTRATION_CLOSED') {
        const checkinDate = new Date(t.startDate);
        checkinDate.setHours(checkinDate.getHours() - 1);
        
        if (checkinDate > now) {
          events.push({
            id: `c-${t.id}`,
            type: 'checkin',
            title: `Check-in Opens: ${t.name}`,
            date: checkinDate.toISOString().split('T')[0],
            time: checkinDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            location: t.location || '',
            city: t.city || '',
            state: t.state || '',
            status: 'UPCOMING',
            tournamentId: t.id,
            requiresCheckin: true,
            checkedIn: checkinStatus[t.id] || false,
          });
        }
      }
    }

    // Add match events
    for (const match of upcomingMatches) {
      const isPlayerA = match.playerAId === userId;
      const opponent = isPlayerA ? match.playerB : match.playerA;
      const scheduledTime = match.scheduledTime || match.tournament.startDate;

      events.push({
        id: `m-${match.id}`,
        type: 'match',
        title: `${match.tournament.name} - ${match.round ? `Round ${match.round}` : 'Match'}`,
        date: scheduledTime.toISOString().split('T')[0],
        time: scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        location: match.court || '',
        city: '',
        state: '',
        status: match.status,
        tournamentId: match.tournamentId,
        matchId: match.id,
        opponent: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'TBD',
        court: match.court || undefined,
        requiresCheckin: true,
        checkedIn: checkinStatus[match.tournamentId] || false,
      });
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get today's events
    const today = now.toISOString().split('T')[0];
    const todayEvents = events.filter(e => e.date === today);

    return NextResponse.json({
      events,
      todayEvents,
      upcoming: events.filter(e => new Date(e.date) >= now),
      totalUpcoming: events.filter(e => new Date(e.date) >= now).length,
    });

  } catch (error) {
    console.error('Error fetching player events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
