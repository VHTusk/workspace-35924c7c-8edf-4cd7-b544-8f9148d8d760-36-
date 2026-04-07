import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/player/quick-team - Get available team requests (find partners)
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

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const format = searchParams.get('format') || 'DOUBLES';

    // Build where clause for available requests
    const where: Record<string, unknown> = {
      sport: session.user.sport,
      status: 'OPEN',
      format,
      expiresAt: { gte: new Date() },
      userId: { not: session.user.id }, // Exclude own requests
    };

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    // Get available team requests
    const availableRequests = await db.quickTeamRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            hiddenElo: true,
            playerRating: {
              select: {
                wins: true,
                losses: true,
                currentStreak: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get user's own requests
    const myRequests = await db.quickTeamRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'OPEN',
        expiresAt: { gte: new Date() },
      },
      include: {
        matchedWith: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      availablePartners: availableRequests.map(r => ({
        id: r.id,
        user: {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          city: r.user.city,
          elo: r.user.hiddenElo,
          wins: r.user.playerRating?.wins || 0,
          losses: r.user.playerRating?.losses || 0,
          streak: r.user.playerRating?.currentStreak || 0,
        },
        notes: r.notes,
        skillLevelMin: r.skillLevelMin,
        skillLevelMax: r.skillLevelMax,
        tournamentId: r.tournamentId,
        createdAt: r.createdAt,
      })),
      myRequests,
      canCreateRequest: myRequests.length < 3, // Max 3 active requests
    });
  } catch (error) {
    console.error('Get quick team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/player/quick-team - Create a team request (looking for partner)
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
    const { tournamentId, format, skillLevelMin, skillLevelMax, notes, expiresHours } = body;

    // Check if user already has active requests
    const activeRequests = await db.quickTeamRequest.count({
      where: {
        userId: session.user.id,
        status: 'OPEN',
        expiresAt: { gte: new Date() },
      },
    });

    if (activeRequests >= 3) {
      return NextResponse.json({ 
        error: 'Maximum 3 active requests allowed' 
      }, { status: 400 });
    }

    // Create team request
    const teamRequest = await db.quickTeamRequest.create({
      data: {
        userId: session.user.id,
        sport: session.user.sport,
        tournamentId,
        format: format || 'DOUBLES',
        skillLevelMin,
        skillLevelMax,
        notes,
        expiresAt: new Date(Date.now() + (expiresHours || 24) * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true, request: teamRequest });
  } catch (error) {
    console.error('Create quick team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/player/quick-team - Match with a partner (one-tap team formation)
export async function PUT(request: NextRequest) {
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
    const { requestId } = body;

    // Get the request
    const teamRequest = await db.quickTeamRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
          },
        },
      },
    });

    if (!teamRequest || teamRequest.status !== 'OPEN') {
      return NextResponse.json({ 
        error: 'Request not available' 
      }, { status: 400 });
    }

    if (teamRequest.userId === session.user.id) {
      return NextResponse.json({ 
        error: 'Cannot match with yourself' 
      }, { status: 400 });
    }

    // Create team
    const team = await db.team.create({
      data: {
        name: `Team ${teamRequest.user.lastName}/${session.user.lastName || 'Player'}`,
        sport: session.user.sport,
        captainId: teamRequest.userId, // Original requester is captain
        format: teamRequest.format as 'DOUBLES' | 'TEAM',
        status: 'ACTIVE',
      },
    });

    // Add both players to team
    await db.teamMember.createMany({
      data: [
        {
          teamId: team.id,
          userId: teamRequest.userId,
          role: 'CAPTAIN',
        },
        {
          teamId: team.id,
          userId: session.user.id,
          role: 'MEMBER',
        },
      ],
    });

    // Update team request as matched
    await db.quickTeamRequest.update({
      where: { id: requestId },
      data: {
        status: 'MATCHED',
        matchedWithId: session.user.id,
        teamId: team.id,
      },
    });

    // Cancel user's own open requests (if any)
    await db.quickTeamRequest.updateMany({
      where: {
        userId: session.user.id,
        status: 'OPEN',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        captain: {
          id: teamRequest.user.id,
          name: `${teamRequest.user.firstName} ${teamRequest.user.lastName}`,
        },
        member: {
          id: session.user.id,
          name: session.user.name || `${session.user.firstName} ${session.user.lastName}`,
        },
      },
    });
  } catch (error) {
    console.error('Match team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/player/quick-team - Cancel a team request
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
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID required' }, { status: 400 });
    }

    await db.quickTeamRequest.update({
      where: {
        id: requestId,
        userId: session.user.id,
      },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel team request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
