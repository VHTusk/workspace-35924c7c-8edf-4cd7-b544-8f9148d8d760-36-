/**
 * V1 Live Matches API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/matches/live
 * 
 * Query params:
 * - sport: CORNHOLE or DARTS (required)
 * - tournamentId: Filter by tournament
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "live": [...],
 *     "upcoming": [...],
 *     "recent": [...],
 *     "tournaments": [...]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { SportType } from '@prisma/client';

// Helper function to get tier from Elo
function getTier(elo: number | null): string {
  if (elo === null) return 'BRONZE';
  if (elo >= 2000) return 'DIAMOND';
  if (elo >= 1800) return 'PLATINUM';
  if (elo >= 1600) return 'GOLD';
  if (elo >= 1400) return 'SILVER';
  return 'BRONZE';
}

// Format match for response
function formatMatch(match: {
  id: string;
  tournamentId: string | null;
  player1Id: string;
  player2Id: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  sport: string;
  scheduledTime: Date | null;
  updatedAt: Date;
  tournament?: { id: string; name: string } | null;
  player1?: { id: string; firstName: string | null; lastName: string | null; hiddenElo: number | null } | null;
  player2?: { id: string; firstName: string | null; lastName: string | null; hiddenElo: number | null } | null;
  bracketMatch?: { roundNumber: number; matchNumber: number; court: string | null } | null;
}) {
  return {
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
    playerB: match.player2Id ? {
      id: match.player2Id,
      name: `${match.player2?.firstName || ''} ${match.player2?.lastName || ''}`.trim() || 'TBD',
      tier: getTier(match.player2?.hiddenElo || null),
      score: match.scoreB || 0,
    } : null,
    court: match.bracketMatch?.court || undefined,
    scheduledTime: match.scheduledTime?.toISOString() || undefined,
    status: match.status,
    sport: match.sport,
    updatedAt: match.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const tournamentId = searchParams.get('tournamentId');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Valid sport parameter required',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    // Get current time and time ranges
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const upcomingLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Next 2 hours

    // Build base where clause
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

    // Format tournaments for response
    const formattedTournaments = activeTournaments.map(tournament => ({
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      liveMatches: tournament._count.matches,
      completedMatches: tournament.matches.length,
      totalMatches: tournament.bracket?.matches.length || 0,
    }));

    const response = NextResponse.json({
      success: true,
      data: {
        live: liveMatches.map(formatMatch),
        upcoming: upcomingMatches.map(formatMatch),
        recent: recentResults.map(formatMatch),
        tournaments: formattedTournaments,
        timestamp: now.toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Matches Live] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch live matches',
      undefined,
      500
    );
  }
}
