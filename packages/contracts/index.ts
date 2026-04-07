/**
 * @valorhive/contracts
 * 
 * Shared contracts for VALORHIVE services.
 * Re-exports all event and API types for convenience.
 * 
 * @example
 * // Import everything
 * import type { MatchUpdateEvent, ApiResponse } from '@valorhive/contracts';
 * 
 * @example
 * // Import from specific modules
 * import type { CourtStatusEvent } from '@valorhive/contracts/events';
 * import type { PaginatedResponse } from '@valorhive/contracts/api';
 */

// ============================================
// Event Types (WebSocket)
// ============================================

export type {
  // Tournament events
  TournamentEvent,
  TournamentStateEvent,
  
  // Match events
  MatchUpdateEvent,
  MatchResultEvent,
  MatchCompletedEvent,
  
  // Bracket events
  BracketUpdateEvent,
  BracketRefreshEvent,
  
  // Court events
  CourtLiveStatus,
  CourtCurrentMatch,
  CourtStatusEvent,
  CourtStatusChangedEvent,
  CourtStatusesEvent,
  CourtUpdatedEvent,
  
  // Queue events
  QueueReadiness,
  QueueItem,
  QueueUpdatedEvent,
  QueueAction,
  QueueUpdateAction,
  
  // Match assignment
  MatchAssignEvent,
  
  // Connection events
  ConnectionAuthData,
  AuthenticatedSocketData,
  
  // Error events
  ErrorEvent,
  
  // State recovery
  MatchStateRecoveredEvent,
  MatchStateNotFoundEvent,
  
  // Health events
  HealthStatusEvent,
  
  // Socket event maps
  ClientToServerEvents,
  ServerToClientEvents,
} from './events';

// ============================================
// API Types (REST)
// ============================================

export type {
  // Standard responses
  ApiResponse,
  ApiErrorResponse,
  ApiSuccessResponse,
  
  // Pagination
  PaginationMeta,
  PaginatedResponse,
  PaginationParams,
  
  // User types
  UserResponse,
  AuthResponse,
  SessionResponse,
  
  // Tournament types
  TournamentResponse,
  TournamentListResponse,
  TournamentRegistrationResponse,
  
  // Match types
  MatchResponse,
  
  // Leaderboard types
  LeaderboardEntry,
  LeaderboardResponse,
  
  // Health check types
  HealthCheckResponse,
  ReadinessResponse,
  
  // Webhook types
  WebhookPayload,
  PaymentWebhookPayload,
  
  // Notification types
  NotificationPayload,
  PushNotificationPayload,
} from './api';

// ============================================
// Error Codes
// ============================================

export { ApiErrorCode } from './api';
