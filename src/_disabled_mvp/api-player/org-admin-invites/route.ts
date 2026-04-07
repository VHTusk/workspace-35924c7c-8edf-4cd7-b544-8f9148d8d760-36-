import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/player/org-admin-invites - Get pending org admin invitations for player
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Get all pending org admin invitations where acceptedAt is null
    const invites = await db.orgAdmin.findMany({
      where: {
        userId: user.id,
        acceptedAt: null,
      },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        orgId: invite.orgId,
        orgName: invite.org.name,
        orgType: invite.org.type,
        role: invite.role,
        invitedAt: invite.invitedAt.toISOString(),
        invitedBy: invite.invitedBy
          ? `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`
          : undefined,
      })),
    });
  } catch (error) {
    console.error('Get org admin invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
