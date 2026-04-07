/**
 * Promo Code Validation API
 * 
 * POST: Validate and preview discount for a promo code
 * Used before payment to show the user their discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode, calculateDiscount } from '@/lib/promo-codes';
import { getSessionUser } from '@/lib/session-helpers';
import { PromoUsedFor, SportType } from '@prisma/client';
import { addVersionHeaders } from '@/lib/api-versioning';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, usedFor, referenceId, orderAmount, sport } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Promo code is required' },
        { status: 400 }
      );
    }

    if (!usedFor || !['SUBSCRIPTION', 'TOURNAMENT_ENTRY'].includes(usedFor)) {
      return NextResponse.json(
        { success: false, error: 'Invalid usage type' },
        { status: 400 }
      );
    }

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sport' },
        { status: 400 }
      );
    }

    if (typeof orderAmount !== 'number' || orderAmount < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid order amount' },
        { status: 400 }
      );
    }

    // Get user context (optional - promo codes can work for anonymous users too)
    const authResult = await getSessionUser(request);
    const userId = authResult.success ? authResult.userId : undefined;

    // Validate the promo code
    const validation = await validatePromoCode(code.toUpperCase(), {
      userId,
      sport: sport as SportType,
      usedFor: usedFor as PromoUsedFor,
      orderAmount,
    });

    if (!validation.valid) {
      const response = NextResponse.json({
        success: false,
        valid: false,
        error: validation.error,
      });
      addVersionHeaders(response);
      return response;
    }

    // Calculate the discount
    const promoCode = validation.promoCode!;
    const calculation = calculateDiscount(
      orderAmount,
      promoCode.discountType,
      promoCode.discountValue,
      promoCode.maxDiscountAmount
    );

    // Format response
    const response = NextResponse.json({
      success: true,
      valid: true,
      promoCode: {
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
      },
      calculation: {
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        finalAmount: calculation.finalAmount,
        maxDiscountApplied: calculation.maxDiscountApplied,
      },
      // Human-readable discount description
      discountText: formatDiscountText(
        promoCode.discountType,
        promoCode.discountValue,
        calculation.discountAmount,
        calculation.maxDiscountApplied
      ),
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Promo code validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate promo code' },
      { status: 500 }
    );
  }
}

/**
 * Format discount text for display
 */
function formatDiscountText(
  discountType: string,
  discountValue: number,
  actualDiscount: number,
  maxDiscountApplied: boolean
): string {
  if (discountType === 'PERCENTAGE') {
    const discountRupees = actualDiscount / 100;
    if (maxDiscountApplied) {
      return `${discountValue}% off (max discount applied: ₹${discountRupees.toFixed(0)})`;
    }
    return `${discountValue}% off (₹${discountRupees.toFixed(0)} saved)`;
  } else {
    const discountRupees = discountValue / 100;
    return `₹${discountRupees.toFixed(0)} off`;
  }
}
