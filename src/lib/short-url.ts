// VALORHIVE Short URL Service
// Creates and manages short URLs for sharing

import { db } from './db';
import { SportType } from '@prisma/client';
import { nanoid } from 'nanoid';

// Short URL configuration
const SHORT_CODE_LENGTH = 7;

// Target types for short URLs
export type ShortUrlTargetType = 'player' | 'tournament' | 'org' | 'match' | 'card' | 'custom';

// Create short URL
export const createShortUrl = async (
  targetType: ShortUrlTargetType,
  targetId: string | null,
  targetUrl: string,
  options?: {
    sport?: SportType;
    createdById?: string;
    expiresInDays?: number;
  }
): Promise<{ shortCode: string; shortUrl: string; qrCodeUrl: string }> => {
  // Generate unique short code
  let shortCode = nanoid(SHORT_CODE_LENGTH);
  let attempts = 0;
  
  // Ensure uniqueness
  while (attempts < 5) {
    const existing = await db.shortUrlRedirect.findUnique({
      where: { shortCode },
    });
    
    if (!existing) break;
    shortCode = nanoid(SHORT_CODE_LENGTH);
    attempts++;
  }

  // Calculate expiry
  const expiresAt = options?.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  // Create short URL record
  const shortUrlRecord = await db.shortUrlRedirect.create({
    data: {
      shortCode,
      targetType,
      targetId,
      targetUrl,
      sport: options?.sport,
      createdById: options?.createdById,
      expiresAt,
      qrCodeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com'}/qr/${shortCode}.png`,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  
  return {
    shortCode,
    shortUrl: `${baseUrl}/s/${shortCode}`,
    qrCodeUrl: shortUrlRecord.qrCodeUrl || '',
  };
};

// Get short URL by short code
export const getShortUrl = async (shortCode: string): Promise<{
  found: boolean;
  targetUrl?: string;
  targetType?: ShortUrlTargetType;
  targetId?: string | null;
  clickCount?: number;
}> => {
  const shortUrl = await db.shortUrlRedirect.findUnique({
    where: { shortCode },
  });

  if (!shortUrl || !shortUrl.isActive) {
    return { found: false };
  }

  // Check expiry
  if (shortUrl.expiresAt && shortUrl.expiresAt < new Date()) {
    return { found: false };
  }

  // Increment click count
  await db.shortUrlRedirect.update({
    where: { shortCode },
    data: {
      clickCount: { increment: 1 },
      lastClickedAt: new Date(),
    },
  });

  return {
    found: true,
    targetUrl: shortUrl.targetUrl,
    targetType: shortUrl.targetType as ShortUrlTargetType,
    targetId: shortUrl.targetId,
    clickCount: shortUrl.clickCount + 1,
  };
};

// Create player profile short URL
export const createPlayerShortUrl = async (
  userId: string,
  sport: SportType
): Promise<{ shortCode: string; shortUrl: string }> => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const targetUrl = `${baseUrl}/${sport.toLowerCase()}/players/${userId}`;

  return createShortUrl('player', userId, targetUrl, { sport });
};

// Create tournament short URL
export const createTournamentShortUrl = async (
  tournamentId: string,
  sport: SportType
): Promise<{ shortCode: string; shortUrl: string }> => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const targetUrl = `${baseUrl}/${sport.toLowerCase()}/tournaments/${tournamentId}`;

  return createShortUrl('tournament', tournamentId, targetUrl, { sport });
};

// Get short URL stats
export const getShortUrlStats = async (shortCode: string): Promise<{
  exists: boolean;
  clicks?: number;
  createdAt?: Date;
  lastClickedAt?: Date | null;
}> => {
  const shortUrl = await db.shortUrlRedirect.findUnique({
    where: { shortCode },
    select: {
      clickCount: true,
      createdAt: true,
      lastClickedAt: true,
    },
  });

  if (!shortUrl) {
    return { exists: false };
  }

  return {
    exists: true,
    clicks: shortUrl.clickCount,
    createdAt: shortUrl.createdAt,
    lastClickedAt: shortUrl.lastClickedAt,
  };
};
