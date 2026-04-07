/**
 * V1 Auth Register API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/auth/register
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "phone": "+919876543210",
 *   "password": "password123",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "sport": "CORNHOLE" | "DARTS"
 * }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createUser, createSession } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, firstName, lastName, sport } = body;

    // Validate required fields
    if (!firstName || !lastName || !sport) {
      return apiError(
        ApiErrorCodes.MISSING_FIELD,
        'Missing required fields',
        { required: ['firstName', 'lastName', 'sport'] }
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

    // Check if user already exists
    const existingUser = email
      ? await db.user.findUnique({
          where: { email_sport: { email, sport } },
        })
      : await db.user.findUnique({
          where: { phone_sport: { phone, sport } },
        });

    if (existingUser) {
      return apiError(
        ApiErrorCodes.ALREADY_EXISTS,
        'An account with this email/phone already exists for this sport',
        { field: email ? 'email' : 'phone' }
      );
    }

    // Create user
    const user = await createUser({
      email,
      phone,
      password,
      firstName,
      lastName,
      sport,
    });

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
    console.error('[V1 Auth] Register error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'An error occurred during registration',
      undefined,
      500
    );
  }
}
