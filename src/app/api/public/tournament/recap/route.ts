import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RecapResult = {
  rank: number;
  userId: string;
  name: string;
  city: string | null;
  points: number;
  matches: number;
  wins: number;
};

// Public tournament recap - no authentication required
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        location: true,
        city: true,
        state: true,
        startDate: true,
        endDate: true,
        status: true,
        prizePool: true,
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status !== 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Tournament not yet completed',
        tournament,
        results: [],
        stats: { totalParticipants: 0, totalMatches: 0, duration: 'N/A' }
      });
    }

    // Get tournament results from TournamentResult table
    const storedResults = await db.tournamentResult.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, city: true, visiblePoints: true }
        }
      },
      orderBy: { rank: 'asc' },
      take: 50,
    });

    let results: RecapResult[] = storedResults.map((result) => ({
      rank: result.rank,
      userId: result.user.id,
      name: `${result.user.firstName} ${result.user.lastName}`,
      city: result.user.city,
      points: result.bonusPoints,
      matches: 0,
      wins: 0,
    }));

    // If no TournamentResult records, generate results dynamically from matches
    if (storedResults.length === 0) {
      // Get all matches for this tournament
      const matches = await db.match.findMany({
        where: { tournamentId },
        select: {
          playerAId: true,
          playerBId: true,
          winnerId: true,
          scoreA: true,
          scoreB: true,
        }
      });

      // Get all registered players
      const registrations = await db.tournamentRegistration.findMany({
        where: { tournamentId, status: 'CONFIRMED' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, city: true, visiblePoints: true }
          }
        }
      });

      // Calculate stats for each player
      const playerStats: Record<string, { 
        userId: string; 
        name: string; 
        city: string | null; 
        matches: number; 
        wins: number; 
        points: number;
        visiblePoints: number;
      }> = {};

      // Initialize all registered players
      for (const reg of registrations) {
        playerStats[reg.userId] = {
          userId: reg.userId,
          name: `${reg.user.firstName} ${reg.user.lastName}`,
          city: reg.user.city,
          matches: 0,
          wins: 0,
          points: 0,
          visiblePoints: reg.user.visiblePoints,
        };
      }

      // Process matches to calculate stats
      for (const match of matches) {
        if (match.playerAId && playerStats[match.playerAId]) {
          playerStats[match.playerAId].matches++;
          if (match.winnerId === match.playerAId) {
            playerStats[match.playerAId].wins++;
            playerStats[match.playerAId].points += 10; // 10 points per win
          }
        }
        if (match.playerBId && playerStats[match.playerBId]) {
          playerStats[match.playerBId].matches++;
          if (match.winnerId === match.playerBId) {
            playerStats[match.playerBId].wins++;
            playerStats[match.playerBId].points += 10; // 10 points per win
          }
        }
      }

      // Sort by wins, then by points, then by visiblePoints for tie-breaker
      const sortedPlayers = Object.values(playerStats).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.points !== a.points) return b.points - a.points;
        return b.visiblePoints - a.visiblePoints;
      });

      // Format results with rankings
      results = sortedPlayers.map((player, index) => ({
        rank: index + 1,
        userId: player.userId,
        name: player.name,
        city: player.city,
        points: player.points,
        matches: player.matches,
        wins: player.wins,
      }));

      // Award bonus points for top 3 positions
      if (results.length >= 1) {
        results[0].points += Math.floor(tournament.prizePool * 0.5 / 100); // Convert to points
      }
      if (results.length >= 2) {
        results[1].points += Math.floor(tournament.prizePool * 0.3 / 100);
      }
      if (results.length >= 3) {
        results[2].points += Math.floor(tournament.prizePool * 0.2 / 100);
      }
    }

    // Get match count
    const totalMatches = await db.match.count({
      where: { tournamentId }
    });

    // Get participant count
    const registrations = await db.tournamentRegistration.count({
      where: { tournamentId, status: 'CONFIRMED' }
    });

    // Calculate duration
    let duration = '1 day';
    if (tournament.endDate) {
      const start = new Date(tournament.startDate);
      const end = new Date(tournament.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      duration = days === 1 ? '1 day' : `${days} days`;
    }

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        scope: tournament.scope || 'NATIONAL',
        location: tournament.location,
        city: tournament.city,
        state: tournament.state,
        startDate: tournament.startDate.toISOString(),
        endDate: tournament.endDate?.toISOString() || tournament.startDate.toISOString(),
        status: tournament.status,
        prizePool: tournament.prizePool,
      },
      results,
      stats: {
        totalParticipants: registrations,
        totalMatches,
        duration,
      }
    });
  } catch (error) {
    console.error('Error fetching tournament recap:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
