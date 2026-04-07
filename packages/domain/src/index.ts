/**
 * @valorhive/domain - Shared Domain Types and Utilities
 * 
 * This package contains shared domain logic used across:
 * - Main Next.js application
 * - Cron Service
 * - Worker Service
 * - WebSocket Services
 */

// ============================================
// Tournament Status
// ============================================

export type TournamentStatus = 
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'CHECK_IN_OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'POSTPONED';

export type TournamentScope = 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL';

export function isTournamentActive(status: TournamentStatus): boolean {
  return ['REGISTRATION_OPEN', 'CHECK_IN_OPEN', 'IN_PROGRESS'].includes(status);
}

export function canRegister(status: TournamentStatus): boolean {
  return status === 'REGISTRATION_OPEN';
}

export function canCheckIn(status: TournamentStatus): boolean {
  return status === 'CHECK_IN_OPEN';
}

export function isTournamentEnded(status: TournamentStatus): boolean {
  return ['COMPLETED', 'CANCELLED', 'POSTPONED'].includes(status);
}

export function isTournamentInProgress(status: TournamentStatus): boolean {
  return status === 'IN_PROGRESS';
}

// ============================================
// Tournament Colors
// ============================================

export const TOURNAMENT_SCOPE_COLORS: Record<TournamentScope, { bg: string; text: string; border: string }> = {
  CITY: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  DISTRICT: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  STATE: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  NATIONAL: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
};

export function getTournamentScopeColor(scope: TournamentScope) {
  return TOURNAMENT_SCOPE_COLORS[scope] || TOURNAMENT_SCOPE_COLORS.CITY;
}

// ============================================
// Tournament Status Colors
// ============================================

export const TOURNAMENT_STATUS_COLORS: Record<TournamentStatus, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800' },
  REGISTRATION_OPEN: { bg: 'bg-green-100', text: 'text-green-800' },
  REGISTRATION_CLOSED: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  CHECK_IN_OPEN: { bg: 'bg-blue-100', text: 'text-blue-800' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-800' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800' },
  POSTPONED: { bg: 'bg-amber-100', text: 'text-amber-800' },
};

export function getTournamentStatusColor(status: TournamentStatus) {
  return TOURNAMENT_STATUS_COLORS[status] || TOURNAMENT_STATUS_COLORS.DRAFT;
}

// ============================================
// Sport Types
// ============================================

export type Sport = 'badminton' | 'table-tennis' | 'tennis' | 'squash' | 'carrom' | 'chess' | 'darts' | 'cornhole';

export const SPORT_LABELS: Record<Sport, string> = {
  'badminton': 'Badminton',
  'table-tennis': 'Table Tennis',
  'tennis': 'Tennis',
  'squash': 'Squash',
  'carrom': 'Carrom',
  'chess': 'Chess',
  'darts': 'Darts',
  'cornhole': 'Cornhole',
};

export const SPORT_ICONS: Record<Sport, string> = {
  'badminton': '🏸',
  'table-tennis': '🏓',
  'tennis': '🎾',
  'squash': '🎾',
  'carrom': '🎯',
  'chess': '♟️',
  'darts': '🎯',
  'cornhole': '🥏',
};

export function isValidSport(sport: string): sport is Sport {
  return sport in SPORT_LABELS;
}

export function getSportLabel(sport: Sport): string {
  return SPORT_LABELS[sport] || sport;
}

export function getSportIcon(sport: Sport): string {
  return SPORT_ICONS[sport] || '🏆';
}

// ============================================
// User Roles
// ============================================

export type UserRole = 'PLAYER' | 'ADMIN' | 'SUB_ADMIN' | 'TOURNAMENT_DIRECTOR' | 'ORG_ADMIN';

export const ROLE_LABELS: Record<UserRole, string> = {
  PLAYER: 'Player',
  ADMIN: 'Admin',
  SUB_ADMIN: 'Sub Admin',
  TOURNAMENT_DIRECTOR: 'Tournament Director',
  ORG_ADMIN: 'Organization Admin',
};

export const ROLE_HIERARCHY: UserRole[] = [
  'PLAYER',
  'TOURNAMENT_DIRECTOR',
  'ORG_ADMIN',
  'SUB_ADMIN',
  'ADMIN',
];

export function isAtLeastRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
}

export function isAdminRole(role: UserRole): boolean {
  return ['ADMIN', 'SUB_ADMIN', 'ORG_ADMIN'].includes(role);
}

export function canManageTournaments(role: UserRole): boolean {
  return ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR', 'ORG_ADMIN'].includes(role);
}

// ============================================
// Match Status
// ============================================

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW' | 'WALKOVER' | 'DOUBLE_FORFEIT' | 'RETIREMENT';

export function isMatchComplete(status: MatchStatus): boolean {
  return status === 'COMPLETED';
}

export function isMatchInProgress(status: MatchStatus): boolean {
  return status === 'IN_PROGRESS';
}

export function canUpdateScore(status: MatchStatus): boolean {
  return ['SCHEDULED', 'IN_PROGRESS'].includes(status);
}

// ============================================
// ELO Rating
// ============================================

export const ELO_CONFIG = {
  INITIAL_RATING: 1000,
  K_FACTOR: 32,
  PROVISIONAL_GAMES: 10,
  MIN_RATING: 100,
  MAX_RATING: 3000,
} as const;

export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  score: number, // 1 = win, 0.5 = draw, 0 = loss
  kFactor: number = ELO_CONFIG.K_FACTOR
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (score - expectedScore));
}

export function getRatingTier(rating: number): string {
  if (rating < 800) return 'Bronze';
  if (rating < 1000) return 'Silver';
  if (rating < 1200) return 'Gold';
  if (rating < 1400) return 'Platinum';
  if (rating < 1600) return 'Diamond';
  if (rating < 1800) return 'Master';
  return 'Grandmaster';
}

// ============================================
// Court Status
// ============================================

export type CourtStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';

export type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';

export function isCourtAvailable(status: CourtLiveStatus): boolean {
  return status === 'AVAILABLE' || status === 'BREAK';
}

// ============================================
// Payment Status
// ============================================

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export function isPaymentComplete(status: PaymentStatus): boolean {
  return status === 'COMPLETED';
}

export function canRefund(status: PaymentStatus): boolean {
  return ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(status);
}

// ============================================
// Subscription
// ============================================

export type SubscriptionPlan = 'ANNUAL' | 'MONTHLY';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export const SUBSCRIPTION_PRICING: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
  ANNUAL: { monthly: 99, annual: 999 }, // Per sport
  MONTHLY: { monthly: 149, annual: 149 * 12 },
};

// ============================================
// Notification Priority
// ============================================

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export function getNotificationTTL(priority: NotificationPriority): number {
  switch (priority) {
    case 'URGENT': return 24 * 60 * 60 * 1000; // 24 hours
    case 'HIGH': return 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'NORMAL': return 30 * 24 * 60 * 60 * 1000; // 30 days
    case 'LOW': return 90 * 24 * 60 * 60 * 1000; // 90 days
  }
}

// ============================================
// Validation Constants
// ============================================

export const VALIDATION_LIMITS = {
  // User
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  
  // Tournament
  MIN_TOURNAMENT_NAME_LENGTH: 3,
  MAX_TOURNAMENT_NAME_LENGTH: 100,
  MIN_PARTICIPANTS: 4,
  MAX_PARTICIPANTS: 256,
  
  // Match
  MAX_SCORE: 100,
  
  // Description
  MAX_DESCRIPTION_LENGTH: 5000,
  
  // Venue
  MAX_VENUE_NAME_LENGTH: 200,
  MAX_ADDRESS_LENGTH: 500,
} as const;

// ============================================
// Time Constants
// ============================================

export const TIME_CONSTANTS = {
  // Minutes
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  
  // Tournament
  CHECK_IN_WINDOW_MINUTES: 30,
  MATCH_REMINDER_MINUTES_BEFORE: 15,
  NO_SHOW_GRACE_PERIOD_MINUTES: 15,
  REGISTRATION_DEADLINE_HOURS_BEFORE: 24,
  
  // Session
  SESSION_EXPIRY_HOURS: 24,
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  
  // Cache
  LEADERBOARD_CACHE_TTL_SECONDS: 300,
  BRACKET_CACHE_TTL_SECONDS: 60,
  USER_CACHE_TTL_SECONDS: 3600,
} as const;
