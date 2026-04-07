/**
 * Sponsorship Marketplace API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SPONSORSHIP_TIERS, createSponsorshipRequest, getAvailableSponsorships } from '@/lib/sponsorship';

// GET - List available sponsorships
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || undefined;
    const scope = searchParams.get('scope') || undefined;
    const minDate = searchParams.get('minDate') ? new Date(searchParams.get('minDate')!) : undefined;
    const maxDate = searchParams.get('maxDate') ? new Date(searchParams.get('maxDate')!) : undefined;

    const sponsorships = await getAvailableSponsorships({
      sport,
      scope,
      minDate,
      maxDate,
    });

    return NextResponse.json({
      success: true,
      data: {
        sponsorships,
        tiers: SPONSORSHIP_TIERS,
      },
    });
  } catch (error) {
    console.error('[Sponsorships API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sponsorships' },
      { status: 500 }
    );
  }
}

// POST - Create sponsorship request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentId, sponsorId, tier, amount, customBenefits } = body;

    if (!tournamentId || !sponsorId || !tier || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await createSponsorshipRequest({
      tournamentId,
      sponsorId,
      tier,
      amount,
      customBenefits,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { sponsorshipId: result.sponsorshipId },
    });
  } catch (error) {
    console.error('[Sponsorships API] Error creating sponsorship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sponsorship request' },
      { status: 500 }
    );
  }
}
