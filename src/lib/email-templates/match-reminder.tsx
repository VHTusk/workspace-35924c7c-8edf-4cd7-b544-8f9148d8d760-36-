/**
 * Match Reminder Email Template
 * 
 * Sent 24 hours and 2 hours before a match
 */

import { SportType } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';

const APP_URL = getAppUrl();

export interface MatchReminderData {
  recipientName: string;
  sport: SportType;
  tournamentName: string;
  tournamentId: string;
  hoursUntilStart: number; // 24 or 2 typically
  tournamentDate: string;
  tournamentTime: string;
  venue: string;
  city?: string;
  state?: string;
  tournamentUrl: string;
  opponentName?: string;
  opponentSeed?: number;
  matchTime?: string;
  court?: string;
  matchNumber?: number;
  checkInRequired: boolean;
  checkInDeadline?: string;
  checkInCode?: string;
  playerSeed?: number;
  bracketPosition?: string;
  weatherInfo?: string;
  arrivalTip?: string;
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

export function MatchReminderEmail(data: MatchReminderData): string {
  const colors = SPORT_COLORS[data.sport];
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  const isUrgent = data.hoursUntilStart <= 2;
  const timeText = data.hoursUntilStart === 24 
    ? 'Tomorrow' 
    : data.hoursUntilStart === 2 
      ? 'Starting Soon!' 
      : `In ${data.hoursUntilStart} Hours`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${isUrgent ? 'URGENT: ' : ''}Match Reminder - VALORHIVE</title>
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
      background: ${isUrgent ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : colors.gradient};
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
    
    .urgency-banner {
      background: ${isUrgent ? '#fee2e2' : '#fef3c7'};
      border-left: 4px solid ${isUrgent ? '#dc2626' : '#f59e0b'};
      padding: 16px 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
    }
    
    .match-card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      border-left: 4px solid ${colors.primary};
    }
    
    .vs-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .player-section {
      flex: 1;
      text-align: center;
    }
    
    .player-name {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    
    .player-seed {
      font-size: 12px;
      color: #6b7280;
      margin: 4px 0 0 0;
    }
    
    .vs-divider {
      padding: 0 20px;
      font-size: 16px;
      color: #9ca3af;
      font-weight: 600;
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
      display: flex;
      align-items: center;
      gap: 8px;
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
    
    .checkin-box {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-left: 4px solid #3b82f6;
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .checkin-code {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #1e40af;
      margin: 12px 0;
    }
    
    .tip-box {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
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
      .vs-section {
        flex-direction: column;
        gap: 16px;
      }
      .vs-divider {
        transform: rotate(90deg);
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <a href="${APP_URL}" class="logo">VALORHIVE</a>
    </div>
    
    <div class="content">
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="sport-badge">${sportName}</span>
      </div>
      
      <div class="urgency-banner">
        <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${isUrgent ? '#991b1b' : '#92400e'};">
          ${isUrgent ? '⚡ ' : '📅 '}${timeText}
        </p>
        <p style="margin: 8px 0 0 0; color: ${isUrgent ? '#991b1b' : '#92400e'};">
          ${isUrgent ? 'Your match is starting soon!' : "Don't forget your upcoming match!"}
        </p>
      </div>
      
      <h1 style="color: #111827; text-align: center; margin: 0 0 8px 0; font-size: 24px;">
        ${data.tournamentName}
      </h1>
      
      ${data.matchNumber ? `
      <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0; font-size: 14px;">
        Match #${data.matchNumber}${data.bracketPosition ? ` • ${data.bracketPosition}` : ''}
      </p>
      ` : ''}
      
      ${data.opponentName ? `
      <div class="match-card">
        <div class="vs-section">
          <div class="player-section">
            <p class="player-name">${data.recipientName}</p>
            ${data.playerSeed ? `<p class="player-seed">Seed #${data.playerSeed}</p>` : ''}
          </div>
          <div class="vs-divider">VS</div>
          <div class="player-section">
            <p class="player-name">${data.opponentName}</p>
            ${data.opponentSeed ? `<p class="player-seed">Seed #${data.opponentSeed}</p>` : ''}
          </div>
        </div>
      </div>
      ` : ''}
      
      <div class="match-card">
        <div class="detail-row">
          <span class="detail-label">📅 Date & Time</span>
          <span class="detail-value">${data.tournamentDate} at ${data.matchTime || data.tournamentTime}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">📍 Venue</span>
          <span class="detail-value">${data.venue}${data.city ? `, ${data.city}` : ''}</span>
        </div>
        
        ${data.court ? `
        <div class="detail-row">
          <span class="detail-label">🏟️ Court</span>
          <span class="detail-value">${data.court}</span>
        </div>
        ` : ''}
        
        ${data.weatherInfo ? `
        <div class="detail-row">
          <span class="detail-label">🌤️ Weather</span>
          <span class="detail-value">${data.weatherInfo}</span>
        </div>
        ` : ''}
      </div>
      
      ${data.checkInRequired ? `
      <div class="checkin-box">
        <p style="margin: 0; font-weight: 600; color: #1e40af;">
          ⚠️ Check-in Required
        </p>
        <p style="margin: 8px 0 0 0; color: #1e40af;">
          Check in before ${data.checkInDeadline || 'match time'} to confirm participation
        </p>
        ${data.checkInCode ? `
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #3b82f6;">Your check-in code:</p>
        <div class="checkin-code">${data.checkInCode}</div>
        ` : ''}
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.tournamentUrl}" class="btn">View Match Details</a>
      </div>
      
      ${data.arrivalTip || !isUrgent ? `
      <div class="tip-box">
        <p style="margin: 0; color: #374151; font-size: 14px;">
          💡 <strong>Tip:</strong> ${data.arrivalTip || 'Arrive 15 minutes early to warm up and familiarize yourself with the venue.'}
        </p>
      </div>
      ` : ''}
      
      ${isUrgent ? `
      <p style="color: #6b7280; font-size: 14px; text-align: center; font-weight: 500;">
        🎯 Good luck! Give it your all!
      </p>
      ` : `
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        We'll send another reminder closer to your match time.
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

export default MatchReminderEmail;
