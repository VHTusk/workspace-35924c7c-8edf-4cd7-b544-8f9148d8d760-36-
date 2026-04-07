import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const sport = searchParams.get('sport') || 'CORNHOLE';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({ players: [] });
    }

    // Search for players by name
    const players = await db.user.findMany({
      where: {
        sport: sport as 'CORNHOLE' | 'DARTS',
        isActive: true,
        OR: [
          {
            firstName: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            lastName: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        visiblePoints: true,
        hiddenElo: true,
        city: true,
        state: true,
        sport: true,
        rating: {
          select: {
            matchesPlayed: true,
            wins: true
          }
        }
      },
      take: limit,
      orderBy: {
        visiblePoints: 'desc'
      }
    });

    // Format response
    const formattedPlayers = players.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      visiblePoints: p.visiblePoints,
      hiddenElo: Math.round(p.hiddenElo),
      city: p.city,
      state: p.state,
      sport: p.sport,
      matchesPlayed: p.rating?.matchesPlayed || 0,
      wins: p.rating?.wins || 0
    }));

    return NextResponse.json({
      players: formattedPlayers,
      total: formattedPlayers.length
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
