/**
 * API Route: GET /api/ratings/player/[id]
 * 
 * v3.39.0 Global Rating System - Player Rating Details
 * Returns detailed rating information for a player
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEloTier, getTierColor, CATEGORY_TIER_MAPPING, TIER_WEIGHTS } from '@/lib/global-rating';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as string;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Valid sport parameter required (CORNHOLE or DARTS)' },
        { status: 400 }
      );
    }

    const player = await db.user.findFirst({
      where: {
        id: playerId,
        sport: sport as any,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        globalElo: true,
        isProvisional: true,
        provisionalMatches: true,
        hiddenElo: true,
        visiblePoints: true,
        city: true,
        state: true,
        rating: {
          select: {
            matchesPlayed: true,
            wins: true,
            losses: true,
            highestElo: true,
            tournamentsPlayed: true,
            tournamentsWon: true,
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get rank in leaderboard
    const rank = await db.user.count({
      where: {
        sport: sport as any,
        isActive: true,
        globalElo: { gt: player.globalElo },
      },
    });

    // Get match history for rating trend (last 20 rated matches)
    const recentMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: playerId },
          { playerBId: playerId },
        ],
        sport: sport as any,
      },
      orderBy: { playedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        playedAt: true,
        scoreA: true,
        scoreB: true,
        winnerId: true,
        playerAId: true,
        playerBId: true,
        tournament: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    // Calculate rating history (simplified)
    let runningElo = player.globalElo;
    const ratingHistory = recentMatches.map(match => {
      const isPlayerA = match.playerAId === playerId;
      const won = match.winnerId === playerId;
      
      // Estimate previous ELO (simplified - would need actual stored values)
      const estimatedChange = won ? 15 : -15; // Rough estimate
      const previousElo = runningElo - (isPlayerA ? estimatedChange : -estimatedChange);
      runningElo = previousElo;

      return {
        matchId: match.id,
        date: match.playedAt,
        elo: runningElo,
        won,
        tournament: match.tournament?.name,
      };
    }).reverse();

    // Current tier info
    const tier = getEloTier(player.globalElo, player.isProvisional ? 0 : (player.rating?.matchesPlayed || 0));
    const tierColor = getTierColor(tier);

    // Calculate statistics
    const totalMatches = player.rating?.matchesPlayed || 0;
    const winRate = totalMatches > 0 
      ? ((player.rating?.wins || 0) / totalMatches * 100).toFixed(1)
      : '0.0';

    // Matches until ranked (if provisional)
    const matchesUntilRanked = player.isProvisional 
      ? Math.max(0, 10 - player.provisionalMatches)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        player: {
          id: player.id,
          name: `${player.firstName} ${player.lastName}`,
          city: player.city,
          state: player.state,
        },
        rating: {
          globalElo: Math.round(player.globalElo * 10) / 10,
          isProvisional: player.isProvisional,
          provisionalMatches: player.provisionalMatches,
          matchesUntilRanked,
          tier,
          tierColor,
          rank: rank + 1,
          // Legacy fields (still tracked)
          hiddenElo: Math.round(player.hiddenElo * 10) / 10,
          visiblePoints: player.visiblePoints,
        },
        stats: {
          matchesPlayed: totalMatches,
          wins: player.rating?.wins || 0,
          losses: player.rating?.losses || 0,
          winRate: `${winRate}%`,
          highestElo: Math.round((player.rating?.highestElo || 1500) * 10) / 10,
          tournamentsPlayed: player.rating?.tournamentsPlayed || 0,
          tournamentsWon: player.rating?.tournamentsWon || 0,
        },
        ratingHistory,
        categoryWeights: {
          explanation: 'Tournament categories affect rating changes. Higher tier = more impact.',
          tiers: Object.entries(TIER_WEIGHTS).map(([tier, weight]) => ({
            tier: parseInt(tier),
            weight,
            categories: Object.entries(CATEGORY_TIER_MAPPING)
              .filter(([_, t]) => t === parseInt(tier))
              .map(([cat]) => cat),
          })),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching player rating:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player rating' },
      { status: 500 }
    );
  }
}
