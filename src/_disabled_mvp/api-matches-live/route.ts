import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/matches/live
 * 
 * Returns live, upcoming, and recent matches for the live ticker
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'CORNHOLE';
    const tournamentId = searchParams.get('tournamentId');

    // Get current time and time ranges
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const upcomingLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Next 2 hours

    // Build where clause
    const baseWhere: Record<string, unknown> = {
      sport: sport as 'CORNHOLE' | 'DARTS',
    };

    if (tournamentId) {
      baseWhere.tournamentId = tournamentId;
    }

    // Fetch live matches (IN_PROGRESS status, tournament IN_PROGRESS)
    const liveMatches = await db.match.findMany({
      where: {
        ...baseWhere,
        status: 'IN_PROGRESS',
        tournament: {
          status: 'IN_PROGRESS',
        },
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        player1: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        player2: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        bracketMatch: {
          select: { roundNumber: true, matchNumber: true, court: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    // Fetch upcoming matches (PENDING status, scheduled within next 2 hours)
    const upcomingMatches = await db.match.findMany({
      where: {
        ...baseWhere,
        status: 'PENDING',
        scheduledTime: {
          gte: now,
          lte: upcomingLimit,
        },
        tournament: {
          status: 'IN_PROGRESS',
        },
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        player1: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        player2: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        bracketMatch: {
          select: { roundNumber: true, matchNumber: true, court: true },
        },
      },
      orderBy: { scheduledTime: 'asc' },
      take: 20,
    });

    // Fetch recent results (COMPLETED today)
    const recentResults = await db.match.findMany({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        updatedAt: {
          gte: todayStart,
        },
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        player1: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        player2: {
          select: { id: true, firstName: true, lastName: true, hiddenElo: true },
        },
        bracketMatch: {
          select: { roundNumber: true, matchNumber: true, court: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    // Get active tournaments with match counts
    const activeTournaments = await db.tournament.findMany({
      where: {
        sport: sport as 'CORNHOLE' | 'DARTS',
        status: 'IN_PROGRESS',
        ...(tournamentId ? { id: tournamentId } : {}),
      },
      include: {
        _count: {
          select: {
            matches: {
              where: { status: 'IN_PROGRESS' },
            },
          },
        },
        matches: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
        bracket: {
          select: { 
            matches: {
              select: { id: true },
            },
          },
        },
      },
      take: 10,
    });

    // Helper function to get tier from Elo
    const getTier = (elo: number | null): string => {
      if (elo === null) return 'BRONZE';
      if (elo >= 2000) return 'DIAMOND';
      if (elo >= 1800) return 'PLATINUM';
      if (elo >= 1600) return 'GOLD';
      if (elo >= 1400) return 'SILVER';
      return 'BRONZE';
    };

    // Format matches for response
    const formatMatch = (match: typeof liveMatches[0]) => ({
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament?.name || 'Unknown Tournament',
      roundNumber: match.bracketMatch?.roundNumber || 1,
      matchNumber: match.bracketMatch?.matchNumber || 1,
      playerA: {
        id: match.player1Id,
        name: `${match.player1?.firstName || ''} ${match.player1?.lastName || ''}`.trim() || 'TBD',
        tier: getTier(match.player1?.hiddenElo || null),
        score: match.scoreA || 0,
      },
      playerB: {
        id: match.player2Id,
        name: `${match.player2?.firstName || ''} ${match.player2?.lastName || ''}`.trim() || 'TBD',
        tier: getTier(match.player2?.hiddenElo || null),
        score: match.scoreB || 0,
      },
      court: match.bracketMatch?.court || undefined,
      scheduledTime: match.scheduledTime?.toISOString() || undefined,
      status: match.status,
      sport: match.sport,
      updatedAt: match.updatedAt.toISOString(),
    });

    // Format tournaments for response
    const formatTournament = (tournament: typeof activeTournaments[0]) => ({
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      liveMatches: tournament._count.matches,
      completedMatches: tournament.matches.length,
      totalMatches: tournament.bracket?.matches.length || 0,
    });

    return NextResponse.json({
      live: liveMatches.map(formatMatch),
      upcoming: upcomingMatches.map(formatMatch),
      recent: recentResults.map(formatMatch),
      tournaments: activeTournaments.map(formatTournament),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live matches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
