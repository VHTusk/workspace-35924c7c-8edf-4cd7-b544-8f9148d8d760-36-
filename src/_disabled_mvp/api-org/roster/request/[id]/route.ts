import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { RosterRequestStatus } from '@prisma/client';

// PATCH - Cancel a roster request (org only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = session.org;
    const body = await request.json();
    const { action } = body; // 'cancel'

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Find the request
    const rosterRequest = await db.orgRosterRequest.findUnique({
      where: { id },
    });

    if (!rosterRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Verify this org owns the request
    if (rosterRequest.orgId !== org.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (rosterRequest.status !== RosterRequestStatus.PENDING) {
      return NextResponse.json({ error: 'Request is no longer pending' }, { status: 400 });
    }

    // Cancel the request
    await db.orgRosterRequest.update({
      where: { id },
      data: {
        status: RosterRequestStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel roster request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove player from roster
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = session.org;

    // Find the roster entry
    const rosterEntry = await db.orgRosterPlayer.findUnique({
      where: { id },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: 'Player not found in roster' }, { status: 404 });
    }

    // Verify this org owns the roster entry
    if (rosterEntry.orgId !== org.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Remove from roster
    await db.orgRosterPlayer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from roster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
