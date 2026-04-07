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

// Base URL for the application
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  // Validate token presence
  if (!token) {
    const baseUrl = getBaseUrl();
    const loginUrl = new URL(`/${encodeURIComponent('CORNHOLE')}/login`, baseUrl);
    loginUrl.searchParams.set('error', 'missing_token');
    loginUrl.searchParams.set('message', 'Verification token is missing. Please request a new verification email.');
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify the token
  const result = await verifyEmailToken(token);
  
  const baseUrl = getBaseUrl();
  
  if (!result.success) {
    // Redirect to login with error
    const loginUrl = new URL(`/${encodeURIComponent(result.sport || 'CORNHOLE')}/login`, baseUrl);
    loginUrl.searchParams.set('error', 'verification_failed');
    loginUrl.searchParams.set('message', result.error || 'Email verification failed. Please try again.');
    loginUrl.searchParams.set('email', result.email || '');
    return NextResponse.redirect(loginUrl);
  }
  
  // Success - redirect to login with success message
  const loginUrl = new URL(`/${encodeURIComponent(result.sport || 'CORNHOLE')}/login`, baseUrl);
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
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }
    
    const result = await verifyEmailToken(token);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: result.userId,
        email: result.email,
        sport: result.sport,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during verification' },
      { status: 500 }
    );
  }
}
