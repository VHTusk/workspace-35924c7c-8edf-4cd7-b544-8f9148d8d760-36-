import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType, CancellationReason } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { triggerTournamentCancellationNotification } from '@/lib/notification-triggers';
import { processTournamentRefunds } from '@/lib/refund-engine';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';

// Cancel tournament
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
    const { reason } = body;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status === TournamentStatus.COMPLETED || tournament.status === TournamentStatus.CANCELLED) {
      return NextResponse.json(
        { error: 'Cannot cancel completed or already cancelled tournament' },
        { status: 400 }
      );
    }

    // ============================================
    // Permission Check (using new admin permission system)
    // ============================================
    const permissionResult = await checkAdminPermission(
      user.id,
      'canCancelTournament' as PermissionKey,
      {
        sport: tournament.sport as SportType,
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

    // Update tournament status
    const updated = await db.tournament.update({
      where: { id },
      data: {
        status: TournamentStatus.CANCELLED,
      },
    });

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
        reason: reason || 'Cancelled by admin',
        metadata: JSON.stringify({
          name: tournament.name,
          registrationsCount: tournament._count.registrations,
        }),
      },
    });

    // Send notifications to registered players (non-blocking)
    let notificationError: string | null = null;
    try {
      await triggerTournamentCancellationNotification(
        tournament.id,
        tournament.name,
        tournament.sport as SportType,
        reason || 'Cancelled by admin'
      );
    } catch (notifyError) {
      console.error('Failed to send cancellation notifications:', notifyError);
      notificationError = notifyError instanceof Error ? notifyError.message : 'Unknown error';
    }

    // Process refunds for paid registrations (non-blocking)
    let refundResult = { success: true, totalJobs: 0, autoQueued: 0, pendingApproval: 0, errors: [] as string[] };
    try {
      refundResult = await processTournamentRefunds(
        tournament.id,
        CancellationReason.ORGANIZER_DECISION,
        user.id
      );
    } catch (refundError) {
      console.error('Failed to process refunds:', refundError);
      refundResult.errors.push(refundError instanceof Error ? refundError.message : 'Unknown refund error');
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
      notifications: {
        sent: !notificationError,
        error: notificationError,
      },
      refunds: {
        totalJobs: refundResult.totalJobs,
        autoQueued: refundResult.autoQueued,
        pendingApproval: refundResult.pendingApproval,
        errors: refundResult.errors.length > 0 ? refundResult.errors : undefined,
      },
    });
  } catch (error) {
    console.error('Cancel tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
