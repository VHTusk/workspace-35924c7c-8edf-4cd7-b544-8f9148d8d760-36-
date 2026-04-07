import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { SportType } from '@prisma/client';

// GET /api/player/skill-metrics - Get player skill metrics for radar chart
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    // Get sport from query parameter, fallback to user's sport
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get("sport");
    const sport = (sportParam?.toUpperCase() as SportType) || user.sport;

    // Get or create skill metrics using composite unique constraint
    let skillMetrics = await db.playerSkillMetrics.findUnique({
      where: { userId_sport: { userId: user.id, sport } },
    });

    if (!skillMetrics) {
      // Calculate initial skill metrics from match history (filtered by sport)
      const matches = await db.match.findMany({
        where: {
          OR: [
            { playerAId: user.id },
            { playerBId: user.id },
          ],
          sport,
        },
        orderBy: { playedAt: 'desc' },
        take: 50,
      });

      // Calculate metrics based on match history
      let wins = 0;
      const totalMatches = matches.length;
      
      matches.forEach(match => {
        if (match.winnerId === user.id) wins++;
      });

      const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 50;
      
      // Calculate skill metrics deterministically based on performance
      // No random values - all derived from actual match data
      const baseMetrics = {
        accuracy: Math.min(100, Math.max(0, Math.round(40 + winRate * 0.3))),
        consistency: Math.min(100, Math.max(0, Math.round(35 + winRate * 0.35))),
        clutch: Math.min(100, Math.max(0, Math.round(30 + winRate * 0.4))),
        endurance: Math.min(100, Math.max(0, Math.round(45 + totalMatches * 0.5))),
        strategy: Math.min(100, Math.max(0, Math.round(40 + winRate * 0.25))),
        teamwork: Math.min(100, Math.max(0, 50)), // Default for individual sports
      };
      
      skillMetrics = await db.playerSkillMetrics.create({
        data: {
          userId: user.id,
          sport,
          accuracy: baseMetrics.accuracy,
          consistency: baseMetrics.consistency,
          clutch: baseMetrics.clutch,
          endurance: baseMetrics.endurance,
          strategy: baseMetrics.strategy,
          teamwork: baseMetrics.teamwork,
          matchesAnalyzed: totalMatches,
        },
      });
    }

    // Get streak information using composite unique constraint
    let streak = await db.playerStreak.findUnique({
      where: { userId_sport: { userId: user.id, sport } },
    });

    if (!streak) {
      // Calculate streak from match history (filtered by sport)
      const matches = await db.match.findMany({
        where: {
          OR: [
            { playerAId: user.id },
            { playerBId: user.id },
          ],
          winnerId: { not: null },
          sport,
        },
        orderBy: { playedAt: 'desc' },
        take: 50,
      });

      let currentWinStreak = 0;
      let bestWinStreak = 0;
      let tempStreak = 0;
      let streakStartedAt: Date | null = null;

      for (const match of matches) {
        if (match.winnerId === user.id) {
          tempStreak++;
          if (currentWinStreak === 0) {
            streakStartedAt = match.playedAt;
          }
          currentWinStreak++;
        } else {
          if (tempStreak > bestWinStreak) {
            bestWinStreak = tempStreak;
          }
          tempStreak = 0;
          if (currentWinStreak > 0) {
            break; // Streak ended
          }
        }
      }

      if (tempStreak > bestWinStreak) {
        bestWinStreak = tempStreak;
      }

      streak = await db.playerStreak.create({
        data: {
          userId: user.id,
          sport,
          currentWinStreak,
          bestWinStreak: Math.max(bestWinStreak, currentWinStreak),
          streakStartedAt,
          lastMatchAt: matches[0]?.playedAt,
        },
      });
    }

    return NextResponse.json({
      skillMetrics: {
        accuracy: skillMetrics.accuracy,
        consistency: skillMetrics.consistency,
        clutch: skillMetrics.clutch,
        endurance: skillMetrics.endurance,
        strategy: skillMetrics.strategy,
        teamwork: skillMetrics.teamwork,
        matchesAnalyzed: skillMetrics.matchesAnalyzed,
        lastCalculated: skillMetrics.lastCalculated,
      },
      streak: {
        currentWinStreak: streak.currentWinStreak,
        bestWinStreak: streak.bestWinStreak,
        currentMatchStreak: streak.currentMatchStreak,
        bestMatchStreak: streak.bestMatchStreak,
        streakStartedAt: streak.streakStartedAt,
      },
    });
  } catch (error) {
    console.error('Get skill metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/player/skill-metrics - Recalculate skill metrics
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    // Get sport from query parameter, fallback to user's sport
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get("sport");
    const sport = (sportParam?.toUpperCase() as SportType) || user.sport;

    // Get all matches for this player (filtered by sport)
    const matches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: user.id },
          { playerBId: user.id },
        ],
        sport,
      },
      orderBy: { playedAt: 'desc' },
    });

    if (matches.length === 0) {
      return NextResponse.json({
        message: 'No matches to analyze',
        skillMetrics: null,
      });
    }

    // Calculate metrics
    let wins = 0;
    const recentMatches = matches.slice(0, 20); // Last 20 matches
    
    recentMatches.forEach(match => {
      if (match.winnerId === user.id) wins++;
    });

    const winRate = (wins / recentMatches.length) * 100;
    
    // Calculate more sophisticated metrics
    const accuracy = Math.min(100, Math.max(0, Math.round(40 + winRate * 0.3)));
    const consistency = Math.min(100, Math.max(0, Math.round(35 + winRate * 0.35)));
    const clutch = Math.min(100, Math.max(0, Math.round(30 + winRate * 0.4)));
    const endurance = Math.min(100, Math.max(0, Math.round(45 + matches.length * 0.3)));
    const strategy = Math.min(100, Math.max(0, Math.round(40 + winRate * 0.25)));
    const teamwork = Math.min(100, Math.max(0, 50)); // Default for individual sports

    // Update or create skill metrics using composite unique constraint
    const skillMetrics = await db.playerSkillMetrics.upsert({
      where: { userId_sport: { userId: user.id, sport } },
      update: {
        accuracy,
        consistency,
        clutch,
        endurance,
        strategy,
        teamwork,
        matchesAnalyzed: matches.length,
        lastCalculated: new Date(),
      },
      create: {
        userId: user.id,
        sport,
        accuracy,
        consistency,
        clutch,
        endurance,
        strategy,
        teamwork,
        matchesAnalyzed: matches.length,
      },
    });

    return NextResponse.json({
      message: 'Skill metrics recalculated',
      skillMetrics: {
        accuracy: skillMetrics.accuracy,
        consistency: skillMetrics.consistency,
        clutch: skillMetrics.clutch,
        endurance: skillMetrics.endurance,
        strategy: skillMetrics.strategy,
        teamwork: skillMetrics.teamwork,
        matchesAnalyzed: skillMetrics.matchesAnalyzed,
      },
    });
  } catch (error) {
    console.error('Recalculate skill metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
