/**
 * Venue Slots API - Get available time slots for a venue
 * 
 * GET /api/venues/[id]/slots - Get available slots with dynamic duration
 * 
 * Features:
 * - Dynamic duration calculation based on player count
 * - Slot merging for longer matches
 * - Availability checking
 * 
 * @version 4.7.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VenueSlotStatus, TournamentFormat } from '@prisma/client';

// Dynamic duration calculation constants
const MATCH_DURATION_CONFIG = {
  CORNHOLE: {
    baseMinutes: 20,          // Base match duration
    perPlayerMinutes: 5,      // Additional time per player beyond 2
    bufferMinutes: 10,        // Buffer between matches
    finalBufferMinutes: 15,   // Extra buffer for finals
  },
  DARTS: {
    baseMinutes: 25,
    perPlayerMinutes: 5,
    bufferMinutes: 10,
    finalBufferMinutes: 15,
  }
};

// Calculate required duration based on players and format
function calculateRequiredDuration(
  playerSlots: number,
  matchType: string,
  matchFormat: string,
  sport: 'CORNHOLE' | 'DARTS'
): number {
  const config = MATCH_DURATION_CONFIG[sport] || MATCH_DURATION_CONFIG.CORNHOLE;
  
  // Base duration for a single match
  let baseMatchDuration = config.baseMinutes;
  
  // Add time based on match format
  const formatMultiplier = matchFormat === 'BEST_OF_3' ? 2.5 : 
                           matchFormat === 'BEST_OF_5' ? 4 : 1;
  baseMatchDuration = Math.round(baseMatchDuration * formatMultiplier);
  
  // Calculate number of rounds based on player slots
  // For bracket format: log2(players) rounds
  const rounds = Math.ceil(Math.log2(playerSlots));
  
  // Total duration = base match * rounds + buffer between rounds
  // For simplicity, assume matches can happen in parallel on multiple courts
  // But sequential rounds need to wait
  let totalDuration = baseMatchDuration; // At least one match
  
  if (playerSlots > 2) {
    // Multiple rounds - each round needs time
    // Assume parallel play capacity reduces effective rounds
    const effectiveRounds = Math.max(1, Math.ceil(rounds * 0.7)); // 30% parallel efficiency
    totalDuration = baseMatchDuration * effectiveRounds + (config.bufferMinutes * (effectiveRounds - 1));
  }
  
  // Add time for additional players beyond minimum
  const extraPlayers = Math.max(0, playerSlots - 2);
  totalDuration += Math.ceil(extraPlayers * config.perPlayerMinutes / 4); // Amortized over rounds
  
  // Round to nearest 15 minutes
  totalDuration = Math.ceil(totalDuration / 15) * 15;
  
  // Minimum 30 minutes, maximum 6 hours
  return Math.min(Math.max(totalDuration, 30), 360);
}

// Generate available time slots for a venue
function generateTimeSlots(
  openingTime: number,  // Minutes from midnight
  closingTime: number,  // Minutes from midnight
  requiredDuration: number,
  bufferMinutes: number,
  playAreas: Array<{ id: string; name: string; type: string; capacity: number }>
): Array<{
  playAreaId: string;
  playAreaName: string;
  startTime: number;
  endTime: number;
  duration: number;
}> {
  const slots: Array<{
    playAreaId: string;
    playAreaName: string;
    startTime: number;
    endTime: number;
    duration: number;
  }> = [];
  
  const slotDuration = requiredDuration + bufferMinutes;
  
  for (const area of playAreas) {
    let currentTime = openingTime;
    
    while (currentTime + requiredDuration <= closingTime) {
      slots.push({
        playAreaId: area.id,
        playAreaName: area.name,
        startTime: currentTime,
        endTime: currentTime + requiredDuration,
        duration: requiredDuration,
      });
      
      currentTime += slotDuration;
    }
  }
  
  return slots;
}

// Convert minutes to time string
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

// GET - Get available slots for a venue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Get query parameters
    const dateStr = searchParams.get('date');
    const playerSlots = parseInt(searchParams.get('playerSlots') || '8');
    const matchType = searchParams.get('matchType') || '1v1';
    const matchFormat = searchParams.get('matchFormat') || 'BEST_OF_1';
    const sport = (searchParams.get('sport') || 'CORNHOLE') as 'CORNHOLE' | 'DARTS';
    
    if (!dateStr) {
      return NextResponse.json(
        { success: false, error: 'Date is required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      );
    }
    
    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return NextResponse.json(
        { success: false, error: 'Cannot book slots in the past' },
        { status: 400 }
      );
    }
    
    // Fetch venue
    const venue = await db.venue.findUnique({
      where: { id: venueId },
    });
    
    if (!venue) {
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );
    }
    
    // Calculate required duration
    const requiredDuration = calculateRequiredDuration(
      playerSlots,
      matchType,
      matchFormat,
      sport
    );
    
    // Parse play areas
    let playAreas: Array<{ id: string; name: string; type: string; capacity: number }> = [];
    try {
      if (venue.playAreas) {
        playAreas = JSON.parse(venue.playAreas);
      }
    } catch {
      // If no play areas, create default one
      playAreas = [{
        id: 'main',
        name: 'Main Area',
        type: 'general',
        capacity: playerSlots
      }];
    }
    
    // If no play areas defined, create default
    if (playAreas.length === 0) {
      playAreas = [{
        id: 'main',
        name: 'Main Area',
        type: 'general',
        capacity: playerSlots
      }];
    }
    
    // Generate potential time slots
    const potentialSlots = generateTimeSlots(
      venue.openingTime,
      venue.closingTime,
      requiredDuration,
      venue.bufferTimeBetweenMatches,
      playAreas
    );
    
    // Fetch existing reservations for this date
    const existingSlots = await db.venueSlot.findMany({
      where: {
        venueId,
        date: {
          gte: new Date(dateStr + 'T00:00:00.000Z'),
          lt: new Date(dateStr + 'T23:59:59.999Z'),
        },
        status: {
          in: [VenueSlotStatus.RESERVED, VenueSlotStatus.BLOCKED]
        }
      },
    });
    
    // Filter out unavailable slots
    const availableSlots = potentialSlots.filter(slot => {
      // Check if this slot conflicts with any existing reservation
      return !existingSlots.some(existing => {
        if (existing.playAreaId && existing.playAreaId !== slot.playAreaId) {
          return false; // Different play area, no conflict
        }
        
        // Check time overlap
        const existingStart = existing.startTime;
        const existingEnd = existing.endTime;
        
        return (
          (slot.startTime >= existingStart && slot.startTime < existingEnd) ||
          (slot.endTime > existingStart && slot.endTime <= existingEnd) ||
          (slot.startTime <= existingStart && slot.endTime >= existingEnd)
        );
      });
    });
    
    // Format slots for response
    const formattedSlots = availableSlots.map(slot => ({
      id: `${venueId}-${dateStr}-${slot.playAreaId}-${slot.startTime}`,
      playAreaId: slot.playAreaId,
      playAreaName: slot.playAreaName,
      startTime: slot.startTime,
      startTimeStr: minutesToTimeString(slot.startTime),
      endTime: slot.endTime,
      endTimeStr: minutesToTimeString(slot.endTime),
      duration: slot.duration,
      durationStr: `${Math.floor(slot.duration / 60)}h ${slot.duration % 60}m`,
      isAvailable: true,
    }));
    
    // Group slots by play area
    const slotsByPlayArea = formattedSlots.reduce((acc, slot) => {
      const key = slot.playAreaId;
      if (!acc[key]) {
        acc[key] = {
          playAreaId: slot.playAreaId,
          playAreaName: slot.playAreaName,
          slots: [],
        };
      }
      acc[key].slots.push(slot);
      return acc;
    }, {} as Record<string, { playAreaId: string; playAreaName: string; slots: typeof formattedSlots }>);
    
    return NextResponse.json({
      success: true,
      data: {
        venue: {
          id: venue.id,
          name: venue.name,
          displayName: venue.displayName || venue.name,
          address: venue.address,
          openingTime: venue.openingTime,
          closingTime: venue.closingTime,
        },
        date: dateStr,
        requirements: {
          playerSlots,
          matchType,
          matchFormat,
          requiredDuration,
          requiredDurationStr: `${Math.floor(requiredDuration / 60)}h ${requiredDuration % 60}m`,
        },
        playAreas: Object.values(slotsByPlayArea),
        totalSlots: formattedSlots.length,
        hasAvailability: formattedSlots.length > 0,
        // Provide alternative suggestions if no slots available
        alternatives: formattedSlots.length === 0 ? generateAlternativeSuggestions(date, requiredDuration) : [],
      }
    });
    
  } catch (error) {
    console.error('[VENUE_SLOTS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch venue slots' },
      { status: 500 }
    );
  }
}

// Generate alternative suggestions when no slots available
function generateAlternativeSuggestions(date: Date, duration: number): Array<{
  type: string;
  message: string;
}> {
  const suggestions = [];
  
  // Check if early morning might work
  suggestions.push({
    type: 'TIME',
    message: `Try an earlier time slot (before 10 AM) for better availability`,
  });
  
  // Check if late evening might work
  suggestions.push({
    type: 'TIME',
    message: `Evening slots (after 6 PM) may have better availability`,
  });
  
  // Suggest different date
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  suggestions.push({
    type: 'DATE',
    message: `Try ${tomorrow.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })} for more options`,
  });
  
  // Suggest reducing duration
  if (duration > 60) {
    suggestions.push({
      type: 'DURATION',
      message: `Consider reducing match format (Best of 1 instead of Best of 3) for shorter duration`,
    });
  }
  
  return suggestions;
}
