/**
 * V1 Current Player Profile API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/players/me
 * 
 * Requires: Bearer token or session cookie
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "player_id",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { getCDNUrl } from '@/lib/cdn-url';

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

    // Get full user data
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        sport: true,
        role: true,
        accountTier: true,
        city: true,
        district: true,
        state: true,
        address: true,
        pinCode: true,
        photoUrl: true,
        bio: true,
        gender: true,
        dob: true,
        verified: true,
        emailVerified: true,
        phoneVerified: true,
        language: true,
        profileVisibility: true,
        showRealName: true,
        showLocation: true,
        showOnLeaderboard: true,
        hideElo: true,
        showPhone: true,
        showEmail: true,
        showTournamentHistory: true,
        allowFriendRequestsFrom: true,
        allowMessagesFrom: true,
        profession: true,
        showProfessionPublicly: true,
        professionVerified: true,
        professionMembershipNumber: true,
        playerOrgType: true,
        verificationStatus: true,
        createdAt: true,
        rating: {
          select: {
            sport: true,
            hiddenElo: true,
            visiblePoints: true,
            tier: true,
            wins: true,
            losses: true,
            matchesPlayed: true,
            currentStreak: true,
            bestStreak: true,
          },
        },
        _count: {
          select: {
            matchesAsA: true,
            matchesAsB: true,
            tournamentRegs: true,
            followers: true,
            following: true,
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            tier: true,
            status: true,
            currentPeriodEnd: true,
          },
          take: 1,
        },
      },
    });

    if (!fullUser) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'User not found',
        undefined,
        404
      );
    }

    // Calculate total matches
    const totalMatches = fullUser._count.matchesAsA + fullUser._count.matchesAsB;

    // Get rating data
    const rating = fullUser.rating?.[0];
    const activeSubscription = fullUser.subscriptions[0];

    const response = NextResponse.json({
      success: true,
      data: {
        id: fullUser.id,
        email: fullUser.email,
        phone: fullUser.phone,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        fullName: `${fullUser.firstName} ${fullUser.lastName}`,
        sport: fullUser.sport,
        role: fullUser.role,
        accountTier: fullUser.accountTier,
        location: {
          city: fullUser.city,
          district: fullUser.district,
          state: fullUser.state,
          address: fullUser.address,
          pinCode: fullUser.pinCode,
        },
        photoUrl: getCDNUrl(fullUser.photoUrl),
        bio: fullUser.bio,
        gender: fullUser.gender,
        dateOfBirth: fullUser.dob?.toISOString() || null,
        verification: {
          email: fullUser.emailVerified,
          phone: fullUser.phoneVerified,
          overall: fullUser.verified,
        },
        preferences: {
          language: fullUser.language,
          profileVisibility: fullUser.profileVisibility,
          showRealName: fullUser.showRealName,
          showLocation: fullUser.showLocation,
          showOnLeaderboard: fullUser.showOnLeaderboard,
          hideElo: fullUser.hideElo,
          showPhone: fullUser.showPhone,
          showEmail: fullUser.showEmail,
          showTournamentHistory: fullUser.showTournamentHistory,
          allowFriendRequestsFrom: fullUser.allowFriendRequestsFrom,
          allowMessagesFrom: fullUser.allowMessagesFrom,
        },
        profession: fullUser.profession ? {
          type: fullUser.profession,
          showPublicly: fullUser.showProfessionPublicly,
          verified: fullUser.professionVerified === 'VERIFIED',
          membershipNumber: fullUser.professionMembershipNumber,
        } : null,
        organization: fullUser.playerOrgType !== 'INDEPENDENT' ? {
          type: fullUser.playerOrgType,
          verificationStatus: fullUser.verificationStatus,
        } : null,
        stats: {
          matchesPlayed: totalMatches,
          tournaments: fullUser._count.tournamentRegs,
          followers: fullUser._count.followers,
          following: fullUser._count.following,
        },
        rating: rating ? {
          sport: rating.sport,
          points: rating.visiblePoints,
          elo: rating.hiddenElo,
          tier: rating.tier,
          wins: rating.wins,
          losses: rating.losses,
          winRate: rating.matchesPlayed > 0
            ? Math.round((rating.wins / rating.matchesPlayed) * 100)
            : 0,
          currentStreak: rating.currentStreak,
          bestStreak: rating.bestStreak,
        } : null,
        subscription: activeSubscription ? {
          id: activeSubscription.id,
          tier: activeSubscription.tier,
          status: activeSubscription.status,
          currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() || null,
        } : null,
        session: {
          sport: session.sport,
          accountType: session.accountType,
          expiresAt: session.expiresAt.toISOString(),
        },
        memberSince: fullUser.createdAt.toISOString(),
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
    console.error('[V1 Player Me] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch profile',
      undefined,
      500
    );
  }
}
