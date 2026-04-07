/**
 * @valorhive/contracts/events
 * 
 * Shared event types for WebSocket real-time communication.
 * These types define the contract between the realtime gateway and clients.
 * 
 * @example
 * import type { TournamentEvent, CourtStatusEvent } from '@valorhive/contracts/events';
 */

// ============================================
// Tournament Events
// ============================================

export interface TournamentEvent {
  type: 'tournament:start' | 'tournament:end' | 'tournament:pause' | 'tournament:resume';
  tournamentId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface TournamentStateEvent {
  tournamentId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  timestamp: string;
}

// ============================================
// Match Events
// ============================================

export interface MatchUpdateEvent {
  tournamentId: string;
  matchId: string;
  bracketMatchId?: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  winner?: string;
  timestamp: string;
  updatedBy?: string;
}

export interface MatchResultEvent {
  matchId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  status: string;
  timestamp: string;
  updatedBy?: string;
}

export interface MatchCompletedEvent {
  tournamentId: string;
  courtId: string;
  matchId: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  timestamp: string;
}

// ============================================
// Bracket Events
// ============================================

export interface BracketUpdateEvent {
  tournamentId: string;
  bracketData: unknown;
  timestamp: string;
}

export interface BracketRefreshEvent {
  bracketData: unknown;
  timestamp: string;
}

// ============================================
// Court Status Events
// ============================================

export type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';

export interface CourtCurrentMatch {
  matchId: string;
  bracketMatchId: string;
  playerA: string;
  playerB: string;
  round: number;
  matchNumber: number;
  scoreA?: number;
  scoreB?: number;
  startedAt?: string;
}

export interface CourtStatusEvent {
  tournamentId: string;
  courtId: string;
  courtName: string;
  status: CourtLiveStatus;
  currentMatch?: CourtCurrentMatch;
  lastUpdated: number;
  updatedBy?: string;
}

export interface CourtStatusChangedEvent {
  tournamentId: string;
  courtId: string;
  courtName: string;
  status: CourtLiveStatus;
  currentMatchId?: string;
  lastUpdated: number;
  updatedBy?: string;
  timestamp: string;
}

export interface CourtStatusesEvent {
  tournamentId: string;
  courts: CourtStatusEvent[];
  queue?: QueueItem[];
  timestamp: string;
}

export interface CourtUpdatedEvent {
  tournamentId: string;
  court: CourtStatusEvent;
  timestamp: string;
}

// ============================================
// Queue Events
// ============================================

export type QueueReadiness = 'NOT_READY' | 'PARTIAL' | 'READY';

export interface QueueItem {
  matchId: string;
  bracketMatchId: string;
  playerA: string;
  playerB: string;
  round: number;
  matchNumber: number;
  position: number;
  priority: number;
  readiness: QueueReadiness;
  readyAt?: string;
  queuedAt: string;
}

export interface QueueUpdatedEvent {
  tournamentId: string;
  queue: QueueItem[];
  timestamp: string;
}

export type QueueAction = 'ADD' | 'REMOVE' | 'REORDER' | 'UPDATE_READINESS';

export interface QueueUpdateAction {
  tournamentId: string;
  action: QueueAction;
  items?: QueueItem[];
  matchId?: string;
  newPosition?: number;
  readiness?: QueueReadiness;
}

// ============================================
// Match Assignment Events
// ============================================

export interface MatchAssignEvent {
  tournamentId: string;
  courtId: string;
  courtName: string;
  match: {
    matchId: string;
    bracketMatchId: string;
    playerA: string;
    playerB: string;
    round: number;
    matchNumber: number;
  };
}

// ============================================
// Connection Events
// ============================================

export interface ConnectionAuthData {
  sessionToken?: string;
  token?: string;
  clientType?: 'web' | 'mobile';
}

export interface AuthenticatedSocketData {
  userId?: string;
  orgId?: string;
  role?: string;
  isAuthenticated: boolean;
  clientIP?: string;
  clientType?: 'web' | 'mobile';
  missedPings?: number;
  lastPong?: number;
}

// ============================================
// Error Events
// ============================================

export interface ErrorEvent {
  message: string;
  code?: string;
  details?: unknown;
}

// ============================================
// State Recovery Events
// ============================================

export interface MatchStateRecoveredEvent {
  matchId: string;
  tournamentId: string;
  state: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  scoreA: number;
  scoreB: number;
  playerAId: string;
  playerBId: string;
  winnerId?: string;
  courtAssignment?: string;
  recoveredAt: number;
}

export interface MatchStateNotFoundEvent {
  matchId: string;
}

// ============================================
// Health Events
// ============================================

export interface HealthStatusEvent {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  redis: {
    connected: boolean;
    mode: 'redis' | 'in-memory' | 'unavailable';
  };
  connections: {
    total: number;
    byIP: number;
    byUser: number;
  };
}

// ============================================
// Socket Event Names (for type-safe emit/on)
// ============================================

export type ClientToServerEvents = {
  'join-tournament': (tournamentId: string) => void;
  'leave-tournament': (tournamentId: string) => void;
  'match-update': (data: MatchUpdateEvent) => void;
  'bracket-update': (data: BracketUpdateEvent) => void;
  'court-status-update': (data: CourtStatusChangedEvent) => void;
  'court-statuses': (data: { tournamentId: string }) => void;
  'match:assign': (data: MatchAssignEvent) => void;
  'match:complete': (data: MatchCompletedEvent) => void;
  'queue:update': (data: QueueUpdateAction) => void;
  'queue:initialize': (data: { tournamentId: string; matches: QueueItem[] }) => void;
  'recover-match-state': (matchId: string) => void;
  pong: () => void;
};

export type ServerToClientEvents = {
  'tournament-state': (data: TournamentStateEvent) => void;
  'match-result': (data: MatchResultEvent) => void;
  'bracket-refresh': (data: BracketRefreshEvent) => void;
  'court-status-changed': (data: CourtStatusChangedEvent) => void;
  'court-statuses': (data: CourtStatusesEvent) => void;
  'court:updated': (data: CourtUpdatedEvent) => void;
  'match:completed': (data: MatchCompletedEvent) => void;
  'queue:updated': (data: QueueUpdatedEvent) => void;
  'match-state-recovered': (data: MatchStateRecoveredEvent) => void;
  'match-state-not-found': (data: MatchStateNotFoundEvent) => void;
  error: (data: ErrorEvent) => void;
};
