/**
 * Tournament Readiness Check API
 * GET /api/tournaments/[id]/readiness - Get readiness report
 * POST /api/tournaments/[id]/readiness - Run readiness check
 * 
 * v3.43.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { getTournamentReadiness, canStartTournament } from '@/lib/tournament-readiness';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get readiness report
    const report = await getTournamentReadiness(tournamentId);

    return NextResponse.json(report);

  } catch (error) {
    console.error('[Readiness API] GET error:', error);
    
    if (error instanceof Error && error.message === 'Tournament not found') {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admin or head director can run checks
    const isStaff = await db.tournamentStaff.findFirst({
      where: {
        tournamentId,
        userId: session.user.id,
        role: 'HEAD_DIRECTOR',
        isActive: true,
      },
    });

    if (session.user.role !== 'ADMIN' && !isStaff) {
      return NextResponse.json({ 
        error: 'Admin or Head Director access required' 
      }, { status: 403 });
    }

    // Run fresh readiness check
    const report = await getTournamentReadiness(tournamentId);

    // Update the checkedBy field
    await db.tournamentReadinessCheck.update({
      where: { tournamentId },
      data: { checkedBy: session.user.id },
    });

    return NextResponse.json({
      ...report,
      checkedBy: {
        id: session.user.id,
        name: `${session.user.firstName} ${session.user.lastName}`,
      },
    });

  } catch (error) {
    console.error('[Readiness API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
