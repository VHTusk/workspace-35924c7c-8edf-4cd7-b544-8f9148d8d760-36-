/**
 * VALORHIVE Abuse Detection System (v4.4.0)
 * 
 * Detects and prevents suspicious patterns including:
 * - Multiple accounts from same device
 * - Bot registrations
 * - Suspicious payment patterns
 * - Impossible travel
 * - Credential stuffing
 * 
 * @module abuse-detection
 */

import { db } from '@/lib/db';
import { AbusePattern, AbuseSeverity, SportType } from '@prisma/client';
import { log, securityLog } from '@/lib/logger';
import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';

// ============================================
// Types & Interfaces
// ============================================

export { AbusePattern, AbuseSeverity };

export interface DeviceFingerprintData {
  userAgent: string;
  screenRes?: string;
  timezone?: string;
  language?: string;
  platform?: string;
}

export interface AbuseDetectionResult {
  detected: boolean;
  pattern?: AbusePattern;
  severity?: AbuseSeverity;
  riskScore: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface BotDetectionResult {
  isBot: boolean;
  indicators: string[];
  riskScore: number;
}

export interface PaymentRiskResult {
  isSuspicious: boolean;
  riskScore: number;
  indicators: string[];
}

export interface TravelCheckResult {
  isImpossible: boolean;
  fromCountry?: string;
  toCountry?: string;
  timeDiffHours?: number;
}

// ============================================
// Constants
// ============================================

// Known temp email domains
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'fakeinbox.com', 'dispostable.com',
  'mailnesia.com', 'tempail.com', 'mohmal.com', 'yopmail.com',
  'sharklasers.com', 'grr.la', 'guerrillamailblock.com', 'pokemail.net',
  'spam4.me', 'guzing.com', 'getairmail.com', 'dropjar.com',
];

// Rate limits for abuse detection
const RATE_LIMITS = {
  MAX_ACCOUNTS_PER_DEVICE: 3,
  MAX_REGISTRATIONS_PER_HOUR: 5,
  MAX_LOGIN_ATTEMPTS_PER_15MIN: 10,
  MAX_FAILED_PAYMENTS_BEFORE_SUCCESS: 3,
  MAX_TOURNAMENT_REGISTRATIONS_PER_HOUR: 10,
  MIN_TIME_BETWEEN_ACTIONS_MS: 100, // Sub-second detection threshold
};

// ============================================
// Device Fingerprint Functions
// ============================================

/**
 * Generate a unique device fingerprint from device characteristics
 */
export function generateDeviceFingerprint(data: DeviceFingerprintData): string {
  const fingerprintData = [
    data.userAgent || '',
    data.screenRes || '',
    data.timezone || '',
    data.language || '',
    data.platform || '',
  ].join('|');
  
  return createHash('sha256')
    .update(fingerprintData)
    .digest('hex');
}

/**
 * Detect device fingerprint from request headers
 */
export function detectDeviceFingerprint(request: NextRequest): DeviceFingerprintData {
  const userAgent = request.headers.get('user-agent') || '';
  const screenRes = request.headers.get('x-screen-resolution') || undefined;
  const timezone = request.headers.get('x-timezone') || undefined;
  const language = request.headers.get('accept-language')?.split(',')[0] || undefined;
  const platform = request.headers.get('sec-ch-ua-platform')?.replace(/"/g, '') || undefined;
  
  return {
    userAgent,
    screenRes,
    timezone,
    language,
    platform,
  };
}

/**
 * Store or update device fingerprint for a user
 */
export async function storeDeviceFingerprint(
  userId: string,
  fingerprintData: DeviceFingerprintData,
  ipAddress?: string,
  country?: string,
  city?: string
): Promise<{ fingerprint: string; isNew: boolean; accountCount: number }> {
  const fingerprint = generateDeviceFingerprint(fingerprintData);
  
  // Check if this fingerprint already exists (including orphaned records)
  const existing = await db.deviceFingerprint.findUnique({
    where: { fingerprint },
  });
  
  if (existing) {
    // Update existing fingerprint
    await db.deviceFingerprint.update({
      where: { fingerprint },
      data: {
        lastSeenAt: new Date(),
        loginCount: { increment: 1 },
        ipAddress,
        country,
        city,
      },
    });
    
    // Count distinct accounts with this fingerprint (only valid ones with existing users)
    const accountsWithFingerprint = await db.deviceFingerprint.count({
      where: { fingerprint },
    });
    
    return { 
      fingerprint, 
      isNew: false, 
      accountCount: accountsWithFingerprint,
    };
  }
  
  // Create new fingerprint
  await db.deviceFingerprint.create({
    data: {
      fingerprint,
      userId,
      userAgent: fingerprintData.userAgent,
      screenRes: fingerprintData.screenRes,
      timezone: fingerprintData.timezone,
      language: fingerprintData.language,
      platform: fingerprintData.platform,
      ipAddress,
      country,
      city,
    },
  });
  
  return { fingerprint, isNew: true, accountCount: 1 };
}

/**
 * Check if a device has multiple accounts
 */
export async function checkMultipleAccounts(fingerprint: string): Promise<AbuseDetectionResult> {
  // First get the device fingerprint count - don't use include to avoid null relation errors
  const devices = await db.deviceFingerprint.findMany({
    where: { fingerprint },
    select: {
      userId: true,
    },
  });
  
  const accountCount = devices.length;
  
  if (accountCount > RATE_LIMITS.MAX_ACCOUNTS_PER_DEVICE) {
    const severity = accountCount > 10 ? AbuseSeverity.CRITICAL :
                     accountCount > 5 ? AbuseSeverity.HIGH :
                     AbuseSeverity.MEDIUM;
    
    return {
      detected: true,
      pattern: AbusePattern.MULTIPLE_ACCOUNTS_SAME_DEVICE,
      severity,
      riskScore: Math.min(100, accountCount * 15),
      message: `Device has ${accountCount} accounts (threshold: ${RATE_LIMITS.MAX_ACCOUNTS_PER_DEVICE})`,
      metadata: {
        accountCount,
      },
    };
  }
  
  return { detected: false, riskScore: accountCount * 5 };
}

// ============================================
// Bot Detection Functions
// ============================================

/**
 * Check if email looks like a bot-generated email
 */
function isSuspiciousEmail(email: string): { isSuspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lowerEmail = email.toLowerCase();
  
  // Check for temp email domains
  const domain = lowerEmail.split('@')[1];
  if (domain && TEMP_EMAIL_DOMAINS.includes(domain)) {
    reasons.push('temp_email_domain');
  }
  
  // Check for random string patterns (e.g., abc123xyz@gmail.com)
  const localPart = lowerEmail.split('@')[0];
  
  // Random number pattern
  if (/\d{6,}/.test(localPart)) {
    reasons.push('random_numbers');
  }
  
  // Random character pattern
  if (/^[a-z]{2,4}\d{4,8}[a-z]{2,4}$/.test(localPart)) {
    reasons.push('random_pattern');
  }
  
  // Very short local part with numbers
  if (localPart.length < 5 && /\d/.test(localPart)) {
    reasons.push('short_with_numbers');
  }
  
  return { isSuspicious: reasons.length > 0, reasons };
}

/**
 * Check if username follows a sequential pattern
 */
function isSequentialUsername(firstName: string, lastName: string): boolean {
  // Check for sequential patterns like user1, user2, test1, test2
  const combined = `${firstName}${lastName}`.toLowerCase();
  
  // Pattern: name + increasing numbers
  if (/^[a-z]+\d{3,}$/.test(combined)) {
    return true;
  }
  
  // Pattern: similar names with slight variations
  if (/^(test|user|player|admin|guest)\d*$/.test(firstName.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Detect bot registration patterns
 */
export async function detectBotRegistration(
  email: string | undefined,
  phone: string | undefined,
  firstName: string,
  lastName: string,
  fingerprint: string | undefined,
  formCompletionTimeMs: number | undefined,
  honeypotValue: string | undefined,
  ipAddress: string | undefined
): Promise<BotDetectionResult> {
  const indicators: string[] = [];
  let riskScore = 0;
  
  // Check honeypot field
  if (honeypotValue && honeypotValue.length > 0) {
    indicators.push('honeypot_filled');
    riskScore += 50;
  }
  
  // Check for sub-second form completion
  if (formCompletionTimeMs && formCompletionTimeMs < RATE_LIMITS.MIN_TIME_BETWEEN_ACTIONS_MS) {
    indicators.push('sub_second_completion');
    riskScore += 40;
  }
  
  // Check email patterns
  if (email) {
    const emailCheck = isSuspiciousEmail(email);
    if (emailCheck.isSuspicious) {
      indicators.push(...emailCheck.reasons);
      riskScore += emailCheck.reasons.length * 15;
    }
  }
  
  // Check username patterns
  if (isSequentialUsername(firstName, lastName)) {
    indicators.push('sequential_username');
    riskScore += 20;
  }
  
  // Check for rapid registrations from same device
  if (fingerprint) {
    const recentRegistrations = await db.deviceFingerprint.findMany({
      where: {
        fingerprint,
        firstSeenAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });
    
    if (recentRegistrations.length >= RATE_LIMITS.MAX_REGISTRATIONS_PER_HOUR) {
      indicators.push('rapid_registrations');
      riskScore += 30;
    }
  }
  
  // Check for registrations from same IP
  if (ipAddress) {
    const recentFromIP = await db.deviceFingerprint.count({
      where: {
        ipAddress,
        firstSeenAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });
    
    if (recentFromIP >= RATE_LIMITS.MAX_REGISTRATIONS_PER_HOUR) {
      indicators.push('ip_rate_exceeded');
      riskScore += 25;
    }
  }
  
  return {
    isBot: riskScore >= 50,
    indicators,
    riskScore: Math.min(100, riskScore),
  };
}

// ============================================
// Payment Risk Detection
// ============================================

/**
 * Detect suspicious payment patterns
 */
export async function detectSuspiciousPayments(
  userId: string,
  amount: number,
  isNewUser: boolean
): Promise<PaymentRiskResult> {
  const indicators: string[] = [];
  let riskScore = 0;
  
  // Get recent payment history
  const recentPayments = await db.paymentLedger.findMany({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  
  // Count failed payments
  const failedPayments = recentPayments.filter(p => p.status === 'FAILED');
  if (failedPayments.length >= RATE_LIMITS.MAX_FAILED_PAYMENTS_BEFORE_SUCCESS) {
    indicators.push('multiple_failed_payments');
    riskScore += 30;
  }
  
  // Check for rapid registration + immediate payment
  if (isNewUser) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    
    if (user) {
      const accountAgeMs = Date.now() - user.createdAt.getTime();
      const accountAgeMinutes = accountAgeMs / (1000 * 60);
      
      if (accountAgeMinutes < 5) {
        indicators.push('immediate_payment');
        riskScore += 25;
      } else if (accountAgeMinutes < 30) {
        indicators.push('quick_payment');
        riskScore += 15;
      }
    }
  }
  
  // Check for unusually high amount for new users
  if (isNewUser && amount > 500000) { // > ₹5000
    indicators.push('high_first_payment');
    riskScore += 20;
  }
  
  // Check for same payment method used by multiple accounts
  // This would require access to payment method data which is typically 
  // stored in payment gateway records
  
  return {
    isSuspicious: riskScore >= 40,
    riskScore: Math.min(100, riskScore),
    indicators,
  };
}

// ============================================
// Impossible Travel Detection
// ============================================

/**
 * Check for impossible travel between logins
 */
export async function detectImpossibleTravel(
  userId: string,
  currentCountry: string,
  currentCity: string,
  ipAddress: string
): Promise<TravelCheckResult> {
  // Get the last login from a different location
  const recentLogins = await db.deviceFingerprint.findMany({
    where: {
      userId,
      country: { not: currentCountry },
    },
    orderBy: { lastSeenAt: 'desc' },
    take: 1,
  });
  
  if (recentLogins.length === 0) {
    return { isImpossible: false };
  }
  
  const lastLogin = recentLogins[0];
  const timeDiffMs = Date.now() - lastLogin.lastSeenAt.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  
  // Impossible travel: Different country within 2 hours
  if (timeDiffHours < 2 && lastLogin.country !== currentCountry) {
    // Log this security event
    securityLog.suspiciousActivity('IMPOSSIBLE_TRAVEL', {
      userId,
      fromCountry: lastLogin.country,
      fromCity: lastLogin.city,
      toCountry: currentCountry,
      toCity: currentCity,
      timeDiffHours,
    }, ipAddress);
    
    return {
      isImpossible: true,
      fromCountry: lastLogin.country || undefined,
      toCountry: currentCountry,
      timeDiffHours,
    };
  }
  
  return { isImpossible: false };
}

// ============================================
// Credential Stuffing Detection
// ============================================

/**
 * Check for credential stuffing patterns
 */
export async function detectCredentialStuffing(
  identifier: string,
  ipAddress: string,
  fingerprint: string | undefined,
  sport: SportType
): Promise<AbuseDetectionResult> {
  // Check for multiple failed attempts with different identifiers from same IP
  const recentAttempts = await db.auditLog.findMany({
    where: {
      action: 'AUTH_LOGIN_FAILED',
      ipAddress,
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
      },
    },
  });
  
  // Count unique identifiers tried
  const uniqueIdentifiers = new Set(
    recentAttempts
      .map(a => a.metadata ? JSON.parse(a.metadata as string)?.identifier : null)
      .filter(Boolean)
  );
  
  if (uniqueIdentifiers.size >= 5) {
    return {
      detected: true,
      pattern: AbusePattern.CREDENTIAL_STUFFING,
      severity: AbuseSeverity.HIGH,
      riskScore: 80,
      message: `Multiple different accounts tried from same IP: ${uniqueIdentifiers.size} identifiers`,
      metadata: {
        uniqueIdentifiers: uniqueIdentifiers.size,
        totalAttempts: recentAttempts.length,
        ipAddress,
      },
    };
  }
  
  // Check for rapid failed attempts from same fingerprint
  if (fingerprint) {
    const fingerprintAttempts = await db.deviceFingerprint.count({
      where: {
        fingerprint,
        lastSeenAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
    });
    
    if (fingerprintAttempts >= RATE_LIMITS.MAX_LOGIN_ATTEMPTS_PER_15MIN) {
      return {
        detected: true,
        pattern: AbusePattern.CREDENTIAL_STUFFING,
        severity: AbuseSeverity.MEDIUM,
        riskScore: 60,
        message: `Rapid login attempts from device: ${fingerprintAttempts}`,
        metadata: {
          attemptsCount: fingerprintAttempts,
          fingerprint,
        },
      };
    }
  }
  
  return { detected: false, riskScore: uniqueIdentifiers.size * 10 };
}

// ============================================
// Tournament Registration Abuse Detection
// ============================================

/**
 * Detect suspicious tournament registration patterns
 */
export async function detectSuspiciousTournamentRegistration(
  userId: string,
  tournamentId: string
): Promise<AbuseDetectionResult> {
  // Check for rapid tournament registrations
  const recentRegistrations = await db.tournamentRegistration.count({
    where: {
      userId,
      registeredAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
  });
  
  if (recentRegistrations >= RATE_LIMITS.MAX_TOURNAMENT_REGISTRATIONS_PER_HOUR) {
    return {
      detected: true,
      pattern: AbusePattern.SUSPICIOUS_TOURNAMENT_REGISTRATIONS,
      severity: AbuseSeverity.MEDIUM,
      riskScore: 50,
      message: `User registered for ${recentRegistrations} tournaments in the last hour`,
      metadata: {
        registrationCount: recentRegistrations,
        threshold: RATE_LIMITS.MAX_TOURNAMENT_REGISTRATIONS_PER_HOUR,
      },
    };
  }
  
  // Check for multiple accounts from same device registering for same tournament
  const userDevices = await db.deviceFingerprint.findMany({
    where: { userId },
    select: { fingerprint: true },
  });
  
  if (userDevices.length > 0) {
    const fingerprints = userDevices.map(d => d.fingerprint);
    
    // Find other accounts with same fingerprints
    const otherAccountsWithSameDevice = await db.deviceFingerprint.findMany({
      where: {
        fingerprint: { in: fingerprints },
        userId: { not: userId },
      },
      select: { userId: true },
    });
    
    const otherUserIds = [...new Set(otherAccountsWithSameDevice.map(d => d.userId))];
    
    if (otherUserIds.length > 0) {
      // Check if these accounts also registered for this tournament
      const duplicateRegistrations = await db.tournamentRegistration.count({
        where: {
          tournamentId,
          userId: { in: otherUserIds },
        },
      });
      
      if (duplicateRegistrations > 0) {
        return {
          detected: true,
          pattern: AbusePattern.SUSPICIOUS_TOURNAMENT_REGISTRATIONS,
          severity: AbuseSeverity.HIGH,
          riskScore: 75,
          message: 'Multiple accounts from same device registered for tournament',
          metadata: {
            relatedAccounts: otherUserIds.length,
            duplicateRegistrations,
          },
        };
      }
    }
  }
  
  return { detected: false, riskScore: 0 };
}

// ============================================
// Abuse Event Recording
// ============================================

/**
 * Record an abuse event in the database
 */
export async function recordAbuseEvent(
  pattern: AbusePattern,
  severity: AbuseSeverity,
  userId: string | undefined,
  deviceId: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  metadata: Record<string, unknown>
): Promise<string> {
  const event = await db.abuseEvent.create({
    data: {
      pattern,
      severity,
      userId,
      deviceId,
      ipAddress,
      userAgent,
      metadata: JSON.stringify(metadata),
      status: 'PENDING',
    },
  });
  
  // Log the event
  securityLog.suspiciousActivity(pattern, {
    eventId: event.id,
    severity,
    userId,
    deviceId,
    ...metadata,
  }, ipAddress || 'unknown');
  
  return event.id;
}

// ============================================
// Risk Score Calculation
// ============================================

/**
 * Calculate overall risk score for a user/device
 */
export async function getAbuseRiskScore(
  userId?: string,
  fingerprint?: string,
  ipAddress?: string
): Promise<{
  overallScore: number;
  components: {
    deviceRisk: number;
    accountRisk: number;
    ipRisk: number;
    historyRisk: number;
  };
  recommendations: string[];
}> {
  const components = {
    deviceRisk: 0,
    accountRisk: 0,
    ipRisk: 0,
    historyRisk: 0,
  };
  const recommendations: string[] = [];
  
  // Device risk
  if (fingerprint) {
    const devices = await db.deviceFingerprint.findMany({
      where: { fingerprint },
    });
    components.deviceRisk = Math.min(30, devices.length * 10);
    
    if (devices.length > RATE_LIMITS.MAX_ACCOUNTS_PER_DEVICE) {
      recommendations.push('Review accounts associated with this device');
    }
    
    // Check if device is blocked
    const blockedDevice = devices.find(d => d.isBlocked);
    if (blockedDevice) {
      components.deviceRisk += 50;
      recommendations.push('Device is currently blocked');
    }
  }
  
  // Account risk (user's abuse history)
  if (userId) {
    const abuseEvents = await db.abuseEvent.count({
      where: {
        userId,
        status: { not: 'FALSE_POSITIVE' },
      },
    });
    components.accountRisk = Math.min(30, abuseEvents * 5);
    
    if (abuseEvents > 0) {
      recommendations.push('User has previous abuse events');
    }
  }
  
  // IP risk
  if (ipAddress) {
    const ipAbuseEvents = await db.abuseEvent.count({
      where: {
        ipAddress,
        severity: { in: [AbuseSeverity.HIGH, AbuseSeverity.CRITICAL] },
        detectedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
        },
      },
    });
    components.ipRisk = Math.min(20, ipAbuseEvents * 10);
    
    if (ipAbuseEvents > 0) {
      recommendations.push('IP has recent high-severity abuse events');
    }
  }
  
  // History risk (recent activity patterns)
  if (userId) {
    const recentAbuse = await db.abuseEvent.findFirst({
      where: {
        userId,
        detectedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });
    
    if (recentAbuse) {
      components.historyRisk = 20;
      recommendations.push('User has recent abuse activity');
    }
  }
  
  const overallScore = Math.min(
    100,
    components.deviceRisk + components.accountRisk + components.ipRisk + components.historyRisk
  );
  
  return {
    overallScore,
    components,
    recommendations,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get client IP address from request
 */
export function getClientIpAddress(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return undefined;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'Unknown';
}

/**
 * Check if an action should be blocked based on risk score
 */
export function shouldBlockAction(riskScore: number, severity?: AbuseSeverity): boolean {
  if (severity === AbuseSeverity.CRITICAL) return true;
  if (severity === AbuseSeverity.HIGH && riskScore >= 70) return true;
  if (riskScore >= 90) return true;
  return false;
}

/**
 * Generate a unique block token
 */
export function generateBlockToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Block a device
 */
export async function blockDevice(
  fingerprint: string,
  reason: string
): Promise<void> {
  await db.deviceFingerprint.updateMany({
    where: { fingerprint },
    data: {
      isBlocked: true,
      blockedReason: reason,
      blockedAt: new Date(),
      riskScore: 100,
    },
  });
}

/**
 * Unblock a device
 */
export async function unblockDevice(fingerprint: string): Promise<void> {
  await db.deviceFingerprint.updateMany({
    where: { fingerprint },
    data: {
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
    },
  });
}
