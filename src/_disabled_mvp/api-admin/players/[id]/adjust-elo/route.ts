import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, AuditAction, SportType } from '@prisma/client';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { getAuthenticatedDirector } from '@/lib/auth';

import type { SportType as PrismaSportType } from '@prisma/client';

// Adjust player ELO manually
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const { newElo, reason } = body;

    const player = await db.user.findUnique({
      where: { id },
      include: { rating: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Permission check using new admin permission system
    const permissionResult = await checkAdminPermission(
      user.id,
      'canAdjustElo' as PermissionKey,
      {
        sport: player.sport as PrismaSportType,
        stateCode: player.state || undefined,
        districtName: player.district || undefined,
      }
    );

    if (!permissionResult.granted) {
      // Fall back to role-based check if permission system doesn't grant access
      if (user.role !== Role.ADMIN) {
        return NextResponse.json({ 
          error: permissionResult.reason || 'Permission denied',
          escalationRequired: permissionResult.escalationRequired,
          escalateTo: permissionResult.escalateTo
        }, { status: 403 });
      }
    }

    if (newElo === undefined || newElo === null) {
      return NextResponse.json(
        { error: 'New ELO value is required' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for ELO adjustment' },
        { status: 400 }
      );
    }

    const newEloValue = parseFloat(newElo);
    if (isNaN(newEloValue) || newEloValue < 0 || newEloValue > 3000) {
      return NextResponse.json(
        { error: 'Invalid ELO value (must be between 0 and 3000)' },
        { status: 400 }
      );
    }

    const oldElo = player.hiddenElo;

    // Update ELO
    const updated = await db.user.update({
      where: { id },
      data: { hiddenElo: newEloValue },
    });

    // Update highest ELO if new is higher
    if (newEloValue > (player.rating?.highestElo || 1500)) {
      await db.playerRating.update({
        where: { userId: id },
        data: { highestElo: newEloValue },
      });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: player.sport as SportType,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'User',
        targetId: player.id,
        reason,
        metadata: JSON.stringify({
          action: 'ELO_ADJUSTMENT',
          oldElo,
          newElo: newEloValue,
          change: newEloValue - oldElo,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      player: {
        id: updated.id,
        oldElo: Math.round(oldElo),
        newElo: Math.round(updated.hiddenElo),
        change: Math.round(newEloValue - oldElo),
      },
    });
  } catch (error) {
    console.error('Adjust ELO error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
