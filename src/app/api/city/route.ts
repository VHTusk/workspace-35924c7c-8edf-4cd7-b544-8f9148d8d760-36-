/**
 * City API Routes
 * GET /api/city - List all cities
 * POST /api/city - Create a new city (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { generateCityId } from '@/lib/city-utils';

// GET /api/city - List all cities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get('sport');
    const sport = sportParam ? (sportParam.toUpperCase() as SportType) : null;
    const state = searchParams.get('state');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {
      isActive: true,
      status: 'ACTIVE',
    };

    if (sport) {
      where.sport = sport;
    }

    if (state) {
      where.state = state;
    }

    if (search) {
      where.cityName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [cities, total] = await Promise.all([
      db.city.findMany({
        where,
        orderBy: [
          { playerCount: 'desc' },
          { cityName: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.city.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: cities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + cities.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cities' },
      { status: 500 }
    );
  }
}

// POST /api/city - Create a new city (admin/system use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cityName, state, country = 'India', sport } = body;

    if (!cityName || !state || !sport) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: cityName, state, sport' },
        { status: 400 }
      );
    }

    // Check if city already exists
    const cityId = generateCityId(cityName, state, sport as SportType);
    const existing = await db.city.findUnique({
      where: { cityId },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: 'City already exists',
      });
    }

    // Create new city
    const city = await db.city.create({
      data: {
        cityId,
        cityName,
        state,
        country,
        sport: sport as SportType,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: city,
      message: 'City created successfully',
    });
  } catch (error) {
    console.error('Error creating city:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create city' },
      { status: 500 }
    );
  }
}
