import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateSession, validateOrgSession } from '@/lib/auth'
import { 
  SUPPORTED_LOCALES, 
  isSupportedLanguage, 
  DEFAULT_LOCALE,
  type SupportedLanguage 
} from '@/lib/i18n'

/**
 * GET /api/user/language
 * Get the current user's language preference
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session cookie
    const sessionToken = request.cookies.get('session_token')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Find session - try player first, then org
    const userSession = await validateSession(sessionToken);
    let isOrg = false;

    if (!userSession) {
      const orgSession = await validateOrgSession(sessionToken);
      if (orgSession) {
        isOrg = true;
      }
    }

    if (!userSession && !isOrg) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 401 }
      )
    }

    // Check for org session - organizations don't have language preferences
    if (isOrg) {
      return NextResponse.json({
        success: true,
        data: {
          language: DEFAULT_LOCALE,
          supportedLanguages: Object.values(SUPPORTED_LOCALES),
        },
      })
    }

    const userLanguage = userSession?.user?.language || DEFAULT_LOCALE

    return NextResponse.json({
      success: true,
      data: {
        language: userLanguage,
        supportedLanguages: Object.values(SUPPORTED_LOCALES),
      },
    })
  } catch (error) {
    console.error('[API] Error getting user language:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/language
 * Update the current user's language preference
 * 
 * Request body:
 * - language: 'en' | 'hi'
 */
export async function PUT(request: NextRequest) {
  try {
    // Get user ID from session cookie
    const sessionToken = request.cookies.get('session_token')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Find session - try player first
    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { language } = body

    // Validate language
    if (!language || !isSupportedLanguage(language)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid language. Supported languages: ${Object.keys(SUPPORTED_LOCALES).join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Update user's language preference
    await db.user.update({
      where: { id: session.user.id },
      data: { language: language as SupportedLanguage },
    })

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      data: {
        language,
        message: 'Language preference updated',
      },
    })

    // Set cookie for immediate effect (expires in 1 year)
    response.cookies.set('language', language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('[API] Error updating user language:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
