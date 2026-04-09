import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';
import { getEloTier } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(token);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const user = session.user;
    const currentSport = session.sport;

    // Get player rating
    const rating = await db.playerRating.findUnique({
      where: { userId: user.id },
    });

    // Get upcoming tournament registrations
    const upcomingRegistrations = await db.tournamentRegistration.findMany({
      where: {
        userId: user.id,
        status: 'CONFIRMED',
        tournament: {
          sport: currentSport,
          startDate: { gte: new Date() },
          status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
        },
      },
      include: {
        tournament: true,
      },
      take: 5,
      orderBy: { tournament: { startDate: 'asc' } },
    });

    // Get recent matches
    const recentMatches = await db.match.findMany({
      where: {
        sport: currentSport,
        OR: [
          { playerAId: user.id },
          { playerBId: user.id },
        ],
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
    });

    const formattedMatches = recentMatches.map((match) => {
      const isPlayerA = match.playerAId === user.id;
      const opponent = isPlayerA ? match.playerB : match.playerA;
      const userScore = isPlayerA ? match.scoreA : match.scoreB;
      const opponentScore = isPlayerA ? match.scoreB : match.scoreA;
      const won = match.winnerId === user.id;

      return {
        id: match.id,
        opponent: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'TBD',
        score: userScore !== null && opponentScore !== null ? `${userScore}-${opponentScore}` : null,
        result: won ? 'WIN' : 'LOSS',
        tournament: match.tournament?.name || 'Friendly',
        points: (isPlayerA ? match.pointsA : match.pointsB) || 0,
        playedAt: match.playedAt,
      };
    });

    // Get achievements (simplified - would need achievement model)
    const achievements = [
      { id: '1', title: 'First Win', description: 'Won your first match', earned: (rating?.wins || 0) > 0 },
      { id: '2', title: 'Hot Streak', description: 'Win 5 matches in a row', earned: (rating?.bestStreak || 0) >= 5 },
      { id: '3', title: 'Gold Tier', description: 'Reach Gold tier', earned: user.hiddenElo >= 1500 },
      { id: '4', title: 'Champion', description: 'Win a tournament', earned: (rating?.tournamentsWon || 0) > 0 },
    ];

    // Get subscription status
    const subscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        sport: currentSport,
        status: 'ACTIVE',
      },
      orderBy: { endDate: 'desc' },
    });

    const tier = getEloTier(user.hiddenElo, rating?.matchesPlayed || 0);
    const winRate = rating?.matchesPlayed 
      ? Math.round((rating.wins / rating.matchesPlayed) * 100) 
      : 0;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        city: user.city,
        state: user.state,
        sport: currentSport,
        tier,
        elo: Math.round(user.hiddenElo),
        points: user.visiblePoints,
        matches: rating?.matchesPlayed || 0,
        wins: rating?.wins || 0,
        losses: rating?.losses || 0,
        winRate,
        currentStreak: rating?.currentStreak || 0,
        bestStreak: rating?.bestStreak || 0,
        tournamentsPlayed: rating?.tournamentsPlayed || 0,
        tournamentsWon: rating?.tournamentsWon || 0,
      },
      subscription: subscription ? {
        status: subscription.status,
        expiresAt: subscription.endDate,
      } : null,
      upcomingMatches: upcomingRegistrations.map((r) => ({
        tournament: r.tournament.name,
        date: r.tournament.startDate,
      })),
      recentMatches: formattedMatches,
      achievements,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
