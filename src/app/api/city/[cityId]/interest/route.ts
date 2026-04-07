/**
 * City Interest Poll API
 * GET /api/city/[cityId]/interest - Get interest polls (Module 5)
 * POST /api/city/[cityId]/interest - Express interest in a poll
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expressPollInterest } from '@/lib/city-utils';

// GET /api/city/[cityId]/interest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'OPEN';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Find city
    let city = await db.city.findUnique({
      where: { cityId },
    });

    if (!city) {
      city = await db.city.findUnique({
        where: { id: cityId },
      });
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Get polls
    const polls = await db.tournamentInterestPoll.findMany({
      where: {
        cityId: city.id,
        status: status as 'OPEN' | 'THRESHOLD_REACHED' | 'TOURNAMENT_CREATED' | 'EXPIRED' | 'CANCELLED',
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Format response
    const formattedPolls = polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      proposedDate: poll.proposedDate,
      proposedFormat: poll.proposedFormat,
      minPlayers: poll.minPlayers,
      maxPlayers: poll.maxPlayers,
      interestedCount: poll.interestedCount,
      status: poll.status,
      thresholdReachedAt: poll.thresholdReachedAt,
      expiresAt: poll.expiresAt,
      createdAt: poll.createdAt,
      progress: Math.min(100, Math.round((poll.interestedCount / poll.minPlayers) * 100)),
      remainingPlayers: Math.max(0, poll.minPlayers - poll.interestedCount),
    }));

    return NextResponse.json({
      success: true,
      data: {
        city: {
          id: city.id,
          cityId: city.cityId,
          cityName: city.cityName,
          state: city.state,
          sport: city.sport,
        },
        polls: formattedPolls,
        count: formattedPolls.length,
      },
    });
  } catch (error) {
    console.error('Error fetching interest polls:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch interest polls' },
      { status: 500 }
    );
  }
}

// POST /api/city/[cityId]/interest - Express interest or create poll
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    const body = await request.json();
    const { action, pollId, userId, ...pollData } = body;

    // Find city
    let city = await db.city.findUnique({
      where: { cityId },
    });

    if (!city) {
      city = await db.city.findUnique({
        where: { id: cityId },
      });
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    if (action === 'express_interest') {
      // Express interest in existing poll
      if (!pollId || !userId) {
        return NextResponse.json(
          { success: false, error: 'Missing pollId or userId' },
          { status: 400 }
        );
      }

      const updatedPoll = await expressPollInterest(pollId, userId);

      return NextResponse.json({
        success: true,
        data: updatedPoll,
        message: 'Interest expressed successfully',
      });
    }

    if (action === 'create_poll') {
      // Create new interest poll
      const { title, description, proposedDate, proposedFormat, minPlayers, maxPlayers, expiresAt, createdById } = pollData;

      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Missing required field: title' },
          { status: 400 }
        );
      }

      // Set default expiry to 30 days from now
      const pollExpiry = expiresAt ? new Date(expiresAt) : new Date();
      if (!expiresAt) {
        pollExpiry.setDate(pollExpiry.getDate() + 30);
      }

      const poll = await db.tournamentInterestPoll.create({
        data: {
          cityId: city.id,
          title,
          description,
          proposedDate: proposedDate ? new Date(proposedDate) : null,
          proposedFormat: proposedFormat || 'INDIVIDUAL',
          minPlayers: minPlayers || 16,
          maxPlayers: maxPlayers || 64,
          expiresAt: pollExpiry,
          createdById: createdById || null,
        },
      });

      return NextResponse.json({
        success: true,
        data: poll,
        message: 'Interest poll created successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "express_interest" or "create_poll"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing interest request:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
