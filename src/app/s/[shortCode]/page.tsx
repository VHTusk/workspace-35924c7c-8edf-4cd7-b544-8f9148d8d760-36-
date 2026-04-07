// VALORHIVE Short URL Redirect Page
// Redirects short URLs to their target destinations

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

interface ShortCodePageProps {
  params: Promise<{ shortCode: string }>;
}

export default async function ShortCodePage({ params }: ShortCodePageProps) {
  const { shortCode } = await params;

  const shortUrl = await db.shortUrlRedirect.findUnique({
    where: { shortCode },
  });

  if (!shortUrl || !shortUrl.isActive) {
    // Redirect to 404 page
    redirect('/not-found');
  }

  // Check expiry
  if (shortUrl.expiresAt && shortUrl.expiresAt < new Date()) {
    redirect('/not-found');
  }

  // Increment click count
  await db.shortUrlRedirect.update({
    where: { shortCode },
    data: {
      clickCount: { increment: 1 },
      lastClickedAt: new Date(),
    },
  });

  // Redirect to target URL
  redirect(shortUrl.targetUrl);
}

// Generate metadata for the page
export async function generateMetadata({ params }: ShortCodePageProps) {
  const { shortCode } = await params;

  const shortUrl = await db.shortUrlRedirect.findUnique({
    where: { shortCode },
  });

  if (!shortUrl) {
    return {
      title: 'Link Not Found - VALORHIVE',
    };
  }

  // Return appropriate metadata based on target type
  const titles: Record<string, string> = {
    player: 'Player Profile - VALORHIVE',
    tournament: 'Tournament - VALORHIVE',
    org: 'Organization - VALORHIVE',
    match: 'Match Result - VALORHIVE',
    card: 'Shareable Card - VALORHIVE',
  };

  return {
    title: titles[shortUrl.targetType] || 'VALORHIVE',
  };
}
