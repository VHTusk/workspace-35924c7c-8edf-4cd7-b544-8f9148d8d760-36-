/**
 * VALORHIVE Feature Flags System
 * Database-backed feature flags with percentage rollout support
 */

import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

// Feature flag keys - pre-defined for the platform
export const FEATURE_FLAGS = {
  // UI/UX Features
  NEW_BRACKET_UI: 'new_bracket_ui',
  DARK_MODE: 'dark_mode',
  SOCIAL_SHARING: 'social_sharing',
  
  // Communication Features
  PUSH_NOTIFICATIONS: 'push_notifications',
  WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
  MESSAGING: 'messaging',
  
  // Engagement Features
  REFERRAL_PROGRAM: 'referral_program',
  ACTIVITY_FEED: 'activity_feed',
  PLAYER_AVAILABILITY: 'player_availability',
  LEADERBOARD_SNAPSHOTS: 'leaderboard_snapshots',
  
  // ============================================
  // AI & HEAVY COMPUTE FEATURES (DISABLED v3.78.0)
  // ============================================
  // These features are disabled to reduce costs and improve initial ROI.
  // They can be enabled later when volume justifies the cost.
  
  /**
   * Tier 1 AI Chatbot (v3.68.0)
   * DISABLED: Early users need direct human support to build trust.
   * Enable: When support volume exceeds team capacity.
   */
  AI_CHATBOT: 'ai_chatbot',
  
  /**
   * LLM Dispute Summarization (v3.65.0)
   * DISABLED: Admin volume low enough for manual review.
   * Enable: When dispute volume > 50/day.
   */
  AI_DISPUTE_SUMMARY: 'ai_dispute_summary',
  
  /**
   * Duel Replay Video Generation (v3.75.0)
   * DISABLED: AWS Lambda video generation burns budget.
   * Static "Replay Card" image generation remains active.
   * Enable: When monetization covers infrastructure costs.
   */
  DUEL_REPLAY_VIDEO: 'duel_replay_video',
  
  /**
   * HyperVerge OCR KYC (v3.65.0)
   * DISABLED for standard registration (reduces friction).
   * Activate: For withdrawals above ₹10,000 threshold.
   */
  KYC_OCR: 'kyc_ocr',
} as const;

type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

// Cache TTL for feature flags (5 minutes)
const FEATURE_FLAG_CACHE_TTL = 300;

// In-memory cache for feature flags
const flagCache = new Map<string, { enabled: boolean; rolloutPercentage: number; timestamp: number }>();

/**
 * Hash a string to a number between 0-100
 * Used for consistent percentage-based rollout
 */
function hashToPercentage(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive number and map to 0-100
  return Math.abs(hash) % 100;
}

/**
 * Check if a feature flag is enabled for a specific user
 * Uses percentage-based rollout for consistent experience
 */
export async function isFeatureEnabled(
  key: FeatureFlagKey | string,
  userId?: string
): Promise<boolean> {
  try {
    // Check in-memory cache first
    const cached = flagCache.get(key);
    const now = Date.now();
    
    let flag: { enabled: boolean; rolloutPercentage: number } | null = null;
    
    if (cached && (now - cached.timestamp) < FEATURE_FLAG_CACHE_TTL * 1000) {
      flag = { enabled: cached.enabled, rolloutPercentage: cached.rolloutPercentage };
    } else {
      // Try Redis cache
      const cacheKey = `feature_flag:${key}`;
      const cachedFlag = await cache.get<{ enabled: boolean; rolloutPercentage: number }>(cacheKey);
      
      if (cachedFlag) {
        flag = cachedFlag;
      } else {
        // Query database
        const dbFlag = await db.featureFlag.findUnique({
          where: { key },
          select: { enabled: true, rolloutPercentage: true },
        });
        
        if (dbFlag) {
          flag = dbFlag;
          // Cache in Redis
          await cache.set(cacheKey, dbFlag, FEATURE_FLAG_CACHE_TTL);
        }
      }
      
      // Update in-memory cache
      if (flag) {
        flagCache.set(key, { ...flag, timestamp: now });
      }
    }
    
    if (!flag) {
      // Feature flag doesn't exist, default to false
      return false;
    }
    
    // If not enabled globally, return false
    if (!flag.enabled) {
      return false;
    }
    
    // If 100% rollout, return true
    if (flag.rolloutPercentage >= 100) {
      return true;
    }
    
    // If 0% rollout, return false
    if (flag.rolloutPercentage <= 0) {
      return false;
    }
    
    // If no userId provided, use global enabled state only
    if (!userId) {
      return false;
    }
    
    // Use consistent hash for percentage-based rollout
    const hashInput = `${key}:${userId}`;
    const userPercentage = hashToPercentage(hashInput);
    
    return userPercentage < flag.rolloutPercentage;
  } catch (error) {
    console.error(`Error checking feature flag ${key}:`, error);
    return false; // Default to false on error
  }
}

/**
 * Get all feature flags (admin only)
 */
export async function getFeatureFlags(): Promise<Array<{
  id: string;
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}>> {
  return db.featureFlag.findMany({
    orderBy: { key: 'asc' },
  });
}

/**
 * Get a single feature flag by key
 */
export async function getFeatureFlag(key: string) {
  return db.featureFlag.findUnique({
    where: { key },
  });
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
  key: string,
  description?: string,
  enabled = false,
  rolloutPercentage = 0
): Promise<{ id: string; key: string; enabled: boolean; rolloutPercentage: number; description: string | null }> {
  const flag = await db.featureFlag.create({
    data: {
      key,
      description,
      enabled,
      rolloutPercentage,
    },
  });
  
  // Invalidate cache
  await invalidateFlagCache(key);
  
  return flag;
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  key: string,
  data: {
    enabled?: boolean;
    rolloutPercentage?: number;
    description?: string;
  }
): Promise<{ id: string; key: string; enabled: boolean; rolloutPercentage: number; description: string | null } | null> {
  const flag = await db.featureFlag.update({
    where: { key },
    data,
  });
  
  // Invalidate cache
  await invalidateFlagCache(key);
  
  return flag;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(key: string): Promise<boolean> {
  try {
    await db.featureFlag.delete({
      where: { key },
    });
    
    // Invalidate cache
    await invalidateFlagCache(key);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Invalidate cache for a feature flag
 */
async function invalidateFlagCache(key: string): Promise<void> {
  // Clear in-memory cache
  flagCache.delete(key);
  
  // Clear Redis cache
  const cacheKey = `feature_flag:${key}`;
  await cache.delete(cacheKey);
}

/**
 * Initialize default feature flags if they don't exist
 */
export async function initializeDefaultFeatureFlags(): Promise<void> {
  const defaultFlags = [
    // UI/UX Features
    { key: FEATURE_FLAGS.NEW_BRACKET_UI, description: 'New bracket visualization UI', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.DARK_MODE, description: 'Dark mode support', enabled: true, rolloutPercentage: 100 },
    { key: FEATURE_FLAGS.SOCIAL_SHARING, description: 'Social media sharing buttons', enabled: true, rolloutPercentage: 100 },
    
    // Communication Features
    { key: FEATURE_FLAGS.PUSH_NOTIFICATIONS, description: 'Push notification support', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.WHATSAPP_NOTIFICATIONS, description: 'WhatsApp notification integration', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.MESSAGING, description: 'In-app messaging system', enabled: true, rolloutPercentage: 100 },
    
    // Engagement Features
    { key: FEATURE_FLAGS.REFERRAL_PROGRAM, description: 'Referral program', enabled: true, rolloutPercentage: 100 },
    { key: FEATURE_FLAGS.ACTIVITY_FEED, description: 'Activity feed', enabled: true, rolloutPercentage: 100 },
    { key: FEATURE_FLAGS.PLAYER_AVAILABILITY, description: 'Player availability calendar', enabled: true, rolloutPercentage: 100 },
    { key: FEATURE_FLAGS.LEADERBOARD_SNAPSHOTS, description: 'Historical leaderboard snapshots', enabled: true, rolloutPercentage: 100 },
    
    // ============================================
    // AI FEATURES (DISABLED v3.78.0)
    // ============================================
    // These are intentionally disabled for cost control
    { key: FEATURE_FLAGS.AI_CHATBOT, description: 'Tier 1 AI Chatbot - DISABLED for human support priority', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.AI_DISPUTE_SUMMARY, description: 'LLM Dispute Summarization - DISABLED, manual review sufficient', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.DUEL_REPLAY_VIDEO, description: 'Duel Replay Video Generation - DISABLED, static cards only', enabled: false, rolloutPercentage: 0 },
    { key: FEATURE_FLAGS.KYC_OCR, description: 'HyperVerge OCR KYC - DISABLED for registration, activate for withdrawals', enabled: false, rolloutPercentage: 0 },
  ];
  
  for (const flag of defaultFlags) {
    const existing = await db.featureFlag.findUnique({
      where: { key: flag.key },
    });
    
    if (!existing) {
      await db.featureFlag.create({ data: flag });
      console.log(`Created feature flag: ${flag.key}`);
    }
  }
}

/**
 * Batch check multiple feature flags
 */
export async function checkMultipleFeatureFlags(
  keys: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  await Promise.all(
    keys.map(async (key) => {
      results[key] = await isFeatureEnabled(key, userId);
    })
  );
  
  return results;
}

/**
 * Get feature flag statistics
 */
export async function getFeatureFlagStats(): Promise<{
  total: number;
  enabled: number;
  partiallyEnabled: number;
  disabled: number;
}> {
  const flags = await db.featureFlag.findMany({
    select: { enabled: true, rolloutPercentage: true },
  });
  
  return {
    total: flags.length,
    enabled: flags.filter(f => f.enabled && f.rolloutPercentage === 100).length,
    partiallyEnabled: flags.filter(f => f.enabled && f.rolloutPercentage > 0 && f.rolloutPercentage < 100).length,
    disabled: flags.filter(f => !f.enabled || f.rolloutPercentage === 0).length,
  };
}
