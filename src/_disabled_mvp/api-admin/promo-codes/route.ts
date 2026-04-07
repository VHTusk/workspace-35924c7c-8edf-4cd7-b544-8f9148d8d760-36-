/**
 * Admin Promo Codes API
 * 
 * GET: List all promo codes with filtering
 * POST: Create a new promo code
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPromoCodes, 
  createPromoCode, 
  getPromoCodeStats,
  updatePromoCode,
  deletePromoCode
} from '@/lib/promo-codes';
import { validateAdminSession } from '@/lib/auth';
import { PromoDiscountType, PromoApplicableTo, SportType } from '@prisma/client';
import { addVersionHeaders } from '@/lib/api-versioning';

// GET /api/admin/promo-codes - List promo codes
export async function GET(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Return stats if requested
    if (action === 'stats') {
      const stats = await getPromoCodeStats();
      const response = NextResponse.json({ success: true, data: stats });
      addVersionHeaders(response);
      return response;
    }

    // Parse filters
    const isActive = searchParams.get('isActive');
    const sport = searchParams.get('sport') as SportType | null;
    const applicableTo = searchParams.get('applicableTo') as PromoApplicableTo | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { promoCodes, total } = await getPromoCodes({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sport: sport || undefined,
      applicableTo: applicableTo || undefined,
      limit,
      offset,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        promoCodes: promoCodes.map(pc => ({
          ...pc,
          usageCount: pc._count.usages,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promo codes' },
      { status: 500 }
    );
  }
}

// POST /api/admin/promo-codes - Create a promo code
export async function POST(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      applicableTo,
      sport,
      minOrderValue,
      startsAt,
      expiresAt,
      maxUses,
      maxUsesPerUser,
    } = body;

    // Validation
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Promo code is required' },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, uppercase)
    const cleanCode = code.toUpperCase().trim();
    if (!/^[A-Z0-9]+$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, error: 'Promo code must contain only letters and numbers' },
        { status: 400 }
      );
    }

    if (cleanCode.length < 3 || cleanCode.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Promo code must be 3-20 characters' },
        { status: 400 }
      );
    }

    if (!discountType || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid discount type' },
        { status: 400 }
      );
    }

    if (typeof discountValue !== 'number' || discountValue <= 0) {
      return NextResponse.json(
        { success: false, error: 'Discount value must be a positive number' },
        { status: 400 }
      );
    }

    // For percentage, validate max 100%
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return NextResponse.json(
        { success: false, error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    if (!applicableTo || !['ALL', 'SUBSCRIPTION', 'TOURNAMENT_ENTRY'].includes(applicableTo)) {
      return NextResponse.json(
        { success: false, error: 'Invalid applicability' },
        { status: 400 }
      );
    }

    if (!startsAt || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Start and end dates are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(expiresAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Create the promo code
    const promoCode = await createPromoCode({
      code: cleanCode,
      description,
      discountType: discountType as PromoDiscountType,
      discountValue,
      maxDiscountAmount,
      applicableTo: applicableTo as PromoApplicableTo,
      sport: sport as SportType || undefined,
      minOrderValue,
      startsAt: startDate,
      expiresAt: endDate,
      maxUses,
      maxUsesPerUser,
      createdById: admin.id,
    });

    const response = NextResponse.json({
      success: true,
      data: promoCode,
      message: 'Promo code created successfully',
    });

    addVersionHeaders(response);
    return response;
  } catch (error: unknown) {
    console.error('Error creating promo code:', error);
    
    // Check for unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A promo code with this code already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create promo code' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/promo-codes - Update a promo code
export async function PUT(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Promo code ID is required' },
        { status: 400 }
      );
    }

    // Validate dates if provided
    if (updates.startsAt || updates.expiresAt) {
      const startDate = updates.startsAt ? new Date(updates.startsAt) : undefined;
      const endDate = updates.expiresAt ? new Date(updates.expiresAt) : undefined;

      if (startDate && isNaN(startDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid start date' },
          { status: 400 }
        );
      }

      if (endDate && isNaN(endDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid end date' },
          { status: 400 }
        );
      }
    }

    // Validate discount value if provided
    if (updates.discountValue !== undefined) {
      if (typeof updates.discountValue !== 'number' || updates.discountValue <= 0) {
        return NextResponse.json(
          { success: false, error: 'Discount value must be a positive number' },
          { status: 400 }
        );
      }
    }

    const promoCode = await updatePromoCode(id, updates);

    const response = NextResponse.json({
      success: true,
      data: promoCode,
      message: 'Promo code updated successfully',
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Error updating promo code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update promo code' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/promo-codes - Delete (deactivate) a promo code
export async function DELETE(request: NextRequest) {
  try {
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Promo code ID is required' },
        { status: 400 }
      );
    }

    await deletePromoCode(id);

    const response = NextResponse.json({
      success: true,
      message: 'Promo code deactivated successfully',
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete promo code' },
      { status: 500 }
    );
  }
}
