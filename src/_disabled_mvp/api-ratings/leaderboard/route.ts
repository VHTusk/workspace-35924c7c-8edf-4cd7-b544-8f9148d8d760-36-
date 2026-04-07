/**
 * API Route: GET /api/ratings/leaderboard
 * 
 * v3.39.0 Global Rating System - Leaderboard Endpoint
 * Returns sport-specific global rating leaderboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalLeaderboard } from '@/lib/global-rating';
import { SportType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Required parameters
    const sport = searchParams.get('sport') as SportType;
    
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Valid sport parameter required (CORNHOLE or DARTS)' },
        { status: 400 }
      );
    }

    // Optional parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const city = searchParams.get('city') || undefined;
    const state = searchParams.get('state') || undefined;
    const excludeProvisional = searchParams.get('excludeProvisional') !== 'false';

    const result = await getGlobalLeaderboard(sport, {
      limit,
      offset,
      city,
      state,
      excludeProvisional,
    });

    return NextResponse.json({
      success: true,
      data: {
        entries: result.entries,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
        filters: {
          sport,
          city,
          state,
          excludeProvisional,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
