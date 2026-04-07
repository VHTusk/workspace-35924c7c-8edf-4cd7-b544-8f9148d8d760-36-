/**
 * OG Image Generation API
 * GET /api/og/image?type=...&...
 * Generates PNG images for Open Graph social sharing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateMatchResultOGImage,
  generateTournamentWinOGImage,
  generateAchievementOGImage,
  generateLeaderboardOGImage,
  generateDefaultOGImage,
} from '@/lib/og-image-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const type = searchParams.get('type') || 'default';
    const sport = (searchParams.get('sport')?.toUpperCase() || 'CORNHOLE') as 'CORNHOLE' | 'DARTS';

    let imageBuffer: Buffer;

    switch (type) {
      case 'match':
        imageBuffer = await generateMatchResultOGImage({
          sport,
          winnerName: searchParams.get('winner') || 'Player 1',
          loserName: searchParams.get('loser') || 'Player 2',
          winnerScore: parseInt(searchParams.get('winnerScore') || '0'),
          loserScore: parseInt(searchParams.get('loserScore') || '0'),
          tournamentName: searchParams.get('tournament') || undefined,
          pointsEarned: parseInt(searchParams.get('points') || '0'),
        });
        break;

      case 'tournament':
        imageBuffer = await generateTournamentWinOGImage({
          sport,
          playerName: searchParams.get('player') || 'Player',
          tournamentName: searchParams.get('tournament') || 'Tournament',
          rank: parseInt(searchParams.get('rank') || '1'),
          prizePool: searchParams.get('prize') ? parseInt(searchParams.get('prize')!) : undefined,
          totalParticipants: searchParams.get('participants') ? parseInt(searchParams.get('participants')!) : undefined,
        });
        break;

      case 'achievement':
        imageBuffer = await generateAchievementOGImage({
          sport,
          playerName: searchParams.get('player') || 'Player',
          achievementName: searchParams.get('name') || 'Achievement',
          achievementDescription: searchParams.get('desc') || 'Unlocked a new achievement!',
          tier: searchParams.get('tier') as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | undefined,
        });
        break;

      case 'leaderboard':
        imageBuffer = await generateLeaderboardOGImage({
          sport,
          playerName: searchParams.get('player') || 'Player',
          rank: parseInt(searchParams.get('rank') || '1'),
          totalPoints: parseInt(searchParams.get('points') || '0'),
          scope: searchParams.get('scope') || undefined,
        });
        break;

      default:
        imageBuffer = await generateDefaultOGImage(sport);
    }

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        'CDN-Cache-Control': 'public, max-age=604800',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);

    // Return a simple fallback image
    const fallbackBuffer = await generateDefaultOGImage('CORNHOLE');
    return new NextResponse(new Uint8Array(fallbackBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
