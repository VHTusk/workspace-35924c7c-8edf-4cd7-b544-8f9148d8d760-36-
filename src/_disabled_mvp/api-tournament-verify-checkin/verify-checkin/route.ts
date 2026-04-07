/**
 * QR Code Check-in Verification API
 * POST /api/tournaments/[id]/verify-checkin - Verify and check in player via QR scan
 * Used by tournament directors scanning player QR codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { verifyAndCheckInPlayer } from '@/lib/tournament-qr';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { playerId, checkInToken } = body;

    if (!playerId || !checkInToken) {
      return NextResponse.json(
        { error: 'Player ID and check-in token are required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated (director or admin)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to check in players
    // Must be tournament director, org admin, or system admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, sport: true },
    });

    const isAuthorized =
      user?.role === 'ADMIN' ||
      user?.role === 'TOURNAMENT_DIRECTOR' ||
      user?.role === 'ORG_ADMIN';

    if (!isAuthorized) {
      // Check if user is assigned as director for this tournament
      const assignment = await db.tournamentStaff.findFirst({
        where: {
          tournamentId,
          userId: session.user.id,
          role: { in: ['DIRECTOR', 'CHECKIN_STAFF'] },
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: 'You are not authorized to check in players' },
          { status: 403 }
        );
      }
    }

    // Verify and process check-in
    const result = await verifyAndCheckInPlayer(
      tournamentId,
      playerId,
      checkInToken,
      session.user.id
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          status: result.status,
          message: result.message,
          player: result.player,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          status: result.status,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error verifying check-in:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get check-in stats for tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    // Verify user is authenticated
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get check-in stats
    const stats = await db.tournamentCheckin.groupBy({
      by: ['status'],
      where: { tournamentId },
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);
    const checkedIn = stats.find(s => s.status === 'CHECKED_IN')?._count || 0;
    const notCheckedIn = stats.find(s => s.status === 'NOT_CHECKED_IN')?._count || 0;
    const noShow = stats.find(s => s.status === 'NO_SHOW_CONFIRMED')?._count || 0;
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    // Get recent check-ins
    const recentCheckIns = await db.tournamentCheckin.findMany({
      where: {
        tournamentId,
        status: 'CHECKED_IN',
      },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { checkedInAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total,
          checkedIn,
          notCheckedIn,
          noShow,
          percentage,
        },
        recentCheckIns: recentCheckIns.map(c => ({
          id: c.id,
          player: {
            id: c.player.id,
            name: `${c.player.firstName} ${c.player.lastName}`,
          },
          checkedInAt: c.checkedInAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting check-in stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
