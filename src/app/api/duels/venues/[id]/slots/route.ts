/**
 * Duel Venue Slots API - Get available time slots for a venue
 * 
 * GET /api/duels/venues/[id]/slots - List available slots
 * 
 * @version 3.73.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List Available Slots for a Venue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Get required duration in minutes
    const duration = parseInt(searchParams.get('duration') || '120');
    
    // Get date range (default: next 7 days)
    const daysAhead = parseInt(searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead);
    
    // Fetch venue to verify it exists
    const venue = await db.duelVenue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true }
    });
    
    if (!venue) {
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );
    }
    
    // Fetch available slots
    const slots = await db.duelVenueSlot.findMany({
      where: {
        venueId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'AVAILABLE',
        durationMinutes: { gte: duration }, // Slot must be long enough
        // Not locked or lock expired
        OR: [
          { lockedById: null },
          { lockExpiresAt: { lt: new Date() } }
        ]
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ],
      take: 30,
    });
    
    // Format slots
    const formattedSlots = slots.map(slot => ({
      id: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      slotFee: slot.slotFee,
      isAvailable: true,
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        venue: {
          id: venue.id,
          name: venue.name,
        },
        slots: formattedSlots,
        total: formattedSlots.length,
      }
    });
    
  } catch (error) {
    console.error('[DUEL_VENUE_SLOTS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch slots' },
      { status: 500 }
    );
  }
}
