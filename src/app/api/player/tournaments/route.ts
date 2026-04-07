import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// GET /api/player/tournaments - Get player's tournaments
export async function GET(request: NextRequest) {
  try {
    // Get session from cookie
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
    const sport = session.sport; // Sport is on session, not user

    // Get tournament registrations for the user
    // FIXED: Use 'registeredAt' instead of 'createdAt' (schema uses registeredAt)
    const registrations = await db.tournamentRegistration.findMany({
      where: {
        userId,
        tournament: { sport },
      },
      include: {
        tournament: {
          include: {
            _count: {
              select: { registrations: true },
            },
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',  // FIXED: was 'createdAt' which doesn't exist
      },
    });

    // Categorize tournaments by status
    const upcoming: typeof registrations = [];
    const active: typeof registrations = [];
    const completed: typeof registrations = [];

    for (const reg of registrations) {
      const t = reg.tournament;
      
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
        completed.push(reg);
      } else if (t.status === 'IN_PROGRESS') {
        active.push(reg);
      } else {
        upcoming.push(reg);
      }
    }

    // Get match results for stats
    // FIXED: Match model doesn't have 'status' field - use winnerId to determine completed matches
    const matches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
        tournament: { sport },
        winnerId: { not: null },  // FIXED: Match has no status, use winnerId to find completed matches
      },
      select: {
        tournamentId: true,
        winnerId: true,
      },
    });

    // Calculate match stats per tournament
    const tournamentStats: Record<string, { played: number; won: number }> = {};
    
    for (const match of matches) {
      const tid = match.tournamentId;
      if (!tid) continue;
      
      if (!tournamentStats[tid]) {
        tournamentStats[tid] = { played: 0, won: 0 };
      }
      tournamentStats[tid].played++;
      
      if (match.winnerId === userId) {
        tournamentStats[tid].won++;
      }
    }

    // Get tournament results for final rankings
    // FIXED: TournamentResult has 'rank' field, not 'position'
    const results = await db.tournamentResult.findMany({
      where: { userId, sport },
      select: {
        tournamentId: true,
        rank: true,  // FIXED: was 'position' which doesn't exist
      },
    });

    const finalRanks: Record<string, number> = {};
    for (const r of results) {
      finalRanks[r.tournamentId] = r.rank;  // FIXED: was r.position
    }

    // Format response
    const formatTournament = (reg: typeof registrations[0]) => ({
      id: reg.tournament.id,
      name: reg.tournament.name,
      status: reg.tournament.status,
      startDate: reg.tournament.startDate,
      endDate: reg.tournament.endDate,
      location: reg.tournament.location,
      city: reg.tournament.city,
      state: reg.tournament.state,
      type: reg.tournament.type,
      scope: reg.tournament.scope,
      maxPlayers: reg.tournament.maxPlayers,
      registeredPlayers: reg.tournament._count.registrations,
      entryFee: reg.tournament.entryFee,
      registrationId: reg.id,
      registrationStatus: reg.status,
      registrationDate: reg.registeredAt,  // FIXED: was reg.createdAt
      matchesPlayed: tournamentStats[reg.tournamentId]?.played || 0,
      matchesWon: tournamentStats[reg.tournamentId]?.won || 0,
      finalRank: finalRanks[reg.tournamentId] || null,
    });

    return NextResponse.json({
      upcoming: upcoming.map(formatTournament),
      active: active.map(formatTournament),
      completed: completed.map(formatTournament),
      total: registrations.length,
    });

  } catch (error) {
    console.error('Error fetching player tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}
