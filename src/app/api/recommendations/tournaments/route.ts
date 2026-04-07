import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getTournamentRecommendations,
  getRecommendationsSummary,
  getTournamentsForDate,
} from '@/lib/tournament-recommendations';

/**
 * GET /api/recommendations/tournaments
 * 
 * Get tournament recommendations based on player availability
 * 
 * Query params:
 * - limit: number of results (default: 10)
 * - offset: pagination offset (default: 0)
 * - includeRegistered: include tournaments already registered for (default: false)
 * - minMatchScore: minimum match score filter (default: 50)
 * - summary: return summary instead of full list (default: false)
 * - date: get recommendations for specific date (YYYY-MM-DD format)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeRegistered = searchParams.get('includeRegistered') === 'true';
    const minMatchScore = parseInt(searchParams.get('minMatchScore') || '50');
    const isSummary = searchParams.get('summary') === 'true';
    const dateParam = searchParams.get('date');

    // If requesting summary for dashboard widget
    if (isSummary) {
      const summary = await getRecommendationsSummary(
        sessionUser.id,
        sessionUser.sport
      );

      return NextResponse.json({
        success: true,
        data: summary,
      });
    }

    // If requesting for specific date (calendar view)
    if (dateParam) {
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const recommendations = await getTournamentsForDate(
        sessionUser.id,
        sessionUser.sport,
        date
      );

      return NextResponse.json({
        success: true,
        data: {
          recommendations,
          date: dateParam,
          total: recommendations.length,
        },
      });
    }

    // Get full recommendations list
    const result = await getTournamentRecommendations(
      sessionUser.id,
      sessionUser.sport,
      {
        limit,
        offset,
        includeRegistered,
        minMatchScore,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
        hasAvailability: result.hasAvailability,
      },
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
