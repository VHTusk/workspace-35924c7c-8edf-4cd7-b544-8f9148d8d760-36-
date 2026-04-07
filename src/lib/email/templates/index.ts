/**
 * Email Templates for VALORHIVE
 * 
 * All templates are designed for:
 * - Mobile responsiveness
 * - Dark mode support
 * - Brand consistency (sport-specific colors)
 * - Accessibility
 */

import { SportType } from '@prisma/client';

// Brand colors by sport
const SPORT_COLORS = {
  CORNHOLE: {
    primary: '#16a34a', // green-600
    primaryLight: '#22c55e', // green-500
    gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  },
  DARTS: {
    primary: '#0d9488', // teal-600
    primaryLight: '#14b8a6', // teal-500
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
  },
};

// Base email wrapper
export function getEmailWrapper(sport: SportType, content: string, previewText: string): string {
  const colors = SPORT_COLORS[sport];
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
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
    
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px 0;
    }
    
    .subtitle {
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 24px 0;
    }
    
    .card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .stat-row:last-child {
      border-bottom: none;
    }
    
    .stat-label {
      color: #6b7280;
      font-size: 14px;
    }
    
    .stat-value {
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
      margin: 8px 0;
    }
    
    .btn:hover {
      background: ${colors.primaryLight};
    }
    
    .btn-secondary {
      background: transparent;
      border: 2px solid ${colors.primary};
      color: ${colors.primary};
    }
    
    .btn-secondary:hover {
      background: ${colors.primary};
      color: white;
    }
    
    .highlight-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
    }
    
    .success-box {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      border-left: 4px solid #10b981;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
    }
    
    .warning-box {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 0 8px 8px 0;
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
    
    .social-links {
      margin: 16px 0;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 8px;
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
      .title {
        font-size: 20px;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #111827;
      }
      .email-container {
        background-color: #1f2937;
      }
      .title {
        color: #f9fafb;
      }
      .subtitle {
        color: #9ca3af;
      }
      .card {
        background: #374151;
      }
      .stat-label {
        color: #9ca3af;
      }
      .stat-value {
        color: #f9fafb;
      }
      .footer {
        background: #111827;
        border-top-color: #374151;
      }
    }
  </style>
</head>
<body>
  <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${previewText}
  </div>
  
  <div class="email-container">
    <div class="header">
      <a href="https://valorhive.com" class="logo">🎯 VALORHIVE</a>
    </div>
    
    <div class="content">
      ${content}
    </div>
    
    <div class="footer">
      <p class="footer-text">
        You're receiving this email because you're registered on VALORHIVE.
      </p>
      <p class="footer-text" style="margin-top: 8px;">
        <a href="https://valorhive.com/legal/privacy" class="footer-link">Privacy Policy</a>
        &nbsp;•&nbsp;
        <a href="https://valorhive.com/legal/terms" class="footer-link">Terms of Service</a>
        &nbsp;•&nbsp;
        <a href="{{unsubscribe_url}}" class="footer-link">Unsubscribe</a>
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

// Tournament Registration Confirmation
export function getTournamentRegistrationEmail(params: {
  sport: SportType;
  playerName: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  entryFee: number;
  tournamentId: string;
}): string {
  const content = `
    <h1 class="title">Registration Confirmed! 🎉</h1>
    <p class="subtitle">Hi ${params.playerName}, you're all set for ${params.tournamentName}</p>
    
    <div class="success-box">
      <strong style="color: #065f46;">✓ Registration Successful</strong>
      <p style="margin: 8px 0 0 0; color: #065f46;">Your spot has been reserved. Get ready to compete!</p>
    </div>
    
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">Tournament Details</h3>
      
      <div class="stat-row">
        <span class="stat-label">📅 Date</span>
        <span class="stat-value">${params.tournamentDate}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">📍 Location</span>
        <span class="stat-value">${params.tournamentLocation}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">💰 Entry Fee</span>
        <span class="stat-value">₹${params.entryFee.toLocaleString('en-IN')}</span>
      </div>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/tournaments/${params.tournamentId}" class="btn">
        View Tournament Details
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      We'll send you reminders before the tournament starts. Good luck! 🍀
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, `You're registered for ${params.tournamentName}!`);
}

// Match Result Notification
export function getMatchResultEmail(params: {
  sport: SportType;
  playerName: string;
  opponentName: string;
  tournamentName: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  pointsEarned: number;
  eloChange: number;
  matchId: string;
}): string {
  const resultText = params.won ? 'Victory!' : 'Defeat';
  const resultEmoji = params.won ? '🏆' : '💪';
  
  const content = `
    <h1 class="title">${resultText} ${resultEmoji}</h1>
    <p class="subtitle">${params.tournamentName}</p>
    
    <div class="${params.won ? 'success-box' : 'warning-box'}">
      <strong style="color: ${params.won ? '#065f46' : '#991b1b'};">
        ${params.won ? '✓ Congratulations!' : 'Better luck next time!'}
      </strong>
    </div>
    
    <div class="card" style="text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="flex: 1; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">YOU</p>
          <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 700; color: ${params.won ? '#16a34a' : '#dc2626'};">
            ${params.playerScore}
          </p>
          <p style="margin: 4px 0 0 0; color: #111827; font-weight: 500;">${params.playerName}</p>
        </div>
        
        <div style="padding: 0 16px;">
          <span style="font-size: 20px; color: #9ca3af;">vs</span>
        </div>
        
        <div style="flex: 1; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">OPPONENT</p>
          <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 700; color: ${params.won ? '#dc2626' : '#16a34a'};">
            ${params.opponentScore}
          </p>
          <p style="margin: 4px 0 0 0; color: #111827; font-weight: 500;">${params.opponentName}</p>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h4 style="margin: 0 0 12px 0; color: #111827;">Stats Update</h4>
      
      <div class="stat-row">
        <span class="stat-label">Points ${params.won ? 'Earned' : 'Received'}</span>
        <span class="stat-value" style="color: #16a34a;">+${params.pointsEarned}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">ELO Change</span>
        <span class="stat-value" style="color: ${params.eloChange >= 0 ? '#16a34a' : '#dc2626'};">
          ${params.eloChange >= 0 ? '+' : ''}${params.eloChange}
        </span>
      </div>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/stats" class="btn">
        View Full Stats
      </a>
    </div>
  `;
  
  return getEmailWrapper(params.sport, content, `Match result: ${params.playerScore}-${params.opponentScore} vs ${params.opponentName}`);
}

// Tournament Reminder (48hr, 24hr, 2hr)
export function getTournamentReminderEmail(params: {
  sport: SportType;
  playerName: string;
  tournamentName: string;
  timeUntil: string; // "48 hours", "24 hours", "2 hours"
  tournamentDate: string;
  tournamentTime: string;
  tournamentLocation: string;
  tournamentId: string;
  checkInCode?: string;
}): string {
  const isUrgent = params.timeUntil === '2 hours';
  
  const content = `
    <h1 class="title">${isUrgent ? 'Starting Soon!' : 'Upcoming Tournament'} ⏰</h1>
    <p class="subtitle">Hi ${params.playerName}, ${params.tournamentName} begins in ${params.timeUntil}</p>
    
    ${isUrgent ? `
    <div class="warning-box">
      <strong style="color: #991b1b;">⚡ Final Reminder!</strong>
      <p style="margin: 8px 0 0 0; color: #991b1b;">Make sure to check in before the tournament starts.</p>
    </div>
    ` : `
    <div class="highlight-box">
      <strong style="color: #92400e;">📅 Don't forget!</strong>
      <p style="margin: 8px 0 0 0; color: #92400e;">Mark your calendar and prepare for the competition.</p>
    </div>
    `}
    
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">${params.tournamentName}</h3>
      
      <div class="stat-row">
        <span class="stat-label">📅 Date</span>
        <span class="stat-value">${params.tournamentDate}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">🕐 Time</span>
        <span class="stat-value">${params.tournamentTime}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">📍 Location</span>
        <span class="stat-value">${params.tournamentLocation}</span>
      </div>
      
      ${params.checkInCode ? `
      <div class="stat-row">
        <span class="stat-label">🎫 Check-in Code</span>
        <span class="stat-value" style="font-size: 18px; letter-spacing: 2px;">${params.checkInCode}</span>
      </div>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/tournaments/${params.tournamentId}" class="btn">
        View Tournament
      </a>
      ${!isUrgent ? `
      <br/>
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/tournaments/${params.tournamentId}/calendar" class="btn btn-secondary" style="margin-top: 12px;">
        Add to Calendar
      </a>
      ` : ''}
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      ${isUrgent ? 'Good luck! Give it your all! 🎯' : "We'll send another reminder closer to the start time."}
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, `${params.tournamentName} starts in ${params.timeUntil}`);
}

// Post-Tournament Recap
export function getTournamentRecapEmail(params: {
  sport: SportType;
  playerName: string;
  tournamentName: string;
  placement: number;
  totalParticipants: number;
  matchesWon: number;
  matchesLost: number;
  pointsEarned: number;
  eloChange: number;
  tournamentId: string;
  highlights: string[];
}): string {
  const placementText = params.placement === 1 ? '🥇 1st Place!' :
                        params.placement === 2 ? '🥈 2nd Place!' :
                        params.placement === 3 ? '🥉 3rd Place!' :
                        `#${params.placement} Place`;
  
  const content = `
    <h1 class="title">Tournament Complete! 🏆</h1>
    <p class="subtitle">${params.tournamentName} has concluded</p>
    
    <div class="success-box" style="text-align: center;">
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #065f46;">
        ${placementText}
      </p>
      <p style="margin: 8px 0 0 0; color: #065f46;">
        Out of ${params.totalParticipants} participants
      </p>
    </div>
    
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">Your Performance</h3>
      
      <div class="stat-row">
        <span class="stat-label">Matches Won</span>
        <span class="stat-value" style="color: #16a34a;">${params.matchesWon}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Matches Lost</span>
        <span class="stat-value" style="color: #dc2626;">${params.matchesLost}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Win Rate</span>
        <span class="stat-value">${Math.round((params.matchesWon / (params.matchesWon + params.matchesLost)) * 100)}%</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Points Earned</span>
        <span class="stat-value" style="color: #16a34a;">+${params.pointsEarned}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">ELO Change</span>
        <span class="stat-value" style="color: ${params.eloChange >= 0 ? '#16a34a' : '#dc2626'};">
          ${params.eloChange >= 0 ? '+' : ''}${params.eloChange}
        </span>
      </div>
    </div>
    
    ${params.highlights.length > 0 ? `
    <div class="card">
      <h4 style="margin: 0 0 12px 0; color: #111827;">Tournament Highlights</h4>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        ${params.highlights.map(h => `<li style="margin: 8px 0;">${h}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/tournaments/${params.tournamentId}/recap" class="btn">
        View Full Recap
      </a>
      <br/>
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/stats" class="btn btn-secondary" style="margin-top: 12px;">
        View Your Stats
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Keep competing and climb the ranks! See you at the next tournament. 🎯
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, `You placed #${params.placement} in ${params.tournamentName}!`);
}

// Rank Change Notification
export function getRankChangeEmail(params: {
  sport: SportType;
  playerName: string;
  previousRank: number;
  newRank: number;
  tier: string;
  points: number;
}): string {
  const improved = params.newRank < params.previousRank;
  const rankChange = Math.abs(params.previousRank - params.newRank);
  
  const content = `
    <h1 class="title">${improved ? 'Rank Improved!' : 'Rank Update'} 📊</h1>
    <p class="subtitle">Hi ${params.playerName}, your ranking has changed</p>
    
    <div class="${improved ? 'success-box' : 'warning-box'}" style="text-align: center;">
      <p style="margin: 0; font-size: 14px; color: ${improved ? '#065f46' : '#991b1b'};">
        ${improved ? `⬆️ Moved up ${rankChange} positions` : `⬇️ Dropped ${rankChange} positions`}
      </p>
    </div>
    
    <div class="card" style="text-align: center;">
      <div style="display: flex; justify-content: center; align-items: center; gap: 32px;">
        <div>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">Previous</p>
          <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 700; color: #9ca3af;">
            #${params.previousRank}
          </p>
        </div>
        
        <div style="font-size: 24px; color: ${improved ? '#16a34a' : '#dc2626'};">
          ${improved ? '→' : '←'}
        </div>
        
        <div>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">Current</p>
          <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 700; color: #111827;">
            #${params.newRank}
          </p>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="stat-row">
        <span class="stat-label">Tier</span>
        <span class="stat-value">${params.tier}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Total Points</span>
        <span class="stat-value">${params.points.toLocaleString('en-IN')}</span>
      </div>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/leaderboard" class="btn">
        View Leaderboard
      </a>
    </div>
  `;
  
  return getEmailWrapper(params.sport, content, `Your rank is now #${params.newRank}`);
}

// Milestone Achievement
export function getMilestoneEmail(params: {
  sport: SportType;
  playerName: string;
  milestoneTitle: string;
  milestoneDescription: string;
  points?: number;
  badgeUrl?: string;
}): string {
  const content = `
    <h1 class="title">Achievement Unlocked! 🏅</h1>
    <p class="subtitle">Congratulations ${params.playerName}!</p>
    
    <div class="success-box" style="text-align: center;">
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #065f46;">
        ${params.milestoneTitle}
      </p>
      <p style="margin: 8px 0 0 0; color: #065f46;">
        ${params.milestoneDescription}
      </p>
    </div>
    
    ${params.points ? `
    <div class="card" style="text-align: center;">
      <p style="margin: 0; color: #6b7280;">Points Earned</p>
      <p style="margin: 8px 0 0 0; font-size: 36px; font-weight: 700; color: #16a34a;">
        +${params.points}
      </p>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/milestones" class="btn">
        View All Achievements
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Keep up the great work! More achievements await. 🎯
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, `You earned: ${params.milestoneTitle}`);
}

// Password Reset
export function getPasswordResetEmail(params: {
  sport: SportType;
  playerName: string;
  resetUrl: string;
  expiresIn: string;
}): string {
  const content = `
    <h1 class="title">Reset Your Password</h1>
    <p class="subtitle">Hi ${params.playerName}, we received a request to reset your password</p>
    
    <div class="card" style="text-align: center;">
      <p style="margin: 0; color: #374151;">
        Click the button below to create a new password. This link will expire in ${params.expiresIn}.
      </p>
      
      <a href="${params.resetUrl}" class="btn" style="margin-top: 24px;">
        Reset Password
      </a>
    </div>
    
    <div class="warning-box">
      <p style="margin: 0; color: #991b1b;">
        <strong>Security Notice:</strong> If you didn't request this password reset, you can safely ignore this email.
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      For security reasons, this link can only be used once.
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, 'Reset your VALORHIVE password');
}

// Welcome Email
export function getWelcomeEmail(params: {
  sport: SportType;
  playerName: string;
  email: string;
}): string {
  const content = `
    <h1 class="title">Welcome to VALORHIVE! 🎯</h1>
    <p class="subtitle">Hi ${params.playerName}, your account is ready</p>
    
    <div class="success-box" style="text-align: center;">
      <p style="margin: 0; font-size: 16px; color: #065f46;">
        You're now part of the ${params.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts'} community!
      </p>
    </div>
    
    <div class="card">
      <h4 style="margin: 0 0 16px 0; color: #111827;">Here's what you can do:</h4>
      
      <ul style="margin: 0; padding-left: 0; list-style: none;">
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          🏆 <strong>Join Tournaments</strong> - Compete in local and national events
        </li>
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e5e7;">
          📊 <strong>Track Your Stats</strong> - Monitor your progress and rankings
        </li>
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          👥 <strong>Connect</strong> - Follow players and organizations
        </li>
        <li style="padding: 12px 0;">
          🎯 <strong>Improve</strong> - Get matched with players of similar skill
        </li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/dashboard" class="btn">
        Go to Dashboard
      </a>
      <br/>
      <a href="https://valorhive.com/${params.sport.toLowerCase()}/subscription" class="btn btn-secondary" style="margin-top: 12px;">
        Get Player Subscription
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Questions? Reply to this email or visit our help center.
    </p>
  `;
  
  return getEmailWrapper(params.sport, content, `Welcome to VALORHIVE, ${params.playerName}!`);
}

// Export all template functions
export const emailTemplates = {
  tournamentRegistration: getTournamentRegistrationEmail,
  matchResult: getMatchResultEmail,
  tournamentReminder: getTournamentReminderEmail,
  tournamentRecap: getTournamentRecapEmail,
  rankChange: getRankChangeEmail,
  milestone: getMilestoneEmail,
  passwordReset: getPasswordResetEmail,
  welcome: getWelcomeEmail,
};
