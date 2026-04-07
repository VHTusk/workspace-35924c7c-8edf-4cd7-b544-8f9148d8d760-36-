/**
 * VALORHIVE Centralized Constants
 * 
 * All magic strings, numbers, and configuration values centralized here.
 * No magic strings anywhere in the codebase.
 * 
 * Categories:
 * - Role names and hierarchy
 * - Tournament states and transitions
 * - Payment statuses
 * - Rating constants (ELO, K-factors, etc.)
 * - Rate limit tiers
 * - Match outcomes
 * - Notification types
 */

import { 
  Role, 
  AdminRole, 
  TournamentStatus, 
  MatchOutcome,
  PaymentLedgerStatus,
  NotificationType,
  OrgPlanTier,
  AccountTier,
  OrgType,
  TournamentType,
  TournamentScope,
  BracketFormat,
  GenderCategory,
  RegistrationStatus,
} from '@prisma/client';

// Re-export state machine functions for tournament transitions
export { 
  VALID_TRANSITIONS, 
  STATUS_LABELS,
  isValidTransition, 
  validateTransition, 
  getAllowedTransitions,
  canModifyTournament,
  canAcceptRegistrations,
  canGenerateBracket,
  canStartTournament,
  canCompleteTournament,
  canScoreMatches,
  canPauseTournament,
  canResumeTournament,
  isTournamentPaused,
  isTerminalStatus,
  isTournamentActive,
  canReseed,
  getNextExpectedStatus,
  getStatusInfo,
} from './tournament-state-machine';

// ============================================
// ROLE CONSTANTS
// ============================================

/**
 * User roles with display names
 */
export const ROLES = {
  PLAYER: Role.PLAYER,
  ORG_ADMIN: Role.ORG_ADMIN,
  SUB_ADMIN: Role.SUB_ADMIN,
  ADMIN: Role.ADMIN,
  TOURNAMENT_DIRECTOR: Role.TOURNAMENT_DIRECTOR,
} as const;

/**
 * Role display names for UI
 */
export const ROLE_LABELS: Record<Role, string> = {
  [Role.PLAYER]: 'Player',
  [Role.ORG_ADMIN]: 'Organization Admin',
  [Role.SUB_ADMIN]: 'Sub Admin',
  [Role.ADMIN]: 'Admin',
  [Role.TOURNAMENT_DIRECTOR]: 'Tournament Director',
};

/**
 * Admin role hierarchy (from highest to lowest)
 * Simplified 5-level hierarchy: SUPER_ADMIN > SPORT_ADMIN > STATE_ADMIN > DISTRICT_ADMIN > TOURNAMENT_DIRECTOR
 * Referee is a separate non-admin role (see RefereeRole enum)
 */
export const ADMIN_ROLE_HIERARCHY: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SPORT_ADMIN,
  AdminRole.STATE_ADMIN,
  AdminRole.DISTRICT_ADMIN,
  AdminRole.TOURNAMENT_DIRECTOR,
];

/**
 * Admin role display names
 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'Super Admin',
  [AdminRole.SPORT_ADMIN]: 'Sport Admin',
  [AdminRole.STATE_ADMIN]: 'State Admin',
  [AdminRole.DISTRICT_ADMIN]: 'District Admin',
  [AdminRole.TOURNAMENT_DIRECTOR]: 'Tournament Director',
};

/**
 * Get admin role level (higher = more permissions)
 */
export function getAdminRoleLevel(role: AdminRole): number {
  return ADMIN_ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if admin A has higher or equal permissions than admin B
 */
export function hasHigherOrEqualAdminRole(roleA: AdminRole, roleB: AdminRole): boolean {
  return getAdminRoleLevel(roleA) <= getAdminRoleLevel(roleB);
}

// ============================================
// TOURNAMENT CONSTANTS
// ============================================

/**
 * Tournament status display names and colors
 */
export const TOURNAMENT_STATUS_CONFIG: Record<TournamentStatus, { label: string; color: string; bgColor: string }> = {
  [TournamentStatus.DRAFT]: { label: 'Draft', color: 'gray', bgColor: 'bg-gray-100' },
  [TournamentStatus.REGISTRATION_OPEN]: { label: 'Registration Open', color: 'green', bgColor: 'bg-green-100' },
  [TournamentStatus.REGISTRATION_CLOSED]: { label: 'Registration Closed', color: 'yellow', bgColor: 'bg-yellow-100' },
  [TournamentStatus.BRACKET_GENERATED]: { label: 'Bracket Generated', color: 'blue', bgColor: 'bg-blue-100' },
  [TournamentStatus.IN_PROGRESS]: { label: 'In Progress', color: 'orange', bgColor: 'bg-orange-100' },
  [TournamentStatus.PAUSED]: { label: 'Paused', color: 'amber', bgColor: 'bg-amber-100' },
  [TournamentStatus.COMPLETED]: { label: 'Completed', color: 'purple', bgColor: 'bg-purple-100' },
  [TournamentStatus.CANCELLED]: { label: 'Cancelled', color: 'red', bgColor: 'bg-red-100' },
};

/**
 * Tournament type display names
 */
export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  [TournamentType.INDIVIDUAL]: 'Individual',
  [TournamentType.INTER_ORG]: 'Inter-Organization',
  [TournamentType.INTRA_ORG]: 'Intra-Organization',
};

/**
 * Tournament scope display names
 */
export const TOURNAMENT_SCOPE_LABELS: Record<TournamentScope, string> = {
  [TournamentScope.CITY]: 'City',
  [TournamentScope.DISTRICT]: 'District',
  [TournamentScope.STATE]: 'State',
  [TournamentScope.NATIONAL]: 'National',
};

/**
 * Bracket format display names
 */
export const BRACKET_FORMAT_LABELS: Record<BracketFormat, string> = {
  [BracketFormat.SINGLE_ELIMINATION]: 'Single Elimination',
  [BracketFormat.DOUBLE_ELIMINATION]: 'Double Elimination',
  [BracketFormat.ROUND_ROBIN]: 'Round Robin',
  [BracketFormat.SWISS]: 'Swiss System',
};

/**
 * Gender category display names
 */
export const GENDER_CATEGORY_LABELS: Record<GenderCategory, string> = {
  [GenderCategory.MALE]: 'Male',
  [GenderCategory.FEMALE]: 'Female',
  [GenderCategory.MIXED]: 'Mixed',
};

/**
 * Registration status display names
 */
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  [RegistrationStatus.PENDING]: 'Pending',
  [RegistrationStatus.CONFIRMED]: 'Confirmed',
  [RegistrationStatus.CANCELLED]: 'Cancelled',
  [RegistrationStatus.WAITLISTED]: 'Waitlisted',
};

/**
 * Terminal tournament statuses (no further transitions allowed)
 */
export const TERMINAL_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.COMPLETED,
  TournamentStatus.CANCELLED,
];

/**
 * Active tournament statuses (matches can be played)
 */
export const ACTIVE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.IN_PROGRESS,
  TournamentStatus.PAUSED,
];

// ============================================
// MATCH CONSTANTS
// ============================================

/**
 * Match outcome display names
 */
export const MATCH_OUTCOME_LABELS: Record<MatchOutcome, string> = {
  [MatchOutcome.PLAYED]: 'Played',
  [MatchOutcome.WALKOVER]: 'Walkover',
  [MatchOutcome.NO_SHOW]: 'No Show',
  [MatchOutcome.FORFEIT]: 'Forfeit',
  [MatchOutcome.BYE]: 'Bye',
};

/**
 * Outcomes that count as a loss for the opponent
 */
export const LOSS_OUTCOMES: MatchOutcome[] = [
  MatchOutcome.WALKOVER,
  MatchOutcome.NO_SHOW,
  MatchOutcome.FORFEIT,
];

/**
 * Outcomes that advance the opponent automatically
 */
export const ADVANCEMENT_OUTCOMES: MatchOutcome[] = [
  MatchOutcome.BYE,
  MatchOutcome.WALKOVER,
  MatchOutcome.NO_SHOW,
  MatchOutcome.FORFEIT,
];

// ============================================
// RATING CONSTANTS (ELO SYSTEM)
// ============================================

/**
 * ELO rating system constants
 * Based on v3.6 specification for dual-metric rating system
 */
export const ELO_CONSTANTS = {
  // Initial ELO for new players
  INITIAL_ELO: 1500,
  
  // Minimum possible ELO (floor)
  MIN_ELO: 100,
  
  // K-factors by player experience
  K_FACTORS: {
    // New players (< 30 matches) - higher volatility
    NEW_PLAYER: 40,
    // Intermediate players (30-100 matches)
    INTERMEDIATE: 32,
    // Experienced players (> 100 matches)
    EXPERIENCED: 24,
    // Tournament directors and special cases
    TOURNAMENT: 30,
  },
  
  // Match count thresholds for K-factor changes
  MATCH_THRESHOLDS: {
    NEW_PLAYER: 30,
    INTERMEDIATE: 100,
  },
  
  // ELO change limits per match
  MAX_ELO_GAIN: 50,
  MAX_ELO_LOSS: 50,
  
  // Bonus ELO for tournament placement
  PLACEMENT_BONUSES: {
    FIRST: 50,
    SECOND: 30,
    THIRD: 20,
    FOURTH: 10,
  },
} as const;

/**
 * Visible points system constants
 * Points are visible and used for leaderboards
 */
export const POINTS_CONSTANTS = {
  // Points by tournament scope
  SCOPE_POINTS: {
    CITY: {
      PARTICIPATION: 1,
      WIN: 2,
      FIRST_PLACE: 10,
      SECOND_PLACE: 6,
      THIRD_PLACE: 3,
    },
    DISTRICT: {
      PARTICIPATION: 1,
      WIN: 3,
      FIRST_PLACE: 15,
      SECOND_PLACE: 9,
      THIRD_PLACE: 5,
    },
    STATE: {
      PARTICIPATION: 2,
      WIN: 4,
      FIRST_PLACE: 25,
      SECOND_PLACE: 15,
      THIRD_PLACE: 10,
    },
    NATIONAL: {
      PARTICIPATION: 3,
      WIN: 6,
      FIRST_PLACE: 50,
      SECOND_PLACE: 30,
      THIRD_PLACE: 20,
    },
  },
  
  // Referral bonus points
  REFERRAL_BONUS: 10,
  
  // Points for profile completion
  PROFILE_COMPLETION_BONUS: 5,
} as const;

/**
 * Get K-factor based on match count
 */
export function getKFactor(matchCount: number): number {
  if (matchCount < ELO_CONSTANTS.MATCH_THRESHOLDS.NEW_PLAYER) {
    return ELO_CONSTANTS.K_FACTORS.NEW_PLAYER;
  }
  if (matchCount < ELO_CONSTANTS.MATCH_THRESHOLDS.INTERMEDIATE) {
    return ELO_CONSTANTS.K_FACTORS.INTERMEDIATE;
  }
  return ELO_CONSTANTS.K_FACTORS.EXPERIENCED;
}

/**
 * Get points for tournament scope
 */
export function getScopePoints(scope: TournamentScope) {
  return POINTS_CONSTANTS.SCOPE_POINTS[scope];
}

// ============================================
// PAYMENT CONSTANTS
// ============================================

/**
 * Payment status display names
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentLedgerStatus, string> = {
  [PaymentLedgerStatus.INITIATED]: 'Initiated',
  [PaymentLedgerStatus.PAID]: 'Paid',
  [PaymentLedgerStatus.FAILED]: 'Failed',
  [PaymentLedgerStatus.REFUNDED]: 'Refunded',
};

/**
 * Subscription pricing (in INR paise - multiply by 100 for display)
 */
export const SUBSCRIPTION_PRICING = {
  PLAYER: {
    MONTHLY: 9900,      // ₹99
    QUARTERLY: 26900,   // ₹269 (10% discount)
    YEARLY: 94900,      // ₹949 (20% discount)
  },
  ORGANIZATION: {
    BASIC_MONTHLY: 49900,    // ₹499
    PRO_MONTHLY: 99900,      // ₹999
    ENTERPRISE_MONTHLY: 249900, // ₹2499
  },
} as const;

/**
 * Trial period duration (in days)
 */
export const TRIAL_PERIOD_DAYS = 30;

/**
 * Organization plan tier features
 */
export const ORG_PLAN_FEATURES: Record<OrgPlanTier, {
  maxRosterSize: number;
  maxTournamentsPerMonth: number;
  analyticsRetention: number; // days
  priority: boolean;
}> = {
  [OrgPlanTier.BASIC]: {
    maxRosterSize: 25,
    maxTournamentsPerMonth: 2,
    analyticsRetention: 30,
    priority: false,
  },
  [OrgPlanTier.PRO]: {
    maxRosterSize: 50,
    maxTournamentsPerMonth: 10,
    analyticsRetention: 90,
    priority: true,
  },
  [OrgPlanTier.ENTERPRISE]: {
    maxRosterSize: 100,
    maxTournamentsPerMonth: -1, // Unlimited
    analyticsRetention: 365,
    priority: true,
  },
};

/**
 * Organization type display names
 */
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  [OrgType.SCHOOL]: 'School',
  [OrgType.COLLEGE]: 'College',
  [OrgType.CLUB]: 'Club',
  [OrgType.ASSOCIATION]: 'Association',
  [OrgType.CORPORATE]: 'Corporate',
  [OrgType.GOVT_ORGANISATION]: 'Government Organisation',
  [OrgType.ACADEMY]: 'Academy',
  [OrgType.OTHER]: 'Other',
};

/**
 * Account tier display names
 */
export const ACCOUNT_TIER_LABELS: Record<AccountTier, string> = {
  [AccountTier.FAN]: 'Fan (Free)',
  [AccountTier.PLAYER]: 'Player (Paid)',
};

// ============================================
// RATE LIMIT CONSTANTS
// ============================================

/**
 * Rate limit tiers
 * Re-exported from rate-limit-types for convenience
 */
export { RATE_LIMITS, ROUTE_RATE_LIMITS, type RateLimitTier } from './rate-limit-types';

// ============================================
// NOTIFICATION CONSTANTS
// ============================================

/**
 * Notification type display names and icons
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; icon: string }> = {
  [NotificationType.TOURNAMENT_REGISTERED]: { label: 'Tournament Registered', icon: 'trophy' },
  [NotificationType.MATCH_RESULT]: { label: 'Match Result', icon: 'clipboard' },
  [NotificationType.POINTS_EARNED]: { label: 'Points Earned', icon: 'star' },
  [NotificationType.SUBSCRIPTION_EXPIRY]: { label: 'Subscription Expiring', icon: 'alert' },
  [NotificationType.DISPUTE_UPDATE]: { label: 'Dispute Update', icon: 'flag' },
  [NotificationType.WAITLIST_PROMOTED]: { label: 'Waitlist Promoted', icon: 'arrow-up' },
  [NotificationType.EMAIL_VERIFIED]: { label: 'Email Verified', icon: 'check' },
  [NotificationType.TOURNAMENT_CANCELLED]: { label: 'Tournament Cancelled', icon: 'x-circle' },
  [NotificationType.REFUND_PROCESSED]: { label: 'Refund Processed', icon: 'dollar-sign' },
  [NotificationType.TEAM_INVITATION]: { label: 'Team Invitation', icon: 'users' },
  [NotificationType.TEAM_INVITATION_ACCEPTED]: { label: 'Invitation Accepted', icon: 'user-check' },
  [NotificationType.TEAM_INVITATION_DECLINED]: { label: 'Invitation Declined', icon: 'user-x' },
  [NotificationType.ADMIN_ASSIGNED]: { label: 'Admin Assigned', icon: 'shield' },
  [NotificationType.ADMIN_REMOVED]: { label: 'Admin Removed', icon: 'shield-off' },
  [NotificationType.DIRECTOR_ASSIGNED]: { label: 'Director Assigned', icon: 'award' },
  [NotificationType.EMERGENCY_CONTROL]: { label: 'Emergency Control', icon: 'alert-triangle' },
  [NotificationType.ADMIN_ASSUMPTION]: { label: 'Admin Assumption', icon: 'key' },
  [NotificationType.ESCALATION]: { label: 'Escalation', icon: 'alert-circle' },
  [NotificationType.INACTIVITY_WARNING]: { label: 'Inactivity Warning', icon: 'clock' },
  [NotificationType.FINALIZATION_WINDOW_OPENED]: { label: 'Finalization Window Opened', icon: 'unlock' },
  [NotificationType.FINALIZATION_LOCKED]: { label: 'Finalization Locked', icon: 'lock' },
  [NotificationType.DISPUTE_RAISED]: { label: 'Dispute Raised', icon: 'flag' },
  [NotificationType.DISPUTE_RESOLVED_NOTIFICATION]: { label: 'Dispute Resolved', icon: 'check-circle' },
  [NotificationType.NEW_FOLLOWER]: { label: 'New Follower', icon: 'user-plus' },
  [NotificationType.RANK_CHANGE]: { label: 'Rank Change', icon: 'trending-up' },
  [NotificationType.MILESTONE]: { label: 'Milestone', icon: 'award' },
  [NotificationType.TOURNAMENT_REMINDER]: { label: 'Tournament Reminder', icon: 'bell' },
};

/**
 * Notification retention period (in days)
 */
export const NOTIFICATION_RETENTION_DAYS = 90;

// ============================================
// SPORTS CONSTANTS
// ============================================

/**
 * Supported sports
 */
export const SUPPORTED_SPORTS = ['CORNHOLE', 'DARTS'] as const;
export type SupportedSport = typeof SUPPORTED_SPORTS[number];

/**
 * Sport display names
 */
export const SPORT_LABELS: Record<SupportedSport, string> = {
  CORNHOLE: 'Cornhole',
  DARTS: 'Darts',
};

// ============================================
// PAGINATION CONSTANTS
// ============================================

/**
 * Default pagination values
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

// ============================================
// SECURITY CONSTANTS
// ============================================

/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: false,
} as const;

/**
 * Account lockout settings
 */
export const ACCOUNT_LOCKOUT = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
} as const;

/**
 * Session settings
 */
export const SESSION = {
  DEFAULT_EXPIRY_DAYS: 30,
  EXTENDED_EXPIRY_DAYS: 90,
  INACTIVITY_TIMEOUT_MINUTES: 60,
} as const;

/**
 * OTP settings
 */
export const OTP = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 3,
} as const;

// ============================================
// TOURNAMENT CONSTRAINTS
// ============================================

/**
 * Tournament constraints
 */
export const TOURNAMENT_CONSTRAINTS = {
  // Minimum/Maximum players
  MIN_PLAYERS: 4,
  MAX_PLAYERS_INDIVIDUAL: 256,
  MAX_PLAYERS_TEAM: 64,
  
  // Team sizes
  DOUBLES_TEAM_SIZE: 2,
  MIN_TEAM_SIZE: 3,
  MAX_TEAM_SIZE: 4,
  
  // Registration
  MAX_PLAYERS_PER_ORG_INTER_ORG: 10,
  MAX_ROSTER_SIZE: 25,
  
  // Scheduling
  MIN_REGISTRATION_DAYS: 1,
  MIN_TOURNAMENT_DURATION_HOURS: 1,
  MAX_TOURNAMENT_DURATION_DAYS: 7,
  
  // Courts
  DEFAULT_COURTS: 4,
  MAX_COURTS: 32,
} as const;

// ============================================
// CACHE TTL CONSTANTS
// ============================================

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  LEADERBOARD: 300,        // 5 minutes
  TOURNAMENT_BRACKET: 120, // 2 minutes
  PLAYER_STATS: 600,       // 10 minutes
  ORG_STATS: 900,          // 15 minutes
  PLAYER_PROFILE: 3600,    // 1 hour
  ACTIVE_TOURNAMENTS: 60,  // 1 minute
} as const;

// ============================================
// API RESPONSE CONSTANTS
// ============================================

/**
 * API version
 */
export const API_VERSION = '1.0.0';

/**
 * Standard success response
 */
export const SUCCESS_RESPONSE = {
  success: true,
} as const;

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Create standard error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Create standard success response with data
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}
