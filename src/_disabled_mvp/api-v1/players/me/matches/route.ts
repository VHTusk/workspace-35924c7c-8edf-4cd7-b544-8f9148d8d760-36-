/**
 * V1 Player Matches API
 *
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 *
 * GET /api/v1/players/me/matches
 *
 * Requires: Bearer token or session cookie
 * Supports cursor pagination
 *
 * Query params:
 * - cursor: Base64 encoded cursor
 * - limit: Number of results (default 20, max 50)
 * - result: Filter by result (WIN/LOSS)
 * - status: Filter by status (COMPLETED/IN_PROGRESS/PENDING)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [...],
 *   "meta": {
 *     "nextCursor": "eyJpZCI6ImNse..."},
 *     "hasMore": true
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { MatchStatus } from '@prisma/client';
import { encodeCursor, decodeCursor, MAX_LIMIT } from '@/lib/pagination';

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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const resultFilter = searchParams.get('result');
    const statusFilter = searchParams.get('status') as MatchStatus | null;

    // Build where clause
    const where: Record<string, unknown> = {
      OR: [{ playerAId: user.id }, { playerBId: user.id }],
      tournament: { sport },
    };

    if (statusFilter && Object.values(MatchStatus).includes(statusFilter)) {
      where.status = statusFilter;
    }

    if (resultFilter === 'WIN') {
      where.winnerId = user.id;
    } else if (resultFilter === 'LOSS') {
      where.NOT = { winnerId: user.id };
    }

    // Decode cursor and add cursor filter
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded && decoded.id) {
        // Use id for cursor (matching original behavior)
        where.id = { lt: decoded.id };
      }
    }

    // Get matches with opponent data
    const matches = await db.match.findMany({
      where,
      include: {
        tournament: {
          select: { id: true, name: true, scope: true },
        },
        playerA: {
          select: { id: true, firstName: true, lastName: true, photoUrl: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true, photoUrl: true },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: limit + 1, // Get one extra to check hasMore
    });

    const hasMore = matches.length > limit;
    const results = hasMore ? matches.slice(0, -1) : matches;

    // Generate next cursor
    let nextCursor: string | null = null;
    if (hasMore && results.length > 0) {
      const lastMatch = results[results.length - 1];
      nextCursor = encodeCursor({
        value: lastMatch.playedAt?.toISOString() ?? '',
        id: lastMatch.id,
        field: 'playedAt',
      });
    }

    // Format matches
    const formattedMatches = results.map(match => {
      const isPlayerA = match.playerAId === user.id;
      const opponent = isPlayerA ? match.playerB : match.playerA;
      const playerScore = isPlayerA ? match.scoreA : match.scoreB;
      const opponentScore = isPlayerA ? match.scoreB : match.scoreA;
      const pointsEarned = isPlayerA ? match.pointsA : match.pointsB;
      const eloChange = isPlayerA ? match.eloChangeA : match.eloChangeB;
      const won = match.winnerId === user.id;

      return {
        id: match.id,
        tournament: match.tournament ? {
          id: match.tournament.id,
          name: match.tournament.name,
          scope: match.tournament.scope,
        } : null,
        opponent: opponent ? {
          id: opponent.id,
          name: `${opponent.firstName} ${opponent.lastName}`,
          photoUrl: opponent.photoUrl,
        } : null,
        result: won ? 'WIN' : 'LOSS',
        score: {
          player: playerScore || 0,
          opponent: opponentScore || 0,
          display: `${playerScore || 0}-${opponentScore || 0}`,
        },
        pointsEarned: pointsEarned || 0,
        eloChange: Math.round(eloChange || 0),
        status: match.status,
        playedAt: match.playedAt?.toISOString() || null,
      };
    });

    const response = NextResponse.json({
      success: true,
      data: formattedMatches,
      meta: {
        nextCursor,
        hasMore,
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Player Matches] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch matches',
      undefined,
      500
    );
  }
}
