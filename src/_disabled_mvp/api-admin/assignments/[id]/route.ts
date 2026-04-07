/**
 * Individual Admin Assignment API (v3.46.0)
 * 
 * GET: Get assignment details
 * PATCH: Update assignment (enable/disable, permissions)
 * DELETE: Revoke assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { checkAdminPermission } from '@/lib/admin-permissions';
import { 
  disableAdminAssignment, 
  enableAdminAssignment 
} from '@/lib/admin-escalation';

// GET /api/admin/assignments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    const assignment = await db.adminAssignment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        permissions: true,
        auditLogs: {
          orderBy: { actedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Get admin metrics
    const metrics = await db.adminMetrics.findUnique({
      where: { adminId: assignment.userId },
    });

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        user: assignment.user,
        role: assignment.adminRole,
        sport: assignment.sport,
        scope: {
          stateCode: assignment.stateCode,
          districtName: assignment.districtName,
        },
        isActive: assignment.isActive,
        deactivatedAt: assignment.deactivatedAt,
        deactivatedBy: assignment.deactivatedBy,
        deactivationReason: assignment.deactivationReason,
        trustLevel: assignment.trustLevel,
        actionsCount: assignment.actionsCount,
        escalationsCount: assignment.escalationsCount,
        assignedAt: assignment.assignedAt,
        assignedById: assignment.assignedById,
        expiresAt: assignment.expiresAt,
        permissions: assignment.permissions,
        metrics,
        auditLogs: assignment.auditLogs,
      },
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/assignments/[id] - Update assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    const body = await request.json();
    const { 
      action, 
      reason, 
      permissions, 
      trustLevel, 
      expiresAt 
    } = body;

    const assignment = await db.adminAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Handle enable/disable actions
    if (action === 'disable') {
      const result = await disableAdminAssignment(id, user.id, reason || 'No reason provided');
      return NextResponse.json(result);
    }

    if (action === 'enable') {
      const result = await enableAdminAssignment(id, user.id, reason || 'No reason provided');
      return NextResponse.json(result);
    }

    // Handle permission updates
    if (permissions) {
      // Check if user has permission to modify permissions
      const permCheck = await checkAdminPermission(
        user.id,
        'canAssignAdmins',
        { userId: user.id, sport: assignment.sport || undefined }
      );

      if (!permCheck.granted) {
        return NextResponse.json(
          { error: 'No permission to modify permissions' },
          { status: 403 }
        );
      }

      // Get old permissions for audit
      const oldPermissions = await db.adminPermissions.findUnique({
        where: { assignmentId: id },
      });

      // Update permissions
      await db.adminPermissions.update({
        where: { assignmentId: id },
        data: permissions,
      });

      // Log the change
      await db.adminAuditLog.create({
        data: {
          assignmentId: id,
          action: 'PERMISSION_CHANGE',
          targetType: 'PERMISSIONS',
          targetId: id,
          reason: reason || 'Permission update',
          oldValue: JSON.stringify(oldPermissions),
          newValue: JSON.stringify(permissions),
          actedById: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Permissions updated',
      });
    }

    // Handle trust level update
    if (trustLevel !== undefined) {
      await db.adminAssignment.update({
        where: { id },
        data: { trustLevel },
      });

      await db.adminAuditLog.create({
        data: {
          assignmentId: id,
          action: 'PERMISSION_CHANGE',
          targetType: 'TRUST_LEVEL',
          targetId: id,
          reason: `Trust level changed to ${trustLevel}`,
          oldValue: JSON.stringify({ trustLevel: assignment.trustLevel }),
          newValue: JSON.stringify({ trustLevel }),
          actedById: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Trust level updated',
      });
    }

    // Handle expiry update
    if (expiresAt !== undefined) {
      await db.adminAssignment.update({
        where: { id },
        data: { expiresAt: expiresAt ? new Date(expiresAt) : null },
      });

      return NextResponse.json({
        success: true,
        message: 'Expiry updated',
      });
    }

    return NextResponse.json(
      { error: 'No action specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/assignments/[id] - Revoke assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    const assignment = await db.adminAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canAssignAdmins',
      { userId: user.id, sport: assignment.sport || undefined }
    );

    if (!permCheck.granted) {
      return NextResponse.json(
        { error: 'No permission to revoke assignments' },
        { status: 403 }
      );
    }

    // Log before deletion
    await db.adminAuditLog.create({
      data: {
        assignmentId: id,
        action: 'REVOKE',
        targetType: 'USER',
        targetId: assignment.userId,
        reason: 'Assignment revoked',
        oldValue: JSON.stringify({
          role: assignment.adminRole,
          sport: assignment.sport,
          scope: {
            stateCode: assignment.stateCode,
            districtName: assignment.districtName,
          },
        }),
        actedById: user.id,
      },
    });

    // Soft delete by setting inactive
    await db.adminAssignment.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: user.id,
        deactivationReason: 'Assignment revoked',
      },
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: assignment.userId,
        sport: assignment.sport || SportType.CORNHOLE,
        type: 'TOURNAMENT_CANCELLED',
        title: 'Admin Role Revoked',
        message: `Your ${assignment.adminRole} privileges have been revoked.`,
        link: '/dashboard',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assignment revoked',
    });
  } catch (error) {
    console.error('Error revoking assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { SportType } from '@prisma/client';
