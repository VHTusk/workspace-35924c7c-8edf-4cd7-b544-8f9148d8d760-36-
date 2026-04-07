/**
 * VALORHIVE - UPI Reconciliation Service (v3.6.1)
 * 
 * Handles deferred UPI settlements which can remain "pending" for up to 48 hours.
 * Implements polling, status checking, and automatic reconciliation.
 * 
 * Features:
 * - VPA extraction and bank derivation
 * - Deferred UPI settlement handling
 * - Periodic reconciliation via cron
 * - Webhook enhancement for UPI details
 */

import { db } from '@/lib/db';
import { PaymentLedgerStatus } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface UPIPaymentDetails {
  vpa: string;              // e.g., "user@paytm"
  bank: string;             // Derived from VPA domain
  method: 'upi';
}

export interface ReconciliationResult {
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
}

export interface UPIPaymentStatus {
  id: string;
  status: 'captured' | 'failed' | 'pending' | 'authorized';
  method: string;
  vpa?: string;
  amount: number;
  created_at: number;
  bank?: string;
}

// ============================================
// Configuration
// ============================================

const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  baseUrl: 'https://api.razorpay.com/v1',
};

// UPI timeout in hours (default 48 hours)
const UPI_TIMEOUT_HOURS = parseInt(process.env.UPI_RECONCILIATION_TIMEOUT_HOURS || '48');

// Check interval for pending payments (default 15 minutes old before first check)
const UPI_MIN_AGE_MINUTES = parseInt(process.env.UPI_PENDING_CHECK_INTERVAL_MINUTES || '15') || 15;

// ============================================
// VPA to Bank Mapping
// ============================================

const VPA_BANK_MAPPING: Record<string, string> = {
  // Popular UPI handles
  '@paytm': 'Paytm Payments Bank',
  '@gpay': 'Google Pay',
  '@phonepe': 'PhonePe',
  '@amazonpay': 'Amazon Pay',
  '@bhim': 'BHIM UPI',
  '@upi': 'Unified Payments Interface',
  
  // Major banks
  '@hdfcbank': 'HDFC Bank',
  '@icici': 'ICICI Bank',
  '@axisbank': 'Axis Bank',
  '@sbi': 'State Bank of India',
  '@kotak': 'Kotak Mahindra Bank',
  '@yesbank': 'Yes Bank',
  '@indus': 'IndusInd Bank',
  '@rblbank': 'RBL Bank',
  '@federalbank': 'Federal Bank',
  '@idfc': 'IDFC First Bank',
  '@aubank': 'AU Small Finance Bank',
  '@pnb': 'Punjab National Bank',
  '@bob': 'Bank of Baroda',
  '@canarabank': 'Canara Bank',
  '@unionbank': 'Union Bank of India',
  '@iob': 'Indian Overseas Bank',
  '@unionbankofindia': 'Union Bank of India',
  '@bankofbaroda': 'Bank of Baroda',
  '@centralbank': 'Central Bank of India',
  '@corpbank': 'Corporation Bank',
  '@andhrabank': 'Andhra Bank',
  '@syndicatebank': 'Syndicate Bank',
  '@allahabadbank': 'Allahabad Bank',
  '@indianbank': 'Indian Bank',
  '@uco': 'UCO Bank',
  '@denabank': 'Dena Bank',
  '@vijayabank': 'Vijaya Bank',
  '@psb': 'Punjab & Sind Bank',
  '@obc': 'Oriental Bank of Commerce',
  '@unitedbank': 'United Bank of India',
  '@mahebank': 'Mahesh Bank',
  '@fino': 'Fino Payments Bank',
  '@airtel': 'Airtel Payments Bank',
  '@jiomoney': 'Jio Money',
  '@olamoney': 'Ola Money',
  '@freecharge': 'Freecharge',
  '@mobikwik': 'MobiKwik',
};

/**
 * Derive bank name from VPA
 */
export function deriveBankFromVPA(vpa: string): string {
  if (!vpa) return 'Unknown Bank';
  
  const handle = vpa.includes('@') ? `@${vpa.split('@')[1]}` : '';
  const lowerHandle = handle.toLowerCase();
  
  // Direct mapping
  if (VPA_BANK_MAPPING[lowerHandle]) {
    return VPA_BANK_MAPPING[lowerHandle];
  }
  
  // Partial match
  for (const [key, bank] of Object.entries(VPA_BANK_MAPPING)) {
    if (lowerHandle.includes(key) || key.includes(lowerHandle)) {
      return bank;
    }
  }
  
  // Extract from handle
  const bankPart = lowerHandle.replace('@', '');
  if (bankPart) {
    return `${bankPart.charAt(0).toUpperCase() + bankPart.slice(1)} Bank`;
  }
  
  return 'Unknown Bank';
}

/**
 * Extract UPI details from Razorpay payment data
 */
export function extractUPIDetails(paymentData: {
  method?: string;
  vpa?: string;
  bank?: string;
}): UPIPaymentDetails | null {
  if (paymentData.method !== 'upi') {
    return null;
  }
  
  const vpa = paymentData.vpa || '';
  const bank = paymentData.bank || deriveBankFromVPA(vpa);
  
  return {
    vpa,
    bank,
    method: 'upi',
  };
}

// ============================================
// Razorpay API Integration
// ============================================

/**
 * Fetch payment details from Razorpay
 */
async function fetchPaymentFromRazorpay(paymentId: string): Promise<UPIPaymentStatus> {
  if (!RAZORPAY_CONFIG.keyId || !RAZORPAY_CONFIG.keySecret) {
    // Mock response for development
    console.log(`[UPI-Reconciliation] Mock: Fetching payment ${paymentId}`);
    return {
      id: paymentId,
      status: 'captured',
      method: 'upi',
      vpa: 'user@paytm',
      amount: 50000,
      created_at: Date.now() / 1000,
      bank: 'Paytm Payments Bank',
    };
  }

  const auth = Buffer.from(`${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`).toString('base64');
  
  const response = await fetch(`${RAZORPAY_CONFIG.baseUrl}/payments/${paymentId}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  return {
    id: data.id,
    status: data.status,
    method: data.method,
    vpa: data.vpa,
    amount: data.amount,
    created_at: data.created_at,
    bank: data.bank,
  };
}

// ============================================
// Deferred UPI Settlement
// ============================================

/**
 * Handle deferred UPI settlement
 * UPI payments can be "pending" for up to 48 hours
 */
export async function handleDeferredUPISettlement(
  razorpayPaymentId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    // Fetch current status from Razorpay
    const payment = await fetchPaymentFromRazorpay(razorpayPaymentId);
    
    console.log(`[UPI-Reconciliation] Payment ${razorpayPaymentId} status: ${payment.status}`);

    // Find payment ledger entry
    const ledgerEntry = await db.paymentLedger.findFirst({
      where: { razorpayId: razorpayPaymentId },
    });

    if (!ledgerEntry) {
      console.log(`[UPI-Reconciliation] No ledger entry for ${razorpayPaymentId}`);
      return { success: false, error: 'Payment ledger not found' };
    }

    // Update based on status
    if (payment.status === 'captured') {
      await db.paymentLedger.update({
        where: { id: ledgerEntry.id },
        data: {
          status: PaymentLedgerStatus.PAID,
          paymentMethod: 'upi',
          upiVpa: payment.vpa,
          upiBank: payment.bank || deriveBankFromVPA(payment.vpa || ''),
          reconciledAt: new Date(),
        },
      });

      // Trigger related updates (registration confirmation, etc.)
      await handlePaymentCompletion(ledgerEntry.id);

      return { success: true, status: 'captured' };
    }

    if (payment.status === 'failed') {
      await db.paymentLedger.update({
        where: { id: ledgerEntry.id },
        data: {
          status: PaymentLedgerStatus.FAILED,
          paymentMethod: 'upi',
          upiVpa: payment.vpa,
          upiBank: payment.bank || deriveBankFromVPA(payment.vpa || ''),
          description: 'UPI payment failed',
        },
      });

      return { success: true, status: 'failed' };
    }

    // Still pending
    return { success: true, status: payment.status };

  } catch (error) {
    console.error(`[UPI-Reconciliation] Error processing ${razorpayPaymentId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Handle payment completion side effects
 */
async function handlePaymentCompletion(ledgerId: string): Promise<void> {
  const ledger = await db.paymentLedger.findUnique({
    where: { id: ledgerId },
  });

  if (!ledger || ledger.status !== PaymentLedgerStatus.PAID) {
    return;
  }

  // Update tournament registration if applicable
  if (ledger.tournamentId && ledger.userId) {
    await db.tournamentRegistration.updateMany({
      where: {
        tournamentId: ledger.tournamentId,
        userId: ledger.userId,
        status: 'PENDING',
      },
      data: {
        status: 'CONFIRMED',
        paymentId: ledger.razorpayId,
      },
    });
  }

  // Create notification
  if (ledger.userId) {
    await db.notification.create({
      data: {
        userId: ledger.userId,
        sport: ledger.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Payment Confirmed',
        message: `Your UPI payment of ₹${ledger.amount} has been confirmed.`,
        isRead: false,
      },
    });
  }
}

// ============================================
// Reconciliation Functions
// ============================================

/**
 * Reconcile all pending UPI payments
 * Called by cron job every 30 minutes
 */
export async function reconcilePendingUPIPayments(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    errors: [],
  };

  const minAge = new Date(Date.now() - UPI_MIN_AGE_MINUTES * 60 * 1000);
  const maxAge = new Date(Date.now() - UPI_TIMEOUT_HOURS * 60 * 60 * 1000);

  try {
    // Find pending UPI payments older than minAge
    const pendingPayments = await db.paymentLedger.findMany({
      where: {
        status: PaymentLedgerStatus.INITIATED,
        paymentMethod: 'upi',
        createdAt: {
          gte: maxAge,  // Not older than timeout
          lte: minAge,  // At least minAge old
        },
        razorpayId: { not: null },
      },
      take: 100, // Process in batches
    });

    console.log(`[UPI-Reconciliation] Found ${pendingPayments.length} pending UPI payments`);

    for (const payment of pendingPayments) {
      result.processed++;

      try {
        const outcome = await handleDeferredUPISettlement(payment.razorpayId!);
        
        if (outcome.success) {
          if (outcome.status === 'captured') {
            result.completed++;
          } else if (outcome.status === 'failed') {
            result.failed++;
          }
        } else {
          result.errors.push(`${payment.razorpayId}: ${outcome.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${payment.razorpayId}: ${errorMsg}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[UPI-Reconciliation] Processed: ${result.processed}, Completed: ${result.completed}, Failed: ${result.failed}`);

  } catch (error) {
    console.error('[UPI-Reconciliation] Error in reconciliation:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Check for timed out UPI payments
 */
export async function handleTimedOutUPIPayments(): Promise<{
  processed: number;
  markedFailed: number;
}> {
  const timeoutDate = new Date(Date.now() - UPI_TIMEOUT_HOURS * 60 * 60 * 1000);

  const result = {
    processed: 0,
    markedFailed: 0,
  };

  try {
    // Find payments that have exceeded timeout
    const timedOutPayments = await db.paymentLedger.findMany({
      where: {
        status: PaymentLedgerStatus.INITIATED,
        paymentMethod: 'upi',
        createdAt: { lt: timeoutDate },
      },
    });

    result.processed = timedOutPayments.length;

    for (const payment of timedOutPayments) {
      try {
        // Final check with Razorpay
        if (payment.razorpayId) {
          const status = await fetchPaymentFromRazorpay(payment.razorpayId);
          
          if (status.status === 'captured') {
            // Payment succeeded before timeout
            await db.paymentLedger.update({
              where: { id: payment.id },
              data: {
                status: PaymentLedgerStatus.PAID,
                reconciledAt: new Date(),
              },
            });
            continue;
          }
        }

        // Mark as failed
        await db.paymentLedger.update({
          where: { id: payment.id },
          data: {
            status: PaymentLedgerStatus.FAILED,
            description: 'UPI payment timed out after 48 hours',
          },
        });

        result.markedFailed++;

      } catch (error) {
        console.error(`[UPI-Reconciliation] Error handling timeout for ${payment.id}:`, error);
      }
    }

  } catch (error) {
    console.error('[UPI-Reconciliation] Error handling timed out payments:', error);
  }

  return result;
}

// ============================================
// Webhook Integration
// ============================================

/**
 * Store UPI details from webhook payment data
 */
export async function storeUPIDetailsFromWebhook(
  razorpayPaymentId: string,
  paymentData: {
    method: string;
    vpa?: string;
    bank?: string;
    status: string;
  }
): Promise<void> {
  if (paymentData.method !== 'upi') {
    return;
  }

  const upiDetails = extractUPIDetails(paymentData);
  if (!upiDetails) {
    return;
  }

  try {
    await db.paymentLedger.updateMany({
      where: { razorpayId: razorpayPaymentId },
      data: {
        paymentMethod: 'upi',
        upiVpa: upiDetails.vpa,
        upiBank: upiDetails.bank,
        reconciledAt: paymentData.status === 'captured' ? new Date() : null,
      },
    });

    console.log(`[UPI-Reconciliation] Stored UPI details for ${razorpayPaymentId}: ${upiDetails.vpa} (${upiDetails.bank})`);
  } catch (error) {
    console.error(`[UPI-Reconciliation] Error storing UPI details:`, error);
  }
}

// ============================================
// Statistics
// ============================================

export async function getUPIReconciliationStats(): Promise<{
  pendingCount: number;
  pendingAmount: number;
  timedOutCount: number;
  lastReconciliation: Date | null;
}> {
  const minAge = new Date(Date.now() - UPI_MIN_AGE_MINUTES * 60 * 1000);
  const timeoutDate = new Date(Date.now() - UPI_TIMEOUT_HOURS * 60 * 60 * 1000);

  const [pendingPayments, timedOutPayments] = await Promise.all([
    db.paymentLedger.aggregate({
      where: {
        status: PaymentLedgerStatus.INITIATED,
        paymentMethod: 'upi',
        createdAt: { gte: minAge },
      },
      _count: true,
      _sum: { amount: true },
    }),
    db.paymentLedger.count({
      where: {
        status: PaymentLedgerStatus.INITIATED,
        paymentMethod: 'upi',
        createdAt: { lt: timeoutDate },
      },
    }),
  ]);

  // Get last reconciliation time from audit log
  const lastReconciliation = await db.auditLog.findFirst({
    where: {
      action: 'ADMIN_OVERRIDE',
      targetType: 'UPI_RECONCILIATION',
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    pendingCount: pendingPayments._count,
    pendingAmount: pendingPayments._sum.amount || 0,
    timedOutCount: timedOutPayments,
    lastReconciliation: lastReconciliation?.createdAt || null,
  };
}

// ============================================
// Export Service Object
// ============================================

export const UPIReconciliationService = {
  handleDeferredSettlement: handleDeferredUPISettlement,
  reconcilePending: reconcilePendingUPIPayments,
  handleTimeouts: handleTimedOutUPIPayments,
  storeFromWebhook: storeUPIDetailsFromWebhook,
  getStats: getUPIReconciliationStats,
  deriveBank: deriveBankFromVPA,
};
