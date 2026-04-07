// VALORHIVE Email Templates Library
// Professional HTML email templates for all notification types

import { SportType } from '@prisma/client';
import { getAppUrl } from './app-url';

const APP_URL = getAppUrl();

// Base email wrapper with VALORHIVE branding
const getEmailWrapper = (content: string, preheader?: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>VALORHIVE</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 20px; text-align: center; }
    .logo { font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 2px; }
    .logo span { color: #e94560; }
    .content { padding: 40px 30px; }
    .footer { background-color: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #e9ecef; }
    .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #e94560 0%, #c23a51 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { opacity: 0.9; }
    .secondary-button { background: #1a1a2e; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
    .sport-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .cornhole-badge { background-color: #fef3c7; color: #92400e; }
    .darts-badge { background-color: #dbeafe; color: #1e40af; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .match-card { background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 15px 0; border-left: 4px solid #e94560; }
    .divider { height: 1px; background: #e9ecef; margin: 30px 0; }
    .highlight { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin: 20px 0; }
    .trophy { font-size: 48px; text-align: center; margin: 20px 0; }
    @media only screen and (max-width: 600px) {
      .content { padding: 30px 20px; }
      .stats-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${preheader ? `<div class="preheader">${preheader}</div>` : ''}
  <div class="email-container">
    <div class="header">
      <div class="logo">VALOR<span>HIVE</span></div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        VALORHIVE - Multi-Sport Tournament Platform
      </p>
      <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 12px;">
        Cornhole &bull; Darts &bull; Compete. Win. Rise.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        <a href="{{unsubscribe_url}}" style="color: #6b7280;">Unsubscribe</a> &bull;
        <a href="{{preferences_url}}" style="color: #6b7280;">Email Preferences</a> &bull;
        <a href="{{privacy_url}}" style="color: #6b7280;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

// Email template types
export interface EmailTemplateData {
  recipientName: string;
  sport: SportType;
  unsubscribeUrl: string;
  preferencesUrl: string;
  privacyUrl: string;
}

export interface TournamentReminderData extends EmailTemplateData {
  tournamentName: string;
  tournamentDate: string;
  tournamentTime: string;
  venue: string;
  hoursUntilStart: number;
  checkinRequired: boolean;
  checkinDeadline?: string;
  tournamentUrl: string;
  opponentName?: string;
  matchTime?: string;
  court?: string;
}

export interface MatchResultData extends EmailTemplateData {
  tournamentName: string;
  opponentName: string;
  playerScore: number;
  opponentScore: number;
  isWinner: boolean;
  pointsEarned: number;
  eloChange: number;
  newElo: number;
  matchDate: string;
  matchUrl: string;
}

export interface TournamentRecapData extends EmailTemplateData {
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  finalRank: number;
  totalParticipants: number;
  matchesPlayed: number;
  matchesWon: number;
  pointsEarned: number;
  eloChange: number;
  prizeWon?: number;
  topPlayers: Array<{ rank: number; name: string; points: number }>;
  tournamentUrl: string;
  galleryUrl?: string;
}

export interface RegistrationConfirmData extends EmailTemplateData {
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  entryFee: number;
  transactionId: string;
  tournamentUrl: string;
  calendarUrl: string;
}

export interface WeeklyDigestData extends EmailTemplateData {
  weekStart: string;
  weekEnd: string;
  matchesPlayed: number;
  matchesWon: number;
  pointsEarned: number;
  eloChange: number;
  currentRank: number;
  rankChange: number;
  upcomingTournaments: Array<{ name: string; date: string; url: string }>;
  leaderboardUrl: string;
}

export interface MilestoneData extends EmailTemplateData {
  milestoneType: 'RANK_TOP_10' | 'RANK_TOP_100' | 'TIER_GOLD' | 'TIER_PLATINUM' | 'TIER_DIAMOND' | '100_WINS' | '50_TOURNAMENTS';
  milestoneTitle: string;
  milestoneDescription: string;
  earnedDate: string;
  badgeUrl?: string;
  shareUrl: string;
}

export interface SubscriptionExpiryData extends EmailTemplateData {
  expiryDate: string;
  daysRemaining: number;
  planType: string;
  renewalUrl: string;
  benefitsList: string[];
}

// Sport display helper
const getSportDisplay = (sport: SportType): { name: string; badgeClass: string } => {
  switch (sport) {
    case 'CORNHOLE':
      return { name: 'Cornhole', badgeClass: 'cornhole-badge' };
    case 'DARTS':
      return { name: 'Darts', badgeClass: 'darts-badge' };
    default:
      return { name: sport, badgeClass: '' };
  }
};

// ============================================
// TOURNAMENT REMINDER EMAILS
// ============================================

export const getTournamentReminderEmail = (data: TournamentReminderData): string => {
  const sportInfo = getSportDisplay(data.sport);
  
  let urgencyMessage = '';
  let urgencyColor = '#1a1a2e';
  
  if (data.hoursUntilStart <= 2) {
    urgencyMessage = '🚨 STARTING SOON - Action Required!';
    urgencyColor = '#dc2626';
  } else if (data.hoursUntilStart <= 24) {
    urgencyMessage = '⏰ Tomorrow - Get Ready!';
    urgencyColor = '#ea580c';
  } else {
    urgencyMessage = '📅 Upcoming Tournament';
  }

  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: ${urgencyColor}; text-align: center; margin: 20px 0;">
      ${urgencyMessage}
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      ${data.tournamentName}
    </h1>
    
    <div class="match-card">
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📅 When:</strong> ${data.tournamentDate} at ${data.tournamentTime}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📍 Where:</strong> ${data.venue}
      </p>
      ${data.opponentName ? `
        <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
          <strong>🎯 First Match vs:</strong> ${data.opponentName}
        </p>
      ` : ''}
      ${data.matchTime ? `
        <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
          <strong>⏰ Match Time:</strong> ${data.matchTime}
        </p>
      ` : ''}
      ${data.court ? `
        <p style="margin: 0; font-size: 18px; color: #1a1a2e;">
          <strong>🏟️ Court:</strong> ${data.court}
        </p>
      ` : ''}
    </div>
    
    ${data.checkinRequired ? `
      <div class="highlight">
        <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #92400e;">
          ⚠️ Check-in Required!
        </p>
        <p style="margin: 0; color: #92400e;">
          Please check in before ${data.checkinDeadline || 'tournament start time'} to confirm your participation.
          Failure to check in may result in automatic withdrawal.
        </p>
      </div>
    ` : ''}
    
    <div style="text-align: center;">
      <a href="${data.tournamentUrl}" class="button">
        View Tournament Details
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      💡 Tip: Arrive 15 minutes early to warm up and familiarize yourself with the venue.
    </p>
  `;

  return getEmailWrapper(content, `${data.hoursUntilStart} hours until ${data.tournamentName}`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// MATCH RESULT EMAIL
// ============================================

export const getMatchResultEmail = (data: MatchResultData): string => {
  const sportInfo = getSportDisplay(data.sport);
  const resultEmoji = data.isWinner ? '🏆' : '😔';
  const resultText = data.isWinner ? 'Victory!' : 'Defeat';
  const resultColor = data.isWinner ? '#059669' : '#dc2626';
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: ${resultColor}; text-align: center; margin: 20px 0; font-size: 28px;">
      ${resultEmoji} ${resultText}
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      Match Result
    </h1>
    
    <div class="match-card">
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #6b7280; text-align: center;">
        ${data.tournamentName}
      </p>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 0;">
        <div style="text-align: center; flex: 1;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">You</p>
          <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: ${data.isWinner ? '#059669' : '#1a1a2e'};">
            ${data.playerScore}
          </p>
        </div>
        <div style="font-size: 24px; color: #9ca3af;">vs</div>
        <div style="text-align: center; flex: 1;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">${data.opponentName}</p>
          <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: ${data.isWinner ? '#1a1a2e' : '#dc2626'};">
            ${data.opponentScore}
          </p>
        </div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value" style="color: ${data.pointsEarned >= 0 ? '#059669' : '#dc2626'}">
          ${data.pointsEarned >= 0 ? '+' : ''}${data.pointsEarned}
        </div>
        <div class="stat-label">Points Earned</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: ${data.eloChange >= 0 ? '#059669' : '#dc2626'}">
          ${data.eloChange >= 0 ? '+' : ''}${data.eloChange.toFixed(1)}
        </div>
        <div class="stat-label">ELO Change</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${data.newElo.toFixed(0)}</div>
        <div class="stat-label">New ELO</div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${data.matchUrl}" class="button">
        View Match Details
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      📅 Match played on ${data.matchDate}
    </p>
  `;

  return getEmailWrapper(content, `Match result: ${data.isWinner ? 'Won' : 'Lost'} vs ${data.opponentName}`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// TOURNAMENT RECAP EMAIL
// ============================================

export const getTournamentRecapEmail = (data: TournamentRecapData): string => {
  const sportInfo = getSportDisplay(data.sport);
  
  let rankEmoji = '🎖️';
  if (data.finalRank === 1) rankEmoji = '🥇';
  else if (data.finalRank === 2) rankEmoji = '🥈';
  else if (data.finalRank === 3) rankEmoji = '🥉';
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #1a1a2e; text-align: center; margin: 20px 0;">
      🏆 Tournament Complete!
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      ${data.tournamentName}
    </h1>
    
    <div class="highlight" style="text-align: center;">
      <div class="trophy">${rankEmoji}</div>
      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #92400e;">
        #${data.finalRank} Place
      </p>
      <p style="margin: 10px 0 0 0; color: #92400e;">
        out of ${data.totalParticipants} participants
      </p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${data.matchesPlayed}</div>
        <div class="stat-label">Matches Played</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${data.matchesWon}</div>
        <div class="stat-label">Matches Won</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: #059669;">+${data.pointsEarned}</div>
        <div class="stat-label">Points Earned</div>
      </div>
    </div>
    
    ${data.prizeWon ? `
      <div class="match-card" style="border-left-color: #059669;">
        <p style="margin: 0; text-align: center; font-size: 18px;">
          💰 <strong>Prize Won: ₹${data.prizeWon.toLocaleString('en-IN')}</strong>
        </p>
      </div>
    ` : ''}
    
    <h3 style="color: #1a1a2e; margin: 30px 0 15px 0;">🏆 Top Finishers</h3>
    <div style="background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      ${data.topPlayers.map((player, idx) => `
        <div style="display: flex; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid #e9ecef;">
          <div>
            <span style="font-size: 18px; margin-right: 10px;">
              ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${player.rank}`}
            </span>
            <span style="font-weight: 500; color: #1a1a2e;">${player.name}</span>
          </div>
          <span style="color: #6b7280;">${player.points} pts</span>
        </div>
      `).join('')}
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.tournamentUrl}" class="button">
        View Full Results
      </a>
      ${data.galleryUrl ? `
        <a href="${data.galleryUrl}" class="button secondary-button" style="margin-left: 10px;">
          View Gallery
        </a>
      ` : ''}
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      📍 ${data.venue} &bull; 📅 ${data.tournamentDate}
    </p>
  `;

  return getEmailWrapper(content, `You finished #${data.finalRank} in ${data.tournamentName}!`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// REGISTRATION CONFIRMATION EMAIL
// ============================================

export const getRegistrationConfirmEmail = (data: RegistrationConfirmData): string => {
  const sportInfo = getSportDisplay(data.sport);
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #059669; text-align: center; margin: 20px 0;">
      ✅ Registration Confirmed!
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      ${data.tournamentName}
    </h1>
    
    <div class="match-card">
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📅 Date:</strong> ${data.tournamentDate}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📍 Venue:</strong> ${data.venue}
      </p>
      <p style="margin: 0; font-size: 18px; color: #1a1a2e;">
        <strong>💳 Entry Fee:</strong> ₹${data.entryFee.toLocaleString('en-IN')}
      </p>
    </div>
    
    <p style="color: #6b7280; text-align: center; font-size: 14px;">
      Transaction ID: <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">${data.transactionId}</code>
    </p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.tournamentUrl}" class="button">
        View Tournament
      </a>
      <a href="${data.calendarUrl}" class="button secondary-button" style="margin-left: 10px;">
        Add to Calendar
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      💡 You'll receive reminder emails before the tournament starts. Make sure to check in on time!
    </p>
  `;

  return getEmailWrapper(content, `Registered for ${data.tournamentName}`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// WEEKLY DIGEST EMAIL
// ============================================

export const getWeeklyDigestEmail = (data: WeeklyDigestData): string => {
  const sportInfo = getSportDisplay(data.sport);
  const winRate = data.matchesPlayed > 0 ? Math.round((data.matchesWon / data.matchesPlayed) * 100) : 0;
  const rankDirection = data.rankChange > 0 ? '⬆️' : data.rankChange < 0 ? '⬇️' : '➡️';
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #1a1a2e; text-align: center; margin: 20px 0;">
      📊 Weekly Performance Summary
    </h2>
    
    <p style="color: #6b7280; text-align: center;">
      ${data.weekStart} - ${data.weekEnd}
    </p>
    
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${data.matchesPlayed}</div>
        <div class="stat-label">Matches</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${data.matchesWon}</div>
        <div class="stat-label">Wins</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${winRate}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value" style="color: #059669;">+${data.pointsEarned}</div>
        <div class="stat-label">Points Earned</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: ${data.eloChange >= 0 ? '#059669' : '#dc2626'}">
          ${data.eloChange >= 0 ? '+' : ''}${data.eloChange.toFixed(1)}
        </div>
        <div class="stat-label">ELO Change</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">
          ${rankDirection} #${data.currentRank}
        </div>
        <div class="stat-label">Leaderboard Rank</div>
      </div>
    </div>
    
    ${data.upcomingTournaments.length > 0 ? `
      <h3 style="color: #1a1a2e; margin: 30px 0 15px 0;">📅 Upcoming Tournaments</h3>
      ${data.upcomingTournaments.map(t => `
        <div class="match-card" style="border-left-color: #1a1a2e;">
          <p style="margin: 0 0 5px 0; font-weight: 500; color: #1a1a2e;">${t.name}</p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            ${t.date} - <a href="${t.url}" style="color: #e94560;">View Details</a>
          </p>
        </div>
      `).join('')}
    ` : ''}
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.leaderboardUrl}" class="button">
        View Leaderboard
      </a>
    </div>
  `;

  return getEmailWrapper(content, `Your weekly ${sportInfo.name} summary`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// MILESTONE ACHIEVEMENT EMAIL
// ============================================

export const getMilestoneEmail = (data: MilestoneData): string => {
  const sportInfo = getSportDisplay(data.sport);
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #059669; text-align: center; margin: 20px 0;">
      🎉 Achievement Unlocked!
    </h2>
    
    <div class="highlight" style="text-align: center;">
      ${data.badgeUrl ? `<img src="${data.badgeUrl}" alt="${data.milestoneTitle}" style="width: 80px; height: 80px; margin-bottom: 15px;">` : ''}
      <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 24px;">
        ${data.milestoneTitle}
      </h3>
      <p style="margin: 0; color: #92400e;">
        ${data.milestoneDescription}
      </p>
    </div>
    
    <p style="color: #6b7280; text-align: center; margin: 20px 0;">
      Earned on ${data.earnedDate}
    </p>
    
    <div style="text-align: center;">
      <a href="${data.shareUrl}" class="button">
        Share Your Achievement
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Keep competing to unlock more achievements and climb the leaderboard!
    </p>
  `;

  return getEmailWrapper(content, `Achievement: ${data.milestoneTitle}!`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// SUBSCRIPTION EXPIRY WARNING EMAIL
// ============================================

export const getSubscriptionExpiryEmail = (data: SubscriptionExpiryData): string => {
  const urgency = data.daysRemaining <= 3 ? 'urgent' : data.daysRemaining <= 7 ? 'warning' : 'notice';
  const urgencyColors = {
    urgent: '#dc2626',
    warning: '#ea580c',
    notice: '#1a1a2e'
  };
  
  const content = `
    <h2 style="color: ${urgencyColors[urgency]}; text-align: center; margin: 20px 0;">
      ${urgency === 'urgent' ? '⚠️ Final Notice!' : urgency === 'warning' ? '⏰ Expiring Soon!' : '📅 Subscription Reminder'}
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      ${data.daysRemaining} Days Remaining
    </h1>
    
    <p style="color: #6b7280; text-align: center;">
      Your ${data.planType} subscription expires on ${data.expiryDate}
    </p>
    
    <h3 style="color: #1a1a2e; margin: 30px 0 15px 0;">Your Subscription Benefits</h3>
    <ul style="color: #374151; line-height: 2;">
      ${data.benefitsList.map(b => `<li>${b}</li>`).join('')}
    </ul>
    
    <div class="highlight" style="text-align: center;">
      <p style="margin: 0 0 15px 0; color: #92400e;">
        Don't lose access to tournaments, leaderboards, and your stats!
      </p>
      <a href="${data.renewalUrl}" class="button">
        Renew Now
      </a>
    </div>
  `;

  return getEmailWrapper(content, `Your subscription expires in ${data.daysRemaining} days`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// WHATSAPP MESSAGE TEMPLATES
// ============================================

export const getWhatsAppTemplates = {
  tournamentReminder: (
    data: Omit<TournamentReminderData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): string => 
    `🏆 *${data.tournamentName}*

📅 ${data.tournamentDate} at ${data.tournamentTime}
📍 ${data.venue}
${data.opponentName ? `🎯 First Match vs: ${data.opponentName}` : ''}

${data.checkinRequired ? `⚠️ Check-in required before start!` : ''}

View details: ${data.tournamentUrl}`,

  matchResult: (
    data: Omit<MatchResultData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): string =>
    `${data.isWinner ? '🏆 Victory!' : '😔 Tough luck!'}
    
${data.playerScore} - ${data.opponentScore} vs ${data.opponentName}

${data.isWinner ? '+' : ''}${data.pointsEarned} points | ELO: ${data.eloChange >= 0 ? '+' : ''}${data.eloChange.toFixed(1)}

View match: ${data.matchUrl}`,

  milestone: (
    data: Omit<MilestoneData, 'unsubscribeUrl' | 'preferencesUrl' | 'privacyUrl'>
  ): string =>
    `🎉 Achievement Unlocked!

🏅 *${data.milestoneTitle}*
${data.milestoneDescription}

Share: ${data.shareUrl}`,

  subscriptionExpiry: (data: SubscriptionExpiryData): string =>
    `⚠️ Subscription Reminder

Your subscription expires in *${data.daysRemaining} days* (${data.expiryDate})

Renew now to continue enjoying all benefits:
${data.renewalUrl}`,
};

// ============================================
// SUBSCRIPTION CONFIRMATION/RENEWAL EMAIL
// ============================================

export interface SubscriptionData extends EmailTemplateData {
  planType: 'PLAYER_MONTHLY' | 'PLAYER_YEARLY' | 'ORG_MONTHLY' | 'ORG_YEARLY';
  startDate: string;
  endDate: string;
  amount: number;
  transactionId: string;
  benefitsList: string[];
  renewalUrl: string;
}

export const getSubscriptionEmail = (data: SubscriptionData): string => {
  const sportInfo = getSportDisplay(data.sport);
  const isYearly = data.planType.includes('YEARLY');
  const isOrg = data.planType.includes('ORG');
  
  const planName = isOrg 
    ? `Organization ${isYearly ? 'Yearly' : 'Monthly'} Plan`
    : `Player ${isYearly ? 'Yearly' : 'Monthly'} Plan`;
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #059669; text-align: center; margin: 20px 0;">
      ✅ Subscription ${isYearly ? 'Activated' : 'Confirmed'}!
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      ${planName}
    </h1>
    
    <div class="match-card">
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📅 Start Date:</strong> ${data.startDate}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #1a1a2e;">
        <strong>📅 End Date:</strong> ${data.endDate}
      </p>
      <p style="margin: 0; font-size: 18px; color: #1a1a2e;">
        <strong>💳 Amount Paid:</strong> ₹${data.amount.toLocaleString('en-IN')}
      </p>
    </div>
    
    <p style="color: #6b7280; text-align: center; font-size: 14px;">
      Transaction ID: <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">${data.transactionId}</code>
    </p>
    
    <h3 style="color: #1a1a2e; margin: 30px 0 15px 0;">Your Subscription Benefits</h3>
    <ul style="color: #374151; line-height: 2;">
      ${data.benefitsList.map(b => `<li>${b}</li>`).join('')}
    </ul>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.renewalUrl}" class="button">
        Manage Subscription
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      💡 ${isYearly ? 'Your subscription will auto-renew next year.' : 'Your subscription will auto-renew monthly.'}
    </p>
  `;

  return getEmailWrapper(content, `Subscription confirmed: ${planName}`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
};

// ============================================
// NAMED EXPORT FUNCTIONS FOR TASK REQUIREMENTS
// ============================================

/**
 * Generate tournament confirmation email
 * Wrapper for tournament registration confirmation
 */
export function generateTournamentConfirmationEmail(data: {
  recipientName: string;
  sport: SportType;
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  entryFee: number;
  transactionId: string;
  tournamentUrl: string;
  calendarUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  privacyUrl: string;
}): string {
  return getRegistrationConfirmEmail({
    recipientName: data.recipientName,
    sport: data.sport,
    tournamentName: data.tournamentName,
    tournamentDate: data.tournamentDate,
    venue: data.venue,
    entryFee: data.entryFee,
    transactionId: data.transactionId,
    tournamentUrl: data.tournamentUrl,
    calendarUrl: data.calendarUrl,
    unsubscribeUrl: data.unsubscribeUrl,
    preferencesUrl: data.preferencesUrl,
    privacyUrl: data.privacyUrl,
  });
}

/**
 * Generate match reminder email
 * Used for 24hr, 2hr before match reminders
 */
export function generateMatchReminderEmail(data: TournamentReminderData): string {
  return getTournamentReminderEmail(data);
}

/**
 * Generate match/tournament result notification email
 */
export function generateResultEmail(data: MatchResultData): string {
  return getMatchResultEmail(data);
}

/**
 * Generate new user welcome email
 */
export function generateWelcomeEmail(data: EmailTemplateData & {
  email: string;
  sport: SportType;
}): string {
  const sportInfo = getSportDisplay(data.sport);
  
  const content = `
    <div style="text-align: center;">
      <span class="sport-badge ${sportInfo.badgeClass}">${sportInfo.name}</span>
    </div>
    
    <h2 style="color: #059669; text-align: center; margin: 20px 0;">
      🎯 Welcome to VALORHIVE!
    </h2>
    
    <h1 style="color: #1a1a2e; text-align: center; margin: 10px 0;">
      Hi ${data.recipientName}!
    </h1>
    
    <p style="color: #374151; text-align: center; font-size: 16px;">
      You're now part of the ${sportInfo.name} community. Compete, win, and rise!
    </p>
    
    <div class="match-card">
      <h3 style="color: #1a1a2e; margin: 0 0 15px 0; text-align: center;">Here's what you can do:</h3>
      
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a2e;">
        🏆 <strong>Join Tournaments</strong> - Compete in local and national events
      </p>
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a2e;">
        📊 <strong>Track Your Stats</strong> - Monitor your progress and rankings
      </p>
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a2e;">
        👥 <strong>Connect</strong> - Follow players and organizations
      </p>
      <p style="margin: 0; font-size: 16px; color: #1a1a2e;">
        🎯 <strong>Improve</strong> - Get matched with players of similar skill
      </p>
    </div>
    
    <div class="highlight">
      <p style="margin: 0; color: #92400e; text-align: center;">
        💡 Complete your profile to unlock all features and start competing!
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${APP_URL}/${data.sport.toLowerCase()}/dashboard" class="button">
        Go to Dashboard
      </a>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Questions? Reply to this email or visit our help center.
    </p>
  `;

  return getEmailWrapper(content, `Welcome to VALORHIVE, ${data.recipientName}!`)
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
}

/**
 * Generate password reset email
 */
export function generatePasswordResetEmail(data: EmailTemplateData & {
  resetUrl: string;
  expiresIn: string;
}): string {
  const content = `
    <h2 style="color: #1a1a2e; text-align: center; margin: 20px 0;">
      🔐 Reset Your Password
    </h2>
    
    <p style="color: #374151; text-align: center; font-size: 16px;">
      Hi ${data.recipientName}, we received a request to reset your password.
    </p>
    
    <div class="match-card" style="text-align: center;">
      <p style="margin: 0 0 20px 0; color: #374151;">
        Click the button below to create a new password. This link will expire in ${data.expiresIn}.
      </p>
      
      <a href="${data.resetUrl}" class="button">
        Reset Password
      </a>
    </div>
    
    <div class="highlight" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left-color: #dc2626;">
      <p style="margin: 0; color: #991b1b;">
        <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, you can safely ignore this email.
      </p>
    </div>
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      For security reasons, this link can only be used once.
    </p>
  `;

  return getEmailWrapper(content, 'Reset your VALORHIVE password')
    .replace(/{{unsubscribe_url}}/g, data.unsubscribeUrl)
    .replace(/{{preferences_url}}/g, data.preferencesUrl)
    .replace(/{{privacy_url}}/g, data.privacyUrl);
}

/**
 * Generate subscription confirmation/renewal email
 */
export function generateSubscriptionEmail(data: SubscriptionData): string {
  return getSubscriptionEmail(data);
}

// Export all templates
export const emailTemplates = {
  tournamentReminder: getTournamentReminderEmail,
  matchResult: getMatchResultEmail,
  tournamentRecap: getTournamentRecapEmail,
  registrationConfirm: getRegistrationConfirmEmail,
  weeklyDigest: getWeeklyDigestEmail,
  milestone: getMilestoneEmail,
  subscriptionExpiry: getSubscriptionExpiryEmail,
  subscription: getSubscriptionEmail,
  // Named exports for task requirements
  tournamentConfirmation: generateTournamentConfirmationEmail,
  matchReminder: generateMatchReminderEmail,
  result: generateResultEmail,
  welcome: generateWelcomeEmail,
  passwordReset: generatePasswordResetEmail,
};
