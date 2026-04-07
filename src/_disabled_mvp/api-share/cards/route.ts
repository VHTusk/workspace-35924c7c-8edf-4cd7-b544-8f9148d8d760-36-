// VALORHIVE Shareable Result Cards API
// Generate and manage shareable result cards for social media

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { SportType } from '@prisma/client';

const CARD_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';

// Generate a shareable card for match result
export const generateMatchResultCard = async (
  userId: string,
  matchId: string,
  sport: SportType
): Promise<{ cardId: string; shareUrl: string; imageUrl: string }> => {
  // Get match details
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      playerA: { select: { firstName: true, lastName: true } },
      playerB: { select: { firstName: true, lastName: true } },
      tournament: { select: { name: true, scope: true } },
    },
  });

  if (!match) throw new Error('Match not found');

  const isWinner = match.winnerId === userId;
  const isPlayerA = match.playerAId === userId;
  const playerScore = isPlayerA ? match.scoreA : match.scoreB;
  const opponentScore = isPlayerA ? match.scoreB : match.scoreA;
  const opponentName = isPlayerA 
    ? `${match.playerB?.firstName} ${match.playerB?.lastName}`
    : `${match.playerA?.firstName} ${match.playerA?.lastName}`;

  const cardId = nanoid(10);
  const shortCode = nanoid(7);

  const card = await db.shareableResultCard.create({
    data: {
      id: cardId,
      sport,
      cardType: 'match_result',
      matchId,
      userId,
      title: isWinner ? '🏆 Victory!' : 'Match Result',
      subtitle: match.tournament?.name || 'Tournament Match',
      message: `${playerScore} - ${opponentScore} vs ${opponentName}`,
      imageUrl: `${CARD_BASE_URL}/api/share/cards/${cardId}/image`,
      shareUrl: `${CARD_BASE_URL}/s/${shortCode}`,
      shortCode,
      stats: JSON.stringify({
        playerScore,
        opponentScore,
        opponentName,
        isWinner,
        pointsEarned: isWinner ? match.pointsA || match.pointsB : 0,
        tournamentName: match.tournament?.name,
        scope: match.tournament?.scope,
      }),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Create short URL
  await db.shortUrlRedirect.create({
    data: {
      shortCode,
      targetType: 'card',
      targetId: cardId,
      targetUrl: `${CARD_BASE_URL}/share/${cardId}`,
      sport,
    },
  });

  return {
    cardId: card.id,
    shareUrl: card.shareUrl,
    imageUrl: card.imageUrl,
  };
};

// Generate a shareable card for tournament win
export const generateTournamentWinCard = async (
  userId: string,
  tournamentId: string,
  sport: SportType,
  rank: number
): Promise<{ cardId: string; shareUrl: string; imageUrl: string }> => {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, scope: true, prizePool: true },
  });

  if (!tournament) throw new Error('Tournament not found');

  const cardId = nanoid(10);
  const shortCode = nanoid(7);

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const title = rank === 1 ? '🏆 Champion!' : rank <= 3 ? `${rankEmoji} Podium Finish!` : `${rankEmoji} Place Finish`;

  const card = await db.shareableResultCard.create({
    data: {
      id: cardId,
      sport,
      cardType: 'tournament_win',
      tournamentId,
      userId,
      title,
      subtitle: tournament.name,
      message: `Finished #${rank} out of all participants`,
      imageUrl: `${CARD_BASE_URL}/api/share/cards/${cardId}/image`,
      shareUrl: `${CARD_BASE_URL}/s/${shortCode}`,
      shortCode,
      stats: JSON.stringify({
        rank,
        tournamentName: tournament.name,
        scope: tournament.scope,
        prizePool: tournament.prizePool,
      }),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  });

  await db.shortUrlRedirect.create({
    data: {
      shortCode,
      targetType: 'card',
      targetId: cardId,
      targetUrl: `${CARD_BASE_URL}/share/${cardId}`,
      sport,
    },
  });

  return {
    cardId: card.id,
    shareUrl: card.shareUrl,
    imageUrl: card.imageUrl,
  };
};

// Generate a shareable card for achievement
export const generateAchievementCard = async (
  userId: string,
  achievementId: string,
  sport: SportType
): Promise<{ cardId: string; shareUrl: string; imageUrl: string }> => {
  const achievement = await db.playerAchievement.findUnique({
    where: { id: achievementId },
    select: { title: true, description: true, type: true },
  });

  if (!achievement) throw new Error('Achievement not found');

  const cardId = nanoid(10);
  const shortCode = nanoid(7);

  const card = await db.shareableResultCard.create({
    data: {
      id: cardId,
      sport,
      cardType: 'achievement',
      userId,
      title: '🎉 Achievement Unlocked!',
      subtitle: achievement.title,
      message: achievement.description,
      imageUrl: `${CARD_BASE_URL}/api/share/cards/${cardId}/image`,
      shareUrl: `${CARD_BASE_URL}/s/${shortCode}`,
      shortCode,
      stats: JSON.stringify({
        achievementType: achievement.type,
        achievementTitle: achievement.title,
      }),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });

  await db.shortUrlRedirect.create({
    data: {
      shortCode,
      targetType: 'card',
      targetId: cardId,
      targetUrl: `${CARD_BASE_URL}/share/${cardId}`,
      sport,
    },
  });

  return {
    cardId: card.id,
    shareUrl: card.shareUrl,
    imageUrl: card.imageUrl,
  };
};

// GET /api/share/cards - Get user's shareable cards
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const cardType = searchParams.get('cardType');
    const sport = searchParams.get('sport') as SportType;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { userId };
    if (cardType) where.cardType = cardType;
    if (sport) where.sport = sport;

    const cards = await db.shareableResultCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error('Error fetching shareable cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/share/cards - Create a new shareable card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, userId, matchId, tournamentId, achievementId, sport } = body;

    if (!userId || !sport || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'match_result':
        if (!matchId) throw new Error('Match ID required for match result card');
        result = await generateMatchResultCard(userId, matchId, sport, parseInt(matchId) ? matchId : matchId);
        break;
      case 'tournament_win':
        if (!tournamentId) throw new Error('Tournament ID required for tournament win card');
        result = await generateTournamentWinCard(userId, tournamentId, sport, body.rank || 1);
        break;
      case 'achievement':
        if (!achievementId) throw new Error('Achievement ID required for achievement card');
        result = await generateAchievementCard(userId, achievementId, sport);
        break;
      default:
        return NextResponse.json({ error: 'Invalid card type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shareable card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/share/cards - Track social share
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardId, platform } = body;

    if (!cardId || !platform) {
      return NextResponse.json({ error: 'Card ID and platform required' }, { status: 400 });
    }

    const platformField: Record<string, string> = {
      twitter: 'shareToTwitter',
      whatsapp: 'shareToWhatsApp',
      facebook: 'shareToFacebook',
      linkedin: 'shareToLinkedIn',
    };

    const field = platformField[platform.toLowerCase()];
    if (!field) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    await db.shareableResultCard.update({
      where: { id: cardId },
      data: {
        [field]: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
