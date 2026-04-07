/**
 * Social Share API
 * 
 * POST /api/share - Generate share link and track shares
 * GET /api/share - Get share data for an entity
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  type ShareType,
  type SocialPlatform,
  generateShareUrl,
  getShareData,
  getAllPlatformShareUrls,
  trackShare,
  getShareAnalytics,
  getQRCodeUrl,
} from '@/lib/integrations/social'

// ============================================
// GET Handler - Get Share Data
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const type = searchParams.get('type') as ShareType | null
    const id = searchParams.get('id')
    const action = searchParams.get('action') || 'data'
    
    // Validate required params
    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: type and id' },
        { status: 400 }
      )
    }
    
    // Validate type
    const validTypes: ShareType[] = ['tournament', 'player', 'organization', 'match', 'leaderboard']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }
    
    switch (action) {
      case 'analytics': {
        // Get share analytics
        const periodDays = parseInt(searchParams.get('period') || '30', 10)
        const analytics = await getShareAnalytics(type, id, periodDays)
        
        return NextResponse.json({
          success: true,
          data: analytics,
        })
      }
      
      case 'qrcode': {
        // Generate QR code URL
        const url = generateShareUrl(type, id)
        const size = parseInt(searchParams.get('size') || '200', 10)
        const qrUrl = getQRCodeUrl(url, size)
        
        return NextResponse.json({
          success: true,
          data: {
            url,
            qrCodeUrl: qrUrl,
          },
        })
      }
      
      case 'data':
      default: {
        // Get share data for entity
        const shareData = await getShareData(type, id)
        
        if (!shareData) {
          return NextResponse.json(
            { success: false, error: 'Entity not found' },
            { status: 404 }
          )
        }
        
        // Get all platform share URLs
        const platformUrls = getAllPlatformShareUrls(shareData)
        
        // Get QR code URL
        const qrUrl = getQRCodeUrl(shareData.url)
        
        return NextResponse.json({
          success: true,
          data: {
            ...shareData,
            platformUrls,
            qrCodeUrl: qrUrl,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Share API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get share data' },
      { status: 500 }
    )
  }
}

// ============================================
// POST Handler - Track Share and Generate Links
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { type, id, platform, action = 'track' } = body as {
      type: ShareType
      id: string
      platform?: SocialPlatform
      action?: 'track' | 'shorten'
    }
    
    // Validate required params
    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: type and id' },
        { status: 400 }
      )
    }
    
    // Validate type
    const validTypes: ShareType[] = ['tournament', 'player', 'organization', 'match', 'leaderboard']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }
    
    switch (action) {
      case 'shorten': {
        // Generate a short link
        const { createShareLink, getShortUrl } = await import('@/lib/integrations/social')
        
        const shareLink = await createShareLink(type, id, 30) // 30 days expiry
        const shortUrl = getShortUrl(shareLink.shortCode)
        
        return NextResponse.json({
          success: true,
          data: {
            shortCode: shareLink.shortCode,
            shortUrl,
            originalUrl: shareLink.url,
            expiresAt: shareLink.expiresAt,
          },
        })
      }
      
      case 'track':
      default: {
        // Track a share event
        if (!platform) {
          return NextResponse.json(
            { success: false, error: 'Missing required parameter: platform' },
            { status: 400 }
          )
        }
        
        // Validate platform
        const validPlatforms: SocialPlatform[] = ['whatsapp', 'twitter', 'facebook', 'linkedin', 'telegram', 'email', 'copy']
        if (!validPlatforms.includes(platform)) {
          return NextResponse.json(
            { success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
            { status: 400 }
          )
        }
        
        // Get request metadata
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          undefined
        const userAgent = request.headers.get('user-agent') || undefined
        const referrer = request.headers.get('referer') || undefined
        
        // Track the share
        await trackShare(type, id, platform, {
          ip,
          userAgent,
          referrer,
        })
        
        // Get share data to return
        const shareData = await getShareData(type, id)
        const platformUrls = shareData ? getAllPlatformShareUrls(shareData) : null
        
        return NextResponse.json({
          success: true,
          data: {
            tracked: true,
            type,
            entityId: id,
            platform,
            shareData,
            platformUrls,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Share API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process share request' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS Handler - CORS Preflight
// ============================================

export async function OPTIONS() {
  // FIX: Use specific origin instead of wildcard to prevent unauthorized access
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com'
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  })
}
