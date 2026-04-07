/**
 * @valorhive/shared - Shared Utilities and Types
 * 
 * Common utilities for Redis, logging, and shared types
 * Used across: Main App, Cron Service, Worker, WebSocket Services
 */

// ============================================
// Logger
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  service: string;
  level?: LogLevel;
}

export class Logger {
  private service: string;
  private level: LogLevel;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}

// ============================================
// Redis Cache Utilities
// ============================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export function getCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

export function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return { host: process.env.REDIS_HOST || 'redis', port: 6379 };
  }
}

// Redis key prefixes for consistency across services
export const REDIS_KEYS = {
  // WebSocket state (tournament-ws)
  WS_MATCH_STATE: 'ws:match:state:',
  WS_COURT_STATUS: 'court-status:', // Court status in tournament-ws
  WS_CONNECTIONS: 'ws:connections:',
  WS_ROOM_PREFIX: 'tournament:room:',
  
  // Court status WebSocket (court-status-ws)
  COURT_WS_STATE: 'court-ws:state:',
  COURT_WS_QUEUE: 'court-ws:queue:',
  COURT_WS_ROOM: 'court-ws:room:',
  
  // Session and auth
  SESSION_PREFIX: 'session:',
  RATE_LIMIT_PREFIX: 'ratelimit:',
  
  // Leaderboard
  LEADERBOARD_PREFIX: 'leaderboard:',
  
  // Cache
  BRACKET_CACHE: 'cache:bracket:',
  TOURNAMENT_CACHE: 'cache:tournament:',
  USER_CACHE: 'cache:user:',
  
  // Job queues
  JOB_QUEUE_PREFIX: 'bull:',
  
  // Locks
  CRON_LOCK_PREFIX: 'cron:lock:',
  DISTRIBUTED_LOCK: 'lock:',
  
  // Match state
  MATCH_STATE_PREFIX: 'match:state:',
} as const;

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Utility Functions
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; delay: number }
): Promise<T> {
  let attempts = 0;

  const attempt = async (): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      if (attempts >= options.maxRetries) {
        throw error;
      }
      await sleep(options.delay);
      return attempt();
    }
  };

  return attempt();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ============================================
// Environment Utilities
// ============================================

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// ============================================
// Date Utilities
// ============================================

export function toIST(date: Date): Date {
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffset);
}

export function formatISODate(date: Date): string {
  return date.toISOString();
}

export function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

// ============================================
// String Utilities
// ============================================

export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================
// Validation Utilities
// ============================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Basic international phone validation
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

// ============================================
// Error Utilities
// ============================================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}
