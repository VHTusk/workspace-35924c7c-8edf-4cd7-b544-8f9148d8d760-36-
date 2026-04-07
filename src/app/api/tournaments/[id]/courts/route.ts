/**
 * Court Management API (v3.47.0)
 * 
 * GET: List courts for tournament
 * POST: Create new court
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CourtStatus } from '@prisma/client';
import { checkAdminPermission } from '@/lib/admin-permissions';
import { getAuthenticatedAdmin } from '@/lib/auth';

// GET /api/tournaments/[id]/courts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    const courts = await db.court.findMany({
      where: { tournamentId },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get current assignments
    const currentAssignments = await db.courtAssignment.findMany({
      where: {
        courtId: { in: courts.map((c) => c.id) },
        releasedAt: null,
      },
      include: {
        match: {
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const assignmentMap = new Map(
      currentAssignments.map((a) => [a.courtId, a])
    );

    return NextResponse.json({
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        code: court.code,
        status: court.status,
        courtType: court.courtType,
        isPriority: court.isPriority,
        capacity: court.capacity,
        matchesHosted: court.matchesHosted,
        currentAssignment: assignmentMap.get(court.id)
          ? {
              matchId: assignmentMap.get(court.id)!.matchId,
              assignedAt: assignmentMap.get(court.id)!.assignedAt,
              players: assignmentMap.get(court.id)!.match
                ? [
                    assignmentMap.get(court.id)!.match.playerA,
                    assignmentMap.get(court.id)!.match.playerB,
                  ].filter(Boolean)
                : [],
            }
          : null,
      })),
      summary: {
        total: courts.length,
        available: courts.filter((c) => c.status === CourtStatus.AVAILABLE).length,
        occupied: courts.filter((c) => c.status === CourtStatus.OCCUPIED).length,
        maintenance: courts.filter((c) => c.status === CourtStatus.MAINTENANCE).length,
      },
    });
  } catch (error) {
    console.error('Error fetching courts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/courts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canEditTournament',
      { tournamentId }
    );

    if (!permCheck.granted) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, capacity, courtType, isPriority } = body;

    if (!name) {
      return NextResponse.json({ error: 'Court name is required' }, { status: 400 });
    }

    const court = await db.court.create({
      data: {
        tournamentId,
        name,
        code: code || name.substring(0, 3).toUpperCase(),
        capacity: capacity || 2,
        courtType,
        isPriority: isPriority || false,
      },
    });

    return NextResponse.json({
      success: true,
      court,
    });
  } catch (error) {
    console.error('Error creating court:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
