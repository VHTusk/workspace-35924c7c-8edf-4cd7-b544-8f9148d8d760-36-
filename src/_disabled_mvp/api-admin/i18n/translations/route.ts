/**
 * VALORHIVE Translation Management API
 * 
 * Admin API for managing translations across supported languages
 * 
 * Supported Languages:
 * - Primary: English (en)
 * - Planned: Hindi (hi), Tamil (ta), Telugu (te), Kannada (kn)
 * 
 * @module /api/admin/i18n/translations
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  SupportedLanguage, 
  SUPPORTED_LOCALES, 
  DEFAULT_LOCALE,
  getSupportedLanguages,
} from '@/lib/i18n'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// ============================================
// TYPES
// ============================================

interface Translation {
  key: string
  translations: Record<SupportedLanguage, string>
  category: string
  description?: string
  lastUpdated: string
}

interface TranslationResponse {
  success: boolean
  data?: {
    translations: Translation[]
    languages: ReturnType<typeof getSupportedLanguages>
    total: number
    categories: string[]
  }
  error?: string
}

interface UpdateTranslationRequest {
  key: string
  language: SupportedLanguage
  value: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate admin access
 * Verifies that the request comes from an authenticated admin user using admin_session cookie
 */
async function validateAdminAccess(request: NextRequest): Promise<{ valid: boolean; error?: string; userId?: string }> {
  try {
    // Use proper admin authentication - checks admin_session cookie
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return { valid: false, error: 'No valid admin session found' };
    }

    const { user } = auth;

    // Check if user is active
    if (!user.isActive) {
      return { valid: false, error: 'User account is deactivated' };
    }

    // Verify user has an admin role
    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR', 'ORG_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return { valid: false, error: 'Insufficient permissions. Admin access required.' };
    }

    return { valid: true, userId: user.id };
  } catch (error) {
    console.error('[i18n API] Admin validation error:', error);
    return { valid: false, error: 'Authentication error' };
  }
}

/**
 * Get all translation categories
 */
function getCategories(): string[] {
  return [
    'common',
    'auth',
    'tournament',
    'leaderboard',
    'profile',
    'notifications',
    'errors',
    'emails',
    'admin',
  ]
}

/**
 * Get placeholder translations
 * In production, these would be fetched from database
 */
function getPlaceholderTranslations(): Translation[] {
  return [
    {
      key: 'common.welcome',
      translations: {
        en: 'Welcome to VALORHIVE',
        hi: 'VALORHIVE में आपका स्वागत है',
      } as Record<SupportedLanguage, string>,
      category: 'common',
      description: 'Welcome message shown on landing page',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'common.login',
      translations: {
        en: 'Login',
        hi: 'लॉग इन',
      } as Record<SupportedLanguage, string>,
      category: 'auth',
      description: 'Login button text',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'common.register',
      translations: {
        en: 'Register',
        hi: 'पंजीकरण',
      } as Record<SupportedLanguage, string>,
      category: 'auth',
      description: 'Register button text',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'tournament.register',
      translations: {
        en: 'Register for Tournament',
        hi: 'टूर्नामेंट के लिए पंजीकरण करें',
      } as Record<SupportedLanguage, string>,
      category: 'tournament',
      description: 'Tournament registration button',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'tournament.entryFee',
      translations: {
        en: 'Entry Fee',
        hi: 'प्रवेश शुल्क',
      } as Record<SupportedLanguage, string>,
      category: 'tournament',
      description: 'Tournament entry fee label',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'leaderboard.rank',
      translations: {
        en: 'Rank',
        hi: 'रैंक',
      } as Record<SupportedLanguage, string>,
      category: 'leaderboard',
      description: 'Leaderboard rank column header',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'leaderboard.points',
      translations: {
        en: 'Points',
        hi: 'अंक',
      } as Record<SupportedLanguage, string>,
      category: 'leaderboard',
      description: 'Leaderboard points column header',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'profile.edit',
      translations: {
        en: 'Edit Profile',
        hi: 'प्रोफ़ाइल संपादित करें',
      } as Record<SupportedLanguage, string>,
      category: 'profile',
      description: 'Edit profile button',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'errors.generic',
      translations: {
        en: 'Something went wrong. Please try again.',
        hi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
      } as Record<SupportedLanguage, string>,
      category: 'errors',
      description: 'Generic error message',
      lastUpdated: new Date().toISOString(),
    },
    {
      key: 'notifications.matchResult',
      translations: {
        en: 'Match result submitted successfully',
        hi: 'मैच परिणाम सफलतापूर्वक सबमिट किया गया',
      } as Record<SupportedLanguage, string>,
      category: 'notifications',
      description: 'Match result notification',
      lastUpdated: new Date().toISOString(),
    },
  ]
}

// ============================================
// API HANDLERS
// ============================================

/**
 * GET /api/admin/i18n/translations
 * 
 * Fetch all translations or filter by category/language
 * 
 * Query Parameters:
 * - category: Filter by translation category
 * - language: Filter by language code
 * - search: Search translations by key
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 */
export async function GET(request: NextRequest): Promise<NextResponse<TranslationResponse>> {
  try {
    // Validate admin access
    const authCheck = await validateAdminAccess(request)
    if (!authCheck.valid) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const language = searchParams.get('language') as SupportedLanguage | null
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Try to fetch from database first
    let dbTranslations = await db.translation.findMany({
      where: category ? { category } : undefined,
      orderBy: { key: 'asc' },
    })

    // If database is empty, seed with placeholder translations
    if (dbTranslations.length === 0) {
      const placeholderTranslations = getPlaceholderTranslations()
      
      // Seed database with placeholder translations
      for (const t of placeholderTranslations) {
        await db.translation.upsert({
          where: { key: t.key },
          update: {
            key: t.key,
            category: t.category,
            description: t.description,
            translations: JSON.stringify(t.translations),
          },
          create: {
            key: t.key,
            category: t.category,
            description: t.description,
            translations: JSON.stringify(t.translations),
          },
        })
      }
      
      // Re-fetch from database
      dbTranslations = await db.translation.findMany({
        where: category ? { category } : undefined,
        orderBy: { key: 'asc' },
      })
    }

    // Convert database records to response format
    let translations: Translation[] = dbTranslations.map(t => ({
      key: t.key,
      translations: JSON.parse(t.translations),
      category: t.category,
      description: t.description || undefined,
      lastUpdated: t.updatedAt.toISOString(),
    }))

    // Apply language filter if specified
    if (language && language in SUPPORTED_LOCALES) {
      translations = translations.map(t => ({
        ...t,
        translations: { [language]: t.translations[language] } as Record<SupportedLanguage, string>,
      }))
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      translations = translations.filter(t => 
        t.key.toLowerCase().includes(searchLower) ||
        Object.values(t.translations).some(v => 
          v.toLowerCase().includes(searchLower)
        )
      )
    }

    // Apply pagination
    const total = translations.length
    const offset = (page - 1) * limit
    const paginatedTranslations = translations.slice(offset, offset + limit)

    // Response
    return NextResponse.json({
      success: true,
      data: {
        translations: paginatedTranslations,
        languages: getSupportedLanguages(),
        total,
        categories: getCategories(),
      },
    })
  } catch (error) {
    console.error('[i18n API] Error fetching translations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch translations' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/i18n/translations
 * 
 * Update or create a translation
 * 
 * Request Body:
 * - key: Translation key
 * - language: Target language
 * - value: Translation value
 */
export async function PUT(request: NextRequest): Promise<NextResponse<{ 
  success: boolean
  data?: { key: string; language: SupportedLanguage; value: string }
  error?: string 
}>> {
  try {
    // Validate admin access
    const authCheck = await validateAdminAccess(request)
    if (!authCheck.valid) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: UpdateTranslationRequest = await request.json()
    const { key, language, value } = body

    // Validate inputs
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Translation key is required' },
        { status: 400 }
      )
    }

    if (!language || !(language in SUPPORTED_LOCALES)) {
      return NextResponse.json(
        { success: false, error: `Invalid language. Supported: ${Object.keys(SUPPORTED_LOCALES).join(', ')}` },
        { status: 400 }
      )
    }

    if (!value || typeof value !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Translation value is required' },
        { status: 400 }
      )
    }

    // Find existing translation or create new one
    const existing = await db.translation.findUnique({
      where: { key },
    })

    if (existing) {
      // Update existing translation
      const currentTranslations = JSON.parse(existing.translations)
      currentTranslations[language] = value
      
      await db.translation.update({
        where: { key },
        data: {
          translations: JSON.stringify(currentTranslations),
          updatedBy: authCheck.userId,
        },
      })
    } else {
      // Create new translation with default empty values
      const defaultTranslations: Record<string, string> = {}
      for (const lang of Object.keys(SUPPORTED_LOCALES)) {
        defaultTranslations[lang] = lang === language ? value : ''
      }
      
      // Extract category from key (e.g., "common.welcome" -> "common")
      const category = key.includes('.') ? key.split('.')[0] : 'common'
      
      await db.translation.create({
        data: {
          key,
          category,
          translations: JSON.stringify(defaultTranslations),
          updatedBy: authCheck.userId,
        },
      })
    }

    console.log('[i18n API] Translation updated:', { key, language, value, userId: authCheck.userId })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[i18n API] Error updating translation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update translation' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/i18n/translations
 * 
 * Bulk import translations
 * 
 * Request Body:
 * - translations: Array of translation objects
 */
export async function POST(request: NextRequest): Promise<NextResponse<{
  success: boolean
  data?: { imported: number; skipped: number; errors: string[] }
  error?: string
}>> {
  try {
    // Validate admin access
    const authCheck = await validateAdminAccess(request)
    if (!authCheck.valid) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { translations, overwrite = false } = body as { 
      translations: Array<{ key: string; translations: Record<string, string>; category?: string }>
      overwrite?: boolean 
    }

    // Validate
    if (!Array.isArray(translations) || translations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Translations array is required' },
        { status: 400 }
      )
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const t of translations) {
      try {
        const existing = await db.translation.findUnique({
          where: { key: t.key },
        })

        if (existing && !overwrite) {
          skipped++
          continue
        }

        if (existing) {
          // Merge translations
          const existingTranslations = JSON.parse(existing.translations)
          const mergedTranslations = { ...existingTranslations, ...t.translations }
          
          await db.translation.update({
            where: { key: t.key },
            data: {
              translations: JSON.stringify(mergedTranslations),
              updatedBy: authCheck.userId,
            },
          })
        } else {
          // Create new translation
          await db.translation.create({
            data: {
              key: t.key,
              category: t.category || 'common',
              translations: JSON.stringify(t.translations),
              updatedBy: authCheck.userId,
            },
          })
        }
        imported++
      } catch (err) {
        errors.push(`Failed to import ${t.key}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    console.log('[i18n API] Bulk import completed:', { imported, skipped, errors: errors.length, userId: authCheck.userId })

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        errors,
      },
    })
  } catch (error) {
    console.error('[i18n API] Error importing translations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import translations' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/i18n/translations
 * 
 * Delete a translation key
 * 
 * Query Parameters:
 * - key: Translation key to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<{
  success: boolean
  error?: string
}>> {
  try {
    // Validate admin access
    const authCheck = await validateAdminAccess(request)
    if (!authCheck.valid) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get translation key from query
    const key = request.nextUrl.searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Translation key is required' },
        { status: 400 }
      )
    }

    // Delete from database
    const result = await db.translation.deleteMany({
      where: { key },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Translation key not found' },
        { status: 404 }
      )
    }

    console.log('[i18n API] Translation deleted:', { key, userId: authCheck.userId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[i18n API] Error deleting translation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete translation' },
      { status: 500 }
    )
  }
}
