/**
 * Result Notification Email Template
 * 
 * Sent after match or tournament completion
 */

import { SportType } from '@prisma/client';

export interface ResultNotificationData {
  recipientName: string;
  sport: SportType;
  tournamentName: string;
  tournamentId: string;
  resultType: 'MATCH' | 'TOURNAMENT';
  
  // Match result fields
  opponentName?: string;
  playerScore?: number;
  opponentScore?: number;
  isWinner?: boolean;
  
  // Tournament result fields
  finalRank?: number;
  totalParticipants?: number;
  matchesPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  
  // Stats
  pointsEarned: number;
  eloChange: number;
  newElo: number;
  newTier?: string;
  prizeWon?: number;
  
  // URLs
  matchUrl?: string;
  tournamentUrl: string;
  statsUrl?: string;
  leaderboardUrl?: string;
  
  // Email settings
  unsubscribeUrl: string;
  preferencesUrl: string;
  privacyUrl: string;
}

// Sport colors
const SPORT_COLORS = {
  CORNHOLE: {
    primary: '#16a34a',
    primaryLight: '#22c55e',
    gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    badge: '#dcfce7',
    badgeText: '#166534',
  },
  DARTS: {
    primary: '#0d9488',
    primaryLight: '#14b8a6',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    badge: '#ccfbf1',
    badgeText: '#115e59',
  },
};

export function ResultNotificationEmail(data: ResultNotificationData): string {
  const colors = SPORT_COLORS[data.sport];
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  const isMatchResult = data.resultType === 'MATCH';
  const isTournamentResult = data.resultType === 'TOURNAMENT';
  
  // Determine result display
  let resultEmoji = '🏆';
  let resultText = 'Victory!';
  let resultColor = '#16a34a';
  
  if (isMatchResult && !data.isWinner) {
    resultEmoji = '💪';
    resultText = 'Defeat';
    resultColor = '#dc2626';
  } else if (isTournamentResult) {
    if (data.finalRank === 1) {
      resultEmoji = '🥇';
      resultText = '1st Place!';
      resultColor = '#eab308';
    } else if (data.finalRank === 2) {
      resultEmoji = '🥈';
      resultText = '2nd Place!';
      resultColor = '#9ca3af';
    } else if (data.finalRank === 3) {
      resultEmoji = '🥉';
      resultText = '3rd Place!';
      resultColor = '#cd7f32';
    } else if (data.finalRank && data.finalRank <= 10) {
      resultEmoji = '🎖️';
      resultText = `#${data.finalRank} Place`;
    } else {
      resultEmoji = '✨';
      resultText = `#${data.finalRank} Place`;
    }
  }
  
  const winRate = data.matchesPlayed && data.matchesWon 
    ? Math.round((data.matchesWon / data.matchesPlayed) * 100) 
    : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${resultText} - VALORHIVE</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      background: ${colors.gradient};
      padding: 32px 40px;
      text-align: center;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: white;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    
    .content {
      padding: 40px;
    }
    
    .sport-badge {
      display: inline-block;
      background: ${colors.badge};
      color: ${colors.badgeText};
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .result-banner {
      background: ${data.isWinner || (isTournamentResult && data.finalRank && data.finalRank <= 3) 
        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' 
        : isMatchResult && !data.isWinner 
          ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
          : '#f9fafb'};
      border-left: 4px solid ${resultColor};
      padding: 24px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .result-emoji {
      font-size: 48px;
      margin: 0 0 8px 0;
    }
    
    .result-text {
      font-size: 28px;
      font-weight: 700;
      color: ${resultColor};
      margin: 0;
    }
    
    .score-card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }
    
    .score-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
    }
    
    .score-player {
      flex: 1;
      text-align: center;
    }
    
    .score-label {
      font-size: 12px;
      color: #6b7280;
      margin: 0 0 8px 0;
      text-transform: uppercase;
    }
    
    .score-name {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 8px 0;
    }
    
    .score-value {
      font-size: 48px;
      font-weight: 700;
      margin: 0;
    }
    
    .score-winner {
      color: #16a34a;
    }
    
    .score-loser {
      color: #dc2626;
    }
    
    .vs-divider {
      padding: 0 16px;
      font-size: 16px;
      color: #9ca3af;
      font-weight: 600;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    
    .stat-box {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }
    
    .stat-positive {
      color: #16a34a;
    }
    
    .stat-negative {
      color: #dc2626;
    }
    
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      margin: 4px 0 0 0;
    }
    
    .card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .detail-label {
      color: #6b7280;
      font-size: 14px;
    }
    
    .detail-value {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
    }
    
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: ${colors.primary};
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
    }
    
    .btn:hover {
      background: ${colors.primaryLight};
    }
    
    .btn-secondary {
      background: transparent;
      border: 2px solid ${colors.primary};
      color: ${colors.primary};
      margin-left: 12px;
    }
    
    .prize-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #eab308;
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .footer {
      background: #f9fafb;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      color: #9ca3af;
      font-size: 12px;
      margin: 0;
    }
    
    .footer-link {
      color: ${colors.primary};
      text-decoration: none;
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        border-radius: 0;
      }
      .content {
        padding: 24px;
      }
      .header {
        padding: 24px;
      }
      .stats-grid {
        grid-template-columns: 1fr;
      }
      .score-section {
        flex-direction: column;
        gap: 16px;
      }
      .vs-divider {
        transform: rotate(90deg);
      }
      .btn-secondary {
        display: block;
        margin: 12px 0 0 0;
        margin-left: 0;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <a href="https://valorhive.com" class="logo">VALORHIVE</a>
    </div>
    
    <div class="content">
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="sport-badge">${sportName}</span>
      </div>
      
      <div class="result-banner">
        <p class="result-emoji">${resultEmoji}</p>
        <p class="result-text">${resultText}</p>
        ${isTournamentResult && data.totalParticipants ? `
        <p style="margin: 8px 0 0 0; color: #6b7280;">
          out of ${data.totalParticipants} participants
        </p>
        ` : ''}
      </div>
      
      <h1 style="color: #111827; text-align: center; margin: 0 0 8px 0; font-size: 24px;">
        ${data.tournamentName}
      </h1>
      
      <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0; font-size: 14px;">
        ${isMatchResult ? 'Match Result' : 'Tournament Complete'}
      </p>
      
      ${isMatchResult && data.opponentName ? `
      <div class="score-card">
        <div class="score-section">
          <div class="score-player">
            <p class="score-label">You</p>
            <p class="score-name">${data.recipientName}</p>
            <p class="score-value ${data.isWinner ? 'score-winner' : 'score-loser'}">${data.playerScore}</p>
          </div>
          <div class="vs-divider">VS</div>
          <div class="score-player">
            <p class="score-label">Opponent</p>
            <p class="score-name">${data.opponentName}</p>
            <p class="score-value ${data.isWinner ? 'score-loser' : 'score-winner'}">${data.opponentScore}</p>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${isTournamentResult ? `
      <div class="card">
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 16px; text-align: center;">Your Performance</h3>
        
        <div class="detail-row">
          <span class="detail-label">Matches Played</span>
          <span class="detail-value">${data.matchesPlayed || 0}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Matches Won</span>
          <span class="detail-value" style="color: #16a34a;">${data.matchesWon || 0}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Matches Lost</span>
          <span class="detail-value" style="color: #dc2626;">${data.matchesLost || 0}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Win Rate</span>
          <span class="detail-value">${winRate}%</span>
        </div>
      </div>
      ` : ''}
      
      <div class="stats-grid">
        <div class="stat-box">
          <p class="stat-value ${data.pointsEarned >= 0 ? 'stat-positive' : 'stat-negative'}">
            ${data.pointsEarned >= 0 ? '+' : ''}${data.pointsEarned}
          </p>
          <p class="stat-label">Points ${isMatchResult ? 'Earned' : 'Total'}</p>
        </div>
        <div class="stat-box">
          <p class="stat-value ${data.eloChange >= 0 ? 'stat-positive' : 'stat-negative'}">
            ${data.eloChange >= 0 ? '+' : ''}${data.eloChange.toFixed(1)}
          </p>
          <p class="stat-label">ELO Change</p>
        </div>
        <div class="stat-box">
          <p class="stat-value">${data.newElo.toFixed(0)}</p>
          <p class="stat-label">New ELO</p>
        </div>
      </div>
      
      ${data.newTier ? `
      <div class="card" style="text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Current Tier</p>
        <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 700; color: ${colors.primary};">
          ${data.newTier}
        </p>
      </div>
      ` : ''}
      
      ${data.prizeWon ? `
      <div class="prize-box">
        <p style="margin: 0; font-size: 14px; color: #92400e;">Prize Won</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 700; color: #92400e;">
          ₹${data.prizeWon.toLocaleString('en-IN')}
        </p>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${isMatchResult && data.matchUrl ? data.matchUrl : data.tournamentUrl}" class="btn">
          ${isMatchResult ? 'View Match Details' : 'View Full Results'}
        </a>
        ${data.statsUrl ? `<a href="${data.statsUrl}" class="btn btn-secondary">View Your Stats</a>` : ''}
      </div>
      
      ${isTournamentResult ? `
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        🎯 Keep competing and climb the ranks! See you at the next tournament.
      </p>
      ` : `
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        ${data.isWinner ? "Great game! Keep up the winning streak!" : "Better luck next time! Keep practicing!"}
      </p>
      `}
    </div>
    
    <div class="footer">
      <p class="footer-text">
        You're receiving this email because you registered on VALORHIVE.
      </p>
      <p class="footer-text" style="margin-top: 8px;">
        <a href="${data.privacyUrl}" class="footer-link">Privacy Policy</a>
        &nbsp;•&nbsp;
        <a href="${data.preferencesUrl}" class="footer-link">Email Preferences</a>
        &nbsp;•&nbsp;
        <a href="${data.unsubscribeUrl}" class="footer-link">Unsubscribe</a>
      </p>
      <p class="footer-text" style="margin-top: 12px;">
        © ${new Date().getFullYear()} VALORHIVE. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

export default ResultNotificationEmail;
