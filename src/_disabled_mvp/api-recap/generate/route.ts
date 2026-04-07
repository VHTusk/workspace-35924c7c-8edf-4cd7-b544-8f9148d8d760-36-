import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { generateSeasonRecap, getAvailableSeasonYears } from '@/lib/season-recap-generator';

/**
 * POST /api/recap/generate
 * Generate or regenerate a season recap
 * 
 * Body:
 * - year: Season year (defaults to current year)
 * - sport: Sport type (CORNHOLE or DARTS) - required
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseInt(body.year?.toString() || new Date().getFullYear().toString());
    const sport = body.sport as SportType;

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Valid sport parameter (CORNHOLE or DARTS) is required' },
        { status: 400 }
      );
    }

    // Validate year
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 }
      );
    }

    // Get user ID from session cookie
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });

    if (!session || !session.userId || session.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Generate/regenerate recap
    const result = await generateSeasonRecap(userId, sport, year);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate recap' },
        { status: 400 }
      );
    }

    // Get available years for navigation
    const availableYears = await getAvailableSeasonYears(userId, sport);

    return NextResponse.json({
      success: true,
      data: {
        recap: result.recap,
        availableYears,
        message: 'Recap generated successfully'
      }
    });
  } catch (error) {
    console.error('Error generating recap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recap' },
      { status: 500 }
    );
  }
}
