/**
 * VALORHIVE v3.42.0 - Tournament Player Stats API
 * Returns player statistics for tournament competition level
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEloTier } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const userElo = searchParams.get('userElo');

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { sport: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get all registered players with their ELO
    const registrations = await db.tournamentRegistration.findMany({
      where: {
        tournamentId,
        status: 'CONFIRMED',
      },
      include: {
        user: {
          select: {
            id: true,
            hiddenElo: true,
            rating: {
              select: { matchesPlayed: true },
            },
          },
        },
      },
    });

    const players = registrations.map((r) => ({
      id: r.user.id,
      elo: r.user.hiddenElo,
      matchCount: r.user.rating?.matchesPlayed || 0,
    }));

    // Calculate tier distribution
    const tierCounts: Record<string, { count: number; color: string }> = {
      DIAMOND: { count: 0, color: '#4169E1' },
      PLATINUM: { count: 0, color: '#008080' },
      GOLD: { count: 0, color: '#FFD700' },
      SILVER: { count: 0, color: '#C0C0C0' },
      BRONZE: { count: 0, color: '#CD7F32' },
      UNRANKED: { count: 0, color: '#9CA3AF' },
    };

    let totalElo = 0;
    let playerCount = 0;

    for (const player of players) {
      if (player.elo) {
        const tier = getEloTier(player.elo, player.matchCount);
        tierCounts[tier].count++;
        totalElo += player.elo;
        playerCount++;
      }
    }

    // Calculate similar ELO players (within ±200 points)
    let similarEloPlayers = 0;
    let userTier: string | null = null;

    if (userElo) {
      const userEloNum = parseInt(userElo, 10);
      similarEloPlayers = players.filter(
        (p) => p.elo && Math.abs(p.elo - userEloNum) <= 200
      ).length;
      
      // Get user's tier
      userTier = getEloTier(userEloNum, 30); // Assume 30+ matches for simplicity
    }

    // Filter out empty tiers and format
    const tierDistribution = Object.entries(tierCounts)
      .filter(([, data]) => data.count > 0)
      .map(([tier, data]) => ({
        tier,
        count: data.count,
        color: data.color,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: {
        similarEloPlayers,
        totalRegistrations: registrations.length,
        tierDistribution,
        averageElo: playerCount > 0 ? totalElo / playerCount : 0,
        userTier,
      },
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}
