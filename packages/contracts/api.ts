/**
 * @valorhive/contracts/api
 * 
 * Shared API response types for VALORHIVE services.
 * These types define the contract for API responses across services.
 * 
 * @example
 * import type { ApiResponse, PaginatedResponse } from '@valorhive/contracts/api';
 */

// ============================================
// Standard API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// User Types
// ============================================

export interface UserResponse {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: 'PLAYER' | 'ADMIN' | 'SUB_ADMIN' | 'TOURNAMENT_DIRECTOR' | 'ORG_ADMIN';
  sport: 'DARTS' | 'CORNHOLE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserResponse;
  token?: string;
  error?: string;
}

export interface SessionResponse {
  isValid: boolean;
  userId?: string;
  orgId?: string;
  role?: string;
  sport?: string;
  expiresAt?: string;
}

// ============================================
// Tournament Types
// ============================================

export interface TournamentResponse {
  id: string;
  name: string;
  sport: 'DARTS' | 'CORNHOLE';
  status: 'PENDING' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  venue?: string;
  city?: string;
  maxParticipants: number;
  currentParticipants: number;
  registrationFee: number;
  prizePool?: number;
  description?: string;
  rules?: string;
  createdAt: string;
  updatedAt: string;
}

export type TournamentListResponse = PaginatedResponse<TournamentResponse>;

export interface TournamentRegistrationResponse {
  success: boolean;
  registrationId?: string;
  tournamentId?: string;
  playerId?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';
  error?: string;
}

// ============================================
// Match Types
// ============================================

export interface MatchResponse {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  playerAId?: string;
  playerBId?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  courtId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Leaderboard Types
// ============================================

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
}

export interface LeaderboardResponse {
  success: true;
  data: LeaderboardEntry[];
  sport: 'DARTS' | 'CORNHOLE';
  city?: string;
  updatedAt: string;
}

// ============================================
// Health Check Types
// ============================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: {
    database?: { status: string; latency?: number };
    redis?: { status: string; connected: boolean };
    storage?: { status: string };
  };
}

export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: Record<string, boolean>;
}

// ============================================
// Error Codes
// ============================================

export enum ApiErrorCode {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Business logic errors
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  TOURNAMENT_FULL = 'TOURNAMENT_FULL',
  ALREADY_REGISTERED = 'ALREADY_REGISTERED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
}

// ============================================
// Webhook Types
// ============================================

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

export interface PaymentWebhookPayload extends WebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.refunded';
  data: {
    orderId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };
}

// ============================================
// Notification Types
// ============================================

export interface NotificationPayload {
  id: string;
  type: 'tournament' | 'match' | 'system' | 'payment';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
  read?: boolean;
}

export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
