import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, AuditAction, SportType, SubscriptionStatus } from '@prisma/client';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { getAuthenticatedAdmin } from '@/lib/auth';

import type { SportType as PrismaSportType } from '@prisma/client';

// Activate organization
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

    const { id } = await params;
    const body = await request.json();
    const { extendDays = 30 } = body;

    const org = await db.organization.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Permission check using new admin permission system
    const permissionResult = await checkAdminPermission(
      user.id,
      'canSuspendOrgs' as PermissionKey,
      {
        sport: org.sport as PrismaSportType,
        stateCode: org.state || undefined,
        districtName: org.district || undefined,
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

    // Activate subscription
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + extendDays);

    await db.orgSubscription.updateMany({
      where: { orgId: id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        endDate: newEndDate,
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        sport: org.sport as SportType,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Organization',
        targetId: org.id,
        metadata: JSON.stringify({
          action: 'ACTIVATED',
          name: org.name,
          extendDays,
          newEndDate,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        status: 'ACTIVE',
        newEndDate,
      },
    });
  } catch (error) {
    console.error('Activate organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
