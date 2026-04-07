/**
 * Institution Packages API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createInstitutionPackage, getInstitutionPricingQuote, MINIMUM_PARTICIPANTS, MAXIMUM_PARTICIPANTS } from '@/lib/institution-package';

// GET - Get pricing quote or list packages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participants = searchParams.get('participants');

    if (participants) {
      const count = parseInt(participants, 10);
      const quote = getInstitutionPricingQuote(count);
      return NextResponse.json({
        success: true,
        data: quote,
      });
    }

    // Return package info
    return NextResponse.json({
      success: true,
      data: {
        minimumParticipants: MINIMUM_PARTICIPANTS,
        maximumParticipants: MAXIMUM_PARTICIPANTS,
        bulkPricingTiers: [
          { min: 10, max: 24, discount: "10%" },
          { min: 25, max: 49, discount: "15%" },
          { min: 50, max: 99, discount: "20%" },
          { min: 100, max: 199, discount: "25%" },
          { min: 200, max: 500, discount: "30%" },
        ],
      },
    });
  } catch (error) {
    console.error('[Institution Packages API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// POST - Create institution package
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      institutionName,
      institutionType,
      contactEmail,
      contactPhone,
      contactName,
      sport,
      participantCount,
      notes,
    } = body;

    // Validation
    if (!institutionName || !institutionType || !contactEmail || !contactPhone || !contactName || !sport || !participantCount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (participantCount < MINIMUM_PARTICIPANTS || participantCount > MAXIMUM_PARTICIPANTS) {
      return NextResponse.json(
        { success: false, error: `Participant count must be between ${MINIMUM_PARTICIPANTS} and ${MAXIMUM_PARTICIPANTS}` },
        { status: 400 }
      );
    }

    const result = await createInstitutionPackage({
      institutionName,
      institutionType,
      contactEmail,
      contactPhone,
      contactName,
      sport,
      participantCount,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.package,
    });
  } catch (error) {
    console.error('[Institution Packages API] Error creating package:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create package' },
      { status: 500 }
    );
  }
}
