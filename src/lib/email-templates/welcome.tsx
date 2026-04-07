/**
 * Welcome Email Template
 * 
 * Sent to new users after registration
 */

import { SportType } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';

const APP_URL = getAppUrl();

export interface WelcomeEmailData {
  recipientName: string;
  email: string;
  sport: SportType;
  userId: string;
  isOrganization?: boolean;
  orgName?: string;
  profileUrl: string;
  dashboardUrl: string;
  tournamentsUrl: string;
  leaderboardUrl: string;
  subscriptionUrl?: string;
  referralCode?: string;
  referralBonus?: string;
  onboardingSteps?: Array<{
    title: string;
    description: string;
    icon: string;
    url?: string;
  }>;
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
    accent: '#f0fdf4',
  },
  DARTS: {
    primary: '#0d9488',
    primaryLight: '#14b8a6',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    badge: '#ccfbf1',
    badgeText: '#115e59',
    accent: '#f0fdfa',
  },
};

export function WelcomeEmail(data: WelcomeEmailData): string {
  const colors = SPORT_COLORS[data.sport];
  const sportName = data.sport === 'CORNHOLE' ? 'Cornhole' : 'Darts';
  
  const defaultOnboardingSteps = [
    {
      title: 'Complete Your Profile',
      description: 'Add your photo, location, and bio to connect with other players.',
      icon: '👤',
      url: data.profileUrl,
    },
    {
      title: 'Find Tournaments',
      description: 'Browse upcoming tournaments in your area and register to compete.',
      icon: '🏆',
      url: data.tournamentsUrl,
    },
    {
      title: 'Check the Leaderboard',
      description: 'See where you rank among other players and set your goals.',
      icon: '📊',
      url: data.leaderboardUrl,
    },
  ];
  
  const steps = data.onboardingSteps || defaultOnboardingSteps;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to VALORHIVE! 🎯</title>
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
      padding: 40px 40px;
      text-align: center;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: white;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    
    .welcome-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 16px;
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
    
    .greeting {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      text-align: center;
      margin: 0 0 8px 0;
    }
    
    .subtitle {
      font-size: 16px;
      color: #6b7280;
      text-align: center;
      margin: 0 0 32px 0;
    }
    
    .success-box {
      background: ${colors.accent};
      border-left: 4px solid ${colors.primary};
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .onboarding-list {
      margin: 24px 0;
      padding: 0;
      list-style: none;
    }
    
    .onboarding-item {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    
    .onboarding-item:last-child {
      margin-bottom: 0;
    }
    
    .step-icon {
      font-size: 28px;
      flex-shrink: 0;
    }
    
    .step-content {
      flex: 1;
    }
    
    .step-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 4px 0;
    }
    
    .step-description {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
    
    .step-link {
      color: ${colors.primary};
      text-decoration: none;
      font-weight: 500;
    }
    
    .step-link:hover {
      text-decoration: underline;
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
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    
    .feature-box {
      background: #f9fafb;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    
    .feature-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    
    .feature-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 4px 0;
    }
    
    .feature-desc {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }
    
    .referral-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #eab308;
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
      text-align: center;
    }
    
    .referral-code {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #92400e;
      margin: 12px 0;
      font-family: monospace;
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
      color: #6b7280;
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
        padding: 32px 24px;
      }
      .features-grid {
        grid-template-columns: 1fr;
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
      <div class="welcome-badge">Welcome to the Community!</div>
    </div>
    
    <div class="content">
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="sport-badge">${sportName}</span>
      </div>
      
      <h1 class="greeting">Welcome, ${data.recipientName}! 🎯</h1>
      <p class="subtitle">
        ${data.isOrganization 
          ? `${data.orgName || 'Your organization'} is now part of the ${sportName} community!`
          : `You're now part of the ${sportName} community. Compete, win, and rise!`}
      </p>
      
      <div class="success-box">
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${colors.primary};">
          ✓ Your account is ready!
        </p>
        <p style="margin: 8px 0 0 0; color: #374151;">
          ${data.email}
        </p>
      </div>
      
      <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 32px 0 16px 0;">
        Get Started in 3 Easy Steps
      </h2>
      
      <ul class="onboarding-list">
        ${steps.map((step, index) => `
        <li class="onboarding-item">
          <span class="step-icon">${step.icon}</span>
          <div class="step-content">
            <p class="step-title">${index + 1}. ${step.title}</p>
            <p class="step-description">
              ${step.description}
              ${step.url ? `<a href="${step.url}" class="step-link">Go →</a>` : ''}
            </p>
          </div>
        </li>
        `).join('')}
      </ul>
      
      <div class="features-grid">
        <div class="feature-box">
          <div class="feature-icon">🏆</div>
          <p class="feature-title">Join Tournaments</p>
          <p class="feature-desc">Compete in local and national events</p>
        </div>
        <div class="feature-box">
          <div class="feature-icon">📊</div>
          <p class="feature-title">Track Progress</p>
          <p class="feature-desc">Monitor your stats and rankings</p>
        </div>
        <div class="feature-box">
          <div class="feature-icon">👥</div>
          <p class="feature-title">Connect</p>
          <p class="feature-desc">Follow players and organizations</p>
        </div>
        <div class="feature-box">
          <div class="feature-icon">🎯</div>
          <p class="feature-title">Improve</p>
          <p class="feature-desc">Get matched with similar skill</p>
        </div>
      </div>
      
      ${data.referralCode ? `
      <div class="referral-box">
        <p style="margin: 0; font-weight: 600; color: #92400e;">
          🎁 Invite Friends & Earn Rewards!
        </p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">
          Share your referral code and earn ${data.referralBonus || 'bonus points'} when they join!
        </p>
        <div class="referral-code">${data.referralCode}</div>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.dashboardUrl}" class="btn">Go to Dashboard</a>
        ${data.subscriptionUrl ? `<a href="${data.subscriptionUrl}" class="btn btn-secondary">Get Pro</a>` : ''}
      </div>
      
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        💡 Tip: Complete your profile to unlock all features and start competing!
      </p>
    </div>
    
    <div class="footer">
      <div class="social-links">
        <a href="https://twitter.com/valorhive">𝕏 Twitter</a>
        <a href="https://instagram.com/valorhive">📷 Instagram</a>
        <a href="https://facebook.com/valorhive">📘 Facebook</a>
      </div>
      
      <p class="footer-text">
        Questions? Reply to this email or visit our <a href="${APP_URL}/help" class="footer-link">Help Center</a>.
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

export default WelcomeEmail;
