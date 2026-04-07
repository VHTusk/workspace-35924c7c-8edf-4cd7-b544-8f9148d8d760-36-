/**
 * Tournament Profession Rules API (v3.53.0)
 * 
 * GET - Fetch profession rules for a tournament
 * POST - Set profession rules (Creator/Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Profession } from '@prisma/client';
import { 
  getTournamentProfessionRules, 
  setTournamentProfessionRules,
  parseAllowedProfessions,
  formatAllowedProfessions,
} from '@/lib/tournament-profession-filter';
import { getAllProfessions, PROFESSION_LABELS } from '@/lib/profession-manager';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tournaments/[id]/profession-rules
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const rules = await getTournamentProfessionRules(id);

    return NextResponse.json({
      isProfessionExclusive: rules.isExclusive,
      allowedProfessions: rules.allowedProfessions.map(p => ({
        value: p,
        label: PROFESSION_LABELS[p],
      })),
      allowedProfessionsDisplay: formatAllowedProfessions(rules.allowedProfessions),
      availableProfessions: getAllProfessions().map(p => ({
        value: p,
        label: PROFESSION_LABELS[p],
      })),
    });
  } catch (error) {
    console.error('Error fetching profession rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profession rules' },
      { status: 500 }
    );
  }
}

// POST /api/tournaments/[id]/profession-rules
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { isExclusive, allowedProfessions } = body;

    // Verify tournament exists and user has permission
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Check permission - only creator or admin can set rules
    // For now, we'll allow the creator or check for admin role
    const isCreator = tournament.createdById === session.userId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'ORG_ADMIN';

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Validate input
    if (isExclusive && (!allowedProfessions || allowedProfessions.length === 0)) {
      return NextResponse.json(
        { error: 'At least one profession must be selected for exclusive tournaments' },
        { status: 400 }
      );
    }

    // Validate profession values
    const validProfessions: Profession[] = [];
    for (const p of (allowedProfessions || [])) {
      if (Object.values(Profession).includes(p)) {
        validProfessions.push(p);
      }
    }

    // Set rules
    const result = await setTournamentProfessionRules(id, {
      isExclusive: isExclusive || false,
      allowedProfessions: validProfessions,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isExclusive 
        ? 'Profession restrictions applied successfully' 
        : 'Profession restrictions removed',
      rules: {
        isExclusive: isExclusive || false,
        allowedProfessions: validProfessions.map(p => ({
          value: p,
          label: PROFESSION_LABELS[p],
        })),
      },
    });
  } catch (error) {
    console.error('Error setting profession rules:', error);
    return NextResponse.json(
      { error: 'Failed to set profession rules' },
      { status: 500 }
    );
  }
}
