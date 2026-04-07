/**
 * Player Card Generator for VALORHIVE
 * 
 * Generates shareable stat cards for players:
 * - Profile Card: Name, avatar, tier badge, win rate, matches played
 * - Stats Card: Detailed stats (wins, losses, avg score, best win streak)
 * - H2H Card: Head-to-head record against a specific opponent
 * - Tournament Card: Tournament finish position, bracket highlight
 */

import { db } from './db';
import { getEloTier, getTierFromPoints } from './tier';
import type { SportType } from '@prisma/client';

// Card types
export type CardType = 'profile' | 'stats' | 'h2h' | 'tournament';

// Sport-specific theming
export const SPORT_THEMES = {
  CORNHOLE: {
    primaryColor: '#16a34a', // Green
    gradientFrom: '#166534',
    gradientTo: '#15803d',
    accentColor: '#4ade80',
    bgGradient: 'from-green-600 to-green-700',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  DARTS: {
    primaryColor: '#14b8a6', // Teal
    gradientFrom: '#0f766e',
    gradientTo: '#0d9488',
    accentColor: '#5eead4',
    bgGradient: 'from-teal-600 to-teal-700',
    textColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
} as const;

// Tier colors for badges
export const TIER_COLORS = {
  Unranked: { bg: '#9CA3AF', text: '#374151', border: '#6B7280' },
  Bronze: { bg: '#CD7F32', text: '#ffffff', border: '#A0522D' },
  Silver: { bg: '#C0C0C0', text: '#1f2937', border: '#9CA3AF' },
  Gold: { bg: '#FFD700', text: '#1f2937', border: '#F59E0B' },
  Platinum: { bg: '#008080', text: '#ffffff', border: '#0D9488' },
  Diamond: { bg: '#4169E1', text: '#ffffff', border: '#3B82F6' },
} as const;

// Card dimensions (optimized for social media sharing - 1200x630px recommended)
export const CARD_DIMENSIONS = {
  width: 1200,
  height: 630,
  profile: { width: 600, height: 315 }, // Smaller variant for in-app preview
} as const;

// Interfaces for card data
export interface ProfileCardData {
  userId: string;
  name: string;
  city?: string | null;
  state?: string | null;
  sport: SportType;
  tier: string;
  tierColor: string;
  visiblePoints: number;
  hiddenElo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsWon: number;
  currentStreak: number;
  bestStreak: number;
  avatarUrl?: string | null;
}

export interface StatsCardData extends ProfileCardData {
  avgScore: number;
  highestElo: number;
  tournamentsPlayed: number;
  pointsThisMonth: number;
  matchesThisMonth: number;
  recentForm: ('W' | 'L')[];
}

export interface H2HCardData {
  playerA: {
    id: string;
    name: string;
    tier: string;
    tierColor: string;
    points: number;
    wins: number;
  };
  playerB: {
    id: string;
    name: string;
    tier: string;
    tierColor: string;
    points: number;
    wins: number;
  };
  sport: SportType;
  totalMatches: number;
  playerAWins: number;
  playerBWins: number;
}

export interface TournamentCardData {
  userId: string;
  name: string;
  tier: string;
  tierColor: string;
  sport: SportType;
  tournamentName: string;
  tournamentScope: string;
  finishPosition: number;
  totalParticipants: number;
  prizeWon?: number;
  matchesWon: number;
  matchesLost: number;
  date: Date;
}

/**
 * Generate profile card data for a player
 */
export async function generateProfileCardData(
  userId: string,
  sport: SportType
): Promise<ProfileCardData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      rating: true,
      tournamentResults: {
        where: { sport },
        orderBy: { awardedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const matchesPlayed = user.rating?.matchesPlayed ?? 0;
  const wins = user.rating?.wins ?? 0;
  const losses = user.rating?.losses ?? 0;
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

  const eloTier = getEloTier(user.hiddenElo, matchesPlayed);
  const tierInfo = TIER_COLORS[eloTier.name as keyof typeof TIER_COLORS] || TIER_COLORS.Bronze;

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    city: user.city,
    state: user.state,
    sport,
    tier: eloTier.name,
    tierColor: tierInfo.bg,
    visiblePoints: user.visiblePoints,
    hiddenElo: user.hiddenElo,
    matchesPlayed,
    wins,
    losses,
    winRate,
    tournamentsWon: user.rating?.tournamentsWon ?? 0,
    currentStreak: user.rating?.currentStreak ?? 0,
    bestStreak: user.rating?.bestStreak ?? 0,
  };
}

/**
 * Generate detailed stats card data for a player
 */
export async function generateStatsCardData(
  userId: string,
  sport: SportType
): Promise<StatsCardData | null> {
  const profileData = await generateProfileCardData(userId, sport);
  if (!profileData) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      rating: true,
      matchesAsA: {
        where: { sport, outcome: 'PLAYED' },
        take: 10,
        orderBy: { playedAt: 'desc' },
      },
    },
  });

  if (!user) return null;

  // Calculate average score (simplified)
  const matchesAsA = user.matchesAsA;
  let totalScore = 0;
  let scoreCount = 0;
  
  for (const match of matchesAsA) {
    if (match.scoreA !== null && match.scoreA !== undefined) {
      totalScore += match.scoreA;
      scoreCount++;
    }
  }
  
  const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  // Get recent form (last 5 matches)
  const recentMatches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: userId, sport },
        { playerBId: userId, sport },
      ],
    },
    orderBy: { playedAt: 'desc' },
    take: 5,
  });

  const recentForm: ('W' | 'L')[] = recentMatches.map(match => {
    if (match.winnerId === userId) return 'W';
    return 'L';
  });

  // Get points earned this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyMatches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: userId, sport, playedAt: { gte: startOfMonth } },
        { playerBId: userId, sport, playedAt: { gte: startOfMonth } },
      ],
    },
  });

  let pointsThisMonth = 0;
  for (const match of monthlyMatches) {
    if (match.playerAId === userId && match.pointsA) {
      pointsThisMonth += match.pointsA;
    } else if (match.playerBId === userId && match.pointsB) {
      pointsThisMonth += match.pointsB;
    }
  }

  return {
    ...profileData,
    avgScore,
    highestElo: user.rating?.highestElo ?? user.hiddenElo,
    tournamentsPlayed: user.rating?.tournamentsPlayed ?? 0,
    pointsThisMonth,
    matchesThisMonth: monthlyMatches.length,
    recentForm,
  };
}

/**
 * Generate H2H card data between two players
 */
export async function generateH2HCardData(
  playerAId: string,
  playerBId: string,
  sport: SportType
): Promise<H2HCardData | null> {
  const [playerA, playerB] = await Promise.all([
    db.user.findUnique({
      where: { id: playerAId },
      include: { rating: true },
    }),
    db.user.findUnique({
      where: { id: playerBId },
      include: { rating: true },
    }),
  ]);

  if (!playerA || !playerB) return null;

  // Get all matches between these players
  const matches = await db.match.findMany({
    where: {
      sport,
      OR: [
        { playerAId, playerBId },
        { playerAId: playerBId, playerBId: playerAId },
      ],
    },
  });

  let playerAWins = 0;
  let playerBWins = 0;

  for (const match of matches) {
    if (match.winnerId === playerAId) playerAWins++;
    else if (match.winnerId === playerBId) playerBWins++;
  }

  const getTier = (elo: number, matches: number) => {
    const tier = getEloTier(elo, matches);
    const colors = TIER_COLORS[tier.name as keyof typeof TIER_COLORS] || TIER_COLORS.Bronze;
    return { name: tier.name, color: colors.bg };
  };

  const tierA = getTier(playerA.hiddenElo, playerA.rating?.matchesPlayed ?? 0);
  const tierB = getTier(playerB.hiddenElo, playerB.rating?.matchesPlayed ?? 0);

  return {
    playerA: {
      id: playerA.id,
      name: `${playerA.firstName} ${playerA.lastName}`,
      tier: tierA.name,
      tierColor: tierA.color,
      points: playerA.visiblePoints,
      wins: playerAWins,
    },
    playerB: {
      id: playerB.id,
      name: `${playerB.firstName} ${playerB.lastName}`,
      tier: tierB.name,
      tierColor: tierB.color,
      points: playerB.visiblePoints,
      wins: playerBWins,
    },
    sport,
    totalMatches: matches.length,
    playerAWins,
    playerBWins,
  };
}

/**
 * Generate tournament card data for a player's tournament finish
 */
export async function generateTournamentCardData(
  userId: string,
  tournamentId: string,
  sport: SportType
): Promise<TournamentCardData | null> {
  const [user, tournamentResult, tournament] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: { rating: true },
    }),
    db.tournamentResult.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    }),
    db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        results: true,
        matches: {
          where: {
            OR: [{ playerAId: userId }, { playerBId: userId }],
          },
        },
      },
    }),
  ]);

  if (!user || !tournamentResult || !tournament) return null;

  const matchesWon = tournament.matches.filter(m => m.winnerId === userId).length;
  const matchesLost = tournament.matches.filter(
    m => (m.playerAId === userId || m.playerBId === userId) && m.winnerId !== userId
  ).length;

  const tier = getEloTier(user.hiddenElo, user.rating?.matchesPlayed ?? 0);
  const tierInfo = TIER_COLORS[tier.name as keyof typeof TIER_COLORS] || TIER_COLORS.Bronze;

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    tier: tier.name,
    tierColor: tierInfo.bg,
    sport,
    tournamentName: tournament.name,
    tournamentScope: tournament.scope ?? 'CITY',
    finishPosition: tournamentResult.rank,
    totalParticipants: tournament.results.length,
    prizeWon: tournamentResult.bonusPoints,
    matchesWon,
    matchesLost,
    date: tournament.endDate,
  };
}

/**
 * Generate SVG card markup for profile card
 * This creates an SVG that can be rendered as an image
 */
export function generateProfileCardSVG(data: ProfileCardData): string {
  const theme = SPORT_THEMES[data.sport];
  const initials = data.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  
  return `
<svg width="${CARD_DIMENSIONS.width}" height="${CARD_DIMENSIONS.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.gradientFrom};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${theme.gradientTo};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${theme.accentColor};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${theme.accentColor};stop-opacity:0" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGradient)" rx="20" />
  
  <!-- Decorative accent -->
  <rect x="0" y="0" width="400" height="630" fill="url(#accentGradient)" rx="20" />
  
  <!-- Brand header -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="rgba(255,255,255,0.9)">VALORHIVE</text>
  <text x="60" y="85" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.7)">${data.sport}</text>
  
  <!-- Avatar circle -->
  <circle cx="200" cy="280" r="100" fill="rgba(255,255,255,0.2)" stroke="${theme.accentColor}" stroke-width="4"/>
  <text x="200" y="300" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
  
  <!-- Tier badge -->
  <rect x="140" y="400" width="120" height="36" fill="${data.tierColor}" rx="18"/>
  <text x="200" y="425" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${data.tier.toUpperCase()}</text>
  
  <!-- Player name -->
  <text x="200" y="475" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${data.name}</text>
  <text x="200" y="510" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">${data.city && data.state ? `${data.city}, ${data.state}` : ''}</text>
  
  <!-- Stats section -->
  <g transform="translate(450, 180)">
    <!-- Points -->
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">POINTS</text>
    <text x="0" y="40" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">${data.visiblePoints.toLocaleString()}</text>
    
    <!-- Win Rate -->
    <text x="300" y="0" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">WIN RATE</text>
    <text x="300" y="40" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">${data.winRate}%</text>
    
    <!-- Matches -->
    <text x="0" y="120" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">MATCHES</text>
    <text x="0" y="160" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">${data.matchesPlayed}</text>
    
    <!-- Tournaments Won -->
    <text x="300" y="120" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">TOURNAMENTS</text>
    <text x="300" y="160" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">${data.tournamentsWon}</text>
    
    <!-- W/L Record -->
    <text x="0" y="240" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">RECORD</text>
    <text x="0" y="280" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">${data.wins}W - ${data.losses}L</text>
    
    <!-- Win Streak -->
    <text x="300" y="240" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">BEST STREAK</text>
    <text x="300" y="280" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">${data.bestStreak}</text>
  </g>
  
  <!-- Footer -->
  <text x="${CARD_DIMENSIONS.width - 60}" y="${CARD_DIMENSIONS.height - 30}" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.5)" text-anchor="end">valorhive.com</text>
</svg>`;
}

/**
 * Generate SVG card markup for H2H card
 */
export function generateH2HCardSVG(data: H2HCardData): string {
  const theme = SPORT_THEMES[data.sport];
  const initialsA = data.playerA.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const initialsB = data.playerB.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  
  return `
<svg width="${CARD_DIMENSIONS.width}" height="${CARD_DIMENSIONS.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1f2937;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#111827;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGradient)" rx="20" />
  
  <!-- Brand header -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="rgba(255,255,255,0.9)">VALORHIVE H2H</text>
  <text x="60" y="85" font-family="Arial, sans-serif" font-size="16" fill="${theme.accentColor}">${data.sport}</text>
  
  <!-- Player A Section -->
  <g transform="translate(100, 200)">
    <circle cx="100" cy="80" r="70" fill="rgba(52, 211, 153, 0.2)" stroke="#34d399" stroke-width="3"/>
    <text x="100" y="100" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${initialsA}</text>
    
    <rect x="40" y="170" width="120" height="28" fill="${data.playerA.tierColor}" rx="14"/>
    <text x="100" y="190" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${data.playerA.tier.toUpperCase()}</text>
    
    <text x="100" y="230" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${data.playerA.name}</text>
    
    <text x="100" y="300" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#34d399" text-anchor="middle">${data.playerAWins}</text>
    <text x="100" y="340" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">WINS</text>
  </g>
  
  <!-- VS Section -->
  <g transform="translate(500, 280)">
    <circle cx="100" cy="70" r="50" fill="rgba(255,255,255,0.1)"/>
    <text x="100" y="85" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="rgba(255,255,255,0.8)" text-anchor="middle">VS</text>
    <text x="100" y="130" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.6)" text-anchor="middle">${data.totalMatches} matches</text>
  </g>
  
  <!-- Player B Section -->
  <g transform="translate(700, 200)">
    <circle cx="100" cy="80" r="70" fill="rgba(248, 113, 113, 0.2)" stroke="#f87171" stroke-width="3"/>
    <text x="100" y="100" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${initialsB}</text>
    
    <rect x="40" y="170" width="120" height="28" fill="${data.playerB.tierColor}" rx="14"/>
    <text x="100" y="190" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${data.playerB.tier.toUpperCase()}</text>
    
    <text x="100" y="230" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${data.playerB.name}</text>
    
    <text x="100" y="300" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#f87171" text-anchor="middle">${data.playerBWins}</text>
    <text x="100" y="340" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">WINS</text>
  </g>
  
  <!-- Footer -->
  <text x="${CARD_DIMENSIONS.width - 60}" y="${CARD_DIMENSIONS.height - 30}" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.5)" text-anchor="end">valorhive.com</text>
</svg>`;
}

/**
 * Convert SVG to base64 data URL
 */
export function svgToDataUrl(svg: string): string {
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Get or create player card
 */
export async function getOrCreatePlayerCard(
  userId: string,
  sport: SportType,
  cardType: CardType,
  h2hPlayerId?: string,
  tournamentId?: string
): Promise<{ imageUrl: string; data: ProfileCardData | StatsCardData | H2HCardData | TournamentCardData | null }> {
  // Check for existing card
  const existingCard = await db.playerCard.findUnique({
    where: {
      userId_sport_cardType: {
        userId,
        sport,
        cardType,
      },
    },
  });

  // Generate card data based on type
  let cardData: ProfileCardData | StatsCardData | H2HCardData | TournamentCardData | null = null;
  let svgMarkup = '';

  switch (cardType) {
    case 'profile':
      cardData = await generateProfileCardData(userId, sport);
      if (cardData) {
        svgMarkup = generateProfileCardSVG(cardData);
      }
      break;
    case 'stats':
      cardData = await generateStatsCardData(userId, sport);
      if (cardData) {
        svgMarkup = generateProfileCardSVG(cardData); // Use same template with more data
      }
      break;
    case 'h2h':
      if (h2hPlayerId) {
        cardData = await generateH2HCardData(userId, h2hPlayerId, sport);
        if (cardData) {
          svgMarkup = generateH2HCardSVG(cardData);
        }
      }
      break;
    case 'tournament':
      if (tournamentId) {
        cardData = await generateTournamentCardData(userId, tournamentId, sport);
        // Tournament cards need their own template
        if (cardData) {
          svgMarkup = generateProfileCardSVG(cardData as ProfileCardData); // Simplified for now
        }
      }
      break;
  }

  if (!cardData) {
    return { imageUrl: '', data: null };
  }

  const imageUrl = svgToDataUrl(svgMarkup);

  // Create or update card record
  if (existingCard) {
    await db.playerCard.update({
      where: { id: existingCard.id },
      data: {
        imageUrl,
        dataSnapshot: JSON.stringify(cardData),
        generatedAt: new Date(),
      },
    });
  } else {
    await db.playerCard.create({
      data: {
        userId,
        sport,
        cardType,
        imageUrl,
        dataSnapshot: JSON.stringify(cardData),
      },
    });
  }

  return { imageUrl, data: cardData };
}

/**
 * Regenerate a player card
 */
export async function regeneratePlayerCard(
  userId: string,
  sport: SportType,
  cardType: CardType
): Promise<{ imageUrl: string } | null> {
  const result = await getOrCreatePlayerCard(userId, sport, cardType);
  if (!result.data) return null;
  return { imageUrl: result.imageUrl };
}

/**
 * Generate WhatsApp share message for player card
 */
export function generateWhatsAppShareMessage(data: ProfileCardData): string {
  return `🏆 *My ${data.sport} Stats on VALORHIVE*

👤 *${data.name}*
🎖️ *${data.tier} Tier*
📊 *Win Rate:* ${data.winRate}%
🎮 *Matches:* ${data.matchesPlayed} (${data.wins}W - ${data.losses}L)
🏆 *Tournaments Won:* ${data.tournamentsWon}

Get your own stat card at valorhive.com

#VALORHIVE #${data.sport}Player #${data.tier}Tier`;
}

/**
 * Generate WhatsApp Status share URL
 * Note: WhatsApp Status doesn't have a direct API, but this generates
 * a shareable link that users can use to post to their status
 */
export function getWhatsAppStatusShareUrl(cardImageUrl: string, playerData: ProfileCardData): string {
  const message = generateWhatsAppShareMessage(playerData);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Generate all share URLs for a player card
 */
export function getAllShareUrls(cardImageUrl: string, playerData: ProfileCardData): {
  whatsapp: string;
  whatsappStatus: string;
  twitter: string;
  facebook: string;
  telegram: string;
  email: string;
} {
  const message = generateWhatsAppShareMessage(playerData);
  const profileUrl = `https://valorhive.com/players/${playerData.userId}`;
  
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message}\n\nView profile: ${profileUrl}`)}`,
    whatsappStatus: `https://wa.me/?text=${encodeURIComponent(message)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(profileUrl)}&hashtags=VALORHIVE,${playerData.sport}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(message)}`,
    email: `mailto:?subject=${encodeURIComponent(`My ${playerData.sport} Stats on VALORHIVE`)}&body=${encodeURIComponent(`${message}\n\nView my profile: ${profileUrl}`)}`,
  };
}
