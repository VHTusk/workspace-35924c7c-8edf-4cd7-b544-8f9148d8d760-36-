/**
 * V1 Auth Login API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/login
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "phone": "+919876543210",
 *   "password": "password123",
 *   "sport": "CORNHOLE" | "DARTS"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "token": "session_token_here",
 *     "user": { ... },
 *     "expiresAt": "2025-01-08T00:00:00.000Z"
 *   }
 * }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, sport } = body;

    // Validate required fields
    if (!password || !sport) {
      return apiError(
        ApiErrorCodes.MISSING_FIELD,
        'Password and sport are required',
        { required: ['password', 'sport'] }
      );
    }

    if (!email && !phone) {
      return apiError(
        ApiErrorCodes.MISSING_FIELD,
        'Either email or phone is required',
        { required: ['email', 'phone'] }
      );
    }

    // Validate sport
    if (!['CORNHOLE', 'DARTS'].includes(sport)) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Invalid sport. Must be CORNHOLE or DARTS',
        { allowed: ['CORNHOLE', 'DARTS'] }
      );
    }

    // Find user by email or phone
    const user = email
      ? await db.user.findUnique({
          where: { email_sport: { email, sport } },
        })
      : await db.user.findUnique({
          where: { phone_sport: { phone, sport } },
        });

    if (!user) {
      return apiError(
        ApiErrorCodes.INVALID_CREDENTIALS,
        'Invalid email/phone or password'
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password || '');
    if (!isValid) {
      return apiError(
        ApiErrorCodes.INVALID_CREDENTIALS,
        'Invalid email/phone or password'
      );
    }

    // Create session
    const session = await createSession(user.id, sport);

    return apiSuccess({
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        sport: user.sport,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('[V1 Auth] Login error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'An error occurred during login',
      undefined,
      500
    );
  }
}
