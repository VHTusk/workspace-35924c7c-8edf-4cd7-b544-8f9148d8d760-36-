import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Tournament Series [id] API
 * 
 * GET: Get series details with standings
 * PUT: Update series
 * DELETE: Delete series (if no tournaments)
 */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const series = await db.tournamentSeries.findUnique({
      where: { id },
      include: {
        org: { select: { id: true, name: true } },
        tournaments: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            seriesPoints: true,
          },
          orderBy: { startDate: 'asc' }
        },
        templates: true,
        standings: {
          orderBy: [
            { rank: 'asc' },
            { totalPoints: 'desc' }
          ],
        },
      },
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // Get player details for standings
    const standingsWithPlayers = await Promise.all(series.standings.map(async (standing) => {
      let playerName = 'Unknown';
      if (standing.userId) {
        const user = await db.user.findUnique({
          where: { id: standing.userId },
          select: { firstName: true, lastName: true, hiddenElo: true }
        });
        if (user) {
          playerName = `${user.firstName} ${user.lastName}`;
        }
      } else if (standing.teamId) {
        const team = await db.team.findUnique({
          where: { id: standing.teamId },
          select: { name: true }
        });
        if (team) {
          playerName = team.name;
        }
      }
      
      return {
        ...standing,
        playerName,
        tournamentBreakdown: standing.tournamentBreakdown ? JSON.parse(standing.tournamentBreakdown) : [],
      };
    }));

    return NextResponse.json({ 
      series: {
        ...series,
        standings: standingsWithPlayers,
      }
    });
  } catch (error) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existingSeries = await db.tournamentSeries.findUnique({
      where: { id },
      select: { orgId: true }
    });

    if (!existingSeries || existingSeries.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const {
      name,
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
      status,
      isPublic,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (seriesType !== undefined) updateData.seriesType = seriesType;
    if (scoringSystem !== undefined) updateData.scoringSystem = scoringSystem;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (registrationDeadline !== undefined) updateData.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
    if (participationPoints !== undefined) updateData.participationPoints = participationPoints;
    if (winPoints !== undefined) updateData.winPoints = winPoints;
    if (placementPoints !== undefined) updateData.placementPoints = placementPoints;
    if (maxTournamentsCounted !== undefined) updateData.maxTournamentsCounted = maxTournamentsCounted;
    if (totalPrizePool !== undefined) updateData.totalPrizePool = totalPrizePool;
    if (prizeDistribution !== undefined) updateData.prizeDistribution = prizeDistribution;
    if (status !== undefined) updateData.status = status;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const series = await db.tournamentSeries.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ series });
  } catch (error) {
    console.error('Error updating series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Verify ownership and no tournaments
    const existingSeries = await db.tournamentSeries.findUnique({
      where: { id },
      include: { tournaments: true }
    });

    if (!existingSeries || existingSeries.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (existingSeries.tournaments.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete series with tournaments. Remove tournaments first.' 
      }, { status: 400 });
    }

    await db.tournamentSeries.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
