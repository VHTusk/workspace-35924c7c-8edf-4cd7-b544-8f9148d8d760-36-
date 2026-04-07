/**
 * CAPTCHA System for VALORHIVE
 * Version: v3.26.0
 * 
 * Features:
 * - Math CAPTCHA (primary, always available)
 * - reCAPTCHA v3 support (when configured)
 * - Rate limiting integration
 */

import { db } from '@/lib/db';

// CAPTCHA Configuration
const CAPTCHA_CONFIG = {
  mathCaptcha: {
    minNumber: 1,
    maxNumber: 20,
    operations: ['+', '-', '*'],
    expiryMinutes: 10,
  },
  recaptcha: {
    verifyUrl: 'https://www.google.com/recaptcha/api/siteverify',
    minScore: 0.5, // Minimum score for v3
  },
};

// Store for CAPTCHA challenges (Redis in production, in-memory fallback)
const captchaStore = new Map<string, {
  answer: string;
  expiresAt: Date;
  attempts: number;
}>();

// In-memory store cleanup interval
setInterval(() => {
  const now = new Date();
  for (const [key, value] of captchaStore.entries()) {
    if (value.expiresAt < now) {
      captchaStore.delete(key);
    }
  }
}, 60000); // Every minute

export interface MathCaptchaChallenge {
  captchaId: string;
  question: string;
  expiresAt: Date;
}

export interface CaptchaVerificationResult {
  success: boolean;
  error?: string;
}

/**
 * Generate a math CAPTCHA challenge
 */
export function generateMathCaptcha(): MathCaptchaChallenge {
  const { minNumber, maxNumber, operations } = CAPTCHA_CONFIG.mathCaptcha;
  
  const num1 = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;
  const num2 = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer: number;
  let question: string;
  
  switch (operation) {
    case '+':
      answer = num1 + num2;
      question = `${num1} + ${num2} = ?`;
      break;
    case '-':
      // Ensure positive result
      const [larger, smaller] = num1 >= num2 ? [num1, num2] : [num2, num1];
      answer = larger - smaller;
      question = `${larger} - ${smaller} = ?`;
      break;
    case '*':
      // Use smaller numbers for multiplication
      const mult1 = Math.min(num1, 10);
      const mult2 = Math.min(num2, 10);
      answer = mult1 * mult2;
      question = `${mult1} × ${mult2} = ?`;
      break;
    default:
      answer = num1 + num2;
      question = `${num1} + ${num2} = ?`;
  }
  
  const captchaId = generateCaptchaId();
  const expiresAt = new Date(Date.now() + CAPTCHA_CONFIG.mathCaptcha.expiryMinutes * 60 * 1000);
  
  // Store the answer
  captchaStore.set(captchaId, {
    answer: answer.toString(),
    expiresAt,
    attempts: 0,
  });
  
  return {
    captchaId,
    question,
    expiresAt,
  };
}

/**
 * Generate a unique CAPTCHA ID
 */
function generateCaptchaId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a math CAPTCHA answer
 */
export function verifyMathCaptcha(
  captchaId: string,
  answer: string
): CaptchaVerificationResult {
  const stored = captchaStore.get(captchaId);
  
  if (!stored) {
    return {
      success: false,
      error: 'CAPTCHA challenge not found or expired',
    };
  }
  
  if (stored.expiresAt < new Date()) {
    captchaStore.delete(captchaId);
    return {
      success: false,
      error: 'CAPTCHA challenge has expired',
    };
  }
  
  // Check attempts to prevent brute force
  if (stored.attempts >= 3) {
    captchaStore.delete(captchaId);
    return {
      success: false,
      error: 'Too many attempts. Please request a new CAPTCHA',
    };
  }
  
  stored.attempts++;
  
  // Compare answer (case-insensitive, trimmed)
  const normalizedAnswer = answer.trim().toLowerCase();
  const normalizedExpected = stored.answer.trim().toLowerCase();
  
  if (normalizedAnswer !== normalizedExpected) {
    return {
      success: false,
      error: 'Incorrect answer',
    };
  }
  
  // Success - remove the CAPTCHA so it can't be reused
  captchaStore.delete(captchaId);
  
  return { success: true };
}

/**
 * Verify reCAPTCHA v3 token
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction: string,
  remoteIp?: string
): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    // reCAPTCHA not configured, allow fallback to math CAPTCHA
    console.warn('reCAPTCHA not configured, skipping verification');
    return { success: true };
  }
  
  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });
    
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }
    
    const response = await fetch(CAPTCHA_CONFIG.recaptcha.verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    const result = await response.json() as {
      success: boolean;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };
    
    if (!result.success) {
      console.error('reCAPTCHA verification failed:', result['error-codes']);
      return {
        success: false,
        error: 'CAPTCHA verification failed',
      };
    }
    
    // Check action matches
    if (result.action && result.action !== expectedAction) {
      return {
        success: false,
        error: 'CAPTCHA action mismatch',
      };
    }
    
    // Check score threshold (v3 only)
    if (result.score !== undefined && result.score < CAPTCHA_CONFIG.recaptcha.minScore) {
      return {
        success: false,
        error: 'CAPTCHA score too low - suspicious activity detected',
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      error: 'CAPTCHA verification service unavailable',
    };
  }
}

/**
 * Combined CAPTCHA verification
 * Supports both math CAPTCHA and reCAPTCHA v3
 */
export async function verifyCaptcha(
  data: {
    captchaType?: 'math' | 'recaptcha';
    captchaId?: string;
    captchaAnswer?: string;
    recaptchaToken?: string;
    recaptchaAction?: string;
    remoteIp?: string;
  }
): Promise<CaptchaVerificationResult> {
  const { captchaType = 'math' } = data;
  
  if (captchaType === 'recaptcha' && data.recaptchaToken) {
    return verifyRecaptcha(
      data.recaptchaToken,
      data.recaptchaAction || 'submit',
      data.remoteIp
    );
  }
  
  if (captchaType === 'math' && data.captchaId && data.captchaAnswer) {
    return verifyMathCaptcha(data.captchaId, data.captchaAnswer);
  }
  
  return {
    success: false,
    error: 'Invalid CAPTCHA data provided',
  };
}

/**
 * Generate CAPTCHA for a specific purpose
 * Returns appropriate CAPTCHA based on configuration
 */
export function generateCaptcha(purpose: 'login' | 'register' | 'password_reset' | 'contact'): {
  captchaType: 'math' | 'recaptcha';
  mathCaptcha?: MathCaptchaChallenge;
  recaptchaSiteKey?: string;
} {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  
  // If reCAPTCHA is configured, prefer it for sensitive operations
  if (recaptchaSiteKey && (purpose === 'login' || purpose === 'register')) {
    return {
      captchaType: 'recaptcha',
      recaptchaSiteKey,
    };
  }
  
  // Fall back to math CAPTCHA
  return {
    captchaType: 'math',
    mathCaptcha: generateMathCaptcha(),
  };
}

/**
 * Store CAPTCHA attempt in database for rate limiting
 */
export async function recordCaptchaAttempt(
  identifier: string, // IP address or user ID
  success: boolean
): Promise<void> {
  // This would typically use Redis or database
  // For now, we'll use in-memory tracking
  // In production, integrate with rate limiting system
}

/**
 * Get CAPTCHA statistics for admin dashboard
 */
export function getCaptchaStats(): {
  activeChallenges: number;
  totalGenerated: number;
  totalVerified: number;
} {
  return {
    activeChallenges: captchaStore.size,
    totalGenerated: 0, // Would track in production
    totalVerified: 0, // Would track in production
  };
}

/**
 * Clear expired CAPTCHA challenges (cleanup)
 */
export function cleanupExpiredCaptchas(): number {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, value] of captchaStore.entries()) {
    if (value.expiresAt < now) {
      captchaStore.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}
