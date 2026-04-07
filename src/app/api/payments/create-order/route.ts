import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRazorpayOrder, getPaymentTypeAmount, formatAmount, PaymentType } from '@/lib/payments/razorpay';
import { getAuthenticatedEntity } from '@/lib/auth';
import { logPaymentCreateEvent } from '@/lib/audit-logger';
import { log } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  detectSuspiciousPayments,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
} from '@/lib/abuse-detection';
import { AbusePattern, AbuseSeverity } from '@prisma/client';

interface CreateOrderBody {
  paymentType: PaymentType;
  sport: string;
  tournamentId?: string; // For tournament entry fees
  orgType?: 'CLUB' | 'SCHOOL' | 'CORPORATE'; // For org subscription
}

/**
 * Create a Razorpay order for payment
 * Works for both players and organizations
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderBody = await request.json();
    const { paymentType, sport, tournamentId, orgType } = body;

    // Validate payment type
    const validTypes: PaymentType[] = [
      'PLAYER_SUBSCRIPTION',
      'ORG_SUBSCRIPTION_SCHOOL_CLUB',
      'ORG_SUBSCRIPTION_CORPORATE',
      'TOURNAMENT_ENTRY',
      'INTER_ORG_TOURNAMENT_ENTRY',
    ];

    if (!validTypes.includes(paymentType)) {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    // Get amount based on payment type
    let amount = getPaymentTypeAmount(paymentType);

    // Determine payer info based on session type
    // Use getAuthenticatedEntity to support both players and organizations
    const authEntity = await getAuthenticatedEntity(request);
    
    if (!authEntity) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let payerId: string;
    let payerType: 'USER' | 'ORG';
    let payerName: string;
    let payerEmail: string | null = null;
    let payerPhone: string | null = null;
    let isNewUser = false; // Track if this is a newly registered user
    const ipAddress = getClientIpAddress(request);
    const userAgentStr = getUserAgent(request);

    // Detect client source (mobile vs web)
    const authSource = request.headers.get('x-auth-source');
    const isMobileClient = authSource === 'bearer' ||
                          userAgentStr.includes('ReactNative') ||
                          userAgentStr.includes('Flutter') ||
                          userAgentStr.includes('VALORHIVE-Mobile');
    const clientSource = isMobileClient ? 'mobile_app' : 'web';

    if (authEntity.type === 'user') {
      const { user } = authEntity;
      payerId = user.id;
      payerType = 'USER';
      payerName = `${user.firstName} ${user.lastName}`;
      payerEmail = user.email;
      payerPhone = user.phone;
      
      // Check if user is new (registered within last 24 hours)
      const accountAge = Date.now() - new Date(user.createdAt).getTime();
      isNewUser = accountAge < 24 * 60 * 60 * 1000;
    } else {
      const { org } = authEntity;
      payerId = org.id;
      payerType = 'ORG';
      payerName = org.name;
      payerEmail = org.email ?? null;
      payerPhone = org.phone ?? null;
    }

    // Validate payment type matches payer type
    if (paymentType === 'PLAYER_SUBSCRIPTION' && payerType !== 'USER') {
      return NextResponse.json({ error: 'Only players can purchase player subscription' }, { status: 400 });
    }

    if (paymentType.startsWith('ORG_SUBSCRIPTION') && payerType !== 'ORG') {
      return NextResponse.json({ error: 'Only organizations can purchase organization subscription' }, { status: 400 });
    }

    // For tournament entry, validate tournament exists and player isn't already registered
    if (paymentType === 'TOURNAMENT_ENTRY' && tournamentId) {
      const tournament = await db.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }

      // Override amount with tournament's entry fee if set
      if (tournament.entryFee > 0) {
        amount = tournament.entryFee * 100; // Convert to paise
      }

      // Check if already registered
      const existingReg = await db.tournamentRegistration.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: payerId,
          },
        },
      });

      if (existingReg) {
        return NextResponse.json({ error: 'Already registered for this tournament' }, { status: 400 });
      }
    }

    // === ABUSE DETECTION: Suspicious Payment Patterns ===
    if (payerType === 'USER') {
      const paymentRisk = await detectSuspiciousPayments(
        payerId,
        amount,
        isNewUser
      );
      
      if (paymentRisk.isSuspicious) {
        await recordAbuseEvent(
          AbusePattern.SUSPICIOUS_PAYMENT_PATTERN,
          paymentRisk.riskScore >= 70 ? AbuseSeverity.HIGH : AbuseSeverity.MEDIUM,
          payerId,
          undefined,
          ipAddress,
          userAgentStr,
          {
            indicators: paymentRisk.indicators,
            riskScore: paymentRisk.riskScore,
            amount,
            paymentType,
            tournamentId,
          }
        );
        
        log.warn('Suspicious payment pattern detected', {
          userId: payerId,
          indicators: paymentRisk.indicators,
          riskScore: paymentRisk.riskScore,
          amount,
        });
        
        // Don't block the payment but flag for review
        // The payment will proceed but be logged for manual review
      }
    }

    // Generate receipt ID
    const receipt = `RCPT_${paymentType}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount,
      receipt,
      notes: {
        paymentType,
        sport,
        payerId,
        payerType,
        payerName,
        tournamentId: tournamentId || '',
        orgType: orgType || '',
        source: clientSource, // Track if payment came from mobile app or web
      },
    });

    // Store payment record in database with tournament context if applicable
    await db.paymentLedger.create({
      data: {
        userId: payerType === 'USER' ? payerId : null,
        orgId: payerType === 'ORG' ? payerId : null,
        tournamentId: tournamentId || null,
        sport: sport as 'CORNHOLE' | 'DARTS',
        amount,
        type: paymentType,
        status: 'INITIATED',
        razorpayId: order.id,
        description: `${paymentType.replace(/_/g, ' ')} - ${sport}`,
      },
    });

    // Log payment creation event for audit
    const payerRole = authEntity.type === 'user' ? authEntity.user.role : undefined;
    logPaymentCreateEvent(
      payerId,
      sport as 'CORNHOLE' | 'DARTS',
      order.id,
      request,
      {
        role: payerRole,
        amount: order.amount,
        paymentType,
        tournamentId,
      }
    ).catch(err => log.error('Failed to log payment create event', { error: err }));

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      payer: {
        name: payerName,
        email: payerEmail,
        phone: payerPhone,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      amountDisplay: formatAmount(amount),
    });

  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
