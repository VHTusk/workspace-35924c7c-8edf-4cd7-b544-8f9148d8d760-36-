/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email?token=xxx
 * 
 * Verifies a user's email address using the verification token sent to their email.
 * On success, redirects to the login page with a success message.
 * On failure, redirects to the login page with an error message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';
import { getSportSlug, normalizeSport } from '@/lib/sports';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';

function buildLoginUrl(request: NextRequest, sport?: string | null): URL {
  const normalizedSport = normalizeSport(sport) ?? 'CORNHOLE';
  return new URL(`/${getSportSlug(normalizedSport)}/login`, request.url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  // Validate token presence
  if (!token) {
    const loginUrl = buildLoginUrl(request, 'CORNHOLE');
    loginUrl.searchParams.set('error', 'missing_token');
    loginUrl.searchParams.set('message', 'Verification token is missing. Please request a new verification email.');
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify the token
  const result = await verifyEmailToken(token);
  
  if (!result.success) {
    // Redirect to login with error
    const loginUrl = buildLoginUrl(request, result.sport);
    loginUrl.searchParams.set('error', 'verification_failed');
    loginUrl.searchParams.set('message', result.error || 'Email verification failed. Please try again.');
    loginUrl.searchParams.set('email', result.email || '');
    return NextResponse.redirect(loginUrl);
  }
  
  // Success - redirect to login with success message
  const loginUrl = buildLoginUrl(request, result.sport);
  loginUrl.searchParams.set('verified', 'true');
  loginUrl.searchParams.set('message', 'Your email has been verified successfully! You can now log in.');
  
  // If we have the email, pass it along to pre-fill the login form
  if (result.email) {
    loginUrl.searchParams.set('email', result.email);
  }
  
  console.log(`Email verification successful for user ${result.userId}`);
  
  return NextResponse.redirect(loginUrl);
}

// Also support POST for API-based verification (mobile apps)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        'Verification token is required.',
        400,
        {
          field: 'token',
          fieldErrors: { token: 'Verification token is required.' },
        },
      );
    }
    
    const result = await verifyEmailToken(token);
    
    if (!result.success) {
      const isExpired = result.error?.toLowerCase().includes('expired');
      return authError(
        isExpired ? AUTH_CODES.RESET_LINK_EXPIRED : AUTH_CODES.INVALID_RESET_TOKEN,
        result.error || 'Email verification failed.',
        400,
        {
          field: 'token',
          fieldErrors: { token: result.error || 'Email verification failed.' },
        },
      );
    }
    
    return authSuccess(AUTH_CODES.EMAIL_VERIFIED, 'Email verified successfully.', {
      user: {
        id: result.userId,
        email: result.email,
        sport: result.sport,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not verify your email right now. Please try again.',
      500,
    );
  }
}
