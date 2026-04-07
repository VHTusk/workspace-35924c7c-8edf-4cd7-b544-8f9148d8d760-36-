/**
 * City Activity Feed API
 * GET /api/city/[cityId]/feed - Get duel activity feed (Module 3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCityActivityFeed } from '@/lib/city-utils';

// GET /api/city/[cityId]/feed
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const activityType = searchParams.get('activityType');

    // Find city
    let city = await db.city.findUnique({
      where: { cityId },
    });

    if (!city) {
      city = await db.city.findUnique({
        where: { id: cityId },
      });
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { cityId: city.id };
    if (activityType) {
      where.activityType = activityType;
    }

    // Get activity feed
    const feed = await db.cityActivityFeedItem.findMany({
      where,
      orderBy: { activityAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Parse metadata JSON
    const parsedFeed = feed.map((item) => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null,
    }));

    // Get total count
    const total = await db.cityActivityFeedItem.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        city: {
          id: city.id,
          cityId: city.cityId,
          cityName: city.cityName,
          state: city.state,
          sport: city.sport,
        },
        feed: parsedFeed,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + feed.length < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching city activity feed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch city activity feed' },
      { status: 500 }
    );
  }
}
