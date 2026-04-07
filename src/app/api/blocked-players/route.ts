import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/blocked-players - Get blocked players list
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blockedPlayers = await db.blockedPlayer.findMany({
      where: { blockerId: session.user.id },
      include: {
        blocked: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
            visiblePoints: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ blockedPlayers });
  } catch (error) {
    console.error('Get blocked players error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/blocked-players - Block a player
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { blockedId, reason, isMute = false } = body;

    if (!blockedId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    // Check if already blocked
    const existing = await db.blockedPlayer.findUnique({
      where: {
        blockerId_blockedId_sport: {
          blockerId: session.user.id,
          blockedId,
          sport: session.user.sport,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Player already blocked' }, { status: 400 });
    }

    const blockedPlayer = await db.blockedPlayer.create({
      data: {
        blockerId: session.user.id,
        blockedId,
        sport: session.user.sport,
        reason,
        isMute,
      },
      include: {
        blocked: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
            visiblePoints: true,
          },
        },
      },
    });

    return NextResponse.json({ blockedPlayer });
  } catch (error) {
    console.error('Block player error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/blocked-players - Unblock a player
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const blockedId = searchParams.get('blockedId');

    if (!blockedId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    await db.blockedPlayer.delete({
      where: {
        blockerId_blockedId_sport: {
          blockerId: session.user.id,
          blockedId,
          sport: session.user.sport,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unblock player error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
