import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

/**
 * GET /api/player/achievements/showcase
 * 
 * Get player's achievement showcase (trophy cabinet)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;
    const sport = (searchParams.get('sport') || session.user.sport) as SportType;

    // Get showcase entries
    const showcase = await db.achievementShowcase.findMany({
      where: { userId, sport },
      orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }],
      take: 6,
    });

    // Get all achievements for user
    const allAchievements = await db.playerAchievement.findMany({
      where: { userId, sport },
      orderBy: { earnedAt: 'desc' },
      include: {
        badge: {
          select: { name: true, iconUrl: true, tier: true },
        },
      },
    });

    // Get recognition awards (titles)
    const titles = await db.recognitionAward.findMany({
      where: { 
        recipientId: userId, 
        recipientType: 'PLAYER',
        sport,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get tournament wins
    const tournamentWins = await db.tournamentResult.findMany({
      where: { userId, sport, rank: 1 },
      include: {
        tournament: {
          select: { name: true, scope: true, createdAt: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
      take: 10,
    });

    // Get podium finishes
    const podiumFinishes = await db.tournamentResult.findMany({
      where: { userId, sport, rank: { lte: 3 } },
      include: {
        tournament: {
          select: { name: true, scope: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      showcase,
      allAchievements,
      titles,
      tournamentWins,
      podiumFinishes,
      stats: {
        totalAchievements: allAchievements.length,
        totalWins: tournamentWins.length,
        totalPodiums: podiumFinishes.length,
        titlesHeld: titles.length,
      },
    });

  } catch (error) {
    console.error('Error fetching achievement showcase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/player/achievements/showcase
 * 
 * Add achievement to showcase slot
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { achievementId, slotIndex } = body;
    const userId = session.user.id;
    const sport = session.user.sport as SportType;

    // Get achievement details
    const achievement = await db.playerAchievement.findFirst({
      where: { id: achievementId, userId, sport },
    });

    if (!achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    // Check slot availability
    const existingSlot = await db.achievementShowcase.findUnique({
      where: { userId_sport_slotIndex: { userId, sport, slotIndex } },
    });

    if (existingSlot) {
      // Update existing slot
      await db.achievementShowcase.update({
        where: { id: existingSlot.id },
        data: {
          achievementId,
          title: achievement.title,
          description: achievement.description,
          iconUrl: achievement.badgeId,
          earnedAt: achievement.earnedAt,
        },
      });
    } else {
      // Create new slot
      await db.achievementShowcase.create({
        data: {
          userId,
          sport,
          slotIndex,
          achievementId,
          title: achievement.title,
          description: achievement.description,
          iconUrl: achievement.badgeId,
          earnedAt: achievement.earnedAt,
          displayOrder: slotIndex,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Achievement added to showcase',
    });

  } catch (error) {
    console.error('Error adding to showcase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/player/achievements/showcase
 * 
 * Remove achievement from showcase
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slotIndex = parseInt(searchParams.get('slotIndex') || '0');
    const userId = session.user.id;
    const sport = session.user.sport as SportType;

    await db.achievementShowcase.delete({
      where: { userId_sport_slotIndex: { userId, sport, slotIndex } },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error removing from showcase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/player/achievements/showcase
 * 
 * Share achievement to social media
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { showcaseId, platform } = body; // platform: 'twitter', 'whatsapp', 'facebook', 'linkedin'
    const userId = session.user.id;

    // Get showcase item
    const showcase = await db.achievementShowcase.findFirst({
      where: { id: showcaseId, userId },
    });

    if (!showcase) {
      return NextResponse.json({ error: 'Showcase item not found' }, { status: 404 });
    }

    // Update share count
    await db.achievementShowcase.update({
      where: { id: showcaseId },
      data: {
        shareCount: { increment: 1 },
        lastSharedAt: new Date(),
      },
    });

    // Generate share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/${session.user.sport}/profile/${userId}?achievement=${showcaseId}`;

    // Generate share text
    const shareText = `🏆 I earned "${showcase.title}" on VALORHIVE! ${shareUrl}`;

    // Generate platform-specific URLs
    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    };

    return NextResponse.json({
      success: true,
      shareUrl: shareUrls[platform] || shareUrl,
      text: shareText,
    });

  } catch (error) {
    console.error('Error sharing achievement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
