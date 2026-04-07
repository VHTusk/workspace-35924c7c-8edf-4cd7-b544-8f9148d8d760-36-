/**
 * Duel Mode API - Create and List Duels
 * 
 * POST /api/duels - Create a new duel (submits for approval)
 * GET /api/duels - List approved/open duels (geo-filtered feed)
 * 
 * @version 3.73.0 - Added admin approval workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DuelStatus, DuelFormat, SportType, DuelApprovalStatus } from '@prisma/client';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// Configuration
const DUEL_CONFIG = {
  minEntryFee: 500,           // ₹5 minimum (in paise)
  maxEntryFee: 50000,         // ₹500 maximum (in paise)
  platformFeePercent: 10,     // 10% platform fee
  minParticipants: 4,         // Minimum for knockout
  maxParticipants: 16,        // Maximum for knockout
  minScheduleHours: 2,        // Minimum 2 hours in advance
  maxDuelsPerUserPerDay: 5,   // Anti-fraud limit
};

// GET - List Approved Duels (Geo-filtered Feed)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Required: User's city (for geo-lock)
    const city = searchParams.get('city');
    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City is required for geo-locking' },
        { status: 400 }
      );
    }
    
    // Filters
    const sport = searchParams.get('sport') as SportType | null;
    const format = searchParams.get('format') as DuelFormat | null;
    const minFee = parseInt(searchParams.get('minFee') || '0');
    const maxFee = parseInt(searchParams.get('maxFee') || '999999999');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build query - Only show APPROVED and OPEN duels
    const where: Record<string, unknown> = {
      city: { equals: city, mode: 'insensitive' },
      status: 'OPEN',
      approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] },
      isPublic: true,
    };
    
    if (sport && ['CORNHOLE', 'DARTS'].includes(sport)) {
      where.sport = sport;
    }
    
    if (format) {
      where.format = format;
    }
    
    if (minFee > 0 || maxFee < 999999999) {
      where.entryFee = {
        gte: minFee,
        lte: maxFee,
      };
    }
    
    if (dateFrom || dateTo) {
      where.scheduledStart = {};
      if (dateFrom) (where.scheduledStart as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.scheduledStart as Record<string, unknown>).lte = new Date(dateTo);
    }
    
    // Only show duels that haven't expired
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ];
    
    // Fetch duels
    const [duels, total] = await Promise.all([
      db.duelMatch.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: true,
              verified: true,
              hiddenElo: true,
            }
          },
          venue: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              googleMapsUrl: true,
            }
          },
          _count: {
            select: { participants: true }
          }
        },
        orderBy: [
          { scheduledStart: 'asc' },
          { prizePool: 'desc' }
        ],
        take: limit,
        skip: offset,
      }),
      db.duelMatch.count({ where })
    ]);
    
    // Format response
    const formattedDuels = duels.map(duel => ({
      id: duel.id,
      sport: duel.sport,
      city: duel.city,
      format: duel.format,
      
      // Host info
      host: {
        id: duel.host.id,
        name: `${duel.host.firstName} ${duel.host.lastName}`,
        city: duel.host.city,
        verified: duel.host.verified,
        rating: Math.round(duel.host.hiddenElo),
      },
      
      // Venue info
      venue: duel.venue ? {
        name: duel.venue.name,
        address: duel.venue.address,
        googleMapsUrl: duel.venue.googleMapsUrl,
      } : {
        name: duel.venueName,
        address: duel.venueAddress,
        googleMapsUrl: duel.venueGoogleMapsUrl,
      },
      
      // Timing
      scheduledStart: duel.scheduledStart,
      durationMinutes: duel.durationMinutes,
      
      // Financials (fully transparent)
      entryFee: duel.entryFee,
      prizePool: duel.prizePool,
      platformFeePercent: duel.platformFeePercent,
      
      // Participants
      currentParticipants: duel._count.participants,
      maxParticipants: duel.maxParticipants,
      availableSlots: duel.maxParticipants - duel._count.participants,
      
      // Status
      status: duel.status,
      approvalStatus: duel.approvalStatus,
      expiresAt: duel.expiresAt,
      
      // Rules
      matchRules: duel.matchRules ? JSON.parse(duel.matchRules) : null,
      customTerms: duel.customTerms,
      
      createdAt: duel.createdAt,
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        duels: formattedDuels,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        filters: {
          city,
          sport,
          format,
        }
      }
    });
    
  } catch (error) {
    console.error('[DUELS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch duels' },
      { status: 500 }
    );
  }
}

// POST - Create a New Duel (Submits for Approval)
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    const {
      sport,
      city,
      hostId,
      format = 'INDIVIDUAL',
      
      // Venue
      venueId,
      venueSlotId,
      venueName,
      venueAddress,
      venuePhone,
      venueGoogleMapsUrl,
      scheduledStart,
      durationMinutes = 120,
      
      // Participants
      maxParticipants = 8,
      
      // Financials
      entryFee,
      
      // Rules
      matchRules,
      customTerms,
      
      // Contact for approval
      contactPhone,
      contactEmail,
      
    } = body;
    
    // Validation
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Valid sport (CORNHOLE/DARTS) is required' },
        { status: 400 }
      );
    }
    
    if (!city || typeof city !== 'string') {
      return NextResponse.json(
        { success: false, error: 'City is required for geo-locking' },
        { status: 400 }
      );
    }
    
    if (hostId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Host ID must match authenticated user' },
        { status: 403 }
      );
    }
    
    if (!scheduledStart) {
      return NextResponse.json(
        { success: false, error: 'Scheduled start time is required' },
        { status: 400 }
      );
    }
    
    // Validate entry fee
    if (!entryFee || entryFee < DUEL_CONFIG.minEntryFee || entryFee > DUEL_CONFIG.maxEntryFee) {
      return NextResponse.json(
        { success: false, error: `Entry fee must be between ₹${DUEL_CONFIG.minEntryFee/100} and ₹${DUEL_CONFIG.maxEntryFee/100}` },
        { status: 400 }
      );
    }
    
    // Validate participants
    if (maxParticipants < DUEL_CONFIG.minParticipants || maxParticipants > DUEL_CONFIG.maxParticipants) {
      return NextResponse.json(
        { success: false, error: `Participants must be between ${DUEL_CONFIG.minParticipants} and ${DUEL_CONFIG.maxParticipants}` },
        { status: 400 }
      );
    }
    
    // Validate scheduled time (must be at least 2 hours in future)
    const scheduledDate = new Date(scheduledStart);
    const minTime = new Date(Date.now() + DUEL_CONFIG.minScheduleHours * 60 * 60 * 1000);
    if (scheduledDate < minTime) {
      return NextResponse.json(
        { success: false, error: `Duel must be scheduled at least ${DUEL_CONFIG.minScheduleHours} hours in advance` },
        { status: 400 }
      );
    }
    
    // Contact phone required for approval
    if (!contactPhone) {
      return NextResponse.json(
        { success: false, error: 'Contact phone is required for approval' },
        { status: 400 }
      );
    }
    
    // Check user's duel limit (anti-fraud)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const userDuelsToday = await db.duelMatch.count({
      where: {
        hostId,
        createdAt: { gte: todayStart },
        status: { notIn: ['CANCELLED', 'EXPIRED', 'COMPLETED', 'REJECTED'] }
      }
    });
    
    if (userDuelsToday >= DUEL_CONFIG.maxDuelsPerUserPerDay) {
      return NextResponse.json(
        { success: false, error: `Maximum ${DUEL_CONFIG.maxDuelsPerUserPerDay} active duels per day allowed` },
        { status: 400 }
      );
    }
    
    // Verify host exists and city matches
    const host = await db.user.findUnique({
      where: { id: hostId },
      select: { id: true, city: true, sport: true }
    });
    
    if (!host) {
      return NextResponse.json(
        { success: false, error: 'Host not found' },
        { status: 404 }
      );
    }
    
    // City must match host's profile city
    if (host.city?.toLowerCase() !== city.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Duel city must match your profile city' },
        { status: 400 }
      );
    }
    
    // Calculate prize pool
    const prizePool = Math.round(entryFee * maxParticipants * (1 - DUEL_CONFIG.platformFeePercent / 100));
    
    // Determine if auto-approval is possible
    // Auto-approve if: venue is from platform, slot is available, all logistics checked
    let approvalStatus: DuelApprovalStatus = DuelApprovalStatus.PENDING;
    let autoApproved = false;
    
    if (venueId && venueSlotId) {
      // Check if venue and slot are valid
      const slot = await db.duelVenueSlot.findFirst({
        where: {
          id: venueSlotId,
          venueId,
          status: 'AVAILABLE',
        },
        include: { venue: true }
      });
      
      if (slot && slot.venue.isActive) {
        // All logistics verified - auto-approve
        approvalStatus = DuelApprovalStatus.AUTO_APPROVED;
        autoApproved = true;
      }
    }
    
    // Create duel with PENDING_APPROVAL status
    const duel = await db.duelMatch.create({
      data: {
        sport: sport as SportType,
        city,
        hostId,
        format: format as DuelFormat,
        maxParticipants,
        
        venueId: venueId || null,
        
        // Custom venue fields (if no platform venue)
        venueName: venueName || null,
        venueAddress: venueAddress || null,
        venueGoogleMapsUrl: venueGoogleMapsUrl || null,
        
        scheduledStart: scheduledDate,
        durationMinutes,
        
        entryFee,
        prizePool,
        platformFeePercent: DUEL_CONFIG.platformFeePercent,
        matchRules: matchRules ? JSON.stringify(matchRules) : null,
        customTerms: customTerms || null,
        
        isPublic: true,
        
        // Approval
        approvalStatus,
        approvedAt: autoApproved ? new Date() : null,
        
        // Status depends on approval
        status: autoApproved ? 'OPEN' : 'PENDING_APPROVAL',
        
        // No auto-expiry for knockout challenges
        expiresAt: null,
      },
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
          }
        },
        venue: true,
      }
    });
    
    // Lock the venue slot if provided
    if (venueSlotId && autoApproved) {
      await db.duelVenueSlot.update({
        where: { id: venueSlotId },
        data: {
          duelMatchId: duel.id,
          status: 'RESERVED',
          lockedById: hostId,
          lockedAt: new Date(),
          lockExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour lock
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        duel: {
          id: duel.id,
          sport: duel.sport,
          city: duel.city,
          format: duel.format,
          maxParticipants: duel.maxParticipants,
          host: duel.host,
          venue: duel.venue,
          scheduledStart: duel.scheduledStart,
          durationMinutes: duel.durationMinutes,
          entryFee: duel.entryFee,
          prizePool: duel.prizePool,
          status: duel.status,
          approvalStatus: duel.approvalStatus,
          createdAt: duel.createdAt,
        },
        message: autoApproved 
          ? 'Duel created and auto-approved! It is now live.'
          : 'Duel submitted for approval. You will be notified once approved.',
        requiresApproval: !autoApproved,
      }
    });
    
  } catch (error) {
    console.error('[DUELS_POST]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create duel' },
      { status: 500 }
    );
  }
}
