/**
 * API Route: POST /api/admin/ratings/adjust
 * 
 * v3.39.0 Global Rating System - Admin Rating Adjustment
 * Allows admins to manually adjust a player's rating
 * 
 * Use cases:
 * - Verified pro players starting at higher rating
 * - Error correction
 * - Special circumstances
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminAdjustRating } from '@/lib/global-rating';
import { SportType } from '@prisma/client';
import { validateSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { playerId, newElo, reason, sport } = body;

    // Validation
    if (!playerId || typeof newElo !== 'number' || !reason || !sport) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, newElo, reason, sport' },
        { status: 400 }
      );
    }

    if (!['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Invalid sport - must be CORNHOLE or DARTS' },
        { status: 400 }
      );
    }

    if (newElo < 100 || newElo > 3000) {
      return NextResponse.json(
        { error: 'ELO must be between 100 and 3000' },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'Reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Verify player exists
    const player = await db.user.findFirst({
      where: {
        id: playerId,
        sport: sport as SportType,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        globalElo: true,
        isProvisional: true,
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found in specified sport' },
        { status: 404 }
      );
    }

    // Perform the adjustment
    const result = await adminAdjustRating({
      playerId,
      newElo,
      reason,
      adminId: session.userId,
      sport: sport as SportType,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to adjust rating' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rating adjusted successfully',
      data: {
        player: {
          id: player.id,
          name: `${player.firstName} ${player.lastName}`,
          previousElo: player.globalElo,
          newElo,
          wasProvisional: player.isProvisional,
        },
        adjustment: {
          by: session.userId,
          reason,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error in admin rating adjustment:', error);
    return NextResponse.json(
      { error: 'Failed to adjust rating' },
      { status: 500 }
    );
  }
}
