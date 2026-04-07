/**
 * Tournament Confirmation Email Template
 * 
 * Sent when a player successfully registers for a tournament
 */

import { SportType } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';

const APP_URL = getAppUrl();

export interface TournamentConfirmationData {
  recipientName: string;
  sport: SportType;
  tournamentName: string;
  tournamentDate: string;
  tournamentTime?: string;
  venue: string;
  city?: string;
  state?: string;
  entryFee: number;
  transactionId: string;
  tournamentId: string;
  tournamentUrl: string;
  calendarUrl?: string;
  registrationId: string;
  checkInRequired?: boolean;
  checkInDeadline?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  prizePool?: number;
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

export function TournamentConfirmationEmail(data: TournamentConfirmationData): string {
  const colors = SPORT_COLORS[data.sport];
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  const spotsRemaining = data.maxParticipants && data.currentParticipants 
    ? data.maxParticipants - data.currentParticipants 
    : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Tournament Registration Confirmed - VALORHIVE</title>
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
    
    .success-box {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      border-left: 4px solid #10b981;
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
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
    
    .highlight-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #f59e0b;
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
      <a href="${APP_URL}" class="logo">VALORHIVE</a>
    </div>
    
    <div class="content">
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="sport-badge">${sportName}</span>
      </div>
      
      <h1 style="color: #111827; text-align: center; margin: 0 0 8px 0; font-size: 28px;">
        Registration Confirmed!
      </h1>
      
      <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0; font-size: 16px;">
        Hi ${data.recipientName}, you're all set for <strong style="color: #111827;">${data.tournamentName}</strong>
      </p>
      
      <div class="success-box">
        <p style="margin: 0 0 8px 0; font-size: 48px;">✓</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #065f46;">
          Registration Successful
        </p>
        <p style="margin: 8px 0 0 0; color: #065f46;">
          Your spot has been reserved. Get ready to compete!
        </p>
      </div>
      
      <div class="card">
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">Tournament Details</h3>
        
        <div class="stat-row">
          <span class="stat-label">Tournament</span>
          <span class="stat-value">${data.tournamentName}</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">Date</span>
          <span class="stat-value">${data.tournamentDate}${data.tournamentTime ? ` at ${data.tournamentTime}` : ''}</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">Venue</span>
          <span class="stat-value">${data.venue}${data.city ? `, ${data.city}` : ''}${data.state ? `, ${data.state}` : ''}</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">Entry Fee</span>
          <span class="stat-value">₹${data.entryFee.toLocaleString('en-IN')}</span>
        </div>
        
        ${data.prizePool ? `
        <div class="stat-row">
          <span class="stat-label">Prize Pool</span>
          <span class="stat-value" style="color: #16a34a;">₹${data.prizePool.toLocaleString('en-IN')}</span>
        </div>
        ` : ''}
        
        ${spotsRemaining !== null ? `
        <div class="stat-row">
          <span class="stat-label">Spots Remaining</span>
          <span class="stat-value">${spotsRemaining} of ${data.maxParticipants}</span>
        </div>
        ` : ''}
      </div>
      
      <p style="color: #6b7280; text-align: center; font-size: 12px; margin: 16px 0;">
        Transaction ID: <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${data.transactionId}</code>
      </p>
      
      ${data.checkInRequired ? `
      <div class="highlight-box">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">
          Check-in Required
        </p>
        <p style="margin: 0; color: #92400e;">
          Please check in before ${data.checkInDeadline || 'the tournament start time'} to confirm your participation.
          Failure to check in may result in automatic withdrawal.
        </p>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.tournamentUrl}" class="btn">View Tournament Details</a>
        ${data.calendarUrl ? `<a href="${data.calendarUrl}" class="btn btn-secondary">Add to Calendar</a>` : ''}
      </div>
      
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        You'll receive reminder emails before the tournament starts. Good luck!
      </p>
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

export default TournamentConfirmationEmail;
