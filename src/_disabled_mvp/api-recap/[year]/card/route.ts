import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getOrGenerateRecap, generateShareableText } from '@/lib/season-recap-generator';

/**
 * GET /api/recap/[year]/card
 * Get shareable card content for a season recap
 * 
 * Query params:
 * - sport: Sport type (CORNHOLE or DARTS) - required
 * - format: 'text' | 'json' (defaults to 'json')
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
    const format = searchParams.get('format') || 'json';

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

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        firstName: true, 
        lastName: true,
        hiddenElo: true,
        visiblePoints: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get recap
    const result = await getOrGenerateRecap(userId, sport, year);

    if (!result.success || !result.recap) {
      return NextResponse.json(
        { success: false, error: 'No recap data available for this season' },
        { status: 404 }
      );
    }

    const recap = result.recap;
    const playerName = `${user.firstName} ${user.lastName}`;
    const shareableText = generateShareableText(recap, playerName);

    // Calculate additional card data
    const winRate = recap.totalMatchesPlayed > 0 
      ? Math.round((recap.wins / recap.totalMatchesPlayed) * 100) 
      : 0;
    
    const eloChange = recap.endingElo - recap.startingElo;
    const eloChangeStr = eloChange >= 0 ? `+${Math.round(eloChange)}` : `${Math.round(eloChange)}`;

    // Generate card data
    const cardData = {
      // Player info
      playerName,
      sport: recap.sport,
      seasonYear: recap.seasonYear,
      
      // Key stats for card
      headline: `My ${recap.seasonYear} ${recap.sport.toLowerCase() === 'cornhole' ? 'Cornhole' : 'Darts'} Season`,
      
      // Main stats
      stats: {
        tournaments: recap.tournamentsPlayed,
        record: `${recap.wins}W - ${recap.losses}L`,
        winRate: `${winRate}%`,
        pointsEarned: recap.totalPointsEarned,
        eloChange: eloChangeStr,
        tierProgress: `${recap.startingTier} → ${recap.endingTier}`,
      },
      
      // Highlights
      highlights: {
        bestFinish: recap.bestFinish ? {
          rank: recap.bestFinish,
          tournament: recap.bestTournamentName,
        } : null,
        signatureScoreline: recap.signatureScoreline,
        biggestRival: recap.mostPlayedRivalName ? {
          name: recap.mostPlayedRivalName,
          record: `${recap.rivalWinCount}/${recap.rivalMatchCount}`,
        } : null,
        longestStreak: recap.longestWinStreak,
        topFiveFinishes: recap.topFiveFinishes,
        hoursPlayed: recap.estimatedHours,
      },
      
      // Upset win
      biggestUpset: recap.biggestUpsetWin,
      
      // Shareable text
      shareableText,
      
      // Share URLs
      shareUrls: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(shareableText)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareableText)}`,
      },
    };

    // Increment share count
    await db.seasonRecap.update({
      where: {
        userId_sport_seasonYear: {
          userId,
          sport,
          seasonYear: year,
        }
      },
      data: {
        shareCount: { increment: 1 }
      }
    }).catch(() => {
      // Ignore error if recap doesn't exist
    });

    if (format === 'text') {
      return new NextResponse(shareableText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: cardData,
    });
  } catch (error) {
    console.error('Error generating card:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate shareable card' },
      { status: 500 }
    );
  }
}
