/**
 * Promotional Code Library
 * 
 * Handles validation, calculation, and usage tracking for promo codes
 */

import { db } from '@/lib/db';
import { PromoDiscountType, PromoApplicableTo, PromoUsedFor, SportType } from '@prisma/client';

// ============================================
// Types
// ============================================

interface PromoCodeValidationResult {
  valid: boolean;
  error?: string;
  promoCode?: {
    id: string;
    code: string;
    discountType: PromoDiscountType;
    discountValue: number;
    maxDiscountAmount: number | null;
    minOrderValue: number;
  };
}

interface DiscountCalculation {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountApplied: boolean;
}

interface ApplyPromoCodeParams {
  code: string;
  userId?: string;
  orgId?: string;
  sport: SportType;
  usedFor: PromoUsedFor;
  referenceId: string;
  originalAmount: number;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate a promo code for use
 */
export async function validatePromoCode(
  code: string,
  params: {
    userId?: string;
    orgId?: string;
    sport: SportType;
    usedFor: PromoUsedFor;
    orderAmount: number;
  }
): Promise<PromoCodeValidationResult> {
  const { userId, orgId, sport, usedFor, orderAmount } = params;

  // Find the promo code
  const promoCode = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      usages: {
        where: userId 
          ? { userId } 
          : orgId 
            ? { orgId }
            : {},
      },
    },
  });

  if (!promoCode) {
    return { valid: false, error: 'Invalid promo code' };
  }

  // Check if active
  if (!promoCode.isActive) {
    return { valid: false, error: 'This promo code is no longer active' };
  }

  // Check validity dates
  const now = new Date();
  if (now < promoCode.startsAt) {
    return { valid: false, error: 'This promo code is not yet valid' };
  }
  if (now > promoCode.expiresAt) {
    return { valid: false, error: 'This promo code has expired' };
  }

  // Check sport applicability
  if (promoCode.sport && promoCode.sport !== sport) {
    return { valid: false, error: 'This promo code is not valid for this sport' };
  }

  // Check applicability
  if (promoCode.applicableTo !== PromoApplicableTo.ALL) {
    if (promoCode.applicableTo === PromoApplicableTo.SUBSCRIPTION && usedFor !== PromoUsedFor.SUBSCRIPTION) {
      return { valid: false, error: 'This promo code is only valid for subscriptions' };
    }
    if (promoCode.applicableTo === PromoApplicableTo.TOURNAMENT_ENTRY && usedFor !== PromoUsedFor.TOURNAMENT_ENTRY) {
      return { valid: false, error: 'This promo code is only valid for tournament registration' };
    }
  }

  // Check minimum order value
  if (orderAmount < promoCode.minOrderValue) {
    const minRupees = promoCode.minOrderValue / 100;
    return { valid: false, error: `Minimum order value of ₹${minRupees} required` };
  }

  // Check total usage limit
  if (promoCode.maxUses !== null && promoCode.currentUses >= promoCode.maxUses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  // Check per-user usage limit
  if (userId || orgId) {
    const userUsages = promoCode.usages.filter(u => 
      (userId && u.userId === userId) || (orgId && u.orgId === orgId)
    );
    if (userUsages.length >= promoCode.maxUsesPerUser) {
      return { valid: false, error: `You have already used this promo code ${promoCode.maxUsesPerUser} time(s)` };
    }
  }

  return {
    valid: true,
    promoCode: {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      maxDiscountAmount: promoCode.maxDiscountAmount,
      minOrderValue: promoCode.minOrderValue,
    },
  };
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  originalAmount: number,
  discountType: PromoDiscountType,
  discountValue: number,
  maxDiscountAmount: number | null
): DiscountCalculation {
  let discountAmount = 0;
  let maxDiscountApplied = false;

  if (discountType === PromoDiscountType.PERCENTAGE) {
    // Percentage discount
    discountAmount = Math.floor((originalAmount * discountValue) / 100);
    
    // Apply max discount cap if set
    if (maxDiscountAmount !== null && discountAmount > maxDiscountAmount) {
      discountAmount = maxDiscountAmount;
      maxDiscountApplied = true;
    }
  } else {
    // Fixed amount discount
    discountAmount = discountValue;
  }

  // Ensure discount doesn't exceed original amount
  if (discountAmount > originalAmount) {
    discountAmount = originalAmount;
  }

  const finalAmount = originalAmount - discountAmount;

  return {
    originalAmount,
    discountAmount,
    finalAmount,
    discountType,
    discountValue,
    maxDiscountApplied,
  };
}

/**
 * Apply and record promo code usage
 */
export async function applyPromoCode(params: ApplyPromoCodeParams): Promise<{
  success: boolean;
  error?: string;
  calculation?: DiscountCalculation;
  usageId?: string;
}> {
  const {
    code,
    userId,
    orgId,
    sport,
    usedFor,
    referenceId,
    originalAmount,
    ipAddress,
    userAgent,
  } = params;

  // Validate the promo code
  const validation = await validatePromoCode(code, {
    userId,
    orgId,
    sport,
    usedFor,
    orderAmount: originalAmount,
  });

  if (!validation.valid || !validation.promoCode) {
    return { success: false, error: validation.error };
  }

  const promoCode = validation.promoCode;

  // Calculate discount
  const calculation = calculateDiscount(
    originalAmount,
    promoCode.discountType,
    promoCode.discountValue,
    promoCode.maxDiscountAmount
  );

  try {
    // Create usage record and update usage count atomically
    const [usage] = await db.$transaction([
      db.promoCodeUsage.create({
        data: {
          promoCodeId: promoCode.id,
          code: promoCode.code,
          userId,
          orgId,
          sport,
          usedFor,
          referenceId,
          originalAmount: calculation.originalAmount,
          discountAmount: calculation.discountAmount,
          finalAmount: calculation.finalAmount,
          ipAddress,
          userAgent,
        },
      }),
      db.promoCode.update({
        where: { id: promoCode.id },
        data: { currentUses: { increment: 1 } },
      }),
    ]);

    return {
      success: true,
      calculation,
      usageId: usage.id,
    };
  } catch (error) {
    console.error('Error applying promo code:', error);
    return { success: false, error: 'Failed to apply promo code' };
  }
}

/**
 * Mark promo code usage as paid (after successful payment)
 */
export async function markPromoCodeUsagePaid(
  usageId: string,
  paymentId: string,
  razorpayId: string
): Promise<boolean> {
  try {
    await db.promoCodeUsage.update({
      where: { id: usageId },
      data: { paymentId, razorpayId },
    });
    return true;
  } catch (error) {
    console.error('Error marking promo code usage as paid:', error);
    return false;
  }
}

/**
 * Get promo code usage history for a user/org
 */
export async function getPromoCodeUsageHistory(params: {
  userId?: string;
  orgId?: string;
  limit?: number;
  offset?: number;
}) {
  const { userId, orgId, limit = 20, offset = 0 } = params;

  const where = userId 
    ? { userId } 
    : orgId 
      ? { orgId }
      : {};

  const [usages, total] = await Promise.all([
    db.promoCodeUsage.findMany({
      where,
      orderBy: { usedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.promoCodeUsage.count({ where }),
  ]);

  return { usages, total };
}

/**
 * Admin: Create a new promo code
 */
export async function createPromoCode(data: {
  code: string;
  description?: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  applicableTo: PromoApplicableTo;
  sport?: SportType;
  minOrderValue?: number;
  startsAt: Date;
  expiresAt: Date;
  maxUses?: number;
  maxUsesPerUser?: number;
  createdById?: string;
}) {
  return db.promoCode.create({
    data: {
      code: data.code.toUpperCase(),
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxDiscountAmount: data.maxDiscountAmount,
      applicableTo: data.applicableTo,
      sport: data.sport,
      minOrderValue: data.minOrderValue || 0,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      maxUses: data.maxUses,
      maxUsesPerUser: data.maxUsesPerUser || 1,
      createdById: data.createdById,
    },
  });
}

/**
 * Admin: Get all promo codes with filtering
 */
export async function getPromoCodes(params?: {
  isActive?: boolean;
  sport?: SportType;
  applicableTo?: PromoApplicableTo;
  limit?: number;
  offset?: number;
}) {
  const { isActive, sport, applicableTo, limit = 50, offset = 0 } = params || {};

  const where: Record<string, unknown> = {};
  if (isActive !== undefined) where.isActive = isActive;
  if (sport) where.sport = sport;
  if (applicableTo) where.applicableTo = applicableTo;

  const [promoCodes, total] = await Promise.all([
    db.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { usages: true },
        },
      },
    }),
    db.promoCode.count({ where }),
  ]);

  return { promoCodes, total };
}

/**
 * Admin: Update a promo code
 */
export async function updatePromoCode(
  id: string,
  data: Partial<{
    description: string;
    discountType: PromoDiscountType;
    discountValue: number;
    maxDiscountAmount: number;
    applicableTo: PromoApplicableTo;
    sport: SportType;
    minOrderValue: number;
    startsAt: Date;
    expiresAt: Date;
    maxUses: number;
    maxUsesPerUser: number;
    isActive: boolean;
  }>
) {
  return db.promoCode.update({
    where: { id },
    data,
  });
}

/**
 * Admin: Delete a promo code (soft delete by setting isActive = false)
 */
export async function deletePromoCode(id: string) {
  return db.promoCode.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Admin: Get promo code statistics
 */
export async function getPromoCodeStats() {
  const [totalCodes, activeCodes, totalUsages, totalDiscount] = await Promise.all([
    db.promoCode.count(),
    db.promoCode.count({ where: { isActive: true } }),
    db.promoCodeUsage.count(),
    db.promoCodeUsage.aggregate({
      _sum: { discountAmount: true },
    }),
  ]);

  // Get usage by type
  const subscriptionUsages = await db.promoCodeUsage.count({
    where: { usedFor: PromoUsedFor.SUBSCRIPTION },
  });
  const tournamentUsages = await db.promoCodeUsage.count({
    where: { usedFor: PromoUsedFor.TOURNAMENT_ENTRY },
  });

  // Get recent usages
  const recentUsages = await db.promoCodeUsage.findMany({
    take: 10,
    orderBy: { usedAt: 'desc' },
    include: {
      promoCode: {
        select: { code: true, discountType: true, discountValue: true },
      },
    },
  });

  return {
    totalCodes,
    activeCodes,
    totalUsages,
    totalDiscount: totalDiscount._sum.discountAmount || 0,
    usageByType: {
      subscription: subscriptionUsages,
      tournament: tournamentUsages,
    },
    recentUsages,
  };
}
