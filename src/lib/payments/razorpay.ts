/**
 * Razorpay Payment Integration
 * Handles order creation, payment verification, and webhook processing
 */

import crypto from 'crypto';

// Pricing in paise (1 Rupee = 100 paise)
export const PRICING = {
  // Player subscription: ₹1,200/year per sport
  PLAYER_SUBSCRIPTION_YEARLY: parseInt(process.env.PLAYER_SUBSCRIPTION_YEARLY || '120000'),
  
  // Organization subscriptions per sport per year
  ORG_SCHOOL_CLUB_YEARLY: parseInt(process.env.ORG_SCHOOL_CLUB_YEARLY || '1500000'),      // ₹15,000
  ORG_CORPORATE_YEARLY: parseInt(process.env.ORG_CORPORATE_YEARLY || '10000000'),          // ₹1,00,000
  
  // Tournament fees
  TOURNAMENT_ENTRY_FEE: parseInt(process.env.TOURNAMENT_ENTRY_FEE || '50000'),             // ₹500
  INTER_ORG_TOURNAMENT_FEE: parseInt(process.env.INTER_ORG_TOURNAMENT_FEE || '500000'),    // ₹5,000
};

export const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  baseUrl: 'https://api.razorpay.com/v1',
};

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`).toString('base64');
  
  const response = await fetch(`${RAZORPAY_CONFIG.baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
      payment_capture: 1, // Auto-capture payment
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Razorpay order creation failed:', error);
    throw new Error(`Failed to create order: ${error}`);
  }

  return response.json();
}

/**
 * Verify Razorpay payment signature
 * Uses timing-safe comparison to prevent timing attacks
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
    .update(body)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Verify webhook signature
 * CRITICAL: Webhook secret must be configured in production
 * Uses timing-safe comparison to prevent timing attacks
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (!RAZORPAY_CONFIG.webhookSecret) {
    // SECURITY: Webhook secret is required in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RAZORPAY_WEBHOOK_SECRET must be configured in production');
    }
    console.warn('⚠️ Webhook secret not configured - skipping verification in development');
    return true; // Only allow skip in development
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_CONFIG.webhookSecret)
    .update(body)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by comparing all characters regardless of where differences occur
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Convert to buffers
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  
  // If lengths differ, pad to same length to maintain constant time
  const maxLen = Math.max(aBuffer.length, bBuffer.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuffer.copy(aPadded);
  bBuffer.copy(bPadded);
  
  // Use Node.js crypto timing-safe comparison
  try {
    // crypto.timingSafeEqual requires equal-length buffers
    const result = crypto.timingSafeEqual(aPadded, bPadded);
    // Also verify lengths match (separate check to not leak timing info)
    return result && aBuffer.length === bBuffer.length;
  } catch {
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string): Promise<{
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  notes?: Record<string, string>;
  created_at: number;
}> {
  const auth = Buffer.from(`${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`).toString('base64');
  
  const response = await fetch(`${RAZORPAY_CONFIG.baseUrl}/payments/${paymentId}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch payment details');
  }

  return response.json();
}

/**
 * Format amount for display (paise to rupees)
 */
export function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/**
 * Create a Razorpay refund
 */
export async function createRazorpayRefund(params: {
  paymentId: string;
  amount: number;
  notes?: Record<string, string>;
  receipt?: string;
}): Promise<{
  id: string;
  entity: string;
  amount: number;
  payment_id: string;
  status: string;
  created_at: number;
}> {
  const auth = Buffer.from(`${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`).toString('base64');
  
  const response = await fetch(`${RAZORPAY_CONFIG.baseUrl}/payments/${params.paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      notes: params.notes,
      receipt: params.receipt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Razorpay refund creation failed:', error);
    throw new Error(`Failed to create refund: ${error}`);
  }

  return response.json();
}

/**
 * Calculate refund amount based on tournament date and refund policy
 */
export function calculateRefundAmount(
  originalAmount: number,
  tournamentStartDate: Date,
  currentDate: Date = new Date(),
  policy: 'full' | 'partial' | 'none' = 'partial'
): { amount: number; percentage: number; reason: string } {
  if (policy === 'none') {
    return { amount: 0, percentage: 0, reason: 'No refund policy' };
  }

  if (policy === 'full') {
    return { amount: originalAmount, percentage: 100, reason: 'Full refund' };
  }

  // Partial refund policy: calculate based on days until tournament
  const daysUntilTournament = Math.ceil(
    (tournamentStartDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilTournament > 7) {
    // More than 7 days: 90% refund
    return { 
      amount: Math.floor(originalAmount * 0.9), 
      percentage: 90, 
      reason: '90% refund (more than 7 days before tournament)' 
    };
  } else if (daysUntilTournament > 3) {
    // 3-7 days: 70% refund
    return { 
      amount: Math.floor(originalAmount * 0.7), 
      percentage: 70, 
      reason: '70% refund (3-7 days before tournament)' 
    };
  } else if (daysUntilTournament > 1) {
    // 1-3 days: 50% refund
    return { 
      amount: Math.floor(originalAmount * 0.5), 
      percentage: 50, 
      reason: '50% refund (1-3 days before tournament)' 
    };
  } else {
    // Less than 1 day: no refund
    return { 
      amount: 0, 
      percentage: 0, 
      reason: 'No refund (less than 24 hours before tournament)' 
    };
  }
}

/**
 * Payment types for tracking
 */
export type PaymentType = 
  | 'PLAYER_SUBSCRIPTION'
  | 'ORG_SUBSCRIPTION_SCHOOL_CLUB'
  | 'ORG_SUBSCRIPTION_CORPORATE'
  | 'TOURNAMENT_ENTRY'
  | 'TEAM_TOURNAMENT_ENTRY'
  | 'INTER_ORG_TOURNAMENT_ENTRY';

export function getPaymentTypeAmount(type: PaymentType): number {
  switch (type) {
    case 'PLAYER_SUBSCRIPTION':
      return PRICING.PLAYER_SUBSCRIPTION_YEARLY;
    case 'ORG_SUBSCRIPTION_SCHOOL_CLUB':
      return PRICING.ORG_SCHOOL_CLUB_YEARLY;
    case 'ORG_SUBSCRIPTION_CORPORATE':
      return PRICING.ORG_CORPORATE_YEARLY;
    case 'TOURNAMENT_ENTRY':
      return PRICING.TOURNAMENT_ENTRY_FEE;
    case 'TEAM_TOURNAMENT_ENTRY':
      return PRICING.TOURNAMENT_ENTRY_FEE;
    case 'INTER_ORG_TOURNAMENT_ENTRY':
      return PRICING.INTER_ORG_TOURNAMENT_FEE;
    default:
      return 0;
  }
}
