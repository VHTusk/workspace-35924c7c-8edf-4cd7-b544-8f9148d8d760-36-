/**
 * Challenge Match Payment API
 * POST - Process payment for a challenge match
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChallengeMatchStatus } from '@prisma/client';

// POST /api/challenge-match/[id]/pay
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, paymentId, amount } = body;

    if (!userId || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or paymentId' },
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

    // Check if match is in payable status
    if (!['THRESHOLD_REACHED', 'PAYMENT_PENDING', 'CONFIRMED'].includes(match.status)) {
      return NextResponse.json(
        { success: false, error: 'This match is not ready for payment yet' },
        { status: 400 }
      );
    }

    // Parse existing joined users
    let joinedUsers: Array<{ userId: string; joinedAt: string; paymentStatus: string; paymentId?: string }> = [];
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

    // Check if already paid
    if (joinedUsers[userIndex].paymentStatus === 'PAID') {
      return NextResponse.json(
        { success: false, error: 'You have already paid for this match' },
        { status: 400 }
      );
    }

    // Update user's payment status
    joinedUsers[userIndex].paymentStatus = 'PAID';
    joinedUsers[userIndex].paymentId = paymentId;

    // Parse paid user IDs
    let paidUserIds: string[] = [];
    if (match.paidUserIds) {
      try {
        paidUserIds = JSON.parse(match.paidUserIds);
      } catch {
        // Ignore parse errors
      }
    }
    paidUserIds.push(userId);

    const newConfirmedCount = match.confirmedCount + 1;

    // Determine new status
    let newStatus = match.status;
    let confirmedAt = match.confirmedAt;

    if (newConfirmedCount >= match.minPlayers && match.status !== 'CONFIRMED') {
      newStatus = ChallengeMatchStatus.CONFIRMED;
      confirmedAt = new Date();
    } else if (match.status === 'THRESHOLD_REACHED') {
      newStatus = ChallengeMatchStatus.PAYMENT_PENDING;
    }

    // Update match
    const updatedMatch = await db.challengeMatch.update({
      where: { id },
      data: {
        joinedUserIds: JSON.stringify(joinedUsers),
        paidUserIds: JSON.stringify(paidUserIds),
        confirmedCount: newConfirmedCount,
        status: newStatus,
        confirmedAt,
      },
    });

    // Calculate new prize pool
    const entryFeeContribution = Math.floor(
      (match.entryFee * match.prizePoolPercentage / 100) * newConfirmedCount
    );
    const totalPrizePool = match.basePrizePool + entryFeeContribution + match.sponsorAmount;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedMatch,
        totalPrizePool,
        confirmedCount: newConfirmedCount,
      },
      message: newStatus === 'CONFIRMED'
        ? 'Payment successful! The match is now confirmed!'
        : 'Payment successful! Waiting for other players to confirm.',
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}

// GET /api/challenge-match/[id]/pay - Get payment status
export async function GET(
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

    // Parse joined users
    let joinedUsers: Array<{ userId: string; joinedAt: string; paymentStatus: string; paymentId?: string }> = [];
    if (match.joinedUserIds) {
      try {
        joinedUsers = JSON.parse(match.joinedUserIds);
      } catch {
        // Ignore parse errors
      }
    }

    const userEntry = joinedUsers.find(u => u.userId === userId);

    // Calculate prize pool
    const entryFeeContribution = Math.floor(
      (match.entryFee * match.prizePoolPercentage / 100) * match.confirmedCount
    );
    const currentPrizePool = match.basePrizePool + entryFeeContribution + match.sponsorAmount;

    return NextResponse.json({
      success: true,
      data: {
        hasJoined: !!userEntry,
        paymentStatus: userEntry?.paymentStatus || null,
        paymentId: userEntry?.paymentId || null,
        entryFee: match.entryFee,
        currentPrizePool,
        matchStatus: match.status,
        requiresPayment: ['THRESHOLD_REACHED', 'PAYMENT_PENDING', 'CONFIRMED'].includes(match.status) && 
          userEntry?.paymentStatus !== 'PAID',
      },
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get payment status' },
      { status: 500 }
    );
  }
}
