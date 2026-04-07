import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - List challenges for current user
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user: sessionUser, session } = authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const type = searchParams.get('type') || 'all'; // 'sent', 'received', 'all'

    // Build where clause
    const whereClause: Record<string, unknown> = {
      sport: session.sport,
    };

    if (status !== 'ALL') {
      whereClause.status = status;
    }

    if (type === 'sent') {
      whereClause.challengerId = sessionUser.id;
    } else if (type === 'received') {
      whereClause.challengedId = sessionUser.id;
    } else {
      whereClause.OR = [
        { challengerId: sessionUser.id },
        { challengedId: sessionUser.id }
      ];
    }

    const challenges = await db.h2HChallenge.findMany({
      where: whereClause,
      include: {
        challenger: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true,
            hiddenElo: true,
            city: true,
            state: true
          }
        },
        challenged: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true,
            hiddenElo: true,
            city: true,
            state: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      challenges: challenges.map(c => ({
        id: c.id,
        challenger: {
          id: c.challenger.id,
          name: `${c.challenger.firstName} ${c.challenger.lastName}`,
          points: c.challenger.visiblePoints,
          elo: Math.round(c.challenger.hiddenElo),
          city: c.challenger.city,
          state: c.challenger.state
        },
        challenged: {
          id: c.challenged.id,
          name: `${c.challenged.firstName} ${c.challenged.lastName}`,
          points: c.challenged.visiblePoints,
          elo: Math.round(c.challenged.hiddenElo),
          city: c.challenged.city,
          state: c.challenged.state
        },
        sport: c.sport,
        status: c.status,
        message: c.message,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
        expiresAt: c.expiresAt,
        isChallenger: c.challengerId === sessionUser.id
      }))
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new challenge
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user: sessionUser, session } = authResult;

    const body = await request.json();
    const { challengerId, challengedId, sport, message } = body;

    // Validate required fields
    if (!challengedId) {
      return NextResponse.json({ error: 'Challenged player ID required' }, { status: 400 });
    }

    // Use session user as challenger if not specified
    const actualChallengerId = challengerId || sessionUser.id;

    // Verify challenger is the current user
    if (actualChallengerId !== sessionUser.id) {
      return NextResponse.json({ error: 'Can only send challenges as yourself' }, { status: 403 });
    }

    // Cannot challenge yourself
    if (actualChallengerId === challengedId) {
      return NextResponse.json({ error: 'Cannot challenge yourself' }, { status: 400 });
    }

    // Verify both players exist and are active
    const [challenger, challenged] = await Promise.all([
      db.user.findUnique({
        where: { id: actualChallengerId },
        select: { id: true, isActive: true, sport: true }
      }),
      db.user.findUnique({
        where: { id: challengedId },
        select: { id: true, isActive: true, sport: true }
      })
    ]);

    if (!challenger || !challenger.isActive) {
      return NextResponse.json({ error: 'Challenger not found or inactive' }, { status: 400 });
    }

    if (!challenged || !challenged.isActive) {
      return NextResponse.json({ error: 'Challenged player not found or inactive' }, { status: 400 });
    }

    const challengeSport = sport || session.sport;

    // Check if there's already a pending challenge between these players
    const existingChallenge = await db.h2HChallenge.findFirst({
      where: {
        OR: [
          { challengerId: actualChallengerId, challengedId, sport: challengeSport, status: 'PENDING' },
          { challengerId: challengedId, challengedId: actualChallengerId, sport: challengeSport, status: 'PENDING' }
        ]
      }
    });

    if (existingChallenge) {
      return NextResponse.json({ error: 'A pending challenge already exists between these players' }, { status: 400 });
    }

    // Create the challenge
    const challenge = await db.h2HChallenge.create({
      data: {
        challengerId: actualChallengerId,
        challengedId,
        sport: challengeSport as 'CORNHOLE' | 'DARTS',
        message: message || null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      include: {
        challenger: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true
          }
        },
        challenged: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true
          }
        }
      }
    });

    // Create notification for challenged player
    await db.notification.create({
      data: {
        userId: challengedId,
        sport: challengeSport as 'CORNHOLE' | 'DARTS',
        type: 'TOURNAMENT_REGISTERED', // Using existing type, could add new type later
        title: 'New Challenge Received!',
        message: `${challenge.challenger.firstName} ${challenge.challenger.lastName} has challenged you to a match!`,
        link: `/h2h?player1=${actualChallengerId}&player2=${challengedId}&sport=${challengeSport}`
      }
    });

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        challenger: {
          id: challenge.challenger.id,
          name: `${challenge.challenger.firstName} ${challenge.challenger.lastName}`,
          points: challenge.challenger.visiblePoints
        },
        challenged: {
          id: challenge.challenged.id,
          name: `${challenge.challenged.firstName} ${challenge.challenged.lastName}`,
          points: challenge.challenged.visiblePoints
        },
        sport: challenge.sport,
        status: challenge.status,
        message: challenge.message,
        createdAt: challenge.createdAt,
        expiresAt: challenge.expiresAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
