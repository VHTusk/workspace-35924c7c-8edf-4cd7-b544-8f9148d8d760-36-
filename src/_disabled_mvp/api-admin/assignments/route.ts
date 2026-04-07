/**
 * Admin Assignment API (v3.46.0)
 * 
 * GET: List admin assignments
 * POST: Create new admin assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AdminRole, SportType } from '@prisma/client';
import { z } from 'zod';
import { 
  canAssignRole, 
  getDefaultPermissionsForRole,
  checkAdminPermission 
} from '@/lib/admin-permissions';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { validateBody, validationErrorResponse } from '@/lib/validation';

// Admin Assignment validation schema
const adminAssignmentSchema = z.object({
  userId: z.string().cuid({ message: 'Invalid user ID format' }),
  adminRole: z.enum(['SUPER_ADMIN', 'SPORT_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'TOURNAMENT_DIRECTOR'], {
    message: 'Invalid admin role',
  }),
  sport: z.enum(['CORNHOLE', 'DARTS']).optional().nullable(),
  stateCode: z.string().max(10, 'State code too long').optional().nullable(),
  districtName: z.string().max(100, 'District name too long').optional().nullable(),
  expiresAt: z.string().datetime({ message: 'Invalid expiry date format' }).optional().nullable(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

// GET /api/admin/assignments - List admin assignments
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    // Check permission
    const permCheck = await checkAdminPermission(
      user.id,
      'canViewAuditLogs',
      { userId: user.id, sport: session?.sport }
    );

    // Get query params
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const role = searchParams.get('role') as AdminRole | null;
    const stateCode = searchParams.get('stateCode');
    const isActive = searchParams.get('isActive');

    // Build filter
    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;
    if (role) where.adminRole = role;
    if (stateCode) where.stateCode = stateCode;
    if (isActive !== null) where.isActive = isActive === 'true';

    const assignments = await db.adminAssignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        permissions: true,
      },
      orderBy: [
        { adminRole: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        user: a.user,
        role: a.adminRole,
        sport: a.sport,
        scope: {
          stateCode: a.stateCode,
          districtName: a.districtName,
        },
        isActive: a.isActive,
        deactivatedAt: a.deactivatedAt,
        deactivationReason: a.deactivationReason,
        trustLevel: a.trustLevel,
        assignedAt: a.assignedAt,
        expiresAt: a.expiresAt,
        permissions: a.permissions,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/assignments - Create new admin assignment
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    const body = await request.json();
    
    // Validate request body with Zod
    const validation = validateBody(adminAssignmentSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    
    const {
      userId,
      adminRole,
      sport,
      stateCode,
      districtName,
      expiresAt,
      permissions: customPermissions,
      reason,
    } = validation.data;

    // Check if assigner can assign this role
    const assignCheck = await canAssignRole(
      user.id,
      adminRole as AdminRole,
      { userId: user.id, sport: sport ?? undefined, stateCode: stateCode ?? undefined, districtName: districtName ?? undefined }
    );

    if (!assignCheck.canAssign) {
      return NextResponse.json(
        { error: assignCheck.reason || 'Cannot assign this role' },
        { status: 403 }
      );
    }

    // Check for existing assignment
    const existing = await db.adminAssignment.findFirst({
      where: {
        userId,
        sport: sport || null,
        adminRole: adminRole as AdminRole,
        stateCode: stateCode || null,
        districtName: districtName || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User already has this assignment' },
        { status: 400 }
      );
    }

    // Get default permissions for role
    const defaultPermissions = getDefaultPermissionsForRole(adminRole as AdminRole);
    const finalPermissions = customPermissions
      ? { ...defaultPermissions, ...customPermissions }
      : defaultPermissions;

    // Create assignment with permissions
    const assignment = await db.adminAssignment.create({
      data: {
        userId,
        adminRole: adminRole as AdminRole,
        sport: sport as SportType || null,
        stateCode: stateCode || null,
        districtName: districtName || null,
        assignedById: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        permissions: {
          create: finalPermissions,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        permissions: true,
      },
    });

    // Log the assignment
    await db.adminAuditLog.create({
      data: {
        assignmentId: assignment.id,
        action: 'ASSIGN',
        targetType: 'USER',
        targetId: userId,
        reason: reason || 'Admin assignment',
        newValue: JSON.stringify({
          role: adminRole,
          sport,
          scope: { stateCode, districtName },
          permissions: finalPermissions,
        }),
        actedById: user.id,
      },
    });

    // Notify the assigned user
    await db.notification.create({
      data: {
        userId,
        sport: sport as SportType || SportType.CORNHOLE,
        type: 'ADMIN_ASSIGNED',
        title: `You've been assigned as ${adminRole}`,
        message: reason || `You have been granted ${adminRole} privileges.`,
        link: '/admin/dashboard',
      },
    });

    // Create admin metrics record
    await db.adminMetrics.upsert({
      where: { adminId: userId },
      create: {
        adminId: userId,
        userId: userId,
      },
      update: {},
    });

    return NextResponse.json({
      success: true,
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
        expiresAt: assignment.expiresAt,
        permissions: assignment.permissions,
      },
    });
  } catch (error) {
    console.error('Error creating admin assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
