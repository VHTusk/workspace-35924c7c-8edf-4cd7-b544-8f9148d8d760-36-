import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * GET - Get saved tournaments for spectator
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { user: sessionUser, session } = authResult;

    const savedTournaments = await db.savedTournament.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch tournament details
    const tournamentIds = savedTournaments.map(st => st.tournamentId);
    const tournaments = await db.tournament.findMany({
      where: { id: { in: tournamentIds } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        location: true,
        status: true,
      },
    });

    const tournamentMap = new Map(tournaments.map(t => [t.id, t]));

    const result = savedTournaments.map(st => ({
      id: st.id,
      tournamentId: st.tournamentId,
      createdAt: st.createdAt,
      tournament: tournamentMap.get(st.tournamentId) || null,
    })).filter(st => st.tournament !== null);

    return NextResponse.json({
      tournaments: result,
    });
  } catch (error) {
    console.error('Fetch saved tournaments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save/bookmark a tournament
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { user: sessionUser, session } = authResult;

    const body = await request.json();
    const { tournamentId } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // Check if tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Check if already saved
    const existing = await db.savedTournament.findUnique({
      where: {
        userId_tournamentId: {
          userId: sessionUser.id,
          tournamentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Tournament already saved' },
        { status: 400 }
      );
    }

    // Save tournament
    const saved = await db.savedTournament.create({
      data: {
        userId: sessionUser.id,
        tournamentId,
        sport: session.sport,
      },
    });

    return NextResponse.json({
      success: true,
      saved,
    });
  } catch (error) {
    console.error('Save tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Unsave/remove a tournament bookmark
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { user: sessionUser } = authResult;

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    await db.savedTournament.delete({
      where: {
        userId_tournamentId: {
          userId: sessionUser.id,
          tournamentId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tournament removed from saved list',
    });
  } catch (error) {
    console.error('Unsave tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
