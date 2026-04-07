/**
 * Challenge Match [id] API
 * GET - Get a specific challenge match
 * PUT - Update a challenge match
 * DELETE - Cancel a challenge match
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChallengeMatchStatus } from '@prisma/client';

// GET /api/challenge-match/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const match = await db.challengeMatch.findUnique({
      where: { id },
      include: {
        city: {
          select: {
            id: true,
            cityId: true,
            cityName: true,
            state: true,
            sport: true,
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Challenge match not found' },
        { status: 404 }
      );
    }

    // Calculate derived fields
    const entryFeeContribution = Math.floor(
      (match.entryFee * match.prizePoolPercentage / 100) * match.confirmedCount
    );
    const totalPrizePool = match.basePrizePool + entryFeeContribution + match.sponsorAmount;
    
    const now = new Date();
    const deadline = new Date(match.registrationDeadline);
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
    
    const progress = Math.min(100, Math.round((match.joinedCount / match.minPlayers) * 100));

    // Parse joined user IDs
    let joinedUsers: Array<{ userId: string; joinedAt: string; paymentStatus: string }> = [];
    if (match.joinedUserIds) {
      try {
        joinedUsers = JSON.parse(match.joinedUserIds);
      } catch {
        // Ignore parse errors
      }
    }

    // Parse paid user IDs
    let paidUserIds: string[] = [];
    if (match.paidUserIds) {
      try {
        paidUserIds = JSON.parse(match.paidUserIds);
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...match,
        totalPrizePool,
        daysRemaining,
        hoursRemaining,
        progress,
        remainingSlots: match.maxPlayers - match.joinedCount,
        needsMore: Math.max(0, match.minPlayers - match.joinedCount),
        joinedUsers,
        paidUserIds,
      },
    });
  } catch (error) {
    console.error('Error fetching challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch challenge match' },
      { status: 500 }
    );
  }
}

// PUT /api/challenge-match/[id] - Update challenge match
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const match = await db.challengeMatch.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Challenge match not found' },
        { status: 404 }
      );
    }

    // Only allow updates if match is still OPEN
    if (match.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: 'Cannot update match that is not in OPEN status' },
        { status: 400 }
      );
    }

    const updatedMatch = await db.challengeMatch.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        matchDate: body.matchDate ? new Date(body.matchDate) : undefined,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : undefined,
        venueName: body.venueName,
        venueAddress: body.venueAddress,
        venueMapsUrl: body.venueMapsUrl,
        minPlayers: body.minPlayers,
        maxPlayers: body.maxPlayers,
        entryFee: body.entryFee,
        basePrizePool: body.basePrizePool,
        prizePoolPercentage: body.prizePoolPercentage,
        sponsorName: body.sponsorName,
        sponsorLogo: body.sponsorLogo,
        sponsorAmount: body.sponsorAmount,
        sponsorMessage: body.sponsorMessage,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMatch,
      message: 'Challenge match updated successfully',
    });
  } catch (error) {
    console.error('Error updating challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update challenge match' },
      { status: 500 }
    );
  }
}

// DELETE /api/challenge-match/[id] - Cancel challenge match
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    const match = await db.challengeMatch.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Challenge match not found' },
        { status: 404 }
      );
    }

    // Cancel the match
    const updatedMatch = await db.challengeMatch.update({
      where: { id },
      data: {
        status: ChallengeMatchStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by organizer',
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMatch,
      message: 'Challenge match cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel challenge match' },
      { status: 500 }
    );
  }
}
