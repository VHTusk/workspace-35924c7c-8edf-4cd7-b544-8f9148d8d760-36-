/**
 * V1 Update User Profile API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * PATCH /api/v1/users/me/profile
 * 
 * Requires: Bearer token or session cookie
 * 
 * Request body:
 * {
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "bio": "Player bio",
 *   "city": "Mumbai",
 *   "state": "Maharashtra",
 *   ...
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_id",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { getCDNUrl } from '@/lib/cdn-url';

// Allowed fields for profile update
const ALLOWED_FIELDS = [
  'firstName',
  'lastName',
  'bio',
  'city',
  'district',
  'state',
  'address',
  'pinCode',
  'gender',
  'language',
  'profileVisibility',
  'showRealName',
  'showLocation',
  'showOnLeaderboard',
  'hideElo',
  'showPhone',
  'showEmail',
  'showTournamentHistory',
  'allowFriendRequestsFrom',
  'allowMessagesFrom',
  'showProfessionPublicly',
] as const;

export async function PATCH(request: NextRequest) {
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

    const { user } = auth;
    const body = await request.json();

    // Filter to only allowed fields
    const updateData: Record<string, unknown> = {};
    const unknownFields: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key as typeof ALLOWED_FIELDS[number])) {
        updateData[key] = value;
      } else {
        unknownFields.push(key);
      }
    }

    if (unknownFields.length > 0) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Unknown fields in request',
        { unknownFields }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'No valid fields to update',
        { allowedFields: ALLOWED_FIELDS }
      );
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        sport: true,
        city: true,
        district: true,
        state: true,
        address: true,
        pinCode: true,
        photoUrl: true,
        bio: true,
        gender: true,
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
        updatedAt: true,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        sport: updatedUser.sport,
        location: {
          city: updatedUser.city,
          district: updatedUser.district,
          state: updatedUser.state,
          address: updatedUser.address,
          pinCode: updatedUser.pinCode,
        },
        photoUrl: getCDNUrl(updatedUser.photoUrl),
        bio: updatedUser.bio,
        gender: updatedUser.gender,
        language: updatedUser.language,
        preferences: {
          profileVisibility: updatedUser.profileVisibility,
          showRealName: updatedUser.showRealName,
          showLocation: updatedUser.showLocation,
          showOnLeaderboard: updatedUser.showOnLeaderboard,
          hideElo: updatedUser.hideElo,
          showPhone: updatedUser.showPhone,
          showEmail: updatedUser.showEmail,
          showTournamentHistory: updatedUser.showTournamentHistory,
          allowFriendRequestsFrom: updatedUser.allowFriendRequestsFrom,
          allowMessagesFrom: updatedUser.allowMessagesFrom,
        },
        updatedAt: updatedUser.updatedAt.toISOString(),
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
    console.error('[V1 Users Me Profile] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to update profile',
      undefined,
      500
    );
  }
}
