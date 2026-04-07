/**
 * VALORHIVE Match State Machine
 * 
 * Production Scaling (v3.80.0):
 * Enforces strict status transitions for matches to prevent:
 * - Match started twice
 * - Match completed twice
 * - Invalid state transitions
 * - Bracket corruption
 * 
 * Used by: Chess.com, ESL Gaming, Battlefy, FACEIT
 */

import { BracketMatchStatus, MatchOutcome } from '@prisma/client';

// ============================================
// Match State Enum (extends Prisma BracketMatchStatus)
// ============================================

export type MatchState = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

// ============================================
// Valid State Transitions
// ============================================

// Defines which states can transition to which other states
const VALID_MATCH_TRANSITIONS: Record<MatchState, MatchState[]> = {
  SCHEDULED: ['IN_PROGRESS'],           // Match can only start
  IN_PROGRESS: ['COMPLETED'],           // Match can only complete
  COMPLETED: ['VERIFIED'],              // Match can only be verified
  VERIFIED: [],                          // Terminal state - no transitions
};

// States that allow score modification
const SCORE_EDITABLE_STATES: MatchState[] = ['IN_PROGRESS', 'COMPLETED'];

// States that are terminal (no further changes)
const TERMINAL_STATES: MatchState[] = ['VERIFIED'];

// ============================================
// Match Event Types
// ============================================

export type MatchEventType = 
  | 'MATCH_STARTED'
  | 'SCORE_UPDATED'
  | 'MATCH_COMPLETED'
  | 'MATCH_VERIFIED'
  | 'MATCH_DISPUTED'
  | 'MATCH_ROLLED_BACK';

export interface MatchEvent {
  eventId: string;           // Unique event ID for idempotency
  matchId: string;
  eventType: MatchEventType;
  previousState?: MatchState;
  newState: MatchState;
  actorId: string;
  actorRole: 'ADMIN' | 'ORG_ADMIN' | 'TOURNAMENT_DIRECTOR' | 'SYSTEM';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// Transition Result
// ============================================

export interface MatchTransitionResult {
  valid: boolean;
  error?: string;
  currentState: MatchState;
  targetState: MatchState;
  requiresVerification?: boolean;
}

// ============================================
// State Transition Functions
// ============================================

/**
 * Check if a state transition is valid
 */
export function isValidMatchTransition(
  currentState: MatchState,
  targetState: MatchState
): boolean {
  // Same state is valid (no-op)
  if (currentState === targetState) {
    return true;
  }

  const allowedTransitions = VALID_MATCH_TRANSITIONS[currentState];
  return allowedTransitions.includes(targetState);
}

/**
 * Validate a state transition and return detailed result
 */
export function validateMatchTransition(
  currentState: MatchState,
  targetState: MatchState
): MatchTransitionResult {
  // Same state is valid (no-op)
  if (currentState === targetState) {
    return {
      valid: true,
      currentState,
      targetState,
    };
  }

  const allowedTransitions = VALID_MATCH_TRANSITIONS[currentState];

  if (allowedTransitions.includes(targetState)) {
    return {
      valid: true,
      currentState,
      targetState,
      requiresVerification: targetState === 'VERIFIED',
    };
  }

  // Invalid transition - provide helpful error message
  const allowedList = allowedTransitions.length > 0 
    ? allowedTransitions.join(', ') 
    : 'none (terminal state)';

  return {
    valid: false,
    error: `Invalid match state transition from "${currentState}" to "${targetState}". Allowed: ${allowedList}`,
    currentState,
    targetState,
  };
}

/**
 * Convert BracketMatchStatus to MatchState
 */
export function bracketStatusToMatchState(status: BracketMatchStatus): MatchState {
  switch (status) {
    case BracketMatchStatus.PENDING:
      return 'SCHEDULED';
    case BracketMatchStatus.LIVE:
      return 'IN_PROGRESS';
    case BracketMatchStatus.COMPLETED:
      return 'COMPLETED';
    case BracketMatchStatus.BYE:
      return 'VERIFIED'; // BYE matches are effectively verified (no play needed)
    default:
      return 'SCHEDULED';
  }
}

/**
 * Convert MatchState to BracketMatchStatus
 */
export function matchStateToBracketStatus(state: MatchState): BracketMatchStatus {
  switch (state) {
    case 'SCHEDULED':
      return BracketMatchStatus.PENDING;
    case 'IN_PROGRESS':
      return BracketMatchStatus.LIVE;
    case 'COMPLETED':
      return BracketMatchStatus.COMPLETED;
    case 'VERIFIED':
      return BracketMatchStatus.COMPLETED;
    default:
      return BracketMatchStatus.PENDING;
  }
}

// ============================================
// State Check Functions
// ============================================

/**
 * Check if match can be started
 */
export function canStartMatch(state: MatchState): boolean {
  return state === 'SCHEDULED';
}

/**
 * Check if match can receive score updates
 */
export function canUpdateScore(state: MatchState): boolean {
  return SCORE_EDITABLE_STATES.includes(state);
}

/**
 * Check if match can be completed
 */
export function canCompleteMatch(state: MatchState): boolean {
  return state === 'IN_PROGRESS';
}

/**
 * Check if match can be verified
 */
export function canVerifyMatch(state: MatchState): boolean {
  return state === 'COMPLETED';
}

/**
 * Check if match is in a terminal state
 */
export function isMatchTerminal(state: MatchState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Check if match is in progress
 */
export function isMatchInProgress(state: MatchState): boolean {
  return state === 'IN_PROGRESS';
}

/**
 * Check if match has a result
 */
export function hasMatchResult(state: MatchState): boolean {
  return ['COMPLETED', 'VERIFIED'].includes(state);
}

// ============================================
// Match Event Idempotency
// ============================================

/**
 * Generate a unique event ID for match events
 * This is used for idempotency - prevents duplicate event processing
 */
export function generateMatchEventId(
  matchId: string,
  eventType: MatchEventType,
  timestamp: number = Date.now()
): string {
  const data = `${matchId}:${eventType}:${timestamp}`;
  // Simple hash function for event ID
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `me_${Math.abs(hash).toString(16)}_${timestamp}`;
}

/**
 * Validate match result payload
 */
export interface MatchResultPayload {
  matchId: string;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  outcome?: MatchOutcome;
  eventId: string; // Required for idempotency
}

export interface MatchResultValidation {
  valid: boolean;
  error?: string;
  requiresVerification?: boolean;
}

/**
 * Validate a match result submission
 */
export function validateMatchResult(
  currentState: MatchState,
  payload: MatchResultPayload
): MatchResultValidation {
  // Check if match can receive results
  if (!canCompleteMatch(currentState) && !canUpdateScore(currentState)) {
    return {
      valid: false,
      error: `Cannot submit result for match in "${currentState}" state`,
    };
  }

  // Validate scores
  if (payload.scoreA < 0 || payload.scoreB < 0) {
    return {
      valid: false,
      error: 'Scores cannot be negative',
    };
  }

  // Validate event ID (required for idempotency)
  if (!payload.eventId || payload.eventId.length < 5) {
    return {
      valid: false,
      error: 'eventId is required for idempotency',
    };
  }

  // If match is already completed, this is a score correction
  if (currentState === 'COMPLETED') {
    return {
      valid: true,
      requiresVerification: true, // Score corrections need re-verification
    };
  }

  return { valid: true };
}

// ============================================
// Match State Info
// ============================================

export interface MatchStateInfo {
  state: MatchState;
  label: string;
  color: string;
  canStart: boolean;
  canScore: boolean;
  canComplete: boolean;
  canVerify: boolean;
  isTerminal: boolean;
  allowedTransitions: MatchState[];
}

/**
 * Get comprehensive match state information
 */
export function getMatchStateInfo(state: MatchState): MatchStateInfo {
  const colors: Record<MatchState, string> = {
    SCHEDULED: 'gray',
    IN_PROGRESS: 'blue',
    COMPLETED: 'green',
    VERIFIED: 'purple',
  };

  const labels: Record<MatchState, string> = {
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    VERIFIED: 'Verified',
  };

  return {
    state,
    label: labels[state],
    color: colors[state],
    canStart: canStartMatch(state),
    canScore: canUpdateScore(state),
    canComplete: canCompleteMatch(state),
    canVerify: canVerifyMatch(state),
    isTerminal: isMatchTerminal(state),
    allowedTransitions: VALID_MATCH_TRANSITIONS[state],
  };
}

// ============================================
// Reconnection State (for WebSocket)
// ============================================

export interface MatchReconnectionState {
  matchId: string;
  state: MatchState;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  lastUpdated: Date;
  courtAssignment?: string;
  scheduledTime?: Date;
}

/**
 * Serialize match state for Redis storage (reconnection support)
 */
export function serializeMatchState(state: MatchReconnectionState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize match state from Redis
 */
export function deserializeMatchState(data: string): MatchReconnectionState | null {
  try {
    const parsed = JSON.parse(data);
    return {
      matchId: parsed.matchId,
      state: parsed.state,
      scoreA: parsed.scoreA ?? 0,
      scoreB: parsed.scoreB ?? 0,
      winnerId: parsed.winnerId,
      lastUpdated: new Date(parsed.lastUpdated),
      courtAssignment: parsed.courtAssignment,
      scheduledTime: parsed.scheduledTime ? new Date(parsed.scheduledTime) : undefined,
    };
  } catch {
    return null;
  }
}
