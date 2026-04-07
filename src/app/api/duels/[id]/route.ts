/**
 * Duel Detail API - Get, Join, Cancel Duel
 * 
 * GET /api/duels/[id] - Get full duel details (transparency)
 * POST /api/duels/[id] - Join a duel
 * DELETE /api/duels/[id] - Cancel a duel (host only, with fee)
 * 
 * @version 3.73.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DuelStatus, PaymentLedgerStatus } from '@prisma/client';

// Configuration
const DUEL_CONFIG = {
  cancellationFee: 2500,      // ₹25 cancellation fee (in paise)
  platformFeePercent: 10,
  checkInWindowMinutes: 30,   // Check-in opens 30 mins before match
  lockBeforeMatchMinutes: 15, // Cannot join within 15 mins of match
};

// GET - Full Duel Details (Complete Transparency)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const duel = await db.duelMatch.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            district: true,
            state: true,
            verified: true,
            hiddenElo: true,
            createdAt: true,
            _count: {
              select: {
                hostedDuels: true,
                wonDuels: true,
              }
            }
          }
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            googleMapsUrl: true,
            contactPhone: true,
            amenities: true,
          }
        },
        venueSlot: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            slotFee: true,
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                city: true,
                hiddenElo: true,
                verified: true,
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        _count: {
          select: { participants: true }
        }
      }
    });
    
    if (!duel) {
      return NextResponse.json(
        { success: false, error: 'Duel not found' },
        { status: 404 }
      );
    }
    
    // Increment view count
    await db.duelMatch.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });
    
    // Calculate financial breakdown
    const totalEntryFees = duel.entryFee * duel._count.participants;
    const platformFee = Math.round(totalEntryFees * (duel.platformFeePercent / 100));
    const netPrizePool = totalEntryFees - platformFee;
    
    // Format response with COMPLETE transparency
    const response = {
      // Basic Info
      id: duel.id,
      sport: duel.sport,
      city: duel.city,
      format: duel.format,
      status: duel.status,
      
      // Host (Full Details)
      host: {
        id: duel.host.id,
        name: `${duel.host.firstName} ${duel.host.lastName}`,
        city: duel.host.city,
        district: duel.host.district,
        state: duel.host.state,
        verified: duel.host.verified,
        rating: Math.round(duel.host.hiddenElo),
        memberSince: duel.host.createdAt,
        stats: {
          duelsHosted: duel.host._count.hostedDuels,
          duelsWon: duel.host._count.wonDuels,
        },
        // Contact (only visible to registered participants)
        contact: null, // Will be populated for participants
      },
      
      // Venue (Full Details with Map)
      venue: duel.venue ? {
        name: duel.venue.name,
        address: duel.venue.address,
        city: duel.venue.city,
        googleMapsUrl: duel.venue.googleMapsUrl,
        contactPhone: duel.venue.contactPhone,
        amenities: duel.venue.amenities ? JSON.parse(duel.venue.amenities) : [],
        slot: duel.venueSlot ? {
          date: duel.venueSlot.date,
          time: `${duel.venueSlot.startTime} - ${duel.venueSlot.endTime}`,
          slotFee: duel.venueSlot.slotFee,
        } : null,
      } : {
        name: duel.venueName,
        address: duel.venueAddress,
        googleMapsUrl: duel.venueGoogleMapsUrl,
        slot: null,
      },
      
      // Timing
      scheduledStart: duel.scheduledStart,
      durationMinutes: duel.durationMinutes,
      checkInOpensAt: new Date(duel.scheduledStart.getTime() - DUEL_CONFIG.checkInWindowMinutes * 60 * 1000),
      
      // Financials (100% Transparent)
      financials: {
        entryFee: duel.entryFee,
        entryFeeFormatted: `₹${(duel.entryFee / 100).toFixed(2)}`,
        
        // Current breakdown
        currentParticipants: duel._count.participants,
        totalEntryFeesCollected: totalEntryFees,
        platformFeeAmount: platformFee,
        platformFeePercent: duel.platformFeePercent,
        netPrizePool: netPrizePool,
        
        // Potential (if full)
        potentialParticipants: duel.maxParticipants,
        potentialTotalEntryFees: duel.entryFee * duel.maxParticipants,
        potentialPlatformFee: Math.round(duel.entryFee * duel.maxParticipants * (duel.platformFeePercent / 100)),
        potentialNetPrizePool: duel.entryFee * duel.maxParticipants - Math.round(duel.entryFee * duel.maxParticipants * (duel.platformFeePercent / 100)),
        
        // Winner takes all (1v1)
        winnerTakesAll: duel.format === 'INDIVIDUAL' && duel.maxParticipants === 2,
      },
      
      // Participants (Visible)
      participants: duel.participants.map(p => ({
        id: p.id,
        userId: p.user.id,
        name: `${p.user.firstName} ${p.user.lastName}`,
        city: p.user.city,
        rating: Math.round(p.user.hiddenElo),
        verified: p.user.verified,
        joinedAt: p.joinedAt,
        checkedIn: p.checkedIn,
        paymentStatus: p.paymentStatus,
        isHost: p.userId === duel.hostId,
      })),
      
      // Slots
      slots: {
        current: duel._count.participants,
        max: duel.maxParticipants,
        available: duel.maxParticipants - duel._count.participants,
      },
      
      // Rules
      matchRules: duel.matchRules ? JSON.parse(duel.matchRules) : null,
      customTerms: duel.customTerms,
      
      // Escalation
      escalation: {
        isEscalatable: duel.isEscalatable,
        threshold: duel.escalationThreshold,
        currentCount: duel._count.participants,
        willEscalate: duel.isEscalatable && duel._count.participants >= duel.escalationThreshold,
      },
      
      // Status Timeline
      timeline: {
        createdAt: duel.createdAt,
        publishedAt: duel.publishedAt,
        expiresAt: duel.expiresAt,
        completedAt: duel.completedAt,
        cancelledAt: duel.cancelledAt,
      },
      
      // Stats
      viewCount: duel.viewCount + 1, // Include current view
      
      // Can Join?
      canJoin: duel.status === 'OPEN' && 
               duel._count.participants < duel.maxParticipants &&
               new Date(duel.scheduledStart.getTime() - DUEL_CONFIG.lockBeforeMatchMinutes * 60 * 1000) > new Date(),
    };
    
    return NextResponse.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('[DUEL_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch duel' },
      { status: 500 }
    );
  }
}

// POST - Join a Duel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, paymentId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Get duel
    const duel = await db.duelMatch.findUnique({
      where: { id },
      include: {
        participants: true,
        host: true,
      }
    });
    
    if (!duel) {
      return NextResponse.json(
        { success: false, error: 'Duel not found' },
        { status: 404 }
      );
    }
    
    // Validate status
    if (duel.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: 'Duel is not open for registration' },
        { status: 400 }
      );
    }
    
    // Check if full
    if (duel.participants.length >= duel.maxParticipants) {
      return NextResponse.json(
        { success: false, error: 'Duel is full' },
        { status: 400 }
      );
    }
    
    // Check if already joined
    const alreadyJoined = duel.participants.find(p => p.userId === userId);
    if (alreadyJoined) {
      return NextResponse.json(
        { success: false, error: 'You have already joined this duel' },
        { status: 400 }
      );
    }
    
    // Cannot join within 15 minutes of match
    const lockTime = new Date(duel.scheduledStart.getTime() - DUEL_CONFIG.lockBeforeMatchMinutes * 60 * 1000);
    if (new Date() >= lockTime) {
      return NextResponse.json(
        { success: false, error: 'Registration closed (within 15 minutes of match)' },
        { status: 400 }
      );
    }
    
    // Verify user exists and city matches
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, city: true, sport: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // City must match (geo-lock)
    if (user.city?.toLowerCase() !== duel.city.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'You can only join duels in your city' },
        { status: 400 }
      );
    }
    
    // Create registration
    const registration = await db.duelRegistration.create({
      data: {
        duelMatchId: id,
        userId,
        amount: duel.entryFee,
        paymentStatus: paymentId ? 'PAID' : 'INITIATED',
        paymentId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });
    
    // Update duel status if now full
    if (duel.participants.length + 1 >= duel.maxParticipants) {
      await db.duelMatch.update({
        where: { id },
        data: { status: 'FULL' }
      });
    }
    
    // Check escalation
    const shouldEscalate = duel.isEscalatable && 
                          duel.participants.length + 1 >= duel.escalationThreshold;
    
    return NextResponse.json({
      success: true,
      data: {
        registration: {
          id: registration.id,
          duelMatchId: registration.duelMatchId,
          user: registration.user,
          amount: registration.amount,
          paymentStatus: registration.paymentStatus,
          joinedAt: registration.joinedAt,
        },
        duel: {
          currentParticipants: duel.participants.length + 1,
          maxParticipants: duel.maxParticipants,
          status: duel.participants.length + 1 >= duel.maxParticipants ? 'FULL' : 'OPEN',
        },
        willEscalate: shouldEscalate,
        message: shouldEscalate 
          ? 'Duel threshold reached! This match will be converted to a tournament.'
          : 'Successfully joined duel!',
      }
    });
    
  } catch (error) {
    console.error('[DUEL_JOIN]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join duel' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a Duel (Host Only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const hostId = searchParams.get('hostId');
    const reason = searchParams.get('reason');
    
    if (!hostId) {
      return NextResponse.json(
        { success: false, error: 'Host ID is required' },
        { status: 400 }
      );
    }
    
    // Get duel
    const duel = await db.duelMatch.findUnique({
      where: { id },
      include: {
        participants: true,
      }
    });
    
    if (!duel) {
      return NextResponse.json(
        { success: false, error: 'Duel not found' },
        { status: 404 }
      );
    }
    
    // Verify host
    if (duel.hostId !== hostId) {
      return NextResponse.json(
        { success: false, error: 'Only the host can cancel this duel' },
        { status: 403 }
      );
    }
    
    // Check if already completed or cancelled
    if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(duel.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot cancel duel with status: ${duel.status}` },
        { status: 400 }
      );
    }
    
    // Check if participants have joined
    const hasParticipants = duel.participants.length > 0;
    
    // If participants exist, host CANNOT cancel
    if (hasParticipants) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel duel with registered participants. Contact support.' },
        { status: 400 }
      );
    }
    
    // No participants - can cancel with fee deduction
    const cancellationFee = DUEL_CONFIG.cancellationFee;
    
    // Update duel status
    const cancelledDuel = await db.duelMatch.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: hostId,
        cancellationReason: reason || 'Host cancelled',
        cancellationFee,
      }
    });
    
    // Release venue slot if this duel reserved one.
    await db.duelVenueSlot.updateMany({
      where: { duelMatchId: duel.id },
      data: {
        duelMatchId: null,
        status: 'AVAILABLE',
        lockedById: null,
        lockedAt: null,
        lockExpiresAt: null,
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        duel: cancelledDuel,
        cancellationFee: {
          amount: cancellationFee,
          formatted: `₹${(cancellationFee / 100).toFixed(2)}`,
          note: 'Cancellation fee deducted for venue slot reservation',
        },
        message: 'Duel cancelled successfully. Cancellation fee has been applied.',
      }
    });
    
  } catch (error) {
    console.error('[DUEL_CANCEL]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel duel' },
      { status: 500 }
    );
  }
}
