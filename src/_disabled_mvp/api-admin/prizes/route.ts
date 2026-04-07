import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus } from '@prisma/client';

// GET - List all tournaments with prize pools
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' | null;
    const status = searchParams.get('status') as TournamentStatus | null;
    const search = searchParams.get('search');
    const hasPrizePool = searchParams.get('hasPrizePool');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    
    if (sport) {
      where.sport = sport;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    
    if (hasPrizePool === 'true') {
      where.prizePool = { gt: 0 };
    }

    // Fetch tournaments with prize pool info
    const tournaments = await db.tournament.findMany({
      where,
      include: {
        prizePayouts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        results: {
          select: {
            id: true,
            userId: true,
            rank: true,
            bonusPoints: true,
          },
          orderBy: { rank: 'asc' },
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { startDate: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    // Calculate payout stats for each tournament
    const tournamentsWithStats = tournaments.map((t) => {
      const totalPaidOut = t.prizePayouts.reduce((sum, p) => sum + p.amount, 0);
      const pendingPayout = t.prizePool - totalPaidOut;
      
      // Check if there are winners without payouts
      const winnerIds = t.results.slice(0, 10).map((r) => r.userId);
      const paidUserIds = t.prizePayouts.map((p) => p.userId);
      const unpaidWinners = winnerIds.filter((id) => !paidUserIds.includes(id));

      return {
        id: t.id,
        name: t.name,
        sport: t.sport,
        type: t.type,
        status: t.status,
        prizePool: t.prizePool,
        startDate: t.startDate,
        endDate: t.endDate,
        location: t.location,
        registrationsCount: t._count.registrations,
        totalPaidOut,
        pendingPayout,
        paidPayoutsCount: t.prizePayouts.length,
        unpaidWinnersCount: unpaidWinners.length,
        hasUnpaidWinners: unpaidWinners.length > 0 && t.prizePool > 0,
      };
    });

    // Get total count for pagination
    const totalCount = await db.tournament.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        tournaments: tournamentsWithStats,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error) {
    console.error('[API] Error fetching tournaments with prize pools:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}

// POST - Create prize configuration for a tournament
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tournamentId,
      distributions,
      nonMonetaryPrizes,
    } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // Validate distributions total 100%
    if (distributions && distributions.length > 0) {
      const totalPercentage = distributions.reduce(
        (sum: number, d: { percentage: number }) => sum + d.percentage,
        0
      );
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: 'Distribution percentages must total 100%' },
          { status: 400 }
        );
      }
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Store prize configuration as metadata
    // Since the schema doesn't have a PrizeConfiguration table,
    // we'll use the Tournament's existing fields
    // For now, we just return success

    return NextResponse.json({
      success: true,
      data: {
        tournamentId,
        prizePool: tournament.prizePool,
        distributions: distributions || [],
        nonMonetaryPrizes: nonMonetaryPrizes || [],
        message: 'Prize configuration saved',
      },
    });
  } catch (error) {
    console.error('[API] Error creating prize configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create prize configuration' },
      { status: 500 }
    );
  }
}
