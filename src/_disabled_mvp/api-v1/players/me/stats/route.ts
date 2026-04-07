/**
 * V1 Player Stats API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/players/me/stats
 * 
 * Requires: Bearer token or session cookie
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "points": { ... },
 *     "rank": { ... },
 *     "matches": { ... },
 *     "tournaments": { ... },
 *     "streaks": { ... }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user, session } = auth;
    const sport = session.sport;

    // Get player's rating/stats
    const rating = await db.sportStats.findUnique({
      where: {
        userId_sport: {
          userId: user.id,
          sport,
        },
      },
    });

    // Get total matches
    const totalMatches = await db.match.count({
      where: {
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
        tournament: { sport },
      },
    });

    // Get tournament stats
    const tournamentsPlayed = await db.tournamentRegistration.count({
      where: {
        userId: user.id,
        tournament: { sport },
        status: 'CONFIRMED',
      },
    });

    const tournamentWins = await db.tournamentResult.count({
      where: {
        userId: user.id,
        rank: 1,
        tournament: { sport },
      },
    });

    const podiumFinishes = await db.tournamentResult.count({
      where: {
        userId: user.id,
        rank: { lte: 3 },
        tournament: { sport },
      },
    });

    // Calculate rank
    const totalPlayers = await db.sportStats.count({
      where: {
        sport,
        user: { isActive: true },
      },
    });

    const playersWithHigherPoints = await db.sportStats.count({
      where: {
        sport,
        user: { isActive: true },
        visiblePoints: { gt: rating?.visiblePoints || 0 },
      },
    });

    const rank = playersWithHigherPoints + 1;

    // Determine tier
    const elo = rating?.hiddenElo || 1200;
    let tier = 'BRONZE';
    let tierProgress = 0;
    
    if (elo >= 1900) {
      tier = 'DIAMOND';
      tierProgress = 100;
    } else if (elo >= 1700) {
      tier = 'PLATINUM';
      tierProgress = ((elo - 1700) / 200) * 100;
    } else if (elo >= 1500) {
      tier = 'GOLD';
      tierProgress = ((elo - 1500) / 200) * 100;
    } else if (elo >= 1300) {
      tier = 'SILVER';
      tierProgress = ((elo - 1300) / 200) * 100;
    } else {
      tierProgress = ((elo - 1000) / 300) * 100;
    }

    // Get recent matches for form
    const recentMatches = await db.match.findMany({
      where: {
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
        tournament: { sport },
        status: 'COMPLETED',
      },
      select: { winnerId: true },
      orderBy: { playedAt: 'desc' },
      take: 5,
    });

    const form = recentMatches.map(m => m.winnerId === user.id ? 'W' : 'L');

    const response = NextResponse.json({
      success: true,
      data: {
        points: {
          current: rating?.visiblePoints || 0,
          elo: Math.round(elo),
          tier,
          tierProgress: Math.round(tierProgress),
        },
        rank: {
          current: rank,
          total: totalPlayers,
          percentile: totalPlayers > 0 
            ? Math.round((1 - (rank - 1) / totalPlayers) * 100) 
            : 0,
        },
        matches: {
          played: rating?.matchesPlayed || 0,
          wins: rating?.wins || 0,
          losses: rating?.losses || 0,
          winRate: rating?.matchesPlayed 
            ? Math.round((rating.wins / rating.matchesPlayed) * 100) 
            : 0,
          total: totalMatches,
        },
        tournaments: {
          played: tournamentsPlayed,
          wins: tournamentWins,
          podiums: podiumFinishes,
        },
        streaks: {
          current: rating?.currentStreak || 0,
          best: rating?.bestStreak || 0,
        },
        form,
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
    console.error('[V1 Player Stats] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch player stats',
      undefined,
      500
    );
  }
}
