/**
 * @valorhive/contracts - Shared Type Definitions and API Contracts
 * 
 * Type definitions shared between services for:
 * - API request/response types
 * - Event types
 * - Domain types
 * - WebSocket message types
 */

// ============================================
// User Types
// ============================================

export type UserRole = 'PLAYER' | 'ADMIN' | 'SUB_ADMIN' | 'TOURNAMENT_DIRECTOR' | 'ORG_ADMIN';

export interface UserBase {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sport?: string;
  elo?: number;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  user: UserBase;
}

// ============================================
// Tournament Types
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

export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';

export interface TournamentBase {
  id: string;
  name: string;
  sport: string;
  status: TournamentStatus;
  scope: TournamentScope;
  format: TournamentFormat;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  maxParticipants: number;
  currentParticipants: number;
  venue?: string;
  city?: string;
  state?: string;
}

// ============================================
// Match Types
// ============================================

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW' | 'WALKOVER' | 'DOUBLE_FORFEIT' | 'RETIREMENT';

export interface MatchBase {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  playerAId: string;
  playerBId: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  status: MatchStatus;
  outcome?: MatchOutcome;
  scheduledTime?: Date;
  courtId?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================
// WebSocket Event Types
// ============================================

export type WsEventType = 
  | 'match-update'
  | 'bracket-update'
  | 'court-status'
  | 'tournament-state'
  | 'queue-update';

export interface TournamentEvent {
  type: WsEventType;
  tournamentId: string;
  timestamp: string;
  data: unknown;
}

export interface MatchUpdateEvent {
  type: 'match-update';
  tournamentId: string;
  matchId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  winner?: string;
  timestamp: string;
}

export interface CourtStatusEvent {
  type: 'court-status';
  tournamentId: string;
  courtId: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
  currentMatchId?: string;
  timestamp: string;
}

// ============================================
// Court Status Types (for Court-WS)
// ============================================

export type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';

export interface CourtLiveState {
  tournamentId: string;
  courtId: string;
  courtName: string;
  status: CourtLiveStatus;
  currentMatch?: {
    matchId: string;
    bracketMatchId: string;
    playerA: string;
    playerB: string;
    round: number;
    matchNumber: number;
    scoreA?: number;
    scoreB?: number;
    startedAt?: string;
  };
  lastUpdated: number;
  updatedBy?: string;
}

export interface QueueItem {
  matchId: string;
  bracketMatchId: string;
  playerA: string;
  playerB: string;
  round: number;
  matchNumber: number;
  position: number;
  priority: number;
  readiness: 'NOT_READY' | 'PARTIAL' | 'READY';
  readyAt?: string;
  queuedAt: string;
}

export interface TournamentQueue {
  tournamentId: string;
  items: QueueItem[];
  lastUpdated: number;
}

// ============================================
// Payment Types
// ============================================

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentBase {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  userId: string;
  createdAt: Date;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 
  | 'MATCH_SCHEDULED'
  | 'MATCH_REMINDER'
  | 'MATCH_RESULT'
  | 'TOURNAMENT_REGISTRATION'
  | 'TOURNAMENT_START'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SYSTEM';

export interface NotificationBase {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  read: boolean;
  createdAt: Date;
}

// ============================================
// Subscription Types
// ============================================

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionBase {
  id: string;
  userId: string;
  sport: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  plan: 'ANNUAL' | 'MONTHLY';
}

// ============================================
// Cron Job Types
// ============================================

export type CronJobType = 
  | 'daily-cleanup'
  | 'weekly-cleanup'
  | 'sli-aggregation'
  | 'cache-warming'
  | 'elo-job-queue'
  | 'recurring-tournaments'
  | 'autopilot'
  | 'completion'
  | 'governance'
  | 'venue-flow'
  | 'finance'
  | 'backup'
  | 'automation'
  | 'noshow-forfeit';

export interface CronJobStatus {
  name: CronJobType;
  lastRun: Date | null;
  nextRun: Date | null;
  status: 'idle' | 'running' | 'success' | 'failed';
  lastError: string | null;
  lastDuration: number | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}

export interface CronJobResult {
  job: CronJobType;
  success: boolean;
  duration: number;
  processed?: number;
  errors?: string[];
  details?: Record<string, unknown>;
}

// ============================================
// Worker Job Types
// ============================================

export type WorkerJobType = 
  | 'send-email'
  | 'create-notification'
  | 'calculate-elo'
  | 'generate-bracket'
  | 'tournament-autopilot'
  | 'aggregate-analytics'
  | 'generate-report'
  | 'process-refund'
  | 'send-sms'
  | 'send-whatsapp';

export interface WorkerJobData {
  type: WorkerJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  priority?: number;
  delay?: number;
}

// ============================================
// API Route Contracts
// ============================================

// Cron API endpoints
export interface CronAutopilotResponse {
  summary: {
    registrationAutoClosed: number;
    bracketsGenerated: number;
    tournamentsStarted: number;
    winnersAdvanced: number;
    waitlistPromotions: number;
    matchRemindersSent: number;
    errors?: string[];
  };
}

export interface CronCompletionResponse {
  autoCompletion: {
    completed: number;
    failed: number;
  };
  finalizationWindows: {
    processed: number;
    locked: number;
  };
  errors?: string[];
}

export interface CronVenueFlowResponse {
  summary: {
    noShowsDetected: number;
    matchesAssigned: number;
    matchesQueued: number;
    tournamentsChecked: number;
    healthAlertsCreated: number;
    errors?: string[];
  };
}

export interface CronFinanceResponse {
  refunds: {
    processed: number;
    failed: number;
  };
  recovery: {
    attempted: number;
    recovered: number;
  };
  errors?: string[];
}

export interface CronAutomationResponse {
  results: {
    matchReminders?: { processed: number };
    health?: { overall: string; alerts: number };
    scheduledNotifications?: { processed: number };
    batchedNotifications?: { processed: number };
  };
  errors?: string[];
}

// Auth API endpoints
export interface AuthCheckResponse {
  user: UserBase | null;
  orgId?: string;
  authenticated: boolean;
}

// Health check
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version?: string;
  checks?: {
    database: { status: string; latency?: number };
    redis: { status: string; latency?: number };
    storage?: { status: string };
  };
}
