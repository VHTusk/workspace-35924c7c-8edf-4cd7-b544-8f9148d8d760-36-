/**
 * VALORHIVE Environment Configuration Validation
 * 
 * Strict runtime validation of environment variables using Zod.
 * This module ensures all required environment variables are present
 * and valid before the application starts.
 * 
 * Features:
 * - Type-safe environment access
 * - Early failure on missing/invalid config
 * - Separate validation for required vs optional vars
 * - Development vs production validation
 * 
 * @module env
 */

import { z } from 'zod';

// ============================================
// Environment Schemas
// ============================================

/**
 * Required environment variables in ALL environments
 */
const requiredEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Required environment variables in PRODUCTION
 */
const productionEnvSchema = z.object({
  // Authentication - Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required in production'),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1, 'NEXT_PUBLIC_GOOGLE_CLIENT_ID is required in production'),
  
  // Payment - Razorpay
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required in production'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required in production'),
  
  // Security
  IDENTITY_HASH_SALT: z.string().min(32, 'IDENTITY_HASH_SALT must be at least 32 characters'),
  LEADERBOARD_HASH_SECRET: z.string().min(32, 'LEADERBOARD_HASH_SECRET must be at least 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  
  // URLs
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_BASE_URL: z.string().url('NEXT_PUBLIC_BASE_URL must be a valid URL'),
  
  // Redis (recommended for production)
  REDIS_URL: z.string().optional(),
});

/**
 * Optional environment variables with defaults
 */
const optionalEnvSchema = z.object({
  // Public URLs (defaults for development)
  NEXT_PUBLIC_APP_URL: z.string().url().default('https://example.invalid'),
  NEXT_PUBLIC_BASE_URL: z.string().url().default('https://example.invalid'),
  NEXT_PUBLIC_API_URL: z.string().url().default('https://example.invalid'),
  NEXT_PUBLIC_WS_URL: z.string().default('wss://example.invalid'),
  NEXT_PUBLIC_APP_NAME: z.string().default('VALORHIVE'),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  
  // Redis
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_PREFIX: z.string().default('vh:rl:'),
  CACHE_DEBUG: z.string().default('false'),
  
  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // SMS/Email Providers
  SMS_PROVIDER: z.enum(['twilio', 'msg91', 'none']).default('none'),
  EMAIL_PROVIDER: z.enum(['sendgrid', 'resend', 'none']).default('none'),
  
  // Feature Flags
  ENABLE_DUEL_MODE: z.string().default('true'),
  ENABLE_AI_CHAT: z.string().default('false'),
  ENABLE_SWISS_FORMAT: z.string().default('true'),
  
  // Rate Limits
  RATE_LIMIT_PUBLIC: z.string().default('100'),
  RATE_LIMIT_AUTHENTICATED: z.string().default('300'),
  RATE_LIMIT_ADMIN: z.string().default('1000'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Development - Security defaults for production readiness
  SKIP_OTP_VERIFICATION: z.string().default('false'),
  LOG_OTP_TO_CONSOLE: z.string().default('false'), // Default to false for security
});

// ============================================
// Validation Function
// ============================================

interface EnvValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  env: Record<string, unknown>;
}

/**
 * Validate environment variables
 * 
 * @returns Validation result with errors and warnings
 */
function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env: Record<string, unknown> = {};
  
  // 1. Validate required variables
  const requiredResult = requiredEnvSchema.safeParse(process.env);
  if (!requiredResult.success) {
    for (const issue of requiredResult.error.issues) {
      errors.push(`Required: ${issue.path.join('.')} - ${issue.message}`);
    }
  } else {
    Object.assign(env, requiredResult.data);
  }
  
  // 2. Validate optional variables with defaults
  const optionalResult = optionalEnvSchema.safeParse(process.env);
  if (optionalResult.success) {
    Object.assign(env, optionalResult.data);
  }
  
  // 3. Production-specific validation
  if (process.env.NODE_ENV === 'production') {
    const productionResult = productionEnvSchema.safeParse(process.env);
    if (!productionResult.success) {
      for (const issue of productionResult.error.issues) {
        errors.push(`Production: ${issue.path.join('.')} - ${issue.message}`);
      }
    }
    
    // Production warnings
    if (!process.env.REDIS_URL) {
      warnings.push('REDIS_URL not set - using in-memory rate limiting (not suitable for multi-instance deployment)');
    }
  }
  
  // 4. Development warnings
  if (process.env.NODE_ENV === 'development') {
    if (!process.env.REDIS_URL) {
      warnings.push('REDIS_URL not set - using in-memory caching');
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings,
    env,
  };
}

// ============================================
// Export Validated Environment
// ============================================

const validationResult = validateEnv();

// Log warnings but don't fail
if (validationResult.warnings.length > 0) {
  console.warn('[ENV] Warnings:');
  validationResult.warnings.forEach(w => console.warn(`  - ${w}`));
}

// Fail on errors in production
if (!validationResult.success && process.env.NODE_ENV === 'production') {
  console.error('[ENV] Validation FAILED:');
  validationResult.errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

// Fail on errors in development too (for required vars)
if (!validationResult.success) {
  console.error('[ENV] Validation FAILED:');
  validationResult.errors.forEach(e => console.error(`  - ${e}`));
  // In development, we might want to allow running with missing optional vars
  // But we should still fail on missing required vars
  const requiredErrors = validationResult.errors.filter(e => e.startsWith('Required:'));
  if (requiredErrors.length > 0) {
    process.exit(1);
  }
}

/**
 * Validated environment configuration
 * 
 * Use this instead of process.env directly for type safety.
 */
export const env = {
  // Application
  nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.invalid',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://example.invalid',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'https://example.invalid',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'wss://example.invalid',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'VALORHIVE',
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  databaseUrlReplica: process.env.DATABASE_URL_REPLICA,
  
  // Authentication
  sessionSecret: process.env.SESSION_SECRET!,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  nextPublicGoogleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  
  // Payment
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  
  // Pricing (in paise)
  playerSubscriptionYearly: parseInt(process.env.PLAYER_SUBSCRIPTION_YEARLY || '29900'),
  orgSchoolClubYearly: parseInt(process.env.ORG_SCHOOL_CLUB_YEARLY || '49900'),
  orgCorporateYearly: parseInt(process.env.ORG_CORPORATE_YEARLY || '99900'),
  interOrgTournamentFee: parseInt(process.env.INTER_ORG_TOURNAMENT_FEE || '50000'),
  tournamentEntryFee: parseInt(process.env.TOURNAMENT_ENTRY_FEE || '10000'),
  
  // Redis
  redisUrl: process.env.REDIS_URL,
  rateLimitPrefix: process.env.RATE_LIMIT_PREFIX || 'vh:rl:',
  cacheDebug: process.env.CACHE_DEBUG === 'true',
  
  // AWS
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  
  // SMS
  smsProvider: (process.env.SMS_PROVIDER || 'none') as 'twilio' | 'msg91' | 'none',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  msg91AuthKey: process.env.MSG91_AUTH_KEY,
  msg91SenderId: process.env.MSG91_SENDER_ID,
  
  // Email
  emailProvider: (process.env.EMAIL_PROVIDER || 'none') as 'sendgrid' | 'resend' | 'none',
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  sendgridFromName: process.env.SENDGRID_FROM_NAME || 'VALORHIVE',
  resendApiKey: process.env.RESEND_API_KEY,
  
  // WhatsApp
  whatsappProvider: (process.env.WHATSAPP_PROVIDER || 'none') as 'gupshup' | 'twilio' | 'none',
  gupshupApiKey: process.env.GUPSHUP_API_KEY,
  gupshupAppName: process.env.GUPSHUP_APP_NAME,
  
  // Security
  identityHashSalt: process.env.IDENTITY_HASH_SALT,
  leaderboardHashSecret: process.env.LEADERBOARD_HASH_SECRET,
  
  // Cron
  cronSecret: process.env.CRON_SECRET,
  
  // Feature Flags
  enableDuelMode: process.env.ENABLE_DUEL_MODE !== 'false',
  enableAiChat: process.env.ENABLE_AI_CHAT === 'true',
  enableSwissFormat: process.env.ENABLE_SWISS_FORMAT !== 'false',
  
  // Rate Limits
  rateLimitPublic: parseInt(process.env.RATE_LIMIT_PUBLIC || '100'),
  rateLimitAuthenticated: parseInt(process.env.RATE_LIMIT_AUTHENTICATED || '300'),
  rateLimitAdmin: parseInt(process.env.RATE_LIMIT_ADMIN || '1000'),
  
  // Logging
  logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  
  // Development
  skipOtpVerification: process.env.SKIP_OTP_VERIFICATION === 'true',
  logOtpToConsole: process.env.LOG_OTP_TO_CONSOLE === 'true',
  
  // KYC
  hypervergeApiKey: process.env.HYPERVERGE_API_KEY,
  hypervergeAppId: process.env.HYPERVERGE_APP_ID,
  hypervergeAppKey: process.env.HYPERVERGE_APP_KEY,
  kycAutoApproveThreshold: parseFloat(process.env.KYC_AUTO_APPROVE_THRESHOLD || '0.95'),
  
  // FCM
  fcmProjectId: process.env.FCM_PROJECT_ID,
  fcmSenderId: process.env.FCM_SENDER_ID,
  fcmServerKey: process.env.FCM_SERVER_KEY,
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  
  // reCAPTCHA
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
  
  // CDN
  cdnProvider: (process.env.CDN_PROVIDER || 'none') as 'cloudflare' | 'cloudfront' | 'none',
  cdnUrl: process.env.CDN_URL,
  cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudfrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
  
  // Sentry
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN,
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,
  disputeSummaryModel: process.env.DISPUTE_SUMMARY_MODEL || 'gpt-4',
  
  // UPI Reconciliation
  upiPendingCheckIntervalMinutes: parseInt(process.env.UPI_PENDING_CHECK_INTERVAL_MINUTES || '5'),
  upiReconciliationTimeoutHours: parseInt(process.env.UPI_RECONCILIATION_TIMEOUT_HOURS || '24'),
  
  // Image Moderation
  imageModerationExplicitThreshold: parseFloat(process.env.IMAGE_MODERATION_EXPLICIT_THRESHOLD || '0.8'),
  imageModerationFlagThreshold: parseFloat(process.env.IMAGE_MODERATION_FLAG_THRESHOLD || '0.5'),
  
  // Helper methods
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // Redis available
  hasRedis: !!process.env.REDIS_URL,
  
  // AWS available
  hasAws: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  
  // SMS available
  hasSms: process.env.SMS_PROVIDER !== 'none' && 
    (process.env.SMS_PROVIDER === 'twilio' 
      ? !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
      : !!(process.env.MSG91_AUTH_KEY)),
  
  // Email available
  hasEmail: process.env.EMAIL_PROVIDER !== 'none' &&
    (process.env.EMAIL_PROVIDER === 'sendgrid'
      ? !!process.env.SENDGRID_API_KEY
      : !!process.env.RESEND_API_KEY),
};

// Type for env object
export type Env = typeof env;

// Log successful validation
console.log(`[ENV] Validated successfully (${env.nodeEnv})`);
// FIX: Use validationResult.warnings instead of env.warnings (which doesn't exist)
if (validationResult.warnings.length > 0) {
  validationResult.warnings.forEach(w => console.warn(`[ENV] Warning: ${w}`));
}

export default env;
