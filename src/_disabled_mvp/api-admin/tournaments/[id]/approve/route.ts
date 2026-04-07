import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';

import type { SportType as PrismaSportType } from '@prisma/client';

// Admin approves an INTRA_ORG tournament
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
    const body = await request.json();
    const { approved, reason } = body;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        hostOrg: {
          select: { id: true, name: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // ============================================
    // Permission Check (using new admin permission system)
    // ============================================
    const permissionResult = await checkAdminPermission(
      user.id,
      'canApproveTournament' as PermissionKey,
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

    
    if (tournament.type !== 'INTRA_ORG') {
      return NextResponse.json(
        { error: 'Only INTRA_ORG tournaments require approval' },
        { status: 400 }
      );
    }

    if (tournament.status !== TournamentStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Tournament is not in DRAFT status' },
        { status: 400 }
      );
    }

    if (approved) {
      // Approve and publish tournament
      const updated = await db.tournament.update({
        where: { id },
        data: {
          status: TournamentStatus.REGISTRATION_OPEN,
          isPublic: true,
        },
      });

      // Create notification for the org
      if (tournament.hostOrg) {
        await db.tournamentAnnouncement.create({
          data: {
            tournamentId: tournament.id,
            title: 'Tournament Approved!',
            message: `Your intra-org tournament "${tournament.name}" has been approved and is now open for registration.`,
          },
        });
      }

      // Log audit
      await db.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Tournament',
          targetId: tournament.id,
          tournamentId: tournament.id,
          metadata: JSON.stringify({
            action: 'INTRA_ORG_APPROVED',
            name: tournament.name,
            orgName: tournament.hostOrg?.name,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        tournament: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          isPublic: updated.isPublic,
        },
        message: 'Tournament approved and published',
      });
    } else {
      // Reject tournament
      const updated = await db.tournament.update({
        where: { id },
        data: {
          status: TournamentStatus.CANCELLED,
        },
      });

      // Create notification for the org
      if (tournament.hostOrg) {
        await db.tournamentAnnouncement.create({
          data: {
            tournamentId: tournament.id,
            title: 'Tournament Not Approved',
            message: `Your intra-org tournament "${tournament.name}" was not approved. Reason: ${reason || 'Not specified'}`,
          },
        });
      }

      // Log audit
      await db.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.TOURNAMENT_CANCELLED,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Tournament',
          targetId: tournament.id,
          tournamentId: tournament.id,
          reason: reason || 'Not approved by admin',
          metadata: JSON.stringify({
            action: 'INTRA_ORG_REJECTED',
            name: tournament.name,
            orgName: tournament.hostOrg?.name,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        tournament: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
        },
        message: 'Tournament rejected',
      });
    }
  } catch (error) {
    console.error('Approve tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
