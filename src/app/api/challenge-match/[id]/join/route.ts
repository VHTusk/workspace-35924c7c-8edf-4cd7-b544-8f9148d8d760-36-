/**
 * Challenge Match Join API
 * POST - Join a challenge match
 * DELETE - Leave a challenge match
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChallengeMatchStatus } from '@prisma/client';

// POST /api/challenge-match/[id]/join
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const match = await db.challengeMatch.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Challenge match not found' },
        { status: 404 }
      );
    }

    // Check if match is joinable
    if (!['OPEN', 'THRESHOLD_REACHED'].includes(match.status)) {
      return NextResponse.json(
        { success: false, error: 'This match is no longer accepting new participants' },
        { status: 400 }
      );
    }

    // Check if registration deadline has passed
    if (new Date() > new Date(match.registrationDeadline)) {
      return NextResponse.json(
        { success: false, error: 'Registration deadline has passed' },
        { status: 400 }
      );
    }

    // Check if match is full
    if (match.joinedCount >= match.maxPlayers) {
      return NextResponse.json(
        { success: false, error: 'This match is full' },
        { status: 400 }
      );
    }

    // Parse existing joined users
    let joinedUsers: Array<{ userId: string; joinedAt: string; paymentStatus: string }> = [];
    if (match.joinedUserIds) {
      try {
        joinedUsers = JSON.parse(match.joinedUserIds);
      } catch {
        // Ignore parse errors
      }
    }

    // Check if user already joined
    if (joinedUsers.some(u => u.userId === userId)) {
      return NextResponse.json(
        { success: false, error: 'You have already joined this match' },
        { status: 400 }
      );
    }

    // Add user to joined list
    joinedUsers.push({
      userId,
      joinedAt: new Date().toISOString(),
      paymentStatus: 'PENDING'
    });

    const newJoinedCount = match.joinedCount + 1;

    // Determine if threshold is reached
    let newStatus = match.status;
    let thresholdReachedAt = match.thresholdReachedAt;

    if (newJoinedCount >= match.minPlayers && match.status === 'OPEN') {
      newStatus = ChallengeMatchStatus.THRESHOLD_REACHED;
      thresholdReachedAt = new Date();
    }

    // Update match
    const updatedMatch = await db.challengeMatch.update({
      where: { id },
      data: {
        joinedUserIds: JSON.stringify(joinedUsers),
        joinedCount: newJoinedCount,
        status: newStatus,
        thresholdReachedAt,
      },
    });

    // Calculate derived fields
    const entryFeeContribution = Math.floor(
      (match.entryFee * match.prizePoolPercentage / 100) * match.confirmedCount
    );
    const potentialPrizePool = match.basePrizePool + 
      Math.floor((match.entryFee * match.prizePoolPercentage / 100) * newJoinedCount) + 
      match.sponsorAmount;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedMatch,
        potentialPrizePool,
        progress: Math.min(100, Math.round((newJoinedCount / match.minPlayers) * 100)),
        needsMore: Math.max(0, match.minPlayers - newJoinedCount),
        thresholdReached: newStatus === 'THRESHOLD_REACHED',
      },
      message: newStatus === 'THRESHOLD_REACHED' 
        ? 'Joined successfully! Threshold reached - payment is now required to confirm your spot.'
        : 'Joined successfully! Waiting for more players to join.',
    });
  } catch (error) {
    console.error('Error joining challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join challenge match' },
      { status: 500 }
    );
  }
}

// DELETE /api/challenge-match/[id]/join - Leave a challenge match
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const match = await db.challengeMatch.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Challenge match not found' },
        { status: 404 }
      );
    }

    // Check if match can be left
    if (!['OPEN', 'THRESHOLD_REACHED'].includes(match.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot leave this match at its current status' },
        { status: 400 }
      );
    }

    // Parse existing joined users
    let joinedUsers: Array<{ userId: string; joinedAt: string; paymentStatus: string }> = [];
    if (match.joinedUserIds) {
      try {
        joinedUsers = JSON.parse(match.joinedUserIds);
      } catch {
        // Ignore parse errors
      }
    }

    // Check if user has joined
    const userIndex = joinedUsers.findIndex(u => u.userId === userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'You have not joined this match' },
        { status: 400 }
      );
    }

    // Check if user has already paid
    if (joinedUsers[userIndex].paymentStatus === 'PAID') {
      return NextResponse.json(
        { success: false, error: 'Cannot leave after payment. Please contact support for refund.' },
        { status: 400 }
      );
    }

    // Remove user from joined list
    joinedUsers.splice(userIndex, 1);
    const newJoinedCount = match.joinedCount - 1;

    // Update status if below threshold
    let newStatus = match.status;
    if (newJoinedCount < match.minPlayers && match.status === 'THRESHOLD_REACHED') {
      newStatus = ChallengeMatchStatus.OPEN;
    }

    // Update match
    const updatedMatch = await db.challengeMatch.update({
      where: { id },
      data: {
        joinedUserIds: JSON.stringify(joinedUsers),
        joinedCount: newJoinedCount,
        status: newStatus,
        thresholdReachedAt: newStatus === 'OPEN' ? null : match.thresholdReachedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMatch,
      message: 'Left challenge match successfully',
    });
  } catch (error) {
    console.error('Error leaving challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to leave challenge match' },
      { status: 500 }
    );
  }
}
