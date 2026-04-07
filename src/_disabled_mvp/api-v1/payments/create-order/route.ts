/**
 * V1 Payments Create Order API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * POST /api/v1/payments/create-order
 * 
 * Creates a Razorpay order for payment.
 * Works for both players and organizations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRazorpayOrder, getPaymentTypeAmount, formatAmount, PaymentType } from '@/lib/payments/razorpay';
import { getAuthenticatedEntity } from '@/lib/auth';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
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
  tournamentId?: string;
  orgType?: 'CLUB' | 'SCHOOL' | 'CORPORATE';
}

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
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Invalid payment type', { validTypes }, 400);
    }

    // Get amount based on payment type
    let amount = getPaymentTypeAmount(paymentType);

    // Determine payer info based on session type
    const authEntity = await getAuthenticatedEntity(request);
    
    if (!authEntity) {
      return apiError(ApiErrorCodes.UNAUTHORIZED, 'Not authenticated', undefined, 401);
    }

    let payerId: string;
    let payerType: 'USER' | 'ORG';
    let payerName: string;
    let payerEmail: string | null = null;
    let payerPhone: string | null = null;
    let isNewUser = false;
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
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Only players can purchase player subscription', undefined, 400);
    }

    if (paymentType.startsWith('ORG_SUBSCRIPTION') && payerType !== 'ORG') {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'Only organizations can purchase organization subscription', undefined, 400);
    }

    // For tournament entry, validate tournament exists and player isn't already registered
    if (paymentType === 'TOURNAMENT_ENTRY' && tournamentId) {
      const tournament = await db.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', { tournamentId }, 404);
      }

      if (tournament.entryFee > 0) {
        amount = tournament.entryFee * 100;
      }

      const existingReg = await db.tournamentRegistration.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: payerId,
          },
        },
      });

      if (existingReg) {
        return apiError(ApiErrorCodes.CONFLICT, 'Already registered for this tournament', undefined, 400);
      }
    }

    // Abuse detection
    if (payerType === 'USER') {
      const paymentRisk = await detectSuspiciousPayments(payerId, amount, isNewUser);
      
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
        source: clientSource,
      },
    });

    // Store payment record in database
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

    // Log payment creation event
    logPaymentCreateEvent(
      payerId,
      sport as 'CORNHOLE' | 'DARTS',
      order.id,
      request,
      {
        role: payerType === 'USER' ? (authEntity as { user: { role } }).role : undefined,
        amount: order.amount,
        paymentType,
        tournamentId,
      }
    ).catch(err => log.error('Failed to log payment create event', { error: err }));

    const response = NextResponse.json({
      success: true,
      data: {
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
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error) {
    console.error('[V1 Payments Create Order] Error:', error);
    return apiError(ApiErrorCodes.INTERNAL_ERROR, 'Failed to create order', undefined, 500);
  }
}
