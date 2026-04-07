import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';

// Google OAuth 2.0 Configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['email', 'profile'].join(' ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const type = searchParams.get('type') as 'player' | 'org';

    // Validate sport parameter
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.redirect(new URL('/?error=invalid_sport', request.url));
    }

    // Get Google OAuth credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('Google OAuth credentials not configured');
      return NextResponse.redirect(new URL('/?error=oauth_not_configured', request.url));
    }

    // Generate a secure state parameter to prevent CSRF
    const state = generateState(sport, type);
    
    // Build the Google OAuth URL
    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', SCOPES);
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}

/**
 * Generate a state parameter containing sport and type info
 * This is base64 encoded JSON to prevent tampering
 */
function generateState(sport: SportType, type: 'player' | 'org'): string {
  const stateData = {
    sport,
    type,
    timestamp: Date.now(),
    random: crypto.randomUUID(),
  };
  
  // Base64 encode the state data
  return Buffer.from(JSON.stringify(stateData)).toString('base64url');
}
