/**
 * Share Card Generator for VALORHIVE
 * 
 * Generates shareable cards after match results
 */

import { SportType } from '@prisma/client';

export interface ShareCardData {
  sport: SportType;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  tournamentName?: string;
  pointsEarned: number;
  eloChange: number;
  matchDate: Date;
}

/**
 * Generate a share card URL for social media
 * Returns a URL that will render an OG image
 */
export function generateShareCardUrl(data: ShareCardData): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://valorhive.com';
  const params = new URLSearchParams({
    winner: data.winnerName,
    loser: data.loserName,
    score: `${data.winnerScore}-${data.loserScore}`,
    points: data.pointsEarned.toString(),
    elo: data.eloChange.toString(),
    sport: data.sport.toLowerCase(),
    tournament: data.tournamentName || '',
    date: data.matchDate.toISOString(),
  });
  
  return `${baseUrl}/api/share/match-card?${params.toString()}`;
}

/**
 * Generate share text for social media
 */
export function generateShareText(data: ShareCardData): string {
  const sportEmoji = data.sport === 'CORNHOLE' ? '🎯' : '🎯';
  const eloText = data.eloChange > 0 ? `+${data.eloChange} ELO` : `${data.eloChange} ELO`;
  
  let text = `${sportEmoji} Match Result!\n\n`;
  text += `🏆 ${data.winnerName} def. ${data.loserName}\n`;
  text += `Score: ${data.winnerScore} - ${data.loserScore}\n\n`;
  
  if (data.tournamentName) {
    text += `📍 ${data.tournamentName}\n`;
  }
  
  text += `📊 +${data.pointsEarned} points | ${eloText}\n\n`;
  text += `Join the competition at VALORHIVE!`;
  
  return text;
}

/**
 * Generate WhatsApp share URL
 */
export function generateWhatsAppShareUrl(data: ShareCardData): string {
  const text = generateShareText(data);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Generate Twitter share URL
 */
export function generateTwitterShareUrl(data: ShareCardData): string {
  const text = generateShareText(data);
  const url = generateShareCardUrl(data);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/**
 * Generate share card HTML for email/notifications
 */
export function generateShareCardHtml(data: ShareCardData): string {
  const sportColor = data.sport === 'CORNHOLE' ? '#16a34a' : '#0d9488';
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Match Result - VALORHIVE</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <div style="width: 400px; background: linear-gradient(135deg, ${sportColor} 0%, #1e293b 100%); padding: 30px; border-radius: 16px; color: white;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 14px; opacity: 0.8;">${sportName.toUpperCase()}</span>
      <h2 style="margin: 5px 0; font-size: 24px;">Match Result</h2>
    </div>
    
    <!-- Score -->
    <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 14px; opacity: 0.8;">Winner</div>
          <div style="font-size: 18px; font-weight: bold;">${data.winnerName}</div>
        </div>
        <div style="font-size: 36px; font-weight: bold;">
          ${data.winnerScore} - ${data.loserScore}
        </div>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 14px; opacity: 0.8;">Opponent</div>
          <div style="font-size: 18px;">${data.loserName}</div>
        </div>
      </div>
    </div>
    
    <!-- Tournament -->
    ${data.tournamentName ? `
    <div style="text-align: center; margin-bottom: 15px;">
      <span style="font-size: 14px; opacity: 0.8;">📍 ${data.tournamentName}</span>
    </div>
    ` : ''}
    
    <!-- Stats -->
    <div style="display: flex; justify-content: center; gap: 30px;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold;">+${data.pointsEarned}</div>
        <div style="font-size: 12px; opacity: 0.8;">Points</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: ${data.eloChange >= 0 ? '#22c55e' : '#ef4444'}">
          ${data.eloChange >= 0 ? '+' : ''}${data.eloChange}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">ELO</div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
      <span style="font-size: 14px; font-weight: bold;">VALORHIVE</span>
      <span style="font-size: 12px; opacity: 0.6; margin-left: 10px;">Where Champions Compete</span>
    </div>
  </div>
</body>
</html>
  `;
}
