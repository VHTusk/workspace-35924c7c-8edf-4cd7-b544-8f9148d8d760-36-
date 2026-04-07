import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

/**
 * Tournament Series API
 * 
 * Manages tournament series/seasons that link multiple tournaments together
 * with cumulative points and standings.
 */

// GET - List all series for the organization
export async function GET(request: NextRequest) {
  try {
    const cookieStore = request.cookies;
    const orgSessionToken = cookieStore.get('session_token')?.value;

    if (!orgSessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(orgSessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const status = searchParams.get('status');

    const where: any = { orgId: session.orgId };
    if (sport) where.sport = sport;
    if (status) where.status = status;

    const series = await db.tournamentSeries.findMany({
      where,
      include: {
        tournaments: {
          select: { id: true, name: true, startDate: true, status: true }
        },
        standings: {
          take: 10,
          orderBy: { totalPoints: 'desc' },
          include: {
            series: { select: { sport: true } }
          }
        },
        templates: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get player names for standings
    const seriesWithPlayerNames = await Promise.all(series.map(async (s) => {
      const standingsWithNames = await Promise.all(s.standings.map(async (standing) => {
        if (standing.userId) {
          const user = await db.user.findUnique({
            where: { id: standing.userId },
            select: { firstName: true, lastName: true }
          });
          return { ...standing, playerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown' };
        }
        return standing;
      }));
      return { ...s, standings: standingsWithNames };
    }));

    return NextResponse.json({ series: seriesWithPlayerNames });
  } catch (error) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new tournament series
export async function POST(request: NextRequest) {
  try {
    const cookieStore = request.cookies;
    const orgSessionToken = cookieStore.get('session_token')?.value;

    if (!orgSessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(orgSessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      sport,
      description,
      seriesType,
      scoringSystem,
      startDate,
      endDate,
      registrationDeadline,
      participationPoints,
      winPoints,
      placementPoints,
      maxTournamentsCounted,
      totalPrizePool,
      prizeDistribution,
      isPublic,
    } = body;

    const series = await db.tournamentSeries.create({
      data: {
        orgId: session.orgId,
        name,
        sport,
        description,
        seriesType: seriesType || 'SEASON',
        scoringSystem: scoringSystem || 'POINTS',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        participationPoints: participationPoints || 1,
        winPoints: winPoints || 3,
        placementPoints,
        maxTournamentsCounted,
        totalPrizePool,
        prizeDistribution,
        isPublic: isPublic ?? true,
        status: 'UPCOMING',
      }
    });

    return NextResponse.json({ series }, { status: 201 });
  } catch (error) {
    console.error('Error creating series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
