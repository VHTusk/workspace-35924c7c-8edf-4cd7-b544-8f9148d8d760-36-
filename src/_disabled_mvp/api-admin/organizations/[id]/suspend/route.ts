import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role, AuditAction, SportType, SubscriptionStatus } from '@prisma/client';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';

import type { SportType as PrismaSportType } from '@prisma/client';

// Suspend organization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, session } = auth;

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

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

    if (org.subscription?.status === SubscriptionStatus.EXPIRED) {
      return NextResponse.json(
        { error: 'Organization is already suspended/expired' },
        { status: 400 }
      );
    }

    // Suspend subscription
    await db.$transaction([
      db.orgSubscription.updateMany({
        where: { orgId: id },
        data: { status: SubscriptionStatus.EXPIRED },
      }),
      db.session.deleteMany({
        where: { orgId: id },
      }),
    ]);

    // Log audit
    await db.auditLog.create({
      data: {
        sport: org.sport as SportType,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Organization',
        targetId: org.id,
        reason: reason || 'Suspended by admin',
        metadata: JSON.stringify({
          action: 'SUSPENDED',
          name: org.name,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        status: 'SUSPENDED',
      },
    });
  } catch (error) {
    console.error('Suspend organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
