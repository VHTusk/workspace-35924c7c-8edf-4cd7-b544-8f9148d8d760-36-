import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

// Get dispute details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const dispute = await db.dispute.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // Get match details
    const match = await db.match.findUnique({
      where: { id: dispute.matchId },
      include: {
        playerA: {
          select: { id: true, firstName: true, lastName: true, email: true, hiddenElo: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true, email: true, hiddenElo: true },
        },
        tournament: {
          select: { id: true, name: true, sport: true },
        },
        history: {
          orderBy: { editedAt: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      dispute: {
        id: dispute.id,
        matchId: dispute.matchId,
        sport: dispute.sport,
        status: dispute.status,
        reason: dispute.reason,
        evidence: dispute.evidence,
        resolution: dispute.resolution,
        resolvedById: dispute.resolvedById,
        resolvedAt: dispute.resolvedAt,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        raisedBy: dispute.user,
      },
      match: match ? {
        id: match.id,
        tournament: match.tournament,
        playerA: match.playerA,
        playerB: match.playerB,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        winnerId: match.winnerId,
        outcome: match.outcome,
        playedAt: match.playedAt,
        verificationStatus: match.verificationStatus,
        editHistory: match.history,
      } : null,
    });
  } catch (error) {
    console.error('Get dispute error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
