/**
 * V1 User Profile API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/users/[id]
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_id",
 *     "name": "John Doe",
 *     "photoUrl": "https://...",
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
    const { id: userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        district: true,
        state: true,
        sport: true,
        photoUrl: true,
        bio: true,
        showOnLeaderboard: true,
        showRealName: true,
        showLocation: true,
        hideElo: true,
        verified: true,
        profession: true,
        showProfessionPublicly: true,
        professionVerified: true,
        playerOrgType: true,
        createdAt: true,
        rating: {
          select: {
            sport: true,
            visiblePoints: true,
            hiddenElo: true,
            tier: true,
            wins: true,
            losses: true,
            matchesPlayed: true,
            currentStreak: true,
            bestStreak: true,
            tournamentsPlayed: true,
            tournamentsWon: true,
            highestElo: true,
          }
        },
        _count: {
          select: {
            matchesAsA: true,
            matchesAsB: true,
            tournamentRegs: true,
            followers: true,
            following: true,
          }
        }
      }
    });

    if (!user) {
      return apiError(
        ApiErrorCodes.PLAYER_NOT_FOUND,
        'User not found',
        undefined,
        404
      );
    }

    // Check privacy settings
    if (!user.showOnLeaderboard) {
      return apiError(
        ApiErrorCodes.FORBIDDEN,
        'This profile is private',
        undefined,
        403
      );
    }

    const totalMatches = user._count.matchesAsA + user._count.matchesAsB;
    const rating = user.rating?.[0];
    const winRate = rating && rating.matchesPlayed > 0
      ? Math.round((rating.wins / rating.matchesPlayed) * 100)
      : 0;

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.showRealName 
          ? `${user.firstName} ${user.lastName}` 
          : `Player ${user.id.slice(0, 8)}`,
        photoUrl: getCDNUrl(user.photoUrl),
        bio: user.bio,
        location: user.showLocation ? {
          city: user.city,
          district: user.district,
          state: user.state,
        } : null,
        sport: user.sport,
        verified: user.verified,
        profession: user.showProfessionPublicly && user.profession ? {
          type: user.profession,
          verified: user.professionVerified === 'VERIFIED',
        } : null,
        organization: user.playerOrgType !== 'INDEPENDENT' ? {
          type: user.playerOrgType,
        } : null,
        stats: {
          matchesPlayed: totalMatches,
          tournaments: user._count.tournamentRegs,
          followers: user._count.followers,
          following: user._count.following,
        },
        rating: rating ? {
          points: rating.visiblePoints,
          elo: user.hideElo ? null : Math.round(rating.hiddenElo),
          tier: rating.tier,
          wins: rating.wins,
          losses: rating.losses,
          winRate,
          currentStreak: rating.currentStreak,
          bestStreak: rating.bestStreak,
          tournamentsPlayed: rating.tournamentsPlayed,
          tournamentsWon: rating.tournamentsWon,
        } : null,
        memberSince: user.createdAt.toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      }
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error) {
    console.error('[V1 User Profile] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch user profile',
      undefined,
      500
    );
  }
}
