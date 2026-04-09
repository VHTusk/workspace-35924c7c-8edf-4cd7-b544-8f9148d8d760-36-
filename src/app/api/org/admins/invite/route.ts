import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';
import { OrgAdminRole, SportType } from '@prisma/client';

// Invite a user to become an org admin
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { org } = auth;

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate role
    const validRoles = [OrgAdminRole.ADMIN, OrgAdminRole.STAFF];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be ADMIN or STAFF.' }, { status: 400 });
    }

    // Find the user by email
    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        sport: org.sport as SportType,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found with this email for this sport. They need to register first.' },
        { status: 404 }
      );
    }

    // Check if user is already an admin
    const existingAdmin = await db.orgAdmin.findUnique({
      where: {
        orgId_userId: { orgId: org.id, userId: user.id },
      },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'User is already an admin for this organization' },
        { status: 400 }
      );
    }

    // Create the org admin invitation
    // We need a userId for invitedById - use the first PRIMARY admin or null
    const primaryAdmin = await db.orgAdmin.findFirst({
      where: { orgId: org.id, role: OrgAdminRole.PRIMARY },
    });

    const orgAdmin = await db.orgAdmin.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: role || OrgAdminRole.STAFF,
        invitedById: primaryAdmin?.userId || user.id, // Fallback to self if no primary
        acceptedAt: new Date(), // Auto-accept for now (in production, would send email)
      },
    });

    // Create notification for the invited user
    await db.notification.create({
      data: {
        userId: user.id,
        sport: org.sport as SportType,
        type: 'TOURNAMENT_REGISTERED', // Using existing type, should add ORG_ADMIN_INVITE
        title: 'Organization Admin Invitation',
        message: `You have been added as an admin for ${org.name} (${org.sport}). Role: ${orgAdmin.role}`,
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: orgAdmin.id,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: orgAdmin.role,
        invitedAt: orgAdmin.invitedAt,
      },
      message: `${user.firstName} ${user.lastName} has been added as ${orgAdmin.role} admin`,
    });
  } catch (error) {
    console.error('Invite org admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
