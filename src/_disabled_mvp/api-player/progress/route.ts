import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getSessionUser } from '@/lib/session-helpers';
import { logRoute } from '@/lib/api-utils';

/**
 * GET /api/player/progress
 * 
 * Get player progress data including:
 * - Win streaks (current, longest)
 * - Skill metrics for radar chart
 * - Recent form
 * - Tournament performance
 */
export async function GET(request: NextRequest) {
  const done = logRoute('GET /api/player/progress', request);
  
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;
    const userId = searchParams.get('userId');

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      done();
      return NextResponse.json({ error: 'Valid sport parameter required' }, { status: 400 });
    }

    // Get current user from session using canonical helper (no recursive fetch)
    let targetUserId = userId;

    if (!targetUserId) {
      const authResult = await getSessionUser(request);
      if (authResult.success) {
        targetUserId = authResult.userId;
      }
    }

    if (!targetUserId) {
      done();
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get or create player progress
    let progress = await db.playerProgress.findUnique({
      where: { userId: targetUserId },
    });

    if (!progress) {
      // Calculate initial progress from existing data
      progress = await calculatePlayerProgress(targetUserId, sport);
    }

    // Get recent matches for form calculation
    const recentMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: targetUserId },
          { playerBId: targetUserId },
        ],
        sport,
        winnerId: { not: null },
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
    });

    // Calculate recent results
    const recentResults = recentMatches.map(m => {
      const won = m.winnerId === targetUserId;
      return won ? 'W' : 'L';
    });

    const response = NextResponse.json({
      success: true,
      progress: {
        ...progress,
        recentResults,
        skillMetrics: {
          attack: progress.attackSkill,
          defense: progress.defenseSkill,
          consistency: progress.consistency,
          clutch: progress.clutchFactor,
          endurance: progress.endurance,
          versatility: progress.versatility,
        },
      },
    });
    
    done();
    return response;

  } catch (error) {
    console.error('Error fetching player progress:', error);
    done();
    return NextResponse.json(
      { error: 'Failed to fetch player progress' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/player/progress
 * 
 * Recalculate player progress (triggered after match completion)
 */
export async function POST(request: NextRequest) {
  const done = logRoute('POST /api/player/progress', request);
  
  try {
    const body = await request.json();
    const { userId, sport } = body;

    if (!userId || !sport) {
      done();
      return NextResponse.json({ error: 'userId and sport required' }, { status: 400 });
    }

    const progress = await calculatePlayerProgress(userId, sport);

    const response = NextResponse.json({
      success: true,
      progress,
    });
    
    done();
    return response;

  } catch (error) {
    console.error('Error recalculating player progress:', error);
    done();
    return NextResponse.json(
      { error: 'Failed to recalculate player progress' },
      { status: 500 }
    );
  }
}

/**
 * Calculate player progress from match history
 */
async function calculatePlayerProgress(userId: string, sport: SportType) {
  // Get all matches
  const matches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: userId },
        { playerBId: userId },
      ],
      sport,
      winnerId: { not: null },
    },
    orderBy: { playedAt: 'asc' },
  });

  // Get tournament results
  const tournamentResults = await db.tournamentResult.findMany({
    where: { userId, sport },
  });

  // Calculate streaks
  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let currentLossStreak = 0;
  let tempStreak = 0;

  for (const match of matches.reverse()) { // Most recent first
    const won = match.winnerId === userId;
    if (won) {
      tempStreak++;
      currentLossStreak = 0;
      if (tempStreak > longestWinStreak) {
        longestWinStreak = tempStreak;
      }
    } else {
      if (tempStreak > 0) {
        currentWinStreak = 0;
      }
      currentLossStreak++;
      tempStreak = 0;
    }
  }
  currentWinStreak = tempStreak;

  // Calculate win rate
  const wins = matches.filter(m => m.winnerId === userId).length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? (wins / matches.length) * 100 : 0;

  // Calculate skill metrics (simplified - would be more sophisticated in production)
  const totalPoints = tournamentResults.reduce((sum, r) => sum + r.bonusPoints, 0);
  const avgPlacement = tournamentResults.length > 0
    ? tournamentResults.reduce((sum, r) => sum + r.rank, 0) / tournamentResults.length
    : 0;
  const podiumFinishes = tournamentResults.filter(r => r.rank <= 3).length;

  // Calculate skill scores (0-100)
  const attackSkill = Math.min(100, 50 + (winRate * 0.3) + (longestWinStreak * 2));
  const defenseSkill = Math.min(100, 50 + ((100 - (losses / Math.max(1, matches.length)) * 100) * 0.3));
  const consistency = Math.min(100, 50 + (matches.length > 5 ? 20 : matches.length * 4) + (winRate * 0.2));
  const clutchFactor = Math.min(100, 50 + (podiumFinishes * 5)); // Based on podium finishes
  const endurance = Math.min(100, 50 + (tournamentResults.length * 3) + (avgPlacement < 5 ? 20 : 0));
  const versatility = Math.min(100, 50 + (matches.length * 0.5) + (tournamentResults.length * 2));

  // Upsert progress
  const progress = await db.playerProgress.upsert({
    where: { userId },
    create: {
      userId,
      sport,
      currentWinStreak,
      longestWinStreak,
      currentLossStreak,
      attackSkill,
      defenseSkill,
      consistency,
      clutchFactor,
      endurance,
      versatility,
      tournamentWinRate: winRate,
      avgPlacement,
      podiumRate: tournamentResults.length > 0 ? (podiumFinishes / tournamentResults.length) * 100 : 0,
      recentWins: wins,
      recentLosses: losses,
      recentWinRate: winRate,
      totalMatchesPlayed: matches.length,
      totalTournaments: tournamentResults.length,
      totalWins: wins,
      totalPodiums: podiumFinishes,
      totalPoints,
      calculatedAt: new Date(),
    },
    update: {
      currentWinStreak,
      longestWinStreak,
      currentLossStreak,
      attackSkill,
      defenseSkill,
      consistency,
      clutchFactor,
      endurance,
      versatility,
      tournamentWinRate: winRate,
      avgPlacement,
      podiumRate: tournamentResults.length > 0 ? (podiumFinishes / tournamentResults.length) * 100 : 0,
      recentWins: wins,
      recentLosses: losses,
      recentWinRate: winRate,
      totalMatchesPlayed: matches.length,
      totalTournaments: tournamentResults.length,
      totalWins: wins,
      totalPodiums: podiumFinishes,
      totalPoints,
      calculatedAt: new Date(),
    },
  });

  return progress;
}
