/**
 * Challenge Match API
 * GET - List challenge matches for a city/district
 * POST - Create a new challenge match with full financial calculations
 * 
 * @version 4.7.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChallengeMatchStatus, SportType, TournamentFormat, VenueSlotStatus } from '@prisma/client';

// Financial calculation constants
const ADMIN_FEE_PERCENTAGE = 30;  // 30% admin fee
const PRIZE_POOL_PERCENTAGE = 70; // 70% to prize pool
const FIRST_PRIZE_PERCENTAGE = 70; // 70% of prize pool to 1st place
const SECOND_PRIZE_PERCENTAGE = 30; // 30% of prize pool to 2nd place
const MIN_ENTRY_FEE = 50000; // Minimum ₹500 entry fee (in paise)
const RECOMMENDED_ENTRY_FEE = 100000; // Recommended ₹1000 entry fee (in paise)

// Calculate prize distribution
function calculatePrizeDistribution(
  entryFee: number,
  playerSlots: number,
  sponsorAmount: number = 0,
  basePrizePool: number = 0
): {
  totalCollection: number;
  adminFee: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
} {
  // Total collection from entry fees
  const totalCollection = entryFee * playerSlots;
  
  // Admin fee (30%)
  const adminFee = Math.floor(totalCollection * (ADMIN_FEE_PERCENTAGE / 100));
  
  // Net prize pool (70% of collection + sponsor + base)
  const feeContribution = Math.floor(totalCollection * (PRIZE_POOL_PERCENTAGE / 100));
  const prizePool = feeContribution + sponsorAmount + basePrizePool;
  
  // Prize distribution (only 1st and 2nd place)
  let firstPrize: number;
  let secondPrize: number;
  
  if (playerSlots === 2) {
    // For 2 players, winner takes all
    firstPrize = prizePool;
    secondPrize = 0;
  } else {
    // Normal split: 70% to 1st, 30% to 2nd
    firstPrize = Math.floor(prizePool * (FIRST_PRIZE_PERCENTAGE / 100));
    secondPrize = Math.floor(prizePool * (SECOND_PRIZE_PERCENTAGE / 100));
  }
  
  return {
    totalCollection,
    adminFee,
    prizePool,
    firstPrize,
    secondPrize,
  };
}

// GET /api/challenge-match - List challenge matches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId');
    const sport = searchParams.get('sport') as SportType | null;
    const status = searchParams.get('status') as ChallengeMatchStatus | null;
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: Record<string, unknown> = {};
    
    if (cityId) {
      // Find city by id or cityId
      const city = await db.city.findFirst({
        where: {
          OR: [
            { id: cityId },
            { cityId: cityId }
          ]
        }
      });
      if (city) {
        where.cityId = city.id;
      }
    }
    
    if (sport) {
      where.sport = sport;
    }
    
    if (status) {
      where.status = status;
    } else {
      // Default to active statuses
      where.status = {
        in: ['OPEN', 'THRESHOLD_REACHED', 'PAYMENT_PENDING', 'CONFIRMED']
      };
    }

    const matches = await db.challengeMatch.findMany({
      where,
      orderBy: { matchDate: 'asc' },
      take: limit,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            googleMapsUrl: true,
          }
        }
      }
    });

    // Calculate derived fields for each match
    const formattedMatches = matches.map(match => {
      // Calculate prize pool from stored values or compute
      const totalPrizePool = match.prizePool || 
        (match.basePrizePool + match.sponsorAmount);
      
      // Calculate days remaining
      const now = new Date();
      const deadline = new Date(match.registrationDeadline);
      const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate progress percentage
      const progress = Math.min(100, Math.round((match.joinedCount / match.minPlayers) * 100));
      
      // Format time
      const startTimeStr = match.startTime ? 
        `${Math.floor(match.startTime / 60).toString().padStart(2, '0')}:${(match.startTime % 60).toString().padStart(2, '0')}` : 
        null;
      const endTimeStr = match.endTime ? 
        `${Math.floor(match.endTime / 60).toString().padStart(2, '0')}:${(match.endTime % 60).toString().padStart(2, '0')}` : 
        null;
      
      return {
        ...match,
        totalPrizePool,
        daysRemaining,
        progress,
        remainingSlots: match.maxPlayers - match.joinedCount,
        needsMore: Math.max(0, match.minPlayers - match.joinedCount),
        startTimeStr,
        endTimeStr,
        estimatedDurationStr: match.estimatedDuration ? 
          `${Math.floor(match.estimatedDuration / 60)}h ${match.estimatedDuration % 60}m` : null,
        entryFeeDisplay: match.entryFee / 100, // Convert paise to rupees
        firstPrizeDisplay: match.firstPrizeAmount / 100,
        secondPrizeDisplay: match.secondPrizeAmount / 100,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        matches: formattedMatches,
        count: formattedMatches.length,
      },
    });
  } catch (error) {
    console.error('Error fetching challenge matches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch challenge matches' },
      { status: 500 }
    );
  }
}

// POST /api/challenge-match - Create a new challenge match
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cityId,
      sport,
      title,
      description,
      matchDate,
      registrationDeadline,
      // Venue fields
      venueId,
      venueName,
      venueAddress,
      venueMapsUrl,
      // Scheduling
      startTime,
      endTime,
      estimatedDuration,
      // Format & Players
      format,
      matchType,
      playerSlots,
      minPlayers,
      maxPlayers,
      // Rules
      matchFormat,
      scoreTarget,
      rules,
      tieBreakRule,
      // Fee & Prize
      entryFee,
      basePrizePool,
      sponsorName,
      sponsorLogo,
      sponsorAmount,
      sponsorMessage,
      // Visibility
      visibility,
      skillLevel,
      // Creator
      createdById,
    } = body;

    // Validate required fields
    if (!cityId || !title || !matchDate || !registrationDeadline || !createdById) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: cityId, title, matchDate, registrationDeadline, createdById' },
        { status: 400 }
      );
    }

    // Validate venue (either venueId or venueName is required)
    if (!venueId && !venueName) {
      return NextResponse.json(
        { success: false, error: 'Either venueId or venueName is required' },
        { status: 400 }
      );
    }

    // Validate user is authenticated
    const user = await db.user.findUnique({
      where: { id: createdById }
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Find city
    const city = await db.city.findFirst({
      where: {
        OR: [
          { id: cityId },
          { cityId: cityId }
        ]
      }
    });

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Validate venue if venueId provided
    let venue = null;
    if (venueId) {
      venue = await db.venue.findUnique({
        where: { id: venueId }
      });
      
      if (!venue) {
        return NextResponse.json(
          { success: false, error: 'Venue not found' },
          { status: 404 }
        );
      }
      
      // Verify venue belongs to the selected district
      if (venue.cityId !== city.id) {
        return NextResponse.json(
          { success: false, error: 'Venue does not belong to the selected district' },
          { status: 400 }
        );
      }
      
      // Verify venue supports the sport
      if (venue.sport !== (sport || city.sport)) {
        return NextResponse.json(
          { success: false, error: 'Venue does not support this sport' },
          { status: 400 }
        );
      }
    }

    // Validate entry fee meets minimum
    const entryFeePaise = entryFee || RECOMMENDED_ENTRY_FEE;
    if (entryFeePaise < MIN_ENTRY_FEE) {
      return NextResponse.json(
        { success: false, error: `Minimum entry fee is ₹${MIN_ENTRY_FEE / 100}` },
        { status: 400 }
      );
    }

    // Validate player slots
    const totalPlayerSlots = playerSlots || minPlayers || 8;
    const minPlayersCount = minPlayers || totalPlayerSlots;
    const maxPlayersCount = maxPlayers || totalPlayerSlots;
    
    if (minPlayersCount > maxPlayersCount) {
      return NextResponse.json(
        { success: false, error: 'Minimum players cannot exceed maximum players' },
        { status: 400 }
      );
    }

    // Validate time slot availability if venueId provided
    if (venueId && startTime && estimatedDuration) {
      const matchDateObj = new Date(matchDate);
      const endTimeMinutes = startTime + estimatedDuration;
      
      // Check for conflicting reservations
      const conflictingSlots = await db.venueSlot.findMany({
        where: {
          venueId,
          date: matchDateObj,
          status: VenueSlotStatus.RESERVED,
          OR: [
            // New slot starts during existing slot
            {
              startTime: { lte: startTime },
              endTime: { gt: startTime }
            },
            // New slot ends during existing slot
            {
              startTime: { lt: endTimeMinutes },
              endTime: { gte: endTimeMinutes }
            },
            // New slot encompasses existing slot
            {
              startTime: { gte: startTime },
              endTime: { lte: endTimeMinutes }
            }
          ]
        }
      });
      
      if (conflictingSlots.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Selected time slot is not available',
            details: {
              conflictingSlots: conflictingSlots.map(s => ({
                startTime: s.startTime,
                endTime: s.endTime
              }))
            }
          },
          { status: 409 }
        );
      }
    }

    // Calculate financial values (server-side, never trust frontend)
    const sponsorAmountPaise = sponsorAmount || 0;
    const basePrizePaise = basePrizePool || 0;
    
    const financials = calculatePrizeDistribution(
      entryFeePaise,
      totalPlayerSlots,
      sponsorAmountPaise,
      basePrizePaise
    );

    // Create challenge match
    const challengeMatch = await db.challengeMatch.create({
      data: {
        cityId: city.id,
        sport: sport as SportType || city.sport,
        title,
        description,
        matchDate: new Date(matchDate),
        registrationDeadline: new Date(registrationDeadline),
        // Venue
        venueId: venue?.id || null,
        venueName: venue?.name || venueName,
        venueAddress: venue?.address || venueAddress,
        venueMapsUrl: venue?.googleMapsUrl || venueMapsUrl,
        // Scheduling
        startTime: startTime || 600, // Default 10 AM
        endTime: endTime || (startTime ? startTime + estimatedDuration : null),
        estimatedDuration: estimatedDuration || 120, // Default 2 hours
        // Format & Players
        format: format as TournamentFormat || 'INDIVIDUAL',
        matchType: matchType || '1v1',
        playerSlots: totalPlayerSlots,
        minPlayers: minPlayersCount,
        maxPlayers: maxPlayersCount,
        // Rules
        matchFormat: matchFormat || 'BEST_OF_1',
        scoreTarget,
        rules,
        tieBreakRule,
        // Fee & Prize (stored in paise)
        entryFee: entryFeePaise,
        adminFeePercentage: ADMIN_FEE_PERCENTAGE,
        prizePoolPercentage: PRIZE_POOL_PERCENTAGE,
        // Calculated financial fields
        totalCollection: financials.totalCollection,
        adminFee: financials.adminFee,
        prizePool: financials.prizePool,
        firstPrizeAmount: financials.firstPrize,
        secondPrizeAmount: financials.secondPrize,
        basePrizePool: basePrizePaise,
        // Sponsor
        sponsorName,
        sponsorLogo,
        sponsorAmount: sponsorAmountPaise,
        sponsorMessage,
        // Visibility
        visibility: visibility || 'PUBLIC',
        skillLevel: skillLevel || 'OPEN',
        // Creator
        createdById,
        status: 'OPEN',
      },
    });

    // Reserve venue slot if venue was selected
    if (venueId && startTime && estimatedDuration) {
      await db.venueSlot.create({
        data: {
          venueId,
          date: new Date(matchDate),
          startTime,
          endTime: startTime + estimatedDuration,
          duration: estimatedDuration,
          maxPlayers: totalPlayerSlots,
          format: format as TournamentFormat || 'INDIVIDUAL',
          status: VenueSlotStatus.RESERVED,
          reservedById: challengeMatch.id,
          reservedAt: new Date(),
        }
      });
    }

    // Auto-join creator to the match
    await db.challengeMatch.update({
      where: { id: challengeMatch.id },
      data: {
        joinedCount: 1,
        joinedUserIds: JSON.stringify([{
          userId: createdById,
          joinedAt: new Date().toISOString(),
          paymentStatus: 'PENDING'
        }])
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...challengeMatch,
        entryFeeDisplay: challengeMatch.entryFee / 100,
        firstPrizeDisplay: challengeMatch.firstPrizeAmount / 100,
        secondPrizeDisplay: challengeMatch.secondPrizeAmount / 100,
      },
      message: 'Challenge match created successfully',
    });
  } catch (error) {
    console.error('Error creating challenge match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create challenge match' },
      { status: 500 }
    );
  }
}
