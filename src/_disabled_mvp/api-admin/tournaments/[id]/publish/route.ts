import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';

import type { SportType as PrismaSportType } from '@prisma/client';

// Publish tournament (make public and open registration)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // ============================================
    // Permission Check (using new admin permission system)
    // ============================================
    const permissionResult = await checkAdminPermission(
      user.id,
      'canPublishTournament' as PermissionKey,
      {
        sport: tournament.sport as PrismaSportType,
        tournamentId: tournament.id,
        stateCode: tournament.state || undefined,
        districtName: tournament.district || undefined,
      }
    );

    if (!permissionResult.granted) {
      // Fall back to role-based check if permission system doesn't grant access
      if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
        return NextResponse.json({ 
          error: permissionResult.reason || 'Permission denied',
          escalationRequired: permissionResult.escalationRequired,
          escalateTo: permissionResult.escalateTo
        }, { status: 403 });
      }
    }

    
    if (tournament.status !== TournamentStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Only draft tournaments can be published' },
        { status: 400 }
      );
    }

    // Update tournament status
    const updated = await db.tournament.update({
      where: { id },
      data: {
        status: TournamentStatus.REGISTRATION_OPEN,
        isPublic: true,
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport as SportType,
        action: AuditAction.TOURNAMENT_CANCELLED, // Using existing enum
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Tournament',
        targetId: tournament.id,
        tournamentId: tournament.id,
        metadata: JSON.stringify({ action: 'PUBLISHED', name: tournament.name }),
      },
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Publish tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
