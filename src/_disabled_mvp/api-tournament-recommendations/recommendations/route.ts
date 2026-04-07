import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/tournaments/recommendations - Get personalized tournament recommendations
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const sport = user.sport;

    // Get user's skill level from their rating
    const userRating = await db.playerRating.findUnique({
      where: { userId_sport: { userId: user.id, sport } },
      select: { 
        matchesPlayed: true,
        wins: true,
        tournamentsPlayed: true,
      },
    });

    // Determine user's skill level based on experience
    const totalMatches = userRating?.matchesPlayed || 0;
    const winRate = userRating?.matchesPlayed 
      ? (userRating.wins || 0) / userRating.matchesPlayed 
      : 0;

    let skillLevel = 'Beginner';
    if (totalMatches > 50 && winRate > 0.6) {
      skillLevel = 'Advanced';
    } else if (totalMatches > 20 && winRate > 0.4) {
      skillLevel = 'Intermediate';
    } else if (totalMatches > 100 && winRate > 0.7) {
      skillLevel = 'Professional';
    }

    // Get tournaments that match user's criteria
    const tournaments = await db.tournament.findMany({
      where: {
        sport,
        status: 'REGISTRATION_OPEN',
        OR: [
          { skillLevel: skillLevel },
          { skillLevel: 'All' },
          { skillLevel: null },
        ],
        registrationEndDate: { gte: new Date() },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: limit * 2, // Get more to filter and rank
      select: {
        id: true,
        name: true,
        startDate: true,
        city: true,
        state: true,
        format: true,
        skillLevel: true,
        registrationFee: true,
        maxParticipants: true,
        currentParticipants: true,
      },
    });

    // Calculate match scores and reasons
    const recommendations = tournaments.map((t) => {
      let matchScore = 50;
      let reason = 'Open for registration';

      // Skill level match
      if (t.skillLevel === skillLevel) {
        matchScore += 30;
        reason = `Perfect for your ${skillLevel} level`;
      } else if (t.skillLevel === 'All' || !t.skillLevel) {
        matchScore += 20;
        reason = 'Open to all skill levels';
      }

      // Location match
      if (t.city === user.city || t.state === user.state) {
        matchScore += 15;
        reason = t.city === user.city 
          ? 'Tournament in your city!' 
          : 'Tournament in your state';
      }

      // Spots availability
      const spotsLeft = (t.maxParticipants || 0) - (t.currentParticipants || 0);
      if (spotsLeft < 10) {
        matchScore += 5;
        if (reason.includes('Perfect') || reason.includes('Open')) {
          reason += ' • Limited spots!';
        }
      }

      // Experience-based boost
      if (totalMatches < 10 && t.skillLevel === 'Beginner') {
        matchScore += 10;
        reason = 'Great for new players';
      } else if (totalMatches > 50 && t.skillLevel === 'Advanced') {
        matchScore += 10;
        reason = 'Challenging competition awaits';
      }

      return {
        id: t.id,
        name: t.name,
        date: t.startDate.toISOString(),
        city: t.city || 'TBD',
        state: t.state || '',
        format: t.format || 'Standard',
        skillLevel: t.skillLevel || 'All',
        registrationFee: t.registrationFee || 0,
        spotsLeft: Math.max(0, spotsLeft),
        matchScore: Math.min(100, matchScore),
        reason,
      };
    });

    // Sort by match score and take limit
    const sortedRecommendations = recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return NextResponse.json({
      recommendations: sortedRecommendations,
      userSkillLevel: skillLevel,
      basedOn: {
        matchesPlayed: totalMatches,
        winRate: Math.round(winRate * 100),
      },
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
