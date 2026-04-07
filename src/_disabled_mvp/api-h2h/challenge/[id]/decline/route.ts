import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    // Get the challenge
    const challenge = await db.h2HChallenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: { select: { id: true, firstName: true, lastName: true } },
        challenged: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Verify the current user is the challenged player
    if (challenge.challengedId !== sessionUser.id) {
      return NextResponse.json({ error: 'Only the challenged player can decline this challenge' }, { status: 403 });
    }

    // Verify challenge is still pending
    if (challenge.status !== 'PENDING') {
      return NextResponse.json({ error: `Challenge already ${challenge.status.toLowerCase()}` }, { status: 400 });
    }

    // Decline the challenge
    const updatedChallenge = await db.h2HChallenge.update({
      where: { id: challengeId },
      data: {
        status: 'DECLINED',
        respondedAt: new Date()
      }
    });

    // Notify the challenger
    await db.notification.create({
      data: {
        userId: challenge.challengerId,
        sport: challenge.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Challenge Declined',
        message: `${challenge.challenged.firstName} ${challenge.challenged.lastName} declined your challenge.`,
        link: `/h2h?player1=${challenge.challengerId}&player2=${challenge.challengedId}&sport=${challenge.sport}`
      }
    });

    return NextResponse.json({
      success: true,
      challenge: {
        id: updatedChallenge.id,
        status: updatedChallenge.status,
        respondedAt: updatedChallenge.respondedAt
      }
    });
  } catch (error) {
    console.error('Error declining challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
