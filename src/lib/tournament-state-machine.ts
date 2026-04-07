/**
 * VALORHIVE Tournament State Machine
 * 
 * Enforces strict status transitions to prevent invalid state changes.
 * Tournament status can only flow in one direction with specific rules.
 */

import { TournamentStatus } from '@prisma/client';

// Valid tournament status transitions
export const VALID_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: [
    TournamentStatus.REGISTRATION_OPEN,  // Admin publishes tournament
    TournamentStatus.CANCELLED,          // Admin cancels before publishing
  ],
  REGISTRATION_OPEN: [
    TournamentStatus.REGISTRATION_CLOSED, // Registration deadline passed
    TournamentStatus.CANCELLED,           // Admin cancels during registration
  ],
  REGISTRATION_CLOSED: [
    TournamentStatus.BRACKET_GENERATED,   // Admin generates bracket
    TournamentStatus.CANCELLED,           // Admin cancels after registration
  ],
  BRACKET_GENERATED: [
    TournamentStatus.IN_PROGRESS,         // Admin starts tournament
    TournamentStatus.CANCELLED,           // Admin cancels before starting
  ],
  IN_PROGRESS: [
    TournamentStatus.PAUSED,              // Admin pauses tournament (weather delay, venue issue)
    TournamentStatus.COMPLETED,           // Admin completes tournament
    TournamentStatus.CANCELLED,           // Admin cancels during play (rare)
  ],
  PAUSED: [
    TournamentStatus.IN_PROGRESS,         // Admin resumes tournament
    TournamentStatus.COMPLETED,           // Admin completes tournament while paused
    TournamentStatus.CANCELLED,           // Admin cancels while paused
  ],
  COMPLETED: [],  // Terminal state - no transitions allowed
  CANCELLED: [],  // Terminal state - no transitions allowed
};

// Human-readable status names
export const STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: 'Draft',
  REGISTRATION_OPEN: 'Registration Open',
  REGISTRATION_CLOSED: 'Registration Closed',
  BRACKET_GENERATED: 'Bracket Generated',
  IN_PROGRESS: 'In Progress',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export interface TransitionResult {
  valid: boolean;
  error?: string;
  currentStatus: TournamentStatus;
  targetStatus: TournamentStatus;
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  currentStatus: TournamentStatus,
  targetStatus: TournamentStatus
): boolean {
  // Same status is always "valid" (no-op)
  if (currentStatus === targetStatus) {
    return true;
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(targetStatus);
}

/**
 * Validate a status transition and return detailed result
 */
export function validateTransition(
  currentStatus: TournamentStatus,
  targetStatus: TournamentStatus
): TransitionResult {
  // Same status is always valid (no-op)
  if (currentStatus === targetStatus) {
    return {
      valid: true,
      currentStatus,
      targetStatus,
    };
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];

  if (allowedTransitions.includes(targetStatus)) {
    return {
      valid: true,
      currentStatus,
      targetStatus,
    };
  }

  // Invalid transition - provide helpful error message
  const allowedLabels = allowedTransitions
    .map(s => STATUS_LABELS[s])
    .join(', ') || 'none (terminal state)';

  return {
    valid: false,
    error: `Invalid status transition from "${STATUS_LABELS[currentStatus]}" to "${STATUS_LABELS[targetStatus]}". Allowed transitions: ${allowedLabels}`,
    currentStatus,
    targetStatus,
  };
}

/**
 * Get allowed transitions for a status
 */
export function getAllowedTransitions(status: TournamentStatus): TournamentStatus[] {
  return VALID_TRANSITIONS[status];
}

/**
 * Check if tournament can be modified
 * Completed and cancelled tournaments cannot be modified
 */
export function canModifyTournament(status: TournamentStatus): boolean {
  return status !== TournamentStatus.COMPLETED && status !== TournamentStatus.CANCELLED;
}

/**
 * Check if tournament can accept registrations
 */
export function canAcceptRegistrations(status: TournamentStatus): boolean {
  return status === TournamentStatus.REGISTRATION_OPEN;
}

/**
 * Check if bracket can be generated
 */
export function canGenerateBracket(status: TournamentStatus): boolean {
  return status === TournamentStatus.REGISTRATION_CLOSED;
}

/**
 * Check if tournament can be started
 */
export function canStartTournament(status: TournamentStatus): boolean {
  return status === TournamentStatus.BRACKET_GENERATED;
}

/**
 * Check if tournament can be completed
 */
export function canCompleteTournament(status: TournamentStatus): boolean {
  return status === TournamentStatus.IN_PROGRESS || status === TournamentStatus.BRACKET_GENERATED;
}

/**
 * Check if matches can be scored
 */
export function canScoreMatches(status: TournamentStatus): boolean {
  return status === TournamentStatus.IN_PROGRESS;
}

/**
 * Check if tournament can be paused
 */
export function canPauseTournament(status: TournamentStatus): boolean {
  return status === TournamentStatus.IN_PROGRESS;
}

/**
 * Check if tournament can be resumed
 */
export function canResumeTournament(status: TournamentStatus): boolean {
  return status === TournamentStatus.PAUSED;
}

/**
 * Check if tournament is paused
 */
export function isTournamentPaused(status: TournamentStatus): boolean {
  return status === TournamentStatus.PAUSED;
}

/**
 * Check if tournament is in a terminal state
 */
export function isTerminalStatus(status: TournamentStatus): boolean {
  return status === TournamentStatus.COMPLETED || status === TournamentStatus.CANCELLED;
}

/**
 * Check if tournament is active (in progress or paused)
 */
export function isTournamentActive(status: TournamentStatus): boolean {
  return status === TournamentStatus.IN_PROGRESS || status === TournamentStatus.PAUSED;
}

/**
 * Check if reseed is allowed
 * Reseeding is only allowed before tournament starts
 */
export function canReseed(status: TournamentStatus): boolean {
  const reseedableStatuses: TournamentStatus[] = [
    TournamentStatus.DRAFT,
    TournamentStatus.REGISTRATION_OPEN,
    TournamentStatus.REGISTRATION_CLOSED,
  ];

  return reseedableStatuses.includes(status);
}

/**
 * Check if tournament can be completed
 * Tournament can be completed from IN_PROGRESS or PAUSED state
 */
export function canCompleteFromPaused(status: TournamentStatus): boolean {
  return status === TournamentStatus.PAUSED;
}

/**
 * Get the next expected status in the workflow
 */
export function getNextExpectedStatus(status: TournamentStatus): TournamentStatus | null {
  const transitions = VALID_TRANSITIONS[status];
  // Return the first non-cancelled transition (normal flow)
  return transitions.find(t => t !== TournamentStatus.CANCELLED) || null;
}

/**
 * Get tournament status info for display
 */
export function getStatusInfo(status: TournamentStatus): {
  label: string;
  color: string;
  canModify: boolean;
  isTerminal: boolean;
  nextStatus: TournamentStatus | null;
  allowedTransitions: TournamentStatus[];
} {
  const colors: Record<TournamentStatus, string> = {
    DRAFT: 'gray',
    REGISTRATION_OPEN: 'green',
    REGISTRATION_CLOSED: 'yellow',
    BRACKET_GENERATED: 'blue',
    IN_PROGRESS: 'orange',
    PAUSED: 'amber',
    COMPLETED: 'purple',
    CANCELLED: 'red',
  };

  return {
    label: STATUS_LABELS[status],
    color: colors[status],
    canModify: canModifyTournament(status),
    isTerminal: isTerminalStatus(status),
    nextStatus: getNextExpectedStatus(status),
    allowedTransitions: getAllowedTransitions(status),
  };
}
