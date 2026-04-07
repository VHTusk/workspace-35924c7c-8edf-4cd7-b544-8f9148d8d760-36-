import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, SportType } from '@prisma/client';
import { suspendUserIdentity, removeUserIdentitySuspension } from '@/lib/suspended-identity';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { getAuthenticatedDirector } from '@/lib/auth';
import { logAdminBanEvent, logAdminUnbanEvent } from '@/lib/audit-logger';
import { log } from '@/lib/logger';

import type { SportType as PrismaSportType } from '@prisma/client';

// Ban player
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user: adminUser, session } = auth;

    // Permission check using new admin permission system
    const { id } = await params;
    const player = await db.user.findUnique({ where: { id } });
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const permissionResult = await checkAdminPermission(
      adminUser.id,
      'canBanPlayer' as PermissionKey,
      {
        sport: player.sport as PrismaSportType,
        stateCode: player.state || undefined,
        districtName: player.district || undefined,
      }
    );

    if (!permissionResult.granted) {
      // Fall back to role-based check if permission system doesn't grant access
      if (adminUser.role !== Role.ADMIN) {
        return NextResponse.json({ 
          error: permissionResult.reason || 'Permission denied',
          escalationRequired: permissionResult.escalationRequired,
          escalateTo: permissionResult.escalateTo
        }, { status: 403 });
      }
    }

    const body = await request.json();
    const { reason, expiresAt } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for banning' },
        { status: 400 }
      );
    }

    if (!player.isActive) {
      return NextResponse.json(
        { error: 'Player is already deactivated' },
        { status: 400 }
      );
    }

    // Deactivate player
    const updated = await db.user.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason,
      },
    });

    // Delete all sessions
    await db.session.deleteMany({
      where: { userId: id },
    });

    // Add to suspended identities (cross-sport ban propagation)
    await suspendUserIdentity(
      player.email,
      player.phone,
      reason,
      adminUser.id,
      expiresAt ? new Date(expiresAt) : undefined
    );

    // Log audit using the new audit logger
    logAdminBanEvent(
      adminUser.id,
      adminUser.role as Role,
      player.sport as SportType,
      player.id,
      reason,
      request,
      {
        targetEmail: player.email || undefined,
        targetPhone: player.phone || undefined,
        expiresAt,
      }
    ).catch(err => log.error('Failed to log admin ban event', { error: err }));

    return NextResponse.json({
      success: true,
      player: {
        id: updated.id,
        isActive: updated.isActive,
        deactivationReason: updated.deactivationReason,
      },
    });
  } catch (error) {
    console.error('Ban player error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Unban player
export async function DELETE(
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

    const player = await db.user.findUnique({ where: { id } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Permission check using new admin permission system
    const permissionResult = await checkAdminPermission(
      user.id,
      'canBanPlayer' as PermissionKey,
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

    if (player.isActive) {
      return NextResponse.json(
        { error: 'Player is already active' },
        { status: 400 }
      );
    }

    // Reactivate player
    const updated = await db.user.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivationReason: null,
      },
    });

    // Remove from suspended identities (cross-sport ban removal)
    await removeUserIdentitySuspension(player.email, player.phone);

    // Log audit using the new audit logger
    logAdminUnbanEvent(
      user.id,
      user.role as Role,
      player.sport as SportType,
      player.id,
      request,
      {
        targetEmail: player.email || undefined,
      }
    ).catch(err => log.error('Failed to log admin unban event', { error: err }));

    return NextResponse.json({
      success: true,
      player: {
        id: updated.id,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('Unban player error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
