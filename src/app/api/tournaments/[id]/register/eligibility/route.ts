/**
 * Tournament Registration Eligibility API (v3.53.0)
 * 
 * GET - Check if user is eligible to register for a profession-exclusive tournament
 * POST - Handle inline profession declaration during registration
 */

import { NextRequest, NextResponse } from 'next/server';
import { Profession } from '@prisma/client';
import { 
  validateRegistrationEligibility,
  handleInlineProfessionDeclaration,
} from '@/lib/registration-profession-check';
import { PROFESSION_LABELS } from '@/lib/profession-manager';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tournaments/[id]/register/eligibility
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized', requiresLogin: true },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    const eligibility = await validateRegistrationEligibility(session.userId, id);

    return NextResponse.json({
      canRegister: eligibility.canRegister,
      blockReason: eligibility.blockReason || null,
      requiresDeclaration: eligibility.requiresDeclaration,
      currentProfession: eligibility.currentProfession 
        ? {
            value: eligibility.currentProfession,
            label: PROFESSION_LABELS[eligibility.currentProfession],
          }
        : null,
      allowedProfessions: (eligibility.allowedProfessions || []).map(p => ({
        value: p,
        label: PROFESSION_LABELS[p],
      })),
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return NextResponse.json(
      { error: 'Failed to check eligibility' },
      { status: 500 }
    );
  }
}

// POST /api/tournaments/[id]/register/eligibility
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized', requiresLogin: true },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { profession } = body;

    // Validate profession
    if (!profession || !Object.values(Profession).includes(profession)) {
      return NextResponse.json(
        { error: 'Invalid profession selected' },
        { status: 400 }
      );
    }

    // Handle inline declaration
    const result = await handleInlineProfessionDeclaration(
      session.userId,
      id,
      profession as Profession
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profession declared successfully. You can now continue with registration.',
      profession: {
        value: result.profession,
        label: result.profession ? PROFESSION_LABELS[result.profession] : null,
      },
      eligibility: result.eligibility ? {
        canRegister: result.eligibility.canRegister,
        blockReason: result.eligibility.blockReason || null,
        requiresDeclaration: result.eligibility.requiresDeclaration,
      } : null,
      verificationNote: 'Note: To claim prizes, rankings, or official titles from this tournament, profession verification will be required later through document submission.',
    });
  } catch (error) {
    console.error('Error handling profession declaration:', error);
    return NextResponse.json(
      { error: 'Failed to process profession declaration' },
      { status: 500 }
    );
  }
}
