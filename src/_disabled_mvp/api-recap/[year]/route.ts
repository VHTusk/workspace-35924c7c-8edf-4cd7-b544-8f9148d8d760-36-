import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getOrGenerateRecap, getAvailableSeasonYears } from '@/lib/season-recap-generator';
import { generateShareableText } from '@/lib/season-recap-generator';

/**
 * GET /api/recap/[year]
 * Get recap for a specific year
 * 
 * Query params:
 * - sport: Sport type (CORNHOLE or DARTS) - required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = parseInt(yearParam);

    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Valid sport parameter (CORNHOLE or DARTS) is required' },
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

    // Get recap for specific year
    const result = await getOrGenerateRecap(userId, sport, year);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'No matches found for this season' },
        { status: 404 }
      );
    }

    // Get available years for navigation
    const availableYears = await getAvailableSeasonYears(userId, sport);

    // Get user info for shareable content
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });

    const playerName = user ? `${user.firstName} ${user.lastName}` : 'Player';
    const shareableText = generateShareableText(result.recap!, playerName);

    return NextResponse.json({
      success: true,
      data: {
        recap: result.recap,
        availableYears,
        shareableText,
      }
    });
  } catch (error) {
    console.error('Error fetching year recap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recap' },
      { status: 500 }
    );
  }
}
