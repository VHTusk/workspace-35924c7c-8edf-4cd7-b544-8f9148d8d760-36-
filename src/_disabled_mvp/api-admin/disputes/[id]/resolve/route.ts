import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, DisputeStatus, AuditAction, SportType, MatchVerificationStatus } from '@prisma/client';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { getAuthenticatedAdmin } from '@/lib/auth';

import type { SportType as PrismaSportType } from '@prisma/client';

// Resolve dispute
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { resolution, newScoreA, newScoreB, newWinnerId } = body;

    if (!resolution) {
      return NextResponse.json(
        { error: 'Resolution is required' },
        { status: 400 }
      );
    }

    const dispute = await db.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // Permission check using new admin permission system
    const permissionResult = await checkAdminPermission(
      user.id,
      'canResolveDisputes' as PermissionKey,
      {
        userId: user.id,
        sport: dispute.sport as PrismaSportType,
        tournamentId: dispute.matchId || undefined,
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

    
    if (dispute.status === DisputeStatus.RESOLVED) {
      return NextResponse.json(
        { error: 'Dispute is already resolved' },
        { status: 400 }
      );
    }

    // Update dispute
    const updatedDispute = await db.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    });

    // Update match if scores provided
    if (newScoreA !== undefined && newScoreB !== undefined) {
      const match = await db.match.findUnique({
        where: { id: dispute.matchId },
      });

      if (match) {
        // Save history
        await db.matchResultHistory.create({
          data: {
            matchId: match.id,
            oldScoreA: match.scoreA,
            oldScoreB: match.scoreB,
            newScoreA,
            newScoreB,
            oldWinnerId: match.winnerId,
            newWinnerId,
            reason: `Dispute resolution: ${resolution}`,
            editedById: user.id,
          },
        });

        // Update match
        await db.match.update({
          where: { id: dispute.matchId },
          data: {
            scoreA: newScoreA,
            scoreB: newScoreB,
            winnerId: newWinnerId,
            verificationStatus: MatchVerificationStatus.VERIFIED,
            updatedById: user.id,
          },
        });
      }
    } else {
      // Just mark match as verified
      await db.match.update({
        where: { id: dispute.matchId },
        data: {
          verificationStatus: MatchVerificationStatus.VERIFIED,
        },
      });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: dispute.sport as SportType,
        action: AuditAction.DISPUTE_RESOLVED,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Dispute',
        targetId: dispute.id,
        tournamentId: dispute.matchId,
        reason: resolution,
        metadata: JSON.stringify({
          matchId: dispute.matchId,
          newScoreA,
          newScoreB,
          newWinnerId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        resolution: updatedDispute.resolution,
        resolvedAt: updatedDispute.resolvedAt,
      },
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
