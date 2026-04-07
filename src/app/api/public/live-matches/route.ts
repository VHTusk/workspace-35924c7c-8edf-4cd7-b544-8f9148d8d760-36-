import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/public/live-matches
 * Get live and recently completed matches for spectators
 * 
 * Query params: sport (required), limit?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'Valid sport parameter required (CORNHOLE or DARTS)' },
        { status: 400 }
      );
    }

    // Get live matches (matches in tournaments with IN_PROGRESS status)
    const liveMatches = await db.match.findMany({
      where: {
        sport: sport.toUpperCase() as 'CORNHOLE' | 'DARTS',
        tournament: {
          status: 'IN_PROGRESS',
        },
        outcome: null, // Not yet completed
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
        bracketMatch: {
          select: { roundNumber: true, matchNumber: true, courtAssignment: true },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: limit,
    });

    // Get recently completed matches (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const completedMatches = await db.match.findMany({
      where: {
        sport: sport.toUpperCase() as 'CORNHOLE' | 'DARTS',
        outcome: { not: null },
        updatedAt: { gte: oneHourAgo },
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
        bracketMatch: {
          select: { roundNumber: true, matchNumber: true, courtAssignment: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Transform matches
    const transformMatch = (
      match: (typeof liveMatches)[number] | (typeof completedMatches)[number],
      isLive: boolean,
    ) => ({
      id: match.id,
      tournamentId: match.tournament?.id ?? null,
      tournamentName: match.tournament?.name ?? 'Independent Match',
      sport: match.sport,
      roundNumber: match.bracketMatch?.roundNumber || 0,
      matchNumber: match.bracketMatch?.matchNumber || 0,
      playerA: {
        id: match.playerA?.id ?? null,
        name: [match.playerA?.firstName, match.playerA?.lastName].filter(Boolean).join(' ') || 'Unknown Player',
      },
      playerB: {
        id: match.playerB?.id ?? null,
        name: [match.playerB?.firstName, match.playerB?.lastName].filter(Boolean).join(' ') || 'Unknown Player',
      },
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: isLive ? 'LIVE' : 'COMPLETED',
      winnerId: match.winnerId,
      courtAssignment: match.bracketMatch?.courtAssignment ?? null,
      updatedAt: match.updatedAt.toISOString(),
    });

    const matches = [
      ...liveMatches.map((m) => transformMatch(m, true)),
      ...completedMatches.map((m) => transformMatch(m, false)),
    ];

    return NextResponse.json({
      success: true,
      matches,
      liveCount: liveMatches.length,
      completedCount: completedMatches.length,
      sport,
    });
  } catch (error) {
    console.error('Get live matches error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
