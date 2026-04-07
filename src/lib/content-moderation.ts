/**
 * Content Moderation Service for VALORHIVE
 * 
 * Features:
 * - Comprehensive profanity filtering (English + Hindi)
 * - Content reporting with auto-flag
 * - Report review workflow
 * - Auto-suspend based on report thresholds
 * - Image moderation flags
 */

import { db } from '@/lib/db';
import { ReportStatus, AuditAction, Role, SportType } from '@prisma/client';

// ============================================
// PROFANITY FILTERING
// ============================================

// Common English profanity words (censored versions for demonstration)
// In production, use actual word list
const ENGLISH_PROFANITY = [
  // Common English profanity - using placeholder/censored versions
  'damn', 'hell', 'ass', 'bastard', 'bitch', 'crap', 'dick',
  'fuck', 'shit', 'piss', 'whore', 'slut', 'cock', 'pussy',
  'asshole', 'dumbass', 'jackass', 'dipshit', 'bullshit',
  'motherfucker', 'wanker', 'twat', 'cunt', 'wtf', 'omfg',
  // Add more as needed
];

// Common Hindi profanity words (transliterated)
const HINDI_PROFANITY = [
  'chutiya', 'chutiya', 'chutiye', 'madarchod', 'madar-chod',
  'behenchod', 'behen-chod', 'bhenchod', 'bhen-chod',
  'bhosdi', 'bhosada', 'bhosdike', 'randi', 'rundi',
  'harami', 'haramzaada', 'haramzada', 'kutta', 'kutte',
  'kamina', 'kaminey', 'saala', 'saale', 'saali',
  'gand', 'gandu', 'gandmarao', 'chodu', 'chudai',
  'lauda', 'loda', 'lode', 'lund', 'lawda', 'lavda',
  'bhosri', 'bhosriwala', 'betichod', 'beti-chod',
  'teri maa ki', 'teri behen ki', 'aai la', 'aaila',
  'suar', 'suwar', 'kameena', 'kamina', 'raapchik',
  'ghatiya', 'awara', 'badtameez', 'bewakoof',
  // Add more as needed
];

// Combined profanity list
const DEFAULT_PROFANITY_LIST = [...ENGLISH_PROFANITY, ...HINDI_PROFANITY];

// Sport-specific custom word lists
const SPORT_PROFANITY: Record<SportType, string[]> = {
  CORNHOLE: [
    // Add cornhole-specific inappropriate terms
  ],
  DARTS: [
    // Add darts-specific inappropriate terms
  ],
};

/**
 * Get profanity list for a specific sport (default + sport-specific)
 */
function getProfanityList(sport?: SportType): string[] {
  if (!sport) return DEFAULT_PROFANITY_LIST;
  return [...DEFAULT_PROFANITY_LIST, ...(SPORT_PROFANITY[sport] || [])];
}

/**
 * Check if text contains profanity
 */
export function containsProfanity(text: string, sport?: SportType): {
  hasProfanity: boolean;
  flaggedWords: string[];
  severity: 'none' | 'mild' | 'moderate' | 'severe';
} {
  const lowerText = text.toLowerCase();
  const profanityList = getProfanityList(sport);
  const flaggedWords: string[] = [];

  // Check for whole word matches
  for (const word of profanityList) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(lowerText)) {
      flaggedWords.push(word);
    }
  }

  // Determine severity based on number and type of words
  let severity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  if (flaggedWords.length > 0) {
    if (flaggedWords.length >= 5 || flaggedWords.some(w => w.length >= 6)) {
      severity = 'severe';
    } else if (flaggedWords.length >= 3) {
      severity = 'moderate';
    } else {
      severity = 'mild';
    }
  }

  return {
    hasProfanity: flaggedWords.length > 0,
    flaggedWords: [...new Set(flaggedWords)], // Remove duplicates
    severity,
  };
}

/**
 * Filter profanity from text, replacing with asterisks
 */
export function filterProfanity(text: string, sport?: SportType): {
  filtered: string;
  wasFiltered: boolean;
  replacements: Array<{ original: string; replaced: string }>;
} {
  let filtered = text;
  const replacements: Array<{ original: string; replaced: string }> = [];
  const profanityList = getProfanityList(sport);

  for (const word of profanityList) {
    const regex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      for (const match of matches) {
        const replacement = '*'.repeat(match.length);
        filtered = filtered.replace(new RegExp(`\\b${match}\\b`, 'gi'), replacement);
        replacements.push({ original: match, replaced: replacement });
      }
    }
  }

  return {
    filtered,
    wasFiltered: replacements.length > 0,
    replacements,
  };
}

// ============================================
// SUSPICIOUS CONTENT DETECTION
// ============================================

// Patterns for detecting potentially problematic content
const SUSPICIOUS_PATTERNS = {
  phone: /\b\d{10,}\b/g,
  email: /\b[\w.-]+@[\w.-]+\.\w+\b/gi,
  url: /https?:\/\/[^\s]+/gi,
  whatsapp: /\b(?:whatsapp|wa|whats\s*app)\s*[:\s]*\d+/gi,
  socialMedia: /\b(?:instagram|facebook|twitter|telegram|snapchat|tiktok)\s*[:\s]*@?\w+/gi,
};

/**
 * Check content for suspicious patterns (personal info, external links, etc.)
 */
export function detectSuspiciousContent(content: string): {
  hasSuspiciousContent: boolean;
  patterns: string[];
  matches: Record<string, string[]>;
} {
  const patterns: string[] = [];
  const matches: Record<string, string[]> = {};

  for (const [type, regex] of Object.entries(SUSPICIOUS_PATTERNS)) {
    const found = content.match(regex);
    if (found && found.length > 0) {
      patterns.push(type);
      matches[type] = found;
    }
    // Reset regex lastIndex
    regex.lastIndex = 0;
  }

  return {
    hasSuspiciousContent: patterns.length > 0,
    patterns,
    matches,
  };
}

// ============================================
// CONTENT REPORTING
// ============================================

export type ContentType = 'message' | 'profile_image' | 'tournament_media' | 'player_name';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fraud' | 'impersonation' | 'hate_speech' | 'other';

/**
 * Report content for moderation
 */
export async function reportContent(data: {
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reason: ReportReason | string;
  description?: string;
  reportedUserId?: string;
  reportedOrgId?: string;
  contentSnapshot?: string;
}): Promise<{
  success: boolean;
  reportId: string;
  autoFlagged: boolean;
  existingReports: number;
}> {
  // Check for existing reports on the same content
  const existingReports = await db.contentReport.count({
    where: {
      contentType: data.contentType,
      contentId: data.contentId,
      status: { not: ReportStatus.DISMISSED },
    },
  });

  // Create the report
  const report = await db.contentReport.create({
    data: {
      reporterId: data.reporterId,
      reportedUserId: data.reportedUserId,
      reportedOrgId: data.reportedOrgId,
      contentType: data.contentType,
      contentId: data.contentId,
      contentSnapshot: data.contentSnapshot,
      reason: data.reason,
      description: data.description,
      status: ReportStatus.PENDING,
    },
  });

  // Auto-flag content with multiple reports (3+ reports)
  const autoFlagged = existingReports >= 2; // This report makes it 3+
  
  if (autoFlagged) {
    // Update all reports for this content to REVIEWING status
    await db.contentReport.updateMany({
      where: {
        contentType: data.contentType,
        contentId: data.contentId,
        status: ReportStatus.PENDING,
      },
      data: { status: ReportStatus.REVIEWING },
    });
  }

  // Check if reported user should be auto-suspended
  if (data.reportedUserId) {
    await checkAutoSuspend(data.reportedUserId);
  }

  return {
    success: true,
    reportId: report.id,
    autoFlagged,
    existingReports: existingReports + 1,
  };
}

// ============================================
// AUTO-SUSPEND LOGIC
// ============================================

interface SuspensionResult {
  suspended: boolean;
  duration: number | null; // in hours, null for permanent
  reason: string;
  reportCount: number;
  timeWindow: number; // in days
}

/**
 * Check if user should be auto-suspended based on report thresholds
 * 
 * Thresholds:
 * - 3 reports in 7 days = 24h suspension
 * - 5 reports in 30 days = 7 day suspension
 * - 10+ reports in 90 days = permanent ban (requires admin review)
 */
export async function checkAutoSuspend(userId: string): Promise<SuspensionResult> {
  const now = new Date();

  // Check 7-day window (3 reports = 24h suspension)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const reports7Days = await db.contentReport.count({
    where: {
      reportedUserId: userId,
      status: { not: ReportStatus.DISMISSED },
      createdAt: { gte: sevenDaysAgo },
    },
  });

  // Check 30-day window (5 reports = 7 day suspension)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const reports30Days = await db.contentReport.count({
    where: {
      reportedUserId: userId,
      status: { not: ReportStatus.DISMISSED },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  // Check 90-day window (10+ reports = permanent ban)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const reports90Days = await db.contentReport.count({
    where: {
      reportedUserId: userId,
      status: { not: ReportStatus.DISMISSED },
      createdAt: { gte: ninetyDaysAgo },
    },
  });

  // Apply suspension based on thresholds
  // Check in order of severity (most severe first)
  
  // Permanent ban (10+ reports in 90 days)
  if (reports90Days >= 10) {
    await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivationReason: `Permanent ban: ${reports90Days} reports in 90 days (pending admin review)`,
      },
    });

    // Log to audit
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user) {
      await db.auditLog.create({
        data: {
          sport: user.sport,
          action: AuditAction.USER_BANNED,
          actorId: userId, // Self-action due to auto-ban
          actorRole: Role.ADMIN, // System action
          targetType: 'user',
          targetId: userId,
          reason: `Auto-ban: ${reports90Days} reports in 90 days`,
          metadata: JSON.stringify({ reportCount: reports90Days, timeWindow: 90 }),
        },
      });
    }

    return {
      suspended: true,
      duration: null, // Permanent
      reason: `Permanent ban triggered: ${reports90Days} reports in 90 days`,
      reportCount: reports90Days,
      timeWindow: 90,
    };
  }

  // 7-day suspension (5 reports in 30 days)
  if (reports30Days >= 5) {
    const suspendedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivationReason: `Suspended 7 days: ${reports30Days} reports in 30 days`,
        lockedUntil: suspendedUntil,
      },
    });

    return {
      suspended: true,
      duration: 168, // 7 days in hours
      reason: `7-day suspension: ${reports30Days} reports in 30 days`,
      reportCount: reports30Days,
      timeWindow: 30,
    };
  }

  // 24-hour suspension (3 reports in 7 days)
  if (reports7Days >= 3) {
    const suspendedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivationReason: `Suspended 24 hours: ${reports7Days} reports in 7 days`,
        lockedUntil: suspendedUntil,
      },
    });

    return {
      suspended: true,
      duration: 24,
      reason: `24-hour suspension: ${reports7Days} reports in 7 days`,
      reportCount: reports7Days,
      timeWindow: 7,
    };
  }

  return {
    suspended: false,
    duration: null,
    reason: 'No suspension threshold reached',
    reportCount: reports7Days,
    timeWindow: 7,
  };
}

// ============================================
// ADMIN ACTIONS
// ============================================

export type AdminAction = 'dismiss' | 'warning' | 'content_removed' | 'account_suspended';

/**
 * Review and resolve a content report
 */
export async function reviewReport(
  reportId: string,
  reviewerId: string,
  action: AdminAction,
  notes?: string
): Promise<{
  success: boolean;
  report: any;
  actionTaken: string;
}> {
  const report = await db.contentReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error('Report not found');
  }

  const reporter = report.reporterId
    ? await db.user.findUnique({
        where: { id: report.reporterId },
        select: { id: true, firstName: true, lastName: true, sport: true },
      })
    : null;

  // Map action to status
  const statusMap: Record<AdminAction, ReportStatus> = {
    dismiss: ReportStatus.DISMISSED,
    warning: ReportStatus.RESOLVED,
    content_removed: ReportStatus.RESOLVED,
    account_suspended: ReportStatus.RESOLVED,
  };

  // Update the report
  const updatedReport = await db.contentReport.update({
    where: { id: reportId },
    data: {
      status: statusMap[action],
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      action,
    },
  });

  // Log the action
  const reviewer = await db.user.findUnique({ where: { id: reviewerId } });
  if (reviewer) {
    await db.auditLog.create({
      data: {
        sport: reviewer.sport,
        action: action === 'account_suspended' ? AuditAction.USER_BANNED : AuditAction.ADMIN_OVERRIDE,
        actorId: reviewerId,
        actorRole: Role.ADMIN,
        targetType: 'content_report',
        targetId: reportId,
        reason: `Report review: ${action}`,
        metadata: JSON.stringify({
          action,
          notes,
          contentType: report.contentType,
          contentId: report.contentId,
          reportedUserId: report.reportedUserId,
        }),
      },
    });
  }

  // Take additional action based on the review
  if (action === 'account_suspended' && report.reportedUserId) {
    await db.user.update({
      where: { id: report.reportedUserId },
      data: {
        isActive: false,
        deactivationReason: `Suspended due to content violation: ${notes || 'No notes provided'}`,
      },
    });
  }

  // Notify the reporter
  if (report.reporterId) {
    await db.notification.create({
      data: {
        userId: report.reporterId,
        sport: reporter?.sport || SportType.CORNHOLE,
        type: 'DISPUTE_UPDATE',
        title: 'Report Update',
        message: `Your report has been reviewed and action taken: ${action.replace('_', ' ')}`,
        link: '/dashboard',
      },
    });
  }

  return {
    success: true,
    report: updatedReport,
    actionTaken: action,
  };
}

// ============================================
// IMAGE MODERATION
// ============================================

export interface ImageModerationResult {
  safe: boolean;
  categories: {
    explicit: number;      // 0-1 probability
    violence: number;
    hateSpeech: number;
    minorPresent: boolean;
  };
  action: 'APPROVED' | 'FLAGGED' | 'AUTO_REMOVED';
  labels?: string[];       // Detected content labels
  error?: string;
}

// Thresholds from environment or defaults
const IMAGE_MODERATION_EXPLICIT_THRESHOLD = parseFloat(
  process.env.IMAGE_MODERATION_EXPLICIT_THRESHOLD || '0.85'
);
const IMAGE_MODERATION_FLAG_THRESHOLD = parseFloat(
  process.env.IMAGE_MODERATION_FLAG_THRESHOLD || '0.60'
);

/**
 * Moderate image using AWS Rekognition
 * 
 * Cost: ~$0.001 per image
 * 
 * Actions:
 * - Auto-removal: Any score > 0.85 on explicit/violence
 * - Flag for review: Any score > 0.60
 * - Minor in explicit context: Immediate account suspension flag
 */
export async function moderateImage(imageUrl: string): Promise<ImageModerationResult> {
  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'ap-south-1';

  // Default result if AWS not configured
  if (!awsAccessKey || !awsSecretKey) {
    console.warn('[ImageModeration] AWS credentials not configured, allowing image');
    return {
      safe: true,
      categories: {
        explicit: 0,
        violence: 0,
        hateSpeech: 0,
        minorPresent: false,
      },
      action: 'APPROVED',
      labels: [],
    };
  }

  try {
    // Dynamic import for AWS SDK (server-side only)
    const { RekognitionClient, DetectModerationLabelsCommand, DetectLabelsCommand } = 
      await import('@aws-sdk/client-rekognition');

    const client = new RekognitionClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
      },
    });

    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image');
    }
    
    const imageBytes = await imageResponse.arrayBuffer();

    // Run moderation labels detection
    const moderationCommand = new DetectModerationLabelsCommand({
      Image: {
        Bytes: new Uint8Array(imageBytes),
      },
      MinConfidence: 50, // Minimum confidence to return
    });

    const moderationResponse = await client.send(moderationCommand);

    // Initialize categories
    const categories: ImageModerationResult['categories'] = {
      explicit: 0,
      violence: 0,
      hateSpeech: 0,
      minorPresent: false,
    };

    const labels: string[] = [];

    // Process moderation labels
    if (moderationResponse.ModerationLabels) {
      for (const label of moderationResponse.ModerationLabels) {
        const confidence = (label.Confidence || 0) / 100; // Convert to 0-1 scale
        const name = label.Name?.toLowerCase() || '';
        const parentName = label.ParentName?.toLowerCase() || '';

        labels.push(label.Name || 'Unknown');

        // Map AWS labels to our categories
        if (
          name.includes('nudity') ||
          name.includes('explicit') ||
          name.includes('suggestive') ||
          parentName.includes('nudity') ||
          parentName.includes('explicit')
        ) {
          categories.explicit = Math.max(categories.explicit, confidence);
        }

        if (
          name.includes('violence') ||
          name.includes('weapons') ||
          name.includes('gore') ||
          parentName.includes('violence')
        ) {
          categories.violence = Math.max(categories.violence, confidence);
        }

        if (
          name.includes('hate') ||
          name.includes('nazi') ||
          name.includes('extremist') ||
          name.includes('middle_finger')
        ) {
          categories.hateSpeech = Math.max(categories.hateSpeech, confidence);
        }
      }
    }

    // Also detect regular labels to check for minors
    const labelsCommand = new DetectLabelsCommand({
      Image: {
        Bytes: new Uint8Array(imageBytes),
      },
      MaxLabels: 50,
      MinConfidence: 70,
    });

    const labelsResponse = await client.send(labelsCommand);
    
    if (labelsResponse.Labels) {
      const hasMinor = labelsResponse.Labels.some(label => {
        const name = label.Name?.toLowerCase() || '';
        return name.includes('kid') || 
               name.includes('child') || 
               name.includes('baby') ||
               name.includes('infant') ||
               name.includes('toddler') ||
               name.includes('teenager') ||
               name.includes('minor');
      });
      
      categories.minorPresent = hasMinor;
      
      // Add detected labels for context
      labels.push(...(labelsResponse.Labels.map(l => l.Name || '').filter(Boolean)));
    }

    // Determine action
    let action: ImageModerationResult['action'] = 'APPROVED';

    // Check for auto-removal threshold
    if (
      categories.explicit > IMAGE_MODERATION_EXPLICIT_THRESHOLD ||
      categories.violence > IMAGE_MODERATION_EXPLICIT_THRESHOLD
    ) {
      action = 'AUTO_REMOVED';
    }
    // Check for flag threshold
    else if (
      categories.explicit > IMAGE_MODERATION_FLAG_THRESHOLD ||
      categories.violence > IMAGE_MODERATION_FLAG_THRESHOLD ||
      categories.hateSpeech > IMAGE_MODERATION_FLAG_THRESHOLD
    ) {
      action = 'FLAGGED';
    }

    // Special case: Minor in explicit context - mark for immediate account suspension
    if (categories.minorPresent && categories.explicit > IMAGE_MODERATION_FLAG_THRESHOLD) {
      action = 'AUTO_REMOVED';
      // Log critical violation for account suspension
      console.error('[ImageModeration] CRITICAL: Minor detected in explicit context', {
        imageUrl,
        explicitScore: categories.explicit,
        minorPresent: categories.minorPresent,
      });
    }

    const safe = action === 'APPROVED';

    // Log moderation result
    console.log('[ImageModeration] Result:', {
      imageUrl,
      categories,
      action,
      labelsCount: labels.length,
    });

    return {
      safe,
      categories,
      action,
      labels: [...new Set(labels)].slice(0, 20), // Unique labels, max 20
    };
  } catch (error) {
    console.error('[ImageModeration] Error:', error);
    
    // On error, flag for manual review rather than allowing
    return {
      safe: false,
      categories: {
        explicit: 0,
        violence: 0,
        hateSpeech: 0,
        minorPresent: false,
      },
      action: 'FLAGGED',
      error: error instanceof Error ? error.message : 'Moderation failed',
    };
  }
}

/**
 * Flag an image for manual review
 */
export async function flagImageForReview(
  imageUrl: string,
  reason: string,
  metadata?: {
    contentType?: 'profile_image' | 'tournament_media';
    contentId?: string;
    uploaderId?: string;
  }
): Promise<{
  success: boolean;
  flagId: string;
}> {
  // Create a report for the image
  const report = await db.contentReport.create({
    data: {
      reporterId: 'SYSTEM', // System-generated flag
      reportedUserId: metadata?.uploaderId,
      contentType: metadata?.contentType || 'profile_image',
      contentId: metadata?.contentId || imageUrl,
      contentSnapshot: JSON.stringify({ imageUrl, metadata }),
      reason: 'image_flagged',
      description: reason,
      status: ReportStatus.REVIEWING,
    },
  });

  return {
    success: true,
    flagId: report.id,
  };
}

/**
 * Legacy scanImage function - now uses AWS Rekognition
 * @deprecated Use moderateImage instead
 */
export async function scanImage(imageUrl: string): Promise<{
  safe: boolean;
  flags: string[];
  confidence: number;
}> {
  const result = await moderateImage(imageUrl);
  
  const flags: string[] = [];
  if (result.categories.explicit > 0) flags.push('explicit');
  if (result.categories.violence > 0) flags.push('violence');
  if (result.categories.hateSpeech > 0) flags.push('hate_speech');
  if (result.categories.minorPresent) flags.push('minor_present');
  
  const maxConfidence = Math.max(
    result.categories.explicit,
    result.categories.violence,
    result.categories.hateSpeech
  );
  
  return {
    safe: result.safe,
    flags,
    confidence: maxConfidence,
  };
}

/**
 * Moderate and upload image
 * Combines moderation with auto-flagging
 */
export async function moderateAndUpload(
  imageUrl: string,
  metadata?: {
    contentType?: 'profile_image' | 'tournament_media';
    contentId?: string;
    uploaderId?: string;
  }
): Promise<{
  approved: boolean;
  moderationResult: ImageModerationResult;
  flagId?: string;
}> {
  const moderationResult = await moderateImage(imageUrl);

  // If flagged or auto-removed, create a report
  if (moderationResult.action !== 'APPROVED') {
    const flagReason = moderationResult.action === 'AUTO_REMOVED'
      ? `Auto-removed: explicit=${moderationResult.categories.explicit}, violence=${moderationResult.categories.violence}, minor=${moderationResult.categories.minorPresent}`
      : `Flagged for review: explicit=${moderationResult.categories.explicit}, violence=${moderationResult.categories.violence}`;

    const { flagId } = await flagImageForReview(imageUrl, flagReason, metadata);

    return {
      approved: false,
      moderationResult,
      flagId,
    };
  }

  return {
    approved: true,
    moderationResult,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get pending reports for admin review
 */
export async function getPendingReports(options?: {
  limit?: number;
  offset?: number;
  contentType?: string;
  status?: ReportStatus;
  startDate?: Date;
  endDate?: Date;
}) {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const where: any = {};
  
  if (options?.status) {
    where.status = options.status;
  } else {
    // Default to pending and reviewing
    where.status = { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] };
  }
  
  if (options?.contentType) {
    where.contentType = options.contentType;
  }
  
  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options?.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options?.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const [reports, total] = await Promise.all([
    db.contentReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.contentReport.count({ where }),
  ]);

  const reporterIds = [...new Set(reports.map((report) => report.reporterId).filter(Boolean))];
  const reporters = reporterIds.length
    ? await db.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const reportersById = new Map(reporters.map((reporter) => [reporter.id, reporter]));

  return {
    reports: reports.map((report) => ({
      ...report,
      reporter: reportersById.get(report.reporterId) ?? null,
    })),
    total,
  };
}

/**
 * Scan message content before saving
 */
export async function scanMessage(content: string, sport?: SportType): Promise<{
  allowed: boolean;
  flags: string[];
  cleanedContent?: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}> {
  const flags: string[] = [];

  // Check profanity
  const profanityResult = containsProfanity(content, sport);
  if (profanityResult.hasProfanity) {
    flags.push(`profanity:${profanityResult.flaggedWords.join(',')}`);
  }

  // Check suspicious patterns
  const suspiciousResult = detectSuspiciousContent(content);
  if (suspiciousResult.hasSuspiciousContent) {
    flags.push(`suspicious:${suspiciousResult.patterns.join(',')}`);
  }

  // Filter profanity from content
  const filterResult = filterProfanity(content, sport);

  // Determine if message should be blocked
  const severeViolation = profanityResult.severity === 'severe';
  
  return {
    allowed: !severeViolation, // Block only severe violations
    flags,
    cleanedContent: filterResult.wasFiltered ? filterResult.filtered : undefined,
    severity: profanityResult.severity,
  };
}

/**
 * Get moderation stats
 */
export async function getModerationStats() {
  const [pending, reviewing, resolved, dismissed] = await Promise.all([
    db.contentReport.count({ where: { status: ReportStatus.PENDING } }),
    db.contentReport.count({ where: { status: ReportStatus.REVIEWING } }),
    db.contentReport.count({ where: { status: ReportStatus.RESOLVED } }),
    db.contentReport.count({ where: { status: ReportStatus.DISMISSED } }),
  ]);

  const byContentType = await db.contentReport.groupBy({
    by: ['contentType'],
    _count: true,
    where: { status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] } },
  });

  const byReason = await db.contentReport.groupBy({
    by: ['reason'],
    _count: true,
    where: { status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] } },
  });

  return {
    pending,
    reviewing,
    resolved,
    dismissed,
    total: pending + reviewing + resolved + dismissed,
    byContentType: byContentType.reduce((acc, item) => {
      acc[item.contentType] = item._count;
      return acc;
    }, {} as Record<string, number>),
    byReason: byReason.reduce((acc, item) => {
      acc[item.reason] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

// ============================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================

/**
 * @deprecated Use reviewReport instead
 * Legacy alias for reviewReport
 */
export async function resolveReport(
  reportId: string,
  reviewerId: string,
  action: AdminAction,
  notes?: string
) {
  return reviewReport(reportId, reviewerId, action, notes);
}
