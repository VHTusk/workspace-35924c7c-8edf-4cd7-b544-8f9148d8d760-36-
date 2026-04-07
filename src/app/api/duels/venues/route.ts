/**
 * Duel Venues API - List available venues for duels
 * 
 * GET /api/duels/venues - List venues for a city/sport
 * 
 * @version 3.73.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// GET - List Duel Venues
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Required filters
    const city = searchParams.get('city');
    const sport = searchParams.get('sport') as SportType | null;
    
    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City is required' },
        { status: 400 }
      );
    }
    
    // Build query
    const where: Record<string, unknown> = {
      city: { equals: city, mode: 'insensitive' },
      isActive: true,
      isDuelEligible: true,
    };
    
    if (sport && ['CORNHOLE', 'DARTS'].includes(sport)) {
      where.sport = sport;
    }
    
    // Fetch venues
    const venues = await db.duelVenue.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        contactPhone: true,
        venueType: true,
        amenities: true,
        googleMapsUrl: true,
        latitude: true,
        longitude: true,
        totalDuelsHosted: true,
      },
      orderBy: [
        { totalDuelsHosted: 'desc' },
        { name: 'asc' }
      ],
      take: 20,
    });
    
    // Parse amenities JSON
    const formattedVenues = venues.map(venue => ({
      ...venue,
      phone: venue.contactPhone,
      amenities: venue.amenities ? JSON.parse(venue.amenities) : [],
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        venues: formattedVenues,
        total: venues.length,
      }
    });
    
  } catch (error) {
    console.error('[DUEL_VENUES_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}
