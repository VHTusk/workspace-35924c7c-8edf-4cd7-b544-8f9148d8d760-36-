import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// GET - Get milestones for logged-in user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate session (properly hashes token before lookup)
    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const milestones = await db.milestone.findMany({
      where: { userId: session.user.id },
      orderBy: { earnedAt: 'desc' },
      take: limit
    });

    // Get user stats for milestone progress
    const userStats = await db.playerRating.findUnique({
      where: { userId: session.user.id }
    });

    // Define milestone definitions (these could come from a config)
    const milestoneDefinitions = [
      // Match milestones
      { category: 'matches', type: 'first_match', title: 'First Match', description: 'Play your first match', targetValue: 1, points: 10, icon: 'matches' },
      { category: 'matches', type: 'matches_10', title: 'Getting Started', description: 'Play 10 matches', targetValue: 10, points: 25, icon: 'matches' },
      { category: 'matches', type: 'matches_50', title: 'Regular Player', description: 'Play 50 matches', targetValue: 50, points: 50, icon: 'matches' },
      { category: 'matches', type: 'matches_100', title: 'Dedicated Player', description: 'Play 100 matches', targetValue: 100, points: 100, icon: 'matches' },
      
      // Win milestones
      { category: 'wins', type: 'first_win', title: 'First Victory', description: 'Win your first match', targetValue: 1, points: 15, icon: 'wins' },
      { category: 'wins', type: 'wins_10', title: 'Winning Streak', description: 'Win 10 matches', targetValue: 10, points: 50, icon: 'wins' },
      { category: 'wins', type: 'wins_25', title: 'Champion', description: 'Win 25 matches', targetValue: 25, points: 100, icon: 'wins' },
      { category: 'wins', type: 'wins_50', title: 'Dominant Force', description: 'Win 50 matches', targetValue: 50, points: 200, icon: 'wins' },
      
      // Tournament milestones
      { category: 'tournaments', type: 'first_tournament', title: 'Tournament Debut', description: 'Enter your first tournament', targetValue: 1, points: 20, icon: 'tournaments' },
      { category: 'tournaments', type: 'tournaments_5', title: 'Tournament Regular', description: 'Enter 5 tournaments', targetValue: 5, points: 50, icon: 'tournaments' },
      { category: 'tournaments', type: 'first_tournament_win', title: 'Tournament Champion', description: 'Win your first tournament', targetValue: 1, points: 100, icon: 'tournaments' },
      
      // Points milestones
      { category: 'points', type: 'points_100', title: 'Point Collector', description: 'Earn 100 points', targetValue: 100, points: 25, icon: 'points' },
      { category: 'points', type: 'points_500', title: 'Point Hunter', description: 'Earn 500 points', targetValue: 500, points: 75, icon: 'points' },
      { category: 'points', type: 'points_1000', title: 'Point Master', description: 'Earn 1000 points', targetValue: 1000, points: 150, icon: 'points' },
    ];

    // Get achieved milestone types
    const achievedTypes = new Set(milestones.map(m => m.type));

    // Calculate current values
    const currentValues = {
      matches: userStats?.matchesPlayed || 0,
      wins: userStats?.wins || 0,
      tournaments: userStats?.tournamentsPlayed || 0,
      points: session.user.visiblePoints || 0,
    };

    // Build milestone response with progress
    const milestoneGroups: { [key: string]: any[] } = {};
    let totalAchieved = 0;
    let totalPointsEarned = 0;

    milestoneDefinitions.forEach(def => {
      const achieved = milestones.find(m => m.type === def.type);
      const currentValue = currentValues[def.category as keyof typeof currentValues] || 0;
      
      if (!milestoneGroups[def.category]) {
        milestoneGroups[def.category] = [];
      }

      milestoneGroups[def.category].push({
        id: achieved?.id || `pending-${def.type}`,
        type: def.type,
        title: def.title,
        description: def.description,
        targetValue: def.targetValue,
        currentValue,
        points: def.points,
        achievedAt: achieved?.earnedAt || null,
        icon: def.icon,
      });

      if (achieved) {
        totalAchieved++;
        totalPointsEarned += def.points;
      }
    });

    return NextResponse.json({
      milestones: Object.entries(milestoneGroups).map(([category, milestones]) => ({
        category,
        milestones,
      })),
      stats: {
        total: milestoneDefinitions.length,
        achieved: totalAchieved,
        pointsEarned: totalPointsEarned,
      }
    });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a milestone (internal use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, orgId, sport, type, title, description, metadata } = body;

    const milestone = await db.milestone.create({
      data: {
        userId,
        orgId,
        sport,
        type,
        title,
        description,
        metadata
      }
    });

    return NextResponse.json({ milestone });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
