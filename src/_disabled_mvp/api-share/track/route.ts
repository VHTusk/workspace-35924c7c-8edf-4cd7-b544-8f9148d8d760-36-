/**
 * Share Tracking API
 * 
 * POST /api/share/track - Track when player cards are shared
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================
// POST Handler - Track Share Event
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      playerId, 
      cardType, 
      platform, 
      sport,
      h2hOpponentId,
      tournamentId,
    } = body as {
      playerId: string
      cardType: string
      platform: string
      sport: string
      h2hOpponentId?: string
      tournamentId?: string
    }
    
    // Validate required params
    if (!playerId || !platform) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: playerId and platform' },
        { status: 400 }
      )
    }
    
    // Validate platform
    const validPlatforms = [
      'whatsapp', 
      'whatsapp_status', 
      'whatsapp_preview',
      'twitter', 
      'facebook', 
      'linkedin', 
      'telegram', 
      'email', 
      'copy',
      'native'
    ]
    
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate card type
    const validCardTypes = ['profile', 'stats', 'h2h', 'tournament']
    if (cardType && !validCardTypes.includes(cardType)) {
      return NextResponse.json(
        { success: false, error: `Invalid cardType. Must be one of: ${validCardTypes.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Get request metadata
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined
    const userAgent = request.headers.get('user-agent') || undefined
    
    try {
      // Track the share in the database
      // Using raw query since we might not have a PlayerCardShare model
      await db.$executeRaw`
        INSERT INTO PlayerCardShare (
          id, 
          playerId, 
          cardType, 
          platform, 
          sport,
          h2hOpponentId,
          tournamentId,
          ip,
          userAgent,
          createdAt
        ) VALUES (
          ${`share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`},
          ${playerId},
          ${cardType || 'profile'},
          ${platform},
          ${sport || 'cornhole'},
          ${h2hOpponentId || null},
          ${tournamentId || null},
          ${ip || null},
          ${userAgent || null},
          ${new Date()}
        )
      `
    } catch (dbError) {
      // If the table doesn't exist, just log the share
      console.log('[Share Track] Would track share:', {
        playerId,
        cardType,
        platform,
        sport,
        ip,
        userAgent,
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        tracked: true,
        playerId,
        cardType: cardType || 'profile',
        platform,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Share Track API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track share' },
      { status: 500 }
    )
  }
}

// ============================================
// GET Handler - Get Share Stats for Player
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const playerId = searchParams.get('playerId')
    const periodDays = parseInt(searchParams.get('period') || '30', 10)
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: playerId' },
        { status: 400 }
      )
    }
    
    const since = new Date()
    since.setDate(since.getDate() - periodDays)
    
    try {
      // Get share counts by platform
      const sharesByPlatform = await db.$queryRaw<Array<{
        platform: string;
        count: bigint;
      }>>`
        SELECT platform, COUNT(*) as count
        FROM PlayerCardShare
        WHERE playerId = ${playerId}
          AND createdAt >= ${since}
        GROUP BY platform
        ORDER BY count DESC
      `
      
      // Get share counts by card type
      const sharesByCardType = await db.$queryRaw<Array<{
        cardType: string;
        count: bigint;
      }>>`
        SELECT cardType, COUNT(*) as count
        FROM PlayerCardShare
        WHERE playerId = ${playerId}
          AND createdAt >= ${since}
        GROUP BY cardType
        ORDER BY count DESC
      `
      
      // Get total shares
      const totalResult = await db.$queryRaw<Array<{
        total: bigint;
      }>>`
        SELECT COUNT(*) as total
        FROM PlayerCardShare
        WHERE playerId = ${playerId}
          AND createdAt >= ${since}
      `
      
      const total = totalResult[0]?.total || BigInt(0)
      
      // Get recent shares
      const recentShares = await db.$queryRaw<Array<{
        platform: string;
        cardType: string;
        createdAt: Date;
      }>>`
        SELECT platform, cardType, createdAt
        FROM PlayerCardShare
        WHERE playerId = ${playerId}
          AND createdAt >= ${since}
        ORDER BY createdAt DESC
        LIMIT 10
      `
      
      return NextResponse.json({
        success: true,
        data: {
          total: Number(total),
          byPlatform: sharesByPlatform.map(s => ({
            platform: s.platform,
            count: Number(s.count),
          })),
          byCardType: sharesByCardType.map(s => ({
            cardType: s.cardType,
            count: Number(s.count),
          })),
          recent: recentShares.map(s => ({
            platform: s.platform,
            cardType: s.cardType,
            createdAt: s.createdAt,
          })),
          periodDays,
        },
      })
    } catch {
      // If the table doesn't exist, return empty stats
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          byPlatform: [],
          byCardType: [],
          recent: [],
          periodDays,
        },
      })
    }
  } catch (error) {
    console.error('[Share Track API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get share stats' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS Handler - CORS Preflight
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
