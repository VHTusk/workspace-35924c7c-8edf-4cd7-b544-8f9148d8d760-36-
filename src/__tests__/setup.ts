/**
 * Test Setup File for VALORHIVE
 * 
 * Provides:
 * - Mock database client
 * - Mock request/response objects
 * - Test fixtures for common scenarios
 * - Helper functions for testing
 */

import { vi } from 'vitest';

// ============================================
// Mock Database Client
// ============================================

/**
 * Create a mock Prisma client with all common operations
 */
export function createMockDb() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tournament: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tournamentRegistration: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    match: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    bracket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bracketMatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    playerRating: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    orgSubscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    paymentLedger: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    webhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notificationPreference: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sportRules: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    orgRosterPlayer: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    orgRosterRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn()),
    $disconnect: vi.fn(),
  };
}

// ============================================
// Mock Request/Response Objects
// ============================================

/**
 * Create a mock NextRequest object
 */
export function createMockRequest(options: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  url?: string;
} = {}): {
  method: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  headers: { get: (key: string) => string | null };
  url: string;
  nextUrl: { searchParams: URLSearchParams };
} {
  const {
    method = 'GET',
    body = null,
    headers = {},
    url = 'http://localhost:3000/api/test',
  } = options;

  const parsedUrl = new URL(url);

  return {
    method,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: {
      get: (key: string) => headers[key] || null,
    },
    url,
    nextUrl: {
      searchParams: parsedUrl.searchParams,
    },
  };
}

/**
 * Create a mock NextResponse object
 */
export function createMockResponse() {
  const responseData = {
    status: 200,
    body: null as unknown,
    headers: new Map<string, string>(),
    cookies: new Map<string, { value: string; options: Record<string, unknown> }>(),
  };

  return {
    json: (data: unknown, options?: { status?: number }) => {
      responseData.status = options?.status || 200;
      responseData.body = data;
      return responseData;
    },
    status: (code: number) => ({
      json: (data: unknown) => {
        responseData.status = code;
        responseData.body = data;
        return responseData;
      },
    }),
    get data() {
      return responseData;
    },
  };
}

// ============================================
// Test Fixtures
// ============================================

/**
 * Create a mock user fixture
 */
export function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  sport: string;
  city: string;
  state: string;
  verified: boolean;
  password: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    sport: 'CORNHOLE',
    city: 'Mumbai',
    state: 'Maharashtra',
    verified: true,
    password: 'hashed_password_here',
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

/**
 * Create a mock organization fixture
 */
export function createMockOrg(overrides: Partial<{
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  sport: string;
  city: string;
  state: string;
  password: string;
}> = {}) {
  return {
    id: 'org-123',
    name: 'Test Sports Club',
    type: 'CLUB',
    email: 'org@example.com',
    phone: '9876543210',
    sport: 'CORNHOLE',
    city: 'Mumbai',
    state: 'Maharashtra',
    password: 'hashed_password_here',
    ...overrides,
  };
}

/**
 * Create a mock tournament fixture
 */
export function createMockTournament(overrides: Partial<{
  id: string;
  name: string;
  sport: string;
  type: string;
  scope: string;
  status: string;
  maxPlayers: number;
  entryFee: number;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  city: string;
  state: string;
}> = {}) {
  return {
    id: 'tournament-123',
    name: 'Test Tournament 2024',
    sport: 'CORNHOLE',
    type: 'INDIVIDUAL',
    scope: 'STATE',
    status: 'REGISTRATION_OPEN',
    maxPlayers: 32,
    entryFee: 50000, // ₹500 in paise
    startDate: new Date('2024-03-15'),
    endDate: new Date('2024-03-17'),
    registrationDeadline: new Date('2024-03-10'),
    city: 'Mumbai',
    state: 'Maharashtra',
    ...overrides,
  };
}

/**
 * Create a mock player rating fixture
 */
export function createMockPlayerRating(overrides: Partial<{
  id: string;
  userId: string;
  sport: string;
  hiddenElo: number;
  visiblePoints: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}> = {}) {
  return {
    id: 'rating-123',
    userId: 'user-123',
    sport: 'CORNHOLE',
    hiddenElo: 1500,
    visiblePoints: 100,
    matchesPlayed: 10,
    wins: 5,
    losses: 5,
    ...overrides,
  };
}

/**
 * Create a mock session fixture
 */
export function createMockSession(overrides: Partial<{
  id: string;
  token: string;
  userId: string;
  orgId: string | null;
  sport: string;
  accountType: string;
  expiresAt: Date;
}> = {}) {
  return {
    id: 'session-123',
    token: 'abc123def456789',
    userId: 'user-123',
    orgId: null,
    sport: 'CORNHOLE',
    accountType: 'PLAYER',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    ...overrides,
  };
}

/**
 * Create a mock payment ledger entry
 */
export function createMockPaymentLedger(overrides: Partial<{
  id: string;
  userId: string | null;
  orgId: string | null;
  razorpayId: string;
  paymentId: string | null;
  amount: number;
  type: string;
  sport: string;
  status: string;
}> = {}) {
  return {
    id: 'payment-123',
    userId: 'user-123',
    orgId: null,
    razorpayId: 'order_abc123',
    paymentId: null,
    amount: 120000, // ₹1200 in paise
    type: 'PLAYER_SUBSCRIPTION',
    sport: 'CORNHOLE',
    status: 'PENDING',
    ...overrides,
  };
}

/**
 * Create a mock webhook event fixture
 */
export function createMockWebhookEvent(overrides: Partial<{
  id: string;
  provider: string;
  eventType: string;
  eventId: string;
  idempotencyKey: string;
  payload: string;
  signature: string;
  status: string;
  attemptCount: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  processedAt: Date | null;
}> = {}) {
  return {
    id: 'webhook-123',
    provider: 'razorpay',
    eventType: 'payment.captured',
    eventId: 'evt_123',
    idempotencyKey: 'razorpay:payment.captured:evt_123',
    payload: JSON.stringify({ event: 'payment.captured', payload: {} }),
    signature: 'abc123signature',
    status: 'PENDING',
    attemptCount: 0,
    nextRetryAt: new Date(),
    lastError: null,
    processedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock bracket fixture
 */
export function createMockBracket(overrides: Partial<{
  id: string;
  tournamentId: string;
  type: string;
  status: string;
}> = {}) {
  return {
    id: 'bracket-123',
    tournamentId: 'tournament-123',
    type: 'SINGLE_ELIMINATION',
    status: 'DRAFT',
    ...overrides,
  };
}

/**
 * Create a mock bracket match fixture
 */
export function createMockBracketMatch(overrides: Partial<{
  id: string;
  bracketId: string;
  round: number;
  matchNumber: number;
  playerAId: string | null;
  playerBId: string | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  court: string | null;
  scheduledAt: Date | null;
}> = {}) {
  return {
    id: 'match-123',
    bracketId: 'bracket-123',
    round: 1,
    matchNumber: 1,
    playerAId: 'user-1',
    playerBId: 'user-2',
    winnerId: null,
    scoreA: null,
    scoreB: null,
    status: 'PENDING',
    court: null,
    scheduledAt: null,
    ...overrides,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID for testing
 * Uses a counter to avoid Date.now() collisions
 */
let uniqueIdCounter = 0;
export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${++uniqueIdCounter}`;
}

/**
 * Reset the unique ID counter (call in beforeEach)
 */
export function resetUniqueIdCounter(): void {
  uniqueIdCounter = 0;
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string of specified length
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Generate a random email for testing
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

/**
 * Generate a random Indian phone number for testing
 */
export function randomPhone(): string {
  const firstDigit = ['6', '7', '8', '9'][Math.floor(Math.random() * 4)];
  const remainingDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return firstDigit + remainingDigits;
}

/**
 * Generate a mock Razorpay signature
 */
export function mockRazorpaySignature(body: string, secret: string = 'test-secret'): string {
  // Simple mock - in real implementation would use HMAC-SHA256
  const hash = Array.from(body + secret)
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16)
    .replace('-', '');
  return hash.padEnd(64, '0').slice(0, 64);
}

/**
 * Create a mock Razorpay webhook payload
 */
export function createMockRazorpayPayload(options: {
  event?: string;
  eventId?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  status?: string;
  notes?: Record<string, string>;
} = {}) {
  const {
    event = 'payment.captured',
    eventId = 'evt_' + randomString(10),
    paymentId = 'pay_' + randomString(10),
    orderId = 'order_' + randomString(10),
    amount = 120000,
    status = 'captured',
    notes = {},
  } = options;

  return {
    event,
    event_id: eventId,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount,
          currency: 'INR',
          status,
          method: 'upi',
          created_at: Math.floor(Date.now() / 1000),
          notes,
        },
      },
    },
  };
}

/**
 * Calculate expected ELO change for testing
 */
export function calculateExpectedEloChange(
  playerElo: number,
  opponentElo: number,
  actualScore: number, // 0 = loss, 0.5 = draw, 1 = win
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
}

/**
 * Assert that a response has the expected status and body
 */
export function assertResponse(
  response: { status: number; body: unknown },
  expectedStatus: number,
  expectedBody?: unknown
): void {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
  if (expectedBody !== undefined) {
    if (JSON.stringify(response.body) !== JSON.stringify(expectedBody)) {
      throw new Error(`Expected body ${JSON.stringify(expectedBody)}, got ${JSON.stringify(response.body)}`);
    }
  }
}

// ============================================
// GST Calculation Helpers
// ============================================

/**
 * Calculate GST for a given amount
 * @param baseAmount Amount in paise (before GST)
 * @param gstRate GST rate as decimal (0.18 for 18%)
 * @returns Object with base amount, GST, and total
 */
export function calculateGST(baseAmount: number, gstRate: number = 0.18): {
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  totalAmount: number;
  isInterState: boolean;
} {
  // For simplicity in tests, assume intra-state (CGST + SGST)
  const isInterState = false;
  const totalGST = Math.round(baseAmount * gstRate);
  
  if (isInterState) {
    return {
      baseAmount,
      cgst: 0,
      sgst: 0,
      igst: totalGST,
      totalGST,
      totalAmount: baseAmount + totalGST,
      isInterState,
    };
  }
  
  const halfGST = Math.round(totalGST / 2);
  return {
    baseAmount,
    cgst: halfGST,
    sgst: totalGST - halfGST, // Ensure total is exact
    igst: 0,
    totalGST,
    totalAmount: baseAmount + totalGST,
    isInterState,
  };
}

/**
 * Format amount for Indian currency display
 */
export function formatIndianCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

// ============================================
// Export all test utilities
// ============================================

export const testUtils = {
  createMockDb,
  createMockRequest,
  createMockResponse,
  createMockUser,
  createMockOrg,
  createMockTournament,
  createMockPlayerRating,
  createMockSession,
  createMockPaymentLedger,
  createMockWebhookEvent,
  createMockBracket,
  createMockBracketMatch,
  generateUniqueId,
  resetUniqueIdCounter,
  wait,
  randomString,
  randomEmail,
  randomPhone,
  mockRazorpaySignature,
  createMockRazorpayPayload,
  calculateExpectedEloChange,
  assertResponse,
  calculateGST,
  formatIndianCurrency,
};
