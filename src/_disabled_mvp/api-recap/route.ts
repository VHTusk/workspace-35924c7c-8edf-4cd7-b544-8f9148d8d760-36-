import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { getOrGenerateRecap, getAvailableSeasonYears, getAllUserRecaps } from '@/lib/season-recap-generator';

/**
 * GET /api/recap
 * Get current user's recap for current or specified year
 * 
 * Query params:
 * - year: Season year (defaults to current year)
 * - sport: Sport type (CORNHOLE or DARTS)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const sport = searchParams.get('sport') as SportType;

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Valid sport parameter (CORNHOLE or DARTS) is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const authResult = await getAuthenticatedUser(request);
    
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Check if user wants all years or specific year
    const allYears = searchParams.get('all') === 'true';

    if (allYears) {
      // Get all available years and recaps
      const [availableYears, existingRecaps] = await Promise.all([
        getAvailableSeasonYears(userId, sport),
        getAllUserRecaps(userId, sport)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          availableYears,
          recaps: existingRecaps,
          currentYear: new Date().getFullYear(),
        }
      });
    }

    // Get recap for specific year
    const result = await getOrGenerateRecap(userId, sport, year);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Also get available years for navigation
    const availableYears = await getAvailableSeasonYears(userId, sport);

    return NextResponse.json({
      success: true,
      data: {
        recap: result.recap,
        availableYears,
      }
    });
  } catch (error) {
    console.error('Error fetching recap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recap' },
      { status: 500 }
    );
  }
}
