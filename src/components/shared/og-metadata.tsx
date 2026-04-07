/**
 * OG Metadata Component for VALORHIVE
 * Generates Open Graph and Twitter Card meta tags for social sharing
 */

interface OGMetadataProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  url?: string;
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  twitterSite?: string;
  twitterCreator?: string;
}

export function OGMetadata({
  title,
  description,
  ogImage,
  ogType = 'website',
  url,
  siteName = 'VALORHIVE',
  twitterCard = 'summary_large_image',
  twitterSite = '@valorhive',
  twitterCreator = '@valorhive',
}: OGMetadataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const fullUrl = url ? `${baseUrl}${url}` : baseUrl;
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`) : `${baseUrl}/api/og/image?type=default`;

  return (
    <>
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}

      {/* Additional SEO */}
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
    </>
  );
}

/**
 * Generate OG image URL for match result
 */
export function getMatchResultOGUrl(params: {
  sport: 'CORNHOLE' | 'DARTS';
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  tournament?: string;
  points: number;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const query = new URLSearchParams({
    type: 'match',
    sport: params.sport,
    winner: params.winner,
    loser: params.loser,
    winnerScore: params.winnerScore.toString(),
    loserScore: params.loserScore.toString(),
    points: params.points.toString(),
  });
  if (params.tournament) query.set('tournament', params.tournament);
  return `${baseUrl}/api/og/image?${query.toString()}`;
}

/**
 * Generate OG image URL for tournament win
 */
export function getTournamentWinOGUrl(params: {
  sport: 'CORNHOLE' | 'DARTS';
  player: string;
  tournament: string;
  rank: number;
  prize?: number;
  participants?: number;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const query = new URLSearchParams({
    type: 'tournament',
    sport: params.sport,
    player: params.player,
    tournament: params.tournament,
    rank: params.rank.toString(),
  });
  if (params.prize) query.set('prize', params.prize.toString());
  if (params.participants) query.set('participants', params.participants.toString());
  return `${baseUrl}/api/og/image?${query.toString()}`;
}

/**
 * Generate OG image URL for achievement
 */
export function getAchievementOGUrl(params: {
  sport: 'CORNHOLE' | 'DARTS';
  player: string;
  name: string;
  desc: string;
  tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const query = new URLSearchParams({
    type: 'achievement',
    sport: params.sport,
    player: params.player,
    name: params.name,
    desc: params.desc,
  });
  if (params.tier) query.set('tier', params.tier);
  return `${baseUrl}/api/og/image?${query.toString()}`;
}

/**
 * Generate OG image URL for leaderboard position
 */
export function getLeaderboardOGUrl(params: {
  sport: 'CORNHOLE' | 'DARTS';
  player: string;
  rank: number;
  points: number;
  scope?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  const query = new URLSearchParams({
    type: 'leaderboard',
    sport: params.sport,
    player: params.player,
    rank: params.rank.toString(),
    points: params.points.toString(),
  });
  if (params.scope) query.set('scope', params.scope);
  return `${baseUrl}/api/og/image?${query.toString()}`;
}
