// API: Open Competitions
// GET /api/orgs/[id]/open-competitions - Get open competition participation data

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrgOpenCompetitions } from '@/lib/open-competitions-tracker';
import { SportType } from '@prisma/client';

// GET - Get open competitions data for organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as SportType || 'CORNHOLE';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate sport
    if (!['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Invalid sport. Must be CORNHOLE or DARTS' },
        { status: 400 }
      );
    }

    // Get organization type
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get open competitions data
    const openCompetitionsData = await getOrgOpenCompetitions(orgId, sport as SportType, { limit });

    return NextResponse.json(openCompetitionsData);
  } catch (error) {
    console.error('Get open competitions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch open competitions data' },
      { status: 500 }
    );
  }
}
