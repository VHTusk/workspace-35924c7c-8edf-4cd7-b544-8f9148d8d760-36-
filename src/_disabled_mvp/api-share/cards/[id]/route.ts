// VALORHIVE Shareable Card Image API
// Generates SVG images for social media sharing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SPORT_COLORS = {
  CORNHOLE: { primary: '#92400e', secondary: '#fef3c7', accent: '#fbbf24' },
  DARTS: { primary: '#1e40af', secondary: '#dbeafe', accent: '#3b82f6' },
};

// GET /api/share/cards/[id]/image - Get card image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params;
    
    const card = await db.shareableResultCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      return new NextResponse('Card not found', { status: 404 });
    }

    const sportColors = SPORT_COLORS[card.sport as keyof typeof SPORT_COLORS] || SPORT_COLORS.CORNHOLE;
    const stats = card.stats ? JSON.parse(card.stats) : {};

    // Generate SVG based on card type
    let svg: string;

    switch (card.cardType) {
      case 'match_result':
        svg = generateMatchResultSVG(card, stats, sportColors);
        break;
      case 'tournament_win':
        svg = generateTournamentWinSVG(card, stats, sportColors);
        break;
      case 'achievement':
        svg = generateAchievementSVG(card, stats, sportColors);
        break;
      case 'leaderboard_rank':
        svg = generateLeaderboardSVG(card, stats, sportColors);
        break;
      default:
        svg = generateDefaultSVG(card, sportColors);
    }

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // 24 hours
      },
    });
  } catch (error) {
    console.error('Error generating card image:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

const generateMatchResultSVG = (
  card: { title: string; subtitle: string; message: string; sport: string },
  stats: Record<string, unknown>,
  colors: { primary: string; secondary: string; accent: string }
): string => {
  const isWinner = stats.isWinner as boolean;
  const playerScore = stats.playerScore as number;
  const opponentScore = stats.opponentScore as number;
  const opponentName = stats.opponentName as string;

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>
  
  <!-- Sport Badge -->
  <rect x="1040" y="35" width="100" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1090" y="57" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${card.sport.toUpperCase()}
  </text>
  
  <!-- Result Icon -->
  <text x="600" y="180" font-size="100" text-anchor="middle">
    ${isWinner ? '🏆' : '⚔️'}
  </text>
  
  <!-- Title -->
  <text x="600" y="260" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
    ${card.title}
  </text>
  
  <!-- Score -->
  <text x="600" y="350" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    ${playerScore} - ${opponentScore}
  </text>
  
  <!-- Opponent -->
  <text x="600" y="420" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    vs ${opponentName}
  </text>
  
  <!-- Tournament -->
  <text x="600" y="480" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)" text-anchor="middle">
    ${card.subtitle}
  </text>
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;
};

const generateTournamentWinSVG = (
  card: { title: string; subtitle: string; message: string; sport: string },
  stats: Record<string, unknown>,
  colors: { primary: string; secondary: string; accent: string }
): string => {
  const rank = stats.rank as number;
  const prizePool = stats.prizePool as number | undefined;

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Decorative circles -->
  <circle cx="100" cy="100" r="150" fill="${colors.secondary}" opacity="0.1"/>
  <circle cx="1100" cy="530" r="200" fill="${colors.accent}" opacity="0.1"/>
  
  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>
  
  <!-- Sport Badge -->
  <rect x="1040" y="35" width="100" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1090" y="57" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${card.sport.toUpperCase()}
  </text>
  
  <!-- Trophy/Rank -->
  <text x="600" y="200" font-size="120" text-anchor="middle">
    ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️'}
  </text>
  
  <!-- Title -->
  <text x="600" y="290" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">
    ${card.title}
  </text>
  
  <!-- Tournament Name -->
  <text x="600" y="360" font-family="Arial, sans-serif" font-size="32" fill="${colors.accent}" text-anchor="middle">
    ${card.subtitle}
  </text>
  
  ${prizePool ? `
  <!-- Prize -->
  <rect x="450" y="400" width="300" height="50" rx="25" fill="${colors.accent}"/>
  <text x="600" y="435" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    💰 ₹${prizePool.toLocaleString('en-IN')} Prize
  </text>
  ` : ''}
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;
};

const generateAchievementSVG = (
  card: { title: string; subtitle: string; message: string; sport: string },
  _stats: Record<string, unknown>,
  colors: { primary: string; secondary: string; accent: string }
): string => {
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>
  
  <!-- Achievement Icon -->
  <text x="600" y="220" font-size="100" text-anchor="middle">
    🏅
  </text>
  
  <!-- Title -->
  <text x="600" y="300" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
    ${card.title}
  </text>
  
  <!-- Achievement Name -->
  <text x="600" y="380" font-family="Arial, sans-serif" font-size="36" fill="${colors.accent}" text-anchor="middle">
    ${card.subtitle}
  </text>
  
  <!-- Description -->
  <text x="600" y="450" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    ${card.message}
  </text>
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;
};

const generateLeaderboardSVG = (
  card: { title: string; subtitle: string; message: string; sport: string },
  stats: Record<string, unknown>,
  colors: { primary: string; secondary: string; accent: string }
): string => {
  const rank = stats.rank as number;

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>
  
  <!-- Rank Icon -->
  <text x="600" y="220" font-size="100" text-anchor="middle">
    ${rank <= 10 ? '🔥' : rank <= 100 ? '⭐' : '📊'}
  </text>
  
  <!-- Rank Number -->
  <text x="600" y="320" font-family="Arial, sans-serif" font-size="100" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    #${rank}
  </text>
  
  <!-- Title -->
  <text x="600" y="400" font-family="Arial, sans-serif" font-size="36" fill="white" text-anchor="middle">
    ${card.title}
  </text>
  
  <!-- Message -->
  <text x="600" y="460" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    ${card.message}
  </text>
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;
};

const generateDefaultSVG = (
  card: { title: string; subtitle: string; sport: string },
  colors: { primary: string; secondary: string; accent: string }
): string => {
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Logo -->
  <text x="600" y="280" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>
  
  <!-- Title -->
  <text x="600" y="360" font-family="Arial, sans-serif" font-size="36" fill="white" text-anchor="middle">
    ${card.title}
  </text>
  
  <!-- Subtitle -->
  <text x="600" y="420" font-family="Arial, sans-serif" font-size="24" fill="${colors.accent}" text-anchor="middle">
    ${card.subtitle}
  </text>
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;
};
