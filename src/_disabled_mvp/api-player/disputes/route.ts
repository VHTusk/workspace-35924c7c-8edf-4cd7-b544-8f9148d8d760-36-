import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { DisputeStatus } from '@prisma/client';

// 72-hour window for disputes (in milliseconds)
const DISPUTE_WINDOW_HOURS = 72;
const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;

// GET - Get player's disputes and disputable matches
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    const { searchParams } = new URL(request.url);
    const includeMatches = searchParams.get('includeMatches') === 'true';

    // Get player's disputes statistics
    const [
      totalDisputes,
      pendingDisputes,
      acceptedDisputes,
      rejectedDisputes,
      withdrawnDisputes,
      disputes,
    ] = await Promise.all([
      db.matchDispute.count({ where: { initiatedById: sessionUser.id } }),
      db.matchDispute.count({ 
        where: { initiatedById: sessionUser.id, status: DisputeStatus.PENDING } 
      }),
      db.matchDispute.count({ 
        where: { initiatedById: sessionUser.id, status: DisputeStatus.RESOLVED_ACCEPTED } 
      }),
      db.matchDispute.count({ 
        where: { initiatedById: sessionUser.id, status: DisputeStatus.RESOLVED_REJECTED } 
      }),
      db.matchDispute.count({ 
        where: { initiatedById: sessionUser.id, status: DisputeStatus.WITHDRAWN } 
      }),
      // Get recent disputes
      db.matchDispute.findMany({
        where: { initiatedById: sessionUser.id },
        include: {
          match: {
            include: {
              playerA: { select: { id: true, firstName: true, lastName: true } },
              playerB: { select: { id: true, firstName: true, lastName: true } },
              tournament: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    let disputableMatches: Array<{
      id: string;
      playedAt: Date;
      scoreA: number | null;
      scoreB: number | null;
      winnerId: string | null;
      outcome: string | null;
      opponent: { id: string; firstName: string; lastName: string } | null;
      tournament: { id: string; name: string } | null;
      timeRemaining: number;
      hasDispute: boolean;
    }> = [];

    // If requested, get matches that can be disputed
    if (includeMatches) {
      const disputeDeadline = new Date(Date.now() - DISPUTE_WINDOW_MS);

      // Get recent matches where user is player A or B
      const matches = await db.match.findMany({
        where: {
          OR: [
            { playerAId: sessionUser.id },
            { playerBId: sessionUser.id },
          ],
          playedAt: { gte: disputeDeadline },
          outcome: { not: 'BYE' }, // Can't dispute bye matches
        },
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
          tournament: { select: { id: true, name: true } },
          disputes: {
            where: { initiatedById: sessionUser.id },
            select: { id: true, status: true },
          },
        },
        orderBy: { playedAt: 'desc' },
        take: 50,
      });

      // Filter and format disputable matches
      disputableMatches = matches
        .filter(match => {
          // Check if already has a pending or under review dispute
          const hasActiveDispute = match.disputes.some(
            d => d.status === DisputeStatus.PENDING || d.status === DisputeStatus.UNDER_REVIEW
          );
          return !hasActiveDispute;
        })
        .map(match => {
          const isPlayerA = match.playerAId === sessionUser.id;
          const opponent = isPlayerA ? match.playerB : match.playerA;
          const timeRemaining = Math.max(
            0,
            match.playedAt.getTime() + DISPUTE_WINDOW_MS - Date.now()
          );

          return {
            id: match.id,
            playedAt: match.playedAt,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            winnerId: match.winnerId,
            outcome: match.outcome,
            opponent: opponent ? {
              id: opponent.id,
              firstName: opponent.firstName,
              lastName: opponent.lastName,
            } : null,
            tournament: match.tournament ? {
              id: match.tournament.id,
              name: match.tournament.name,
            } : null,
            timeRemaining,
            hasDispute: match.disputes.length > 0,
          };
        });
    }

    // Format disputes for response
    const formattedDisputes = disputes.map(dispute => {
      const isPlayerA = dispute.match.playerAId === sessionUser.id;
      const opponent = isPlayerA ? dispute.match.playerB : dispute.match.playerA;

      return {
        id: dispute.id,
        matchId: dispute.matchId,
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        resolution: dispute.resolution,
        createdAt: dispute.createdAt,
        resolvedAt: dispute.resolvedAt,
        match: {
          opponent: opponent || { id: '', firstName: 'Unknown', lastName: '' },
          tournament: dispute.match.tournament,
          scoreA: dispute.match.scoreA,
          scoreB: dispute.match.scoreB,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        statistics: {
          total: totalDisputes,
          pending: pendingDisputes,
          accepted: acceptedDisputes,
          rejected: rejectedDisputes,
          withdrawn: withdrawnDisputes,
        },
        disputes: formattedDisputes,
        disputableMatches,
        disputeWindow: {
          hours: DISPUTE_WINDOW_HOURS,
          milliseconds: DISPUTE_WINDOW_MS,
        },
      },
    });
  } catch (error) {
    console.error('Fetch player disputes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
