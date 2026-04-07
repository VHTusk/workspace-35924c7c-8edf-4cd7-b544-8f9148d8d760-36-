import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';
import { OrgAdminRole } from '@prisma/client';

// PATCH /api/org/admins/[id] - Update admin role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: adminId } = await params;
    const auth = await getAuthenticatedOrg(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { org } = auth;

    const body = await request.json();
    const { role } = body;

    // Validate role
    const validRoles = [OrgAdminRole.ADMIN, OrgAdminRole.STAFF];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN or STAFF.' },
        { status: 400 }
      );
    }

    // Get the admin to update
    const adminToUpdate = await db.orgAdmin.findFirst({
      where: { id: adminId, orgId: org.id },
    });

    if (!adminToUpdate) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Cannot change PRIMARY role
    if (adminToUpdate.role === OrgAdminRole.PRIMARY) {
      return NextResponse.json(
        { error: 'Cannot modify PRIMARY admin role. Transfer primary role first.' },
        { status: 400 }
      );
    }

    // Cannot set role to PRIMARY
    if (role === OrgAdminRole.PRIMARY) {
      return NextResponse.json(
        { error: 'Cannot assign PRIMARY role. Use the transfer primary feature instead.' },
        { status: 400 }
      );
    }

    // Update the role
    const updatedAdmin = await db.orgAdmin.update({
      where: { id: adminId },
      data: { role },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    // Create notification for the user
    await db.notification.create({
      data: {
        userId: updatedAdmin.userId,
        sport: org.sport,
        type: 'TOURNAMENT_REGISTERED', // Using existing type
        title: 'Role Updated',
        message: `Your role in ${org.name} has been changed to ${role}.`,
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: updatedAdmin.id,
        userId: updatedAdmin.userId,
        name: `${updatedAdmin.user.firstName} ${updatedAdmin.user.lastName}`,
        email: updatedAdmin.user.email,
        role: updatedAdmin.role,
      },
    });
  } catch (error) {
    console.error('Update org admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/org/admins/[id] - Deactivate admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: adminId } = await params;
    const auth = await getAuthenticatedOrg(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { org } = auth;

    // Get the admin to deactivate
    const adminToDeactivate = await db.orgAdmin.findFirst({
      where: { id: adminId, orgId: org.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!adminToDeactivate) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Cannot deactivate PRIMARY
    if (adminToDeactivate.role === OrgAdminRole.PRIMARY) {
      return NextResponse.json(
        { error: 'Cannot deactivate PRIMARY admin. Transfer primary role first.' },
        { status: 400 }
      );
    }

    // Delete the admin record
    await db.orgAdmin.delete({
      where: { id: adminId },
    });

    // Create notification for the user
    await db.notification.create({
      data: {
        userId: adminToDeactivate.userId,
        sport: org.sport,
        type: 'TOURNAMENT_REGISTERED', // Using existing type
        title: 'Admin Access Removed',
        message: `Your admin access to ${org.name} has been removed.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${adminToDeactivate.user.firstName} ${adminToDeactivate.user.lastName} has been removed as admin`,
    });
  } catch (error) {
    console.error('Deactivate org admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
