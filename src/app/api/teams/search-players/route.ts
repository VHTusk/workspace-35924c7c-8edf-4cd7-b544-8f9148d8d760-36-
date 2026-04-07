import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';

// GET /api/teams/search-players - Search for players to invite as partners
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const sport = searchParams.get('sport') as SportType;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Valid sport parameter required' }, { status: 400 });
    }

    if (!query || query.length < 2) {
      return NextResponse.json({ players: [] });
    }

    // Get current user's info to check for existing teams
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { sport: true },
    });

    if (!currentUser || currentUser.sport !== sport) {
      return NextResponse.json({ error: 'Sport mismatch' }, { status: 400 });
    }

    // Search for players by name or email (SQLite is case-insensitive by default for contains)
    const players = await db.user.findMany({
      where: {
        sport: sport as SportType,
        isActive: true,
        id: { not: userId }, // Exclude current user
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        state: true,
        hiddenElo: true,
        visiblePoints: true,
        teamMemberships: {
          where: {
            team: {
              sport: sport as SportType,
              status: { in: ['PENDING', 'ACTIVE'] },
            },
          },
          select: {
            teamId: true,
          },
        },
        _count: {
          select: {
            matchesAsA: true,
            matchesAsB: true,
          },
        },
      },
      take: 10,
    });

    // Get player ratings for win/loss
    const playerIds = players.map(p => p.id);
    const ratings = await db.playerRating.findMany({
      where: {
        userId: { in: playerIds },
        sport: sport as SportType,
      },
      select: {
        userId: true,
        wins: true,
        losses: true,
        matchesPlayed: true,
      },
    });

    const ratingMap = new Map(ratings.map(r => [r.userId, r]));

    // Format results and check if already in a team
    const formattedPlayers = players.map(player => {
      const rating = ratingMap.get(player.id);
      const totalMatches = (player._count.matchesAsA + player._count.matchesAsB);
      const isInTeam = player.teamMemberships.length > 0;

      return {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        email: player.email,
        city: player.city,
        state: player.state,
        elo: Math.round(player.hiddenElo),
        points: player.visiblePoints,
        matchesPlayed: rating?.matchesPlayed || totalMatches,
        wins: rating?.wins || 0,
        losses: rating?.losses || 0,
        winRate: rating?.matchesPlayed 
          ? Math.round((rating.wins / rating.matchesPlayed) * 100) 
          : 0,
        isInTeam,
        canInvite: !isInTeam,
      };
    });

    return NextResponse.json({ players: formattedPlayers });
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
