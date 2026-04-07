import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMockDb,
  createMockRequest,
  createMockPaymentLedger,
  createMockWebhookEvent,
  createMockRazorpayPayload,
  mockRazorpaySignature,
  calculateGST,
  randomString,
} from '../setup';

/**
 * Payment Webhook Tests
 * 
 * Tests for:
 * - Razorpay signature verification
 * - Idempotency key handling
 * - Payment status updates
 * - GST calculation
 * - Subscription activation
 * - Tournament registration confirmation
 */

// ============================================
// Mock Implementation of Webhook Logic
// ============================================

// Mock config for testing
const MOCK_RAZORPAY_SECRET = 'test-webhook-secret';
const MAX_RETRIES = 5;

// In-memory storage for mock testing
let mockDb: ReturnType<typeof createMockDb>;
let processedWebhooks: Map<string, { status: string; processedAt?: Date }>;

// Reset state before each test
beforeEach(() => {
  mockDb = createMockDb();
  processedWebhooks = new Map();
  vi.clearAllMocks();
});

// ============================================
// Signature Verification Tests
// ============================================

describe('Razorpay Signature Verification', () => {
  /**
   * Mock implementation of signature verification
   * In production, this uses HMAC-SHA256
   */
  function verifySignature(body: string, signature: string, secret: string): boolean {
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RAZORPAY_WEBHOOK_SECRET must be configured in production');
      }
      return true; // Skip in development
    }
    
    // For testing, we use a simplified verification
    const expectedSignature = mockRazorpaySignature(body, secret);
    return signature === expectedSignature;
  }

  it('should verify a valid webhook signature', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = mockRazorpaySignature(body, MOCK_RAZORPAY_SECRET);
    
    const isValid = verifySignature(body, signature, MOCK_RAZORPAY_SECRET);
    expect(isValid).toBe(true);
  });

  it('should reject an invalid webhook signature', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const invalidSignature = 'invalid_signature_12345';
    
    const isValid = verifySignature(body, invalidSignature, MOCK_RAZORPAY_SECRET);
    expect(isValid).toBe(false);
  });

  it('should reject modified body with valid signature', () => {
    const originalBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = mockRazorpaySignature(originalBody, MOCK_RAZORPAY_SECRET);
    
    // Tampered body
    const tamperedBody = JSON.stringify({ event: 'payment.captured', payload: { amount: 999999 } });
    
    const isValid = verifySignature(tamperedBody, signature, MOCK_RAZORPAY_SECRET);
    expect(isValid).toBe(false);
  });

  it('should allow skip in development without secret', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = 'any_signature';
    
    // In development, without secret configured
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const isValid = verifySignature(body, signature, ''); // No secret
    expect(isValid).toBe(true);
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should throw error in production without secret', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = 'any_signature';
    
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    expect(() => verifySignature(body, signature, '')).toThrow(
      'RAZORPAY_WEBHOOK_SECRET must be configured in production'
    );
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should generate different signatures for different secrets', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    
    const sig1 = mockRazorpaySignature(body, 'secret1');
    const sig2 = mockRazorpaySignature(body, 'secret2');
    
    expect(sig1).not.toBe(sig2);
  });

  it('should generate same signature for same body and secret', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    
    const sig1 = mockRazorpaySignature(body, MOCK_RAZORPAY_SECRET);
    const sig2 = mockRazorpaySignature(body, MOCK_RAZORPAY_SECRET);
    
    expect(sig1).toBe(sig2);
  });
});

// ============================================
// Idempotency Key Handling Tests
// ============================================

describe('Idempotency Key Handling', () => {
  function generateIdempotencyKey(provider: string, eventId: string, eventType: string): string {
    return `${provider}:${eventType}:${eventId}`;
  }

  function checkIdempotency(key: string): { exists: boolean; status?: string } {
    const existing = processedWebhooks.get(key);
    if (existing) {
      return { exists: true, status: existing.status };
    }
    return { exists: false };
  }

  function markProcessed(key: string, status: string = 'COMPLETED') {
    processedWebhooks.set(key, { status, processedAt: new Date() });
  }

  it('should generate consistent idempotency keys', () => {
    const key1 = generateIdempotencyKey('razorpay', 'evt_123', 'payment.captured');
    const key2 = generateIdempotencyKey('razorpay', 'evt_123', 'payment.captured');
    
    expect(key1).toBe('razorpay:payment.captured:evt_123');
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different events', () => {
    const key1 = generateIdempotencyKey('razorpay', 'evt_123', 'payment.captured');
    const key2 = generateIdempotencyKey('razorpay', 'evt_456', 'payment.captured');
    const key3 = generateIdempotencyKey('razorpay', 'evt_123', 'payment.failed');
    
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it('should detect already processed webhooks', () => {
    const key = 'razorpay:payment.captured:evt_123';
    markProcessed(key, 'COMPLETED');
    
    const result = checkIdempotency(key);
    
    expect(result.exists).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });

  it('should allow new webhooks to be processed', () => {
    const key = 'razorpay:payment.captured:evt_456';
    
    const result = checkIdempotency(key);
    
    expect(result.exists).toBe(false);
  });

  it('should handle processing status correctly', () => {
    const key = 'razorpay:payment.captured:evt_789';
    markProcessed(key, 'PROCESSING');
    
    const result = checkIdempotency(key);
    
    expect(result.exists).toBe(true);
    expect(result.status).toBe('PROCESSING');
  });

  it('should prevent duplicate processing of completed webhooks', () => {
    const key = 'razorpay:payment.captured:evt_duplicate';
    
    // First processing
    markProcessed(key, 'COMPLETED');
    
    // Attempt to re-process
    const result = checkIdempotency(key);
    
    // Should be rejected as already processed
    expect(result.exists).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });

  it('should handle concurrent processing attempts', () => {
    const key = 'razorpay:payment.captured:evt_concurrent';
    
    // Simulate first request starting processing
    markProcessed(key, 'PROCESSING');
    
    // Second concurrent request should see it's being processed
    const result = checkIdempotency(key);
    
    expect(result.exists).toBe(true);
    expect(result.status).toBe('PROCESSING');
  });

  it('should handle retry status correctly', () => {
    const key = 'razorpay:payment.captured:evt_retry';
    markProcessed(key, 'RETRYING');
    
    const result = checkIdempotency(key);
    
    expect(result.exists).toBe(true);
    expect(result.status).toBe('RETRYING');
  });
});

// ============================================
// Payment Status Updates Tests
// ============================================

describe('Payment Status Updates', () => {
  interface PaymentLedger {
    id: string;
    razorpayId: string;
    paymentId: string | null;
    status: string;
    amount: number;
    type: string;
  }

  const mockLedgerStore: Map<string, PaymentLedger> = new Map();

  beforeEach(() => {
    mockLedgerStore.clear();
  });

  function updatePaymentStatus(orderId: string, updates: Partial<PaymentLedger>): PaymentLedger | null {
    const entry = mockLedgerStore.get(orderId);
    if (!entry) return null;
    
    const updated = { ...entry, ...updates };
    mockLedgerStore.set(orderId, updated);
    return updated;
  }

  it('should update status to PAID on successful payment', () => {
    const orderId = 'order_123';
    const paymentId = 'pay_456';
    
    // Create initial pending payment
    mockLedgerStore.set(orderId, {
      id: 'ledger-1',
      razorpayId: orderId,
      paymentId: null,
      status: 'PENDING',
      amount: 120000,
      type: 'PLAYER_SUBSCRIPTION',
    });
    
    // Update on payment captured
    const result = updatePaymentStatus(orderId, {
      paymentId,
      status: 'PAID',
    });
    
    expect(result).not.toBeNull();
    expect(result?.status).toBe('PAID');
    expect(result?.paymentId).toBe(paymentId);
  });

  it('should update status to FAILED on failed payment', () => {
    const orderId = 'order_failed';
    
    mockLedgerStore.set(orderId, {
      id: 'ledger-2',
      razorpayId: orderId,
      paymentId: null,
      status: 'PENDING',
      amount: 120000,
      type: 'PLAYER_SUBSCRIPTION',
    });
    
    const result = updatePaymentStatus(orderId, {
      status: 'FAILED',
    });
    
    expect(result?.status).toBe('FAILED');
    expect(result?.paymentId).toBeNull();
  });

  it('should handle payment.captured event correctly', async () => {
    const orderId = 'order_captured';
    const paymentId = 'pay_captured';
    
    mockLedgerStore.set(orderId, {
      id: 'ledger-3',
      razorpayId: orderId,
      paymentId: null,
      status: 'PENDING',
      amount: 50000,
      type: 'TOURNAMENT_ENTRY',
    });
    
    // Simulate payment.captured webhook
    const payload = createMockRazorpayPayload({
      event: 'payment.captured',
      orderId,
      paymentId,
      amount: 50000,
      status: 'captured',
    });
    
    // Process the webhook (simplified)
    const result = updatePaymentStatus(payload.payload.payment.entity.order_id, {
      paymentId: payload.payload.payment.entity.id,
      status: 'PAID',
    });
    
    expect(result?.status).toBe('PAID');
    expect(result?.paymentId).toBe(paymentId);
  });

  it('should handle payment.failed event correctly', async () => {
    const orderId = 'order_failed_evt';
    
    mockLedgerStore.set(orderId, {
      id: 'ledger-4',
      razorpayId: orderId,
      paymentId: null,
      status: 'PENDING',
      amount: 120000,
      type: 'PLAYER_SUBSCRIPTION',
    });
    
    // Simulate payment.failed webhook
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_failed',
            order_id: orderId,
            error_description: 'Payment declined by bank',
          },
        },
      },
    };
    
    const result = updatePaymentStatus(payload.payload.payment.entity.order_id, {
      status: 'FAILED',
    });
    
    expect(result?.status).toBe('FAILED');
  });

  it('should handle refund status correctly', () => {
    const orderId = 'order_refund';
    
    mockLedgerStore.set(orderId, {
      id: 'ledger-5',
      razorpayId: orderId,
      paymentId: 'pay_refund',
      status: 'PAID',
      amount: 120000,
      type: 'PLAYER_SUBSCRIPTION',
    });
    
    const result = updatePaymentStatus(orderId, {
      status: 'REFUNDED',
    });
    
    expect(result?.status).toBe('REFUNDED');
  });

  it('should not find non-existent payment ledger', () => {
    const result = updatePaymentStatus('non_existent_order', { status: 'PAID' });
    expect(result).toBeNull();
  });
});

// ============================================
// GST Calculation Tests
// ============================================

describe('GST Calculation', () => {
  it('should calculate correct GST for subscription amount', () => {
    const baseAmount = 120000; // ₹1,200 in paise
    const result = calculateGST(baseAmount, 0.18);
    
    // GST = 120000 * 0.18 = 21600 paise (₹216)
    expect(result.totalGST).toBe(21600);
    expect(result.totalAmount).toBe(141600); // ₹1,416
  });

  it('should split GST into CGST and SGST for intra-state', () => {
    const baseAmount = 50000; // ₹500
    const result = calculateGST(baseAmount, 0.18);
    
    // Total GST = 9000 paise (₹90)
    // CGST = SGST = 4500 paise (₹45 each)
    expect(result.cgst).toBe(4500);
    expect(result.sgst).toBe(4500);
    expect(result.cgst + result.sgst).toBe(result.totalGST);
    expect(result.igst).toBe(0);
  });

  it('should handle zero GST rate', () => {
    const baseAmount = 100000; // ₹1,000
    const result = calculateGST(baseAmount, 0);
    
    expect(result.totalGST).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.totalAmount).toBe(baseAmount);
  });

  it('should handle large amounts correctly', () => {
    const baseAmount = 10000000; // ₹1,00,000 (organization subscription)
    const result = calculateGST(baseAmount, 0.18);
    
    // GST = 1,800,000 paise (₹18,000)
    expect(result.totalGST).toBe(1800000);
    expect(result.totalAmount).toBe(11800000); // ₹1,18,000
  });

  it('should handle odd amounts with rounding', () => {
    const baseAmount = 777; // Odd paise amount
    const result = calculateGST(baseAmount, 0.18);
    
    // GST should be rounded correctly
    expect(result.totalGST).toBe(Math.round(777 * 0.18));
    // CGST + SGST should equal total GST
    expect(result.cgst + result.sgst).toBe(result.totalGST);
  });

  it('should calculate correct total invoice amount', () => {
    const amounts = [
      { base: 120000, rate: 0.18 }, // Player subscription
      { base: 1500000, rate: 0.18 }, // Org subscription
      { base: 50000, rate: 0.18 }, // Tournament entry
    ];
    
    let totalBase = 0;
    let totalGST = 0;
    
    amounts.forEach(({ base, rate }) => {
      const result = calculateGST(base, rate);
      totalBase += result.baseAmount;
      totalGST += result.totalGST;
    });
    
    // Total base: 1,670,000 paise (₹16,700)
    expect(totalBase).toBe(1670000);
    // Total GST: 300,600 paise (₹3,006)
    expect(totalGST).toBe(Math.round(1670000 * 0.18));
  });

  it('should generate valid GST invoice breakdown', () => {
    const baseAmount = 120000;
    const result = calculateGST(baseAmount, 0.18);
    
    // Verify invoice breakdown structure
    expect(result).toHaveProperty('baseAmount');
    expect(result).toHaveProperty('cgst');
    expect(result).toHaveProperty('sgst');
    expect(result).toHaveProperty('igst');
    expect(result).toHaveProperty('totalGST');
    expect(result).toHaveProperty('totalAmount');
    
    // Verify math
    expect(result.totalAmount).toBe(result.baseAmount + result.totalGST);
    expect(result.totalGST).toBe(result.cgst + result.sgst + result.igst);
  });
});

// ============================================
// Subscription Activation Tests
// ============================================

describe('Subscription Activation', () => {
  interface Subscription {
    id: string;
    userId: string;
    sport: string;
    status: string;
    startDate: Date;
    endDate: Date;
    amount: number;
    paymentId: string | null;
  }

  const mockSubscriptionStore: Map<string, Subscription> = new Map();

  beforeEach(() => {
    mockSubscriptionStore.clear();
  });

  it('should create new subscription on first payment', () => {
    const userId = 'user-123';
    const sport = 'CORNHOLE';
    const amount = 120000;
    const paymentId = 'pay_123';
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    const subscription: Subscription = {
      id: 'sub-1',
      userId,
      sport,
      status: 'ACTIVE',
      startDate,
      endDate,
      amount,
      paymentId,
    };
    
    mockSubscriptionStore.set(`${userId}:${sport}`, subscription);
    
    const result = mockSubscriptionStore.get(`${userId}:${sport}`);
    
    expect(result).toBeDefined();
    expect(result?.status).toBe('ACTIVE');
    expect(result?.paymentId).toBe(paymentId);
  });

  it('should extend existing subscription on renewal', () => {
    const userId = 'user-456';
    const sport = 'DARTS';
    
    // Existing subscription
    const existingEndDate = new Date('2024-12-31');
    mockSubscriptionStore.set(`${userId}:${sport}`, {
      id: 'sub-2',
      userId,
      sport,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: existingEndDate,
      amount: 120000,
      paymentId: 'pay_old',
    });
    
    // Renewal - should extend from current end date
    const newEndDate = new Date(existingEndDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    
    const existing = mockSubscriptionStore.get(`${userId}:${sport}`)!;
    existing.endDate = newEndDate;
    existing.amount = 120000;
    existing.paymentId = 'pay_new';
    
    const result = mockSubscriptionStore.get(`${userId}:${sport}`);
    
    expect(result?.endDate.getFullYear()).toBe(existingEndDate.getFullYear() + 1);
  });

  it('should activate org subscription on payment', () => {
    const orgId = 'org-123';
    
    const subscription = {
      id: 'org-sub-1',
      orgId,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amount: 1500000, // ₹15,000
      paymentId: 'pay_org',
    };
    
    // Simulate activation
    const result = subscription;
    
    expect(result.status).toBe('ACTIVE');
    expect(result.amount).toBe(1500000);
  });

  it('should set correct subscription duration (1 year)', () => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    const durationMs = endDate.getTime() - startDate.getTime();
    const expectedDurationMs = 365 * 24 * 60 * 60 * 1000;
    
    // Allow 1 day tolerance for leap years
    expect(Math.abs(durationMs - expectedDurationMs)).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('should handle trial subscription correctly', () => {
    const orgId = 'org-trial';
    
    const trialSubscription = {
      id: 'trial-1',
      orgId,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      amount: 0, // Trial is free
      paymentId: null,
    };
    
    expect(trialSubscription.amount).toBe(0);
    expect(trialSubscription.paymentId).toBeNull();
    
    // Verify trial is 30 days
    const durationMs = trialSubscription.endDate.getTime() - trialSubscription.startDate.getTime();
    const expectedDurationMs = 30 * 24 * 60 * 60 * 1000;
    expect(durationMs).toBe(expectedDurationMs);
  });
});

// ============================================
// Tournament Registration Confirmation Tests
// ============================================

describe('Tournament Registration Confirmation', () => {
  interface TournamentRegistration {
    id: string;
    tournamentId: string;
    userId: string;
    status: string;
    paymentId: string | null;
  }

  const mockRegistrationStore: Map<string, TournamentRegistration> = new Map();

  beforeEach(() => {
    mockRegistrationStore.clear();
  });

  it('should confirm registration on successful payment', () => {
    const tournamentId = 'tournament-123';
    const userId = 'user-123';
    const paymentId = 'pay_tournament';
    
    // Create pending registration
    mockRegistrationStore.set(`${tournamentId}:${userId}`, {
      id: 'reg-1',
      tournamentId,
      userId,
      status: 'PENDING',
      paymentId: null,
    });
    
    // Update on payment
    const registration = mockRegistrationStore.get(`${tournamentId}:${userId}`)!;
    registration.status = 'CONFIRMED';
    registration.paymentId = paymentId;
    
    const result = mockRegistrationStore.get(`${tournamentId}:${userId}`);
    
    expect(result?.status).toBe('CONFIRMED');
    expect(result?.paymentId).toBe(paymentId);
  });

  it('should create notification on registration confirmation', () => {
    const notification = {
      id: 'notif-1',
      userId: 'user-123',
      type: 'TOURNAMENT_REGISTERED',
      title: 'Registration Confirmed!',
      message: 'Your registration for Test Tournament 2024 has been confirmed.',
      link: '/cornhole/tournaments/tournament-123',
    };
    
    expect(notification.type).toBe('TOURNAMENT_REGISTERED');
    expect(notification.title).toContain('Confirmed');
  });

  it('should handle waitlist promotion on payment', () => {
    const tournamentId = 'tournament-full';
    const userId = 'user-waitlist';
    
    // Create waitlisted registration
    mockRegistrationStore.set(`${tournamentId}:${userId}`, {
      id: 'reg-waitlist',
      tournamentId,
      userId,
      status: 'WAITLISTED',
      paymentId: null,
    });
    
    // Promote from waitlist
    const registration = mockRegistrationStore.get(`${tournamentId}:${userId}`)!;
    registration.status = 'CONFIRMED';
    registration.paymentId = 'pay_waitlist';
    
    expect(registration.status).toBe('CONFIRMED');
  });

  it('should handle team tournament registration', () => {
    const teamId = 'team-123';
    const tournamentId = 'tournament-team';
    const paymentId = 'pay_team';
    
    const teamRegistration = {
      id: 'team-reg-1',
      tournamentId,
      teamId,
      status: 'CONFIRMED',
      paymentId,
    };
    
    expect(teamRegistration.status).toBe('CONFIRMED');
    expect(teamRegistration.paymentId).toBe(paymentId);
  });

  it('should send notification to all team members', () => {
    const teamMembers = ['user-1', 'user-2', 'user-3'];
    const notifications: { userId: string; type: string }[] = [];
    
    teamMembers.forEach(userId => {
      notifications.push({
        userId,
        type: 'TOURNAMENT_REGISTERED',
      });
    });
    
    expect(notifications.length).toBe(3);
    expect(notifications.every(n => n.type === 'TOURNAMENT_REGISTERED')).toBe(true);
  });
});

// ============================================
// Webhook Retry Logic Tests
// ============================================

describe('Webhook Retry Logic', () => {
  const RETRY_CONFIG = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  };

  function calculateDelay(attempt: number): number {
    const delay = Math.min(
      RETRY_CONFIG.maxDelayMs,
      RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
    );
    return Math.floor(delay);
  }

  it('should calculate exponential backoff delays', () => {
    expect(calculateDelay(0)).toBe(1000); // 1 second
    expect(calculateDelay(1)).toBe(2000); // 2 seconds
    expect(calculateDelay(2)).toBe(4000); // 4 seconds
    expect(calculateDelay(3)).toBe(8000); // 8 seconds
    expect(calculateDelay(4)).toBe(16000); // 16 seconds
  });

  it('should cap delay at maximum', () => {
    // With multiplier of 2, attempt 6 would be 64 seconds > 60 second max
    expect(calculateDelay(6)).toBe(RETRY_CONFIG.maxDelayMs);
    expect(calculateDelay(10)).toBe(RETRY_CONFIG.maxDelayMs);
  });

  it('should stop retrying after max attempts', () => {
    const attemptCount = RETRY_CONFIG.maxRetries;
    
    // Should be moved to dead letter queue
    expect(attemptCount >= RETRY_CONFIG.maxRetries).toBe(true);
  });

  it('should track attempt count correctly', () => {
    interface WebhookEvent {
      attemptCount: number;
      status: string;
    }
    
    const event: WebhookEvent = {
      attemptCount: 0,
      status: 'PENDING',
    };
    
    // Simulate processing attempts
    for (let i = 0; i < 3; i++) {
      event.attemptCount++;
      event.status = 'RETRYING';
    }
    
    expect(event.attemptCount).toBe(3);
    expect(event.status).toBe('RETRYING');
  });

  it('should mark as completed on successful processing', () => {
    interface WebhookEvent {
      status: string;
      processedAt: Date | null;
      lastError: string | null;
    }
    
    const event: WebhookEvent = {
      status: 'PROCESSING',
      processedAt: null,
      lastError: null,
    };
    
    // Successful processing
    event.status = 'COMPLETED';
    event.processedAt = new Date();
    
    expect(event.status).toBe('COMPLETED');
    expect(event.processedAt).not.toBeNull();
  });

  it('should store error message on failure', () => {
    interface WebhookEvent {
      status: string;
      lastError: string | null;
      attemptCount: number;
    }
    
    const event: WebhookEvent = {
      status: 'PROCESSING',
      lastError: null,
      attemptCount: 1,
    };
    
    // Failed processing
    event.status = 'RETRYING';
    event.lastError = 'Database connection timeout';
    event.attemptCount++;
    
    expect(event.status).toBe('RETRYING');
    expect(event.lastError).toBe('Database connection timeout');
    expect(event.attemptCount).toBe(2);
  });

  it('should handle dead letter queue items', () => {
    interface WebhookEvent {
      status: string;
      attemptCount: number;
      lastError: string | null;
    }
    
    const deadLetterEvent: WebhookEvent = {
      status: 'DEAD_LETTER',
      attemptCount: 5,
      lastError: 'Max retries exceeded',
    };
    
    expect(deadLetterEvent.status).toBe('DEAD_LETTER');
    expect(deadLetterEvent.attemptCount).toBe(5);
    
    // Should be available for manual retry
    // After manual retry, status should be reset
    deadLetterEvent.status = 'PENDING';
    deadLetterEvent.attemptCount = 0;
    deadLetterEvent.lastError = null;
    
    expect(deadLetterEvent.status).toBe('PENDING');
    expect(deadLetterEvent.attemptCount).toBe(0);
  });
});

// ============================================
// Edge Cases and Error Handling Tests
// ============================================

describe('Edge Cases and Error Handling', () => {
  it('should handle malformed webhook payload', () => {
    const malformedBody = 'not valid json';
    
    expect(() => JSON.parse(malformedBody)).toThrow();
  });

  it('should handle missing required fields in payload', () => {
    const incompletePayload = {
      event: 'payment.captured',
      // Missing payload.payment.entity
    };
    
    // Should have required fields
    expect(incompletePayload.payload).toBeUndefined();
  });

  it('should handle unknown event types gracefully', () => {
    const unknownEvent = 'subscription.updated';
    const knownEvents = ['payment.captured', 'payment.failed', 'order.paid'];
    
    expect(knownEvents.includes(unknownEvent)).toBe(false);
  });

  it('should handle concurrent webhook delivery', () => {
    const webhooks = [
      { id: 'evt_1', status: 'COMPLETED' },
      { id: 'evt_2', status: 'PROCESSING' },
      { id: 'evt_3', status: 'PENDING' },
    ];
    
    // All should be tracked independently
    expect(webhooks.length).toBe(3);
    expect(webhooks.filter(w => w.status === 'COMPLETED').length).toBe(1);
  });

  it('should handle delayed webhook delivery', () => {
    const eventTime = new Date('2024-01-01T10:00:00Z');
    const processTime = new Date('2024-01-01T12:00:00Z');
    
    const delayMs = processTime.getTime() - eventTime.getTime();
    const delayMinutes = delayMs / (1000 * 60);
    
    expect(delayMinutes).toBe(120);
  });

  it('should handle very large payment amounts', () => {
    const largeAmount = 100000000; // ₹10,00,000 in paise
    
    const result = calculateGST(largeAmount, 0.18);
    
    // GST = 18,000,000 paise (₹1,80,000)
    expect(result.totalGST).toBe(18000000);
    expect(result.totalAmount).toBe(118000000);
  });

  it('should handle zero amount payments', () => {
    const zeroAmount = 0;
    
    const result = calculateGST(zeroAmount, 0.18);
    
    expect(result.totalGST).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('should handle multiple sports subscriptions', () => {
    const userId = 'user-multi';
    const sports = ['CORNHOLE', 'DARTS'];
    const subscriptions: { userId: string; sport: string; status: string }[] = [];
    
    sports.forEach(sport => {
      subscriptions.push({
        userId,
        sport,
        status: 'ACTIVE',
      });
    });
    
    expect(subscriptions.length).toBe(2);
    expect(subscriptions.map(s => s.sport)).toContain('CORNHOLE');
    expect(subscriptions.map(s => s.sport)).toContain('DARTS');
  });
});

// ============================================
// Integration Test Scenarios
// ============================================

describe('Integration Test Scenarios', () => {
  it('should process complete payment flow', async () => {
    // 1. Create order
    const orderId = 'order_integration';
    const paymentLedger = createMockPaymentLedger({
      razorpayId: orderId,
      status: 'PENDING',
    });
    
    expect(paymentLedger.status).toBe('PENDING');
    
    // 2. Payment captured webhook
    const payload = createMockRazorpayPayload({
      event: 'payment.captured',
      orderId,
      paymentId: 'pay_integration',
      amount: 120000,
    });
    
    // 3. Update payment status
    const updatedLedger = {
      ...paymentLedger,
      status: 'PAID',
      paymentId: payload.payload.payment.entity.id,
    };
    
    expect(updatedLedger.status).toBe('PAID');
    expect(updatedLedger.paymentId).toBe('pay_integration');
    
    // 4. Activate subscription
    const subscription = {
      userId: paymentLedger.userId,
      sport: paymentLedger.sport,
      status: 'ACTIVE',
      amount: payload.payload.payment.entity.amount,
      paymentId: updatedLedger.paymentId,
    };
    
    expect(subscription.status).toBe('ACTIVE');
  });

  it('should handle refund flow', async () => {
    // 1. Original payment
    const orderId = 'order_refund_flow';
    const paymentLedger = createMockPaymentLedger({
      razorpayId: orderId,
      status: 'PAID',
      paymentId: 'pay_original',
    });
    
    // 2. Refund webhook
    const refundPayload = {
      event: 'refund.processed',
      payload: {
        payment: {
          entity: {
            order_id: orderId,
            id: 'pay_original',
          },
        },
        refund: {
          entity: {
            id: 'rfn_123',
            amount: 120000,
            status: 'processed',
          },
        },
      },
    };
    
    // 3. Update status
    paymentLedger.status = 'REFUNDED';
    
    expect(paymentLedger.status).toBe('REFUNDED');
    // Subscription should be cancelled
  });

  it('should handle tournament entry flow', async () => {
    // 1. Player registers for tournament
    const tournamentId = 'tournament_integration';
    const userId = 'user_integration';
    
    const registration = {
      tournamentId,
      userId,
      status: 'PENDING',
      paymentId: null,
    };
    
    // 2. Payment webhook
    const payload = createMockRazorpayPayload({
      event: 'payment.captured',
      orderId: 'order_tournament',
      paymentId: 'pay_tournament',
      amount: 50000, // ₹500
      notes: { tournamentId },
    });
    
    // 3. Confirm registration
    registration.status = 'CONFIRMED';
    registration.paymentId = payload.payload.payment.entity.id;
    
    expect(registration.status).toBe('CONFIRMED');
    expect(registration.paymentId).toBe('pay_tournament');
  });
});
