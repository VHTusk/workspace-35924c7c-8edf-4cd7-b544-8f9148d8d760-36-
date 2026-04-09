import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { createRazorpayOrder, formatAmount } from '@/lib/payments/razorpay';
import { v4 as uuidv4 } from 'uuid';
import { SportType, SubscriptionStatus } from '@prisma/client';

interface CheckoutRequest {
  sports: string[];  // Array of sport IDs (CORNHOLE, DARTS, etc.)
  promoCode?: string;
  amount: number;    // Final amount in paise after discount
}

// Fixed price per sport per year: ₹50,000
const PRICE_PER_SPORT = 50000; // in paise (₹50,000 = 50,000 * 100 paise)
const SUBSCRIPTION_DURATION_DAYS = 365;

/**
 * POST /api/org/subscription/checkout
 * Create a checkout order for multi-sport subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Validate organization session
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const org = session.org;
    const body: CheckoutRequest = await request.json();
    const { sports, promoCode, amount } = body;

    // Validate sports array
    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      return NextResponse.json({ error: 'No sports selected' }, { status: 400 });
    }

    // Validate each sport is a valid SportType
    const validSports = Object.values(SportType);
    const invalidSports = sports.filter(s => !validSports.includes(s as SportType));
    
    if (invalidSports.length > 0) {
      return NextResponse.json({ 
        error: `Invalid sport types: ${invalidSports.join(', ')}` 
      }, { status: 400 });
    }

    // Check for already subscribed sports
    const existingSubscription = await db.orgSubscription.findFirst({
      where: {
        orgId: org.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      return NextResponse.json({ 
        error: 'This organization already has an active subscription.',
        subscribedSports: sports,
      }, { status: 400 });
    }

    // Calculate subtotal
    const subtotal = sports.length * PRICE_PER_SPORT * 100; // Convert to paise

    // Apply promo code if provided
    let discount = 0;
    let appliedCoupon = null;

    if (promoCode) {
      const coupon = await db.coupon.findUnique({
        where: { 
          couponCode: promoCode.toUpperCase(),
          status: 'ACTIVE',
        },
      });

      if (coupon) {
        // Check if coupon is applicable
        const now = new Date();
        const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < now;
        const isUsageLimitReached = coupon.usageLimit && coupon.usageCount >= coupon.usageLimit;

        if (!isExpired && !isUsageLimitReached) {
          // Calculate discount
          if (coupon.discountType === 'PERCENTAGE') {
            discount = Math.floor((subtotal * coupon.discountValue) / 100);
            if (coupon.maxDiscountLimit) {
              discount = Math.min(discount, coupon.maxDiscountLimit * 100);
            }
          } else if (coupon.discountType === 'FIXED') {
            discount = coupon.discountValue * 100;
          }

          appliedCoupon = coupon;
        }
      }
    }

    const totalAmount = Math.max(0, subtotal - discount);

    // Verify the amount matches what client sent (for integrity)
    if (amount && Math.abs(amount - totalAmount) > 100) { // Allow small rounding differences
      console.warn('Amount mismatch', { clientAmount: amount, serverAmount: totalAmount });
    }

    // Create Razorpay order
    const receipt = `SUB_${org.id.slice(0, 8)}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    const order = await createRazorpayOrder({
      amount: totalAmount,
      receipt,
      notes: {
        type: 'MULTI_SPORT_SUBSCRIPTION',
        orgId: org.id,
        orgName: org.name,
        sports: sports.join(','),
        promoCode: promoCode || '',
        subtotal: subtotal.toString(),
        discount: discount.toString(),
      },
    });

    // Create payment ledger entry
    const paymentLedger = await db.paymentLedger.create({
      data: {
        orgId: org.id,
        sport: sports[0] as SportType, // Primary sport for ledger
        amount: totalAmount,
        type: 'ORG_SUBSCRIPTION',
        status: 'INITIATED',
        razorpayId: order.id,
        description: `Subscription for ${sports.length} sport(s): ${sports.join(', ')}`,
      },
    });

    // Store checkout details temporarily (will be processed after payment)
    // We'll use the payment ledger ID to track this
    await db.paymentLedger.update({
      where: { id: paymentLedger.id },
      data: {
        description: JSON.stringify({
          type: 'MULTI_SPORT_SUBSCRIPTION',
          sports,
          promoCode: promoCode || null,
          couponId: appliedCoupon?.id || null,
          subtotal,
          discount,
          total: totalAmount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentLedgerId: paymentLedger.id,
      amount: totalAmount,
      amountDisplay: formatAmount(totalAmount),
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      sports,
      subtotal,
      discount,
      payer: {
        name: org.name,
        email: org.email,
        phone: org.phone,
      },
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout order' },
      { status: 500 }
    );
  }
}
