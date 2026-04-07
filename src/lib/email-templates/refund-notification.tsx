/**
 * Refund Notification Email Template
 * 
 * Sent when a refund is processed for a tournament registration
 */

import { SportType } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';

const APP_URL = getAppUrl();

export interface RefundNotificationData {
  recipientName: string;
  sport: SportType;
  tournamentName: string;
  tournamentId: string;
  refundAmount: number;
  refundReason: string;
  processingDate: string;
  transactionId: string;
  originalTransactionId?: string;
  refundMethod?: string;
  expectedRefundDays?: number;
  supportUrl: string;
  tournamentUrl?: string;
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

// Refund reason display mapping
const REFUND_REASON_LABELS: Record<string, { label: string; icon: string }> = {
  TOURNAMENT_CANCELLED: { label: 'Tournament Cancelled', icon: '❌' },
  PLAYER_WITHDRAWAL: { label: 'Player Withdrawal', icon: '↩️' },
  VENUE_CHANGE: { label: 'Venue Change', icon: '📍' },
  SCHEDULE_CHANGE: { label: 'Schedule Change', icon: '📅' },
  OVERBOOKING: { label: 'Overbooking', icon: '👥' },
  WAITLIST_NOT_PROMOTED: { label: 'Waitlist Not Promoted', icon: '⏳' },
  PAYMENT_ISSUE: { label: 'Payment Issue', icon: '💳' },
  ADMIN_INITIATED: { label: 'Admin Initiated', icon: '🔧' },
  DUPLICATE_REGISTRATION: { label: 'Duplicate Registration', icon: '📋' },
  OTHER: { label: 'Other', icon: 'ℹ️' },
};

export function RefundNotificationEmail(data: RefundNotificationData): string {
  const colors = SPORT_COLORS[data.sport];
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  
  const reasonInfo = REFUND_REASON_LABELS[data.refundReason] || REFUND_REASON_LABELS.OTHER;
  const processingDateFormatted = new Date(data.processingDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Refund Processed - VALORHIVE</title>
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
    
    .refund-banner {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-left: 4px solid #3b82f6;
      padding: 24px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .refund-icon {
      font-size: 48px;
      margin: 0 0 8px 0;
    }
    
    .refund-title {
      font-size: 24px;
      font-weight: 700;
      color: #1e40af;
      margin: 0;
    }
    
    .refund-amount-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 2px solid ${colors.primary};
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }
    
    .refund-amount-label {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 8px 0;
    }
    
    .refund-amount-value {
      font-size: 40px;
      font-weight: 700;
      color: ${colors.primary};
      margin: 0;
    }
    
    .card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    
    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 16px 0;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
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
      text-align: right;
    }
    
    .reason-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
    }
    
    .reason-label {
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    
    .reason-text {
      font-size: 14px;
      color: #78350f;
      margin: 0;
    }
    
    .timeline-box {
      background: #eff6ff;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      text-align: center;
    }
    
    .timeline-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .timeline-text {
      font-size: 14px;
      color: #1e40af;
      margin: 0;
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
    
    .transaction-id {
      font-family: monospace;
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #6b7280;
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
    
    .help-box {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
    }
    
    .help-title {
      font-size: 14px;
      font-weight: 600;
      color: #991b1b;
      margin: 0 0 4px 0;
    }
    
    .help-text {
      font-size: 14px;
      color: #7f1d1d;
      margin: 0;
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
      .refund-amount-value {
        font-size: 32px;
      }
      .btn-secondary {
        display: block;
        margin: 12px 0 0 0;
        margin-left: 0;
      }
      .detail-row {
        flex-direction: column;
        gap: 4px;
      }
      .detail-value {
        text-align: left;
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
      
      <div class="refund-banner">
        <p class="refund-icon">💸</p>
        <p class="refund-title">Refund Processed</p>
        <p style="margin: 8px 0 0 0; color: #1e40af;">
          Your refund has been initiated successfully
        </p>
      </div>
      
      <h1 style="color: #111827; text-align: center; margin: 0 0 8px 0; font-size: 24px;">
        Hi ${data.recipientName},
      </h1>
      
      <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0; font-size: 16px;">
        We've processed your refund for <strong style="color: #111827;">${data.tournamentName}</strong>
      </p>
      
      <div class="refund-amount-box">
        <p class="refund-amount-label">Refund Amount</p>
        <p class="refund-amount-value">₹${data.refundAmount.toLocaleString('en-IN')}</p>
      </div>
      
      <div class="card">
        <h3 class="card-title">Refund Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">🏆 Tournament</span>
          <span class="detail-value">${data.tournamentName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">📅 Processing Date</span>
          <span class="detail-value">${processingDateFormatted}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">🧾 Transaction ID</span>
          <span class="detail-value"><code class="transaction-id">${data.transactionId}</code></span>
        </div>
        
        ${data.originalTransactionId ? `
        <div class="detail-row">
          <span class="detail-label">💳 Original Payment ID</span>
          <span class="detail-value"><code class="transaction-id">${data.originalTransactionId}</code></span>
        </div>
        ` : ''}
        
        ${data.refundMethod ? `
        <div class="detail-row">
          <span class="detail-label">🏦 Refund Method</span>
          <span class="detail-value">${data.refundMethod}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="reason-box">
        <p class="reason-label">Refund Reason</p>
        <p class="reason-text">${reasonInfo.icon} ${reasonInfo.label}</p>
      </div>
      
      ${data.expectedRefundDays ? `
      <div class="timeline-box">
        <p class="timeline-icon">⏱️</p>
        <p class="timeline-text">
          Expected refund time: <strong>${data.expectedRefundDays} business days</strong>
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #3b82f6;">
          The refund will be credited to your original payment method
        </p>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 32px 0;">
        ${data.tournamentUrl ? `<a href="${data.tournamentUrl}" class="btn">View Tournament</a>` : ''}
        <a href="${data.supportUrl}" class="btn ${data.tournamentUrl ? 'btn-secondary' : ''}">Contact Support</a>
      </div>
      
      <div class="help-box">
        <p class="help-title">Questions about your refund?</p>
        <p class="help-text">
          If you have any questions or concerns about this refund, please contact our support team.
          Reference your Transaction ID: <code class="transaction-id">${data.transactionId}</code>
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        We hope to see you at future tournaments! Check out other upcoming events on VALORHIVE.
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

export default RefundNotificationEmail;
