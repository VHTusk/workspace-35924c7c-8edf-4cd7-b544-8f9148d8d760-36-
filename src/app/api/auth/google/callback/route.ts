import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, generateReferralCode } from '@/lib/auth';
import { SportType, Role } from '@prisma/client';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { buildAppUrl, getAuthUrl } from '@/lib/app-url';
import { getSportSlug, normalizeSport } from '@/lib/sports';

// Google OAuth 2.0 endpoints
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

interface StateData {
  sport: SportType;
  type: 'player' | 'org';
  timestamp: number;
  random: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authUrl = getAuthUrl(request.headers);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(buildAppUrl(`/?error=${encodeURIComponent(error)}`, authUrl));
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(buildAppUrl('/?error=invalid_oauth_response', authUrl));
    }

    // Parse and validate state
    const stateData = parseState(state);
    if (!stateData) {
      return NextResponse.redirect(buildAppUrl('/?error=invalid_state', authUrl));
    }

    // Check state timestamp (valid for 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.redirect(buildAppUrl('/?error=expired_state', authUrl));
    }

    const { sport, type } = stateData;

    // Exchange authorization code for access token
    const tokens = await exchangeCodeForTokens(code, authUrl);
    if (!tokens.access_token) {
      return NextResponse.redirect(buildAppUrl('/?error=token_exchange_failed', authUrl));
    }

    // Get user info from Google
    const googleUser = await getUserInfo(tokens.access_token);
    if (!googleUser || !googleUser.email) {
      return NextResponse.redirect(buildAppUrl('/?error=no_email_from_google', authUrl));
    }

    // For organization registration, store data in a temporary token instead of URL params
    // FIX: Don't pass sensitive data (email, name) in URL params - they end up in access logs
    if (type === 'org') {
      // Create a temporary token that contains the Google user data
      // This token expires in 10 minutes and can only be used once
      const tempToken = Buffer.from(JSON.stringify({
        google_email: googleUser.email,
        google_name: googleUser.name || `${googleUser.given_name || ''} ${googleUser.family_name || ''}`.trim(),
        google_id: googleUser.id,
        timestamp: Date.now(),
      })).toString('base64url');
      
      // Redirect with only the token - sensitive data is not in URL
      const redirectUrl = new URL(buildAppUrl(`/${getSportSlug(sport)}/org/register`, authUrl));
      redirectUrl.searchParams.set('google_token', tempToken);
      return NextResponse.redirect(redirectUrl);
    }

    // Handle player login/registration
    // Check if user exists with this Google ID and sport
    let user = await db.user.findFirst({
      where: {
        googleId: googleUser.id,
        sport: sport as SportType,
      },
    });

    if (!user) {
      // Check if user exists with this email and sport
      user = await db.user.findUnique({
        where: {
          email_sport: {
            email: googleUser.email,
            sport: sport as SportType,
          },
        },
      });

      if (user) {
        // Link Google account to existing user
        user = await db.user.update({
          where: { id: user.id },
          data: { 
            googleId: googleUser.id,
            verified: true,
            verifiedAt: user.verifiedAt || new Date(),
          },
        });
      } else {
        // Create new user from Google profile
        // Generate unique referral code
        let referralCode = generateReferralCode();
        let attempts = 0;
        while (attempts < 10) {
          const existing = await db.user.findUnique({
            where: { referralCode },
          });
          if (!existing) break;
          referralCode = generateReferralCode();
          attempts++;
        }

        user = await db.user.create({
          data: {
            email: googleUser.email,
            googleId: googleUser.id,
            firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'Google',
            lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || 'User',
            sport: sport as SportType,
            role: Role.PLAYER,
            referralCode,
            verified: true,
            verifiedAt: new Date(),
          },
        });

        // Create player rating
        await db.playerRating.create({
          data: {
            userId: user.id,
            sport: sport as SportType,
          },
        });

        // Create notification preferences
        await db.notificationPreference.create({
          data: {
            userId: user.id,
          },
        });
      }
    }

    // Create session
    const session = await createSession(user.id, sport as SportType);

    // Set cookie and redirect to dashboard
    const response = NextResponse.redirect(
      buildAppUrl(`/${getSportSlug(sport)}/dashboard`, authUrl)
    );
    
    // OVERRIDE: sameSite: 'lax' required for OAuth callbacks
    // OAuth redirects are cross-site navigations. With sameSite: 'strict',
    // the session cookie would not be sent on subsequent cross-site navigations,
    // breaking the OAuth flow when users follow external links back to the site.
    setSessionCookie(response, session.token, { sameSite: 'lax' });

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(buildAppUrl('/?error=oauth_callback_failed', getAuthUrl(request.headers)));
  }
}

/**
 * Parse and validate state parameter
 */
function parseState(state: string): StateData | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as Partial<StateData>;
    
    // Validate required fields
    if (!parsed.sport || !parsed.type || !parsed.timestamp || !parsed.random) {
      return null;
    }
    
    // Validate sport
    const sport = normalizeSport(parsed.sport);
    if (!sport) {
      return null;
    }
    
    // Validate type
    if (!['player', 'org'].includes(parsed.type)) {
      return null;
    }
    
    return {
      sport,
      type: parsed.type,
      timestamp: parsed.timestamp,
      random: parsed.random,
    };
  } catch {
    return null;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForTokens(code: string, authUrl: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || buildAppUrl('/api/auth/google/callback', authUrl);

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', errorText);
    throw new Error('Failed to exchange code for tokens');
  }

  return response.json();
}

/**
 * Get user info from Google using access token
 */
async function getUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user info:', await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}
