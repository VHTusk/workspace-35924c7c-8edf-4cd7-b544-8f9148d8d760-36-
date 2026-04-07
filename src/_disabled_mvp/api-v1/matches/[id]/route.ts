/**
 * V1 Match by ID API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/matches/:id
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "match_id",
 *     "tournament": { ... },
 *     "players": { ... },
 *     "score": { ... },
 *     "status": "...",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getCDNUrl } from '@/lib/cdn-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const match = await db.match.findUnique({
      where: { id },
      select: {
        id: true,
        sport: true,
        status: true,
        scheduledTime: true,
        playedAt: true,
        scoreA: true,
        scoreB: true,
        winnerId: true,
        outcome: true,
        eloChangeA: true,
        eloChangeB: true,
        pointsA: true,
        pointsB: true,
        court: true,
        roundNumber: true,
        matchNumber: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
        playerA: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            hiddenElo: true,
            visiblePoints: true,
          },
        },
        playerB: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            hiddenElo: true,
            visiblePoints: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            scope: true,
            status: true,
            city: true,
            state: true,
            location: true,
          },
        },
        bracketMatch: {
          select: {
            id: true,
            roundNumber: true,
            matchNumber: true,
            status: true,
          },
        },
      },
    });

    if (!match) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'Match not found',
        { id },
        404
      );
    }

    // Determine winner
    let winner = null;
    if (match.winnerId) {
      winner = match.winnerId === match.playerAId ? match.playerA : match.playerB;
    }

    const response = NextResponse.json({
      success: true,
      data: {
        id: match.id,
        sport: match.sport,
        status: match.status,
        tournament: match.tournament ? {
          id: match.tournament.id,
          name: match.tournament.name,
          scope: match.tournament.scope,
          status: match.tournament.status,
          location: {
            city: match.tournament.city,
            state: match.tournament.state,
            venue: match.tournament.location,
          },
        } : null,
        players: {
          playerA: match.playerA ? {
            id: match.playerA.id,
            name: `${match.playerA.firstName} ${match.playerA.lastName}`,
            photoUrl: getCDNUrl(match.playerA.photoUrl),
            elo: match.playerA.hiddenElo,
            points: match.playerA.visiblePoints,
          } : null,
          playerB: match.playerB ? {
            id: match.playerB.id,
            name: `${match.playerB.firstName} ${match.playerB.lastName}`,
            photoUrl: getCDNUrl(match.playerB.photoUrl),
            elo: match.playerB.hiddenElo,
            points: match.playerB.visiblePoints,
          } : null,
        },
        score: {
          playerA: match.scoreA,
          playerB: match.scoreB,
          display: match.scoreA !== null && match.scoreB !== null 
            ? `${match.scoreA}-${match.scoreB}` 
            : null,
        },
        result: match.winnerId ? {
          winnerId: match.winnerId,
          winner: winner ? {
            id: winner.id,
            name: `${winner.firstName} ${winner.lastName}`,
          } : null,
          outcome: match.outcome,
        } : null,
        rating: {
          eloChangeA: match.eloChangeA,
          eloChangeB: match.eloChangeB,
          pointsA: match.pointsA,
          pointsB: match.pointsB,
        },
        schedule: {
          scheduledTime: match.scheduledTime?.toISOString() || null,
          playedAt: match.playedAt?.toISOString() || null,
        },
        venue: {
          court: match.court,
        },
        bracket: match.bracketMatch ? {
          roundNumber: match.bracketMatch.roundNumber,
          matchNumber: match.bracketMatch.matchNumber,
          status: match.bracketMatch.status,
        } : null,
        roundNumber: match.roundNumber,
        matchNumber: match.matchNumber,
        verificationStatus: match.verificationStatus,
        createdAt: match.createdAt.toISOString(),
        updatedAt: match.updatedAt.toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    // Add v1 headers
    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Match] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch match',
      undefined,
      500
    );
  }
}
