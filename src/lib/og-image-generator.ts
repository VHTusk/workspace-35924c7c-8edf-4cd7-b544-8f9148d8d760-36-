/**
 * VALORHIVE OG Image Generator
 * Generates PNG images for Open Graph social sharing
 * Uses Sharp for SVG to PNG conversion
 */

import sharp from 'sharp';

// Sport-specific color schemes
const SPORT_COLORS = {
  CORNHOLE: { primary: '#92400e', secondary: '#fef3c7', accent: '#fbbf24', gradient: '#b45309' },
  DARTS: { primary: '#1e40af', secondary: '#dbeafe', accent: '#3b82f6', gradient: '#1d4ed8' },
};

interface MatchResultData {
  sport: 'CORNHOLE' | 'DARTS';
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  tournamentName?: string;
  pointsEarned: number;
}

interface TournamentWinData {
  sport: 'CORNHOLE' | 'DARTS';
  playerName: string;
  tournamentName: string;
  rank: number;
  prizePool?: number;
  totalParticipants?: number;
}

interface AchievementData {
  sport: 'CORNHOLE' | 'DARTS';
  playerName: string;
  achievementName: string;
  achievementDescription: string;
  tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

interface LeaderboardData {
  sport: 'CORNHOLE' | 'DARTS';
  playerName: string;
  rank: number;
  totalPoints: number;
  scope?: string;
}

/**
 * Generate PNG buffer from SVG string
 */
async function svgToPng(svg: string, width = 1200, height = 630): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(width, height)
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
}

/**
 * Generate match result OG image
 */
export async function generateMatchResultOGImage(data: MatchResultData): Promise<Buffer> {
  const colors = SPORT_COLORS[data.sport] || SPORT_COLORS.CORNHOLE;
  const isWinner = data.winnerScore > data.loserScore;

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.gradient};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="100" cy="100" r="200" fill="${colors.secondary}" opacity="0.05"/>
  <circle cx="1100" cy="530" r="250" fill="${colors.accent}" opacity="0.05"/>

  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>

  <!-- Sport Badge -->
  <rect x="1040" y="35" width="120" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1100" y="57" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${data.sport}
  </text>

  <!-- Result Icon -->
  <text x="600" y="160" font-size="80" text-anchor="middle" filter="url(#glow)">
    ${isWinner ? '🏆' : '⚔️'}
  </text>

  <!-- Title -->
  <text x="600" y="230" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">
    ${isWinner ? 'Victory!' : 'Match Result'}
  </text>

  <!-- Score Box -->
  <rect x="250" y="270" width="700" height="120" rx="20" fill="rgba(255,255,255,0.1)"/>

  <!-- Winner Name -->
  <text x="350" y="340" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="white" text-anchor="start">
    ${data.winnerName.length > 15 ? data.winnerName.substring(0, 15) + '...' : data.winnerName}
  </text>

  <!-- Score -->
  <text x="600" y="355" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    ${data.winnerScore} - ${data.loserScore}
  </text>

  <!-- Loser Name -->
  <text x="850" y="340" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="rgba(255,255,255,0.8)" text-anchor="end">
    ${data.loserName.length > 15 ? data.loserName.substring(0, 15) + '...' : data.loserName}
  </text>

  <!-- Tournament Name -->
  ${data.tournamentName ? `
  <text x="600" y="440" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    📍 ${data.tournamentName.length > 40 ? data.tournamentName.substring(0, 40) + '...' : data.tournamentName}
  </text>
  ` : ''}

  <!-- Points Badge -->
  <rect x="450" y="470" width="300" height="50" rx="25" fill="${colors.accent}"/>
  <text x="600" y="505" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    ⭐ +${data.pointsEarned} Points Earned
  </text>

  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;

  return svgToPng(svg);
}

/**
 * Generate tournament win OG image
 */
export async function generateTournamentWinOGImage(data: TournamentWinData): Promise<Buffer> {
  const colors = SPORT_COLORS[data.sport] || SPORT_COLORS.CORNHOLE;

  const rankEmoji = data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🎖️';
  const title = data.rank === 1 ? 'Champion!' : data.rank <= 3 ? 'Podium Finish!' : `#${data.rank} Place`;

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.gradient};stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="100" cy="100" r="200" fill="${colors.secondary}" opacity="0.08"/>
  <circle cx="1100" cy="530" r="250" fill="${colors.accent}" opacity="0.08"/>
  <circle cx="600" cy="315" r="400" fill="${colors.accent}" opacity="0.03"/>

  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>

  <!-- Sport Badge -->
  <rect x="1040" y="35" width="120" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1100" y="57" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${data.sport}
  </text>

  <!-- Trophy/Rank -->
  <text x="600" y="180" font-size="100" text-anchor="middle" filter="url(#glow)">
    ${rankEmoji}
  </text>

  <!-- Title -->
  <text x="600" y="260" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
    ${title}
  </text>

  <!-- Player Name -->
  <text x="600" y="330" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="${colors.accent}" text-anchor="middle">
    ${data.playerName}
  </text>

  <!-- Tournament Name -->
  <text x="600" y="390" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    ${data.tournamentName.length > 45 ? data.tournamentName.substring(0, 45) + '...' : data.tournamentName}
  </text>

  ${data.prizePool ? `
  <!-- Prize Badge -->
  <rect x="400" y="420" width="400" height="60" rx="30" fill="${colors.accent}"/>
  <text x="600" y="462" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    💰 ₹${data.prizePool.toLocaleString('en-IN')} Prize
  </text>
  ` : ''}

  ${data.totalParticipants ? `
  <text x="600" y="520" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">
    ${data.totalParticipants} Participants
  </text>
  ` : ''}

  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;

  return svgToPng(svg);
}

/**
 * Generate achievement OG image
 */
export async function generateAchievementOGImage(data: AchievementData): Promise<Buffer> {
  const colors = SPORT_COLORS[data.sport] || SPORT_COLORS.CORNHOLE;

  const tierColors = {
    BRONZE: '#cd7f32',
    SILVER: '#c0c0c0',
    GOLD: '#ffd700',
    PLATINUM: '#e5e4e2',
  };

  const tierColor = data.tier ? tierColors[data.tier] : colors.accent;

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.gradient};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="600" cy="250" r="200" fill="${tierColor}" opacity="0.1"/>

  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>

  <!-- Sport Badge -->
  <rect x="1040" y="35" width="120" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1100" y="57" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${data.sport}
  </text>

  <!-- Achievement Icon -->
  <text x="600" y="200" font-size="100" text-anchor="middle" filter="url(#glow)">
    🏅
  </text>

  <!-- Title -->
  <text x="600" y="280" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">
    Achievement Unlocked!
  </text>

  <!-- Achievement Name -->
  <text x="600" y="350" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="${tierColor}" text-anchor="middle">
    ${data.achievementName}
  </text>

  ${data.tier ? `
  <!-- Tier Badge -->
  <rect x="500" y="380" width="200" height="35" rx="17" fill="${tierColor}"/>
  <text x="600" y="405" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    ${data.tier} TIER
  </text>
  ` : ''}

  <!-- Player Name -->
  <text x="600" y="460" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    ${data.playerName}
  </text>

  <!-- Description -->
  <text x="600" y="510" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">
    ${data.achievementDescription.length > 60 ? data.achievementDescription.substring(0, 60) + '...' : data.achievementDescription}
  </text>

  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;

  return svgToPng(svg);
}

/**
 * Generate leaderboard OG image
 */
export async function generateLeaderboardOGImage(data: LeaderboardData): Promise<Buffer> {
  const colors = SPORT_COLORS[data.sport] || SPORT_COLORS.CORNHOLE;

  const rankEmoji = data.rank <= 10 ? '🔥' : data.rank <= 100 ? '⭐' : '📊';

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.gradient};stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="600" cy="280" r="250" fill="${colors.accent}" opacity="0.05"/>

  <!-- Logo -->
  <text x="60" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="white">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>

  <!-- Sport Badge -->
  <rect x="1040" y="35" width="120" height="30" rx="15" fill="${colors.secondary}"/>
  <text x="1100" y="57" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
    ${data.sport}
  </text>

  <!-- Rank Icon -->
  <text x="600" y="170" font-size="80" text-anchor="middle" filter="url(#glow)">
    ${rankEmoji}
  </text>

  <!-- Rank Number -->
  <text x="600" y="290" font-family="Arial, Helvetica, sans-serif" font-size="100" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    #${data.rank}
  </text>

  <!-- Player Name -->
  <text x="600" y="360" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="white" text-anchor="middle">
    ${data.playerName}
  </text>

  <!-- Scope -->
  ${data.scope ? `
  <text x="600" y="410" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    ${data.scope} Leaderboard
  </text>
  ` : ''}

  <!-- Points -->
  <rect x="450" y="440" width="300" height="55" rx="27" fill="${colors.accent}"/>
  <text x="600" y="478" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    ⭐ ${data.totalPoints.toLocaleString()} Points
  </text>

  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Compete. Win. Rise. | valorhive.com
  </text>
</svg>`;

  return svgToPng(svg);
}

/**
 * Generate generic OG image for VALORHIVE
 */
export async function generateDefaultOGImage(sport: 'CORNHOLE' | 'DARTS' = 'CORNHOLE'): Promise<Buffer> {
  const colors = SPORT_COLORS[sport] || SPORT_COLORS.CORNHOLE;

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.gradient};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="200" cy="315" r="300" fill="${colors.secondary}" opacity="0.05"/>
  <circle cx="1000" cy="315" r="300" fill="${colors.accent}" opacity="0.05"/>

  <!-- Logo -->
  <text x="600" y="280" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle">
    VALOR<tspan fill="${colors.accent}">HIVE</tspan>
  </text>

  <!-- Tagline -->
  <text x="600" y="360" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    Compete. Win. Rise.
  </text>

  <!-- Sport Badge -->
  <rect x="500" y="400" width="200" height="50" rx="25" fill="${colors.accent}"/>
  <text x="600" y="435" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#1a1a2e" text-anchor="middle">
    ${sport}
  </text>

  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="600" y="608" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Multi-Sport Tournament Platform | valorhive.com
  </text>
</svg>`;

  return svgToPng(svg);
}
