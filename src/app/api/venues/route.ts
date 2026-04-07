/**
 * Venues API - List and manage venues for challenge matches
 * 
 * GET /api/venues - List venues for a city/district
 * POST /api/venues - Create a new venue (admin only)
 * 
 * @version 4.7.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, VenueStatus } from '@prisma/client';

// GET - List Venues for a City/District
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Required filters
    const cityId = searchParams.get('cityId');
    const sport = searchParams.get('sport') as SportType | null;
    const format = searchParams.get('format'); // INDIVIDUAL, DOUBLES, TEAM
    
    if (!cityId) {
      return NextResponse.json(
        { success: false, error: 'cityId is required' },
        { status: 400 }
      );
    }
    
    // Find the city
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
    
    // Build venue query
    const where: Record<string, unknown> = {
      cityId: city.id,
      isActive: true,
    };
    
    if (sport) {
      where.sport = sport;
    }
    
    // Fetch venues
    const venues = await db.venue.findMany({
      where,
      orderBy: [
        { verifiedAt: 'desc' }, // Verified venues first
        { name: 'asc' }
      ],
    });
    
    // Filter by supported format if provided
    let filteredVenues = venues;
    if (format) {
      filteredVenues = venues.filter(venue => {
        if (!venue.supportedFormats) return true; // If not specified, assume all formats supported
        try {
          const formats = JSON.parse(venue.supportedFormats);
          return formats.includes(format);
        } catch {
          return true;
        }
      });
    }
    
    // Format venues for response
    const formattedVenues = filteredVenues.map(venue => {
      let playAreas: Array<{ id: string; name: string; type: string; capacity: number }> = [];
      let amenities: string[] = [];
      
      try {
        if (venue.playAreas) {
          playAreas = JSON.parse(venue.playAreas);
        }
        if (venue.amenities) {
          amenities = JSON.parse(venue.amenities);
        }
      } catch {
        // Ignore parse errors
      }
      
      return {
        id: venue.id,
        name: venue.name,
        displayName: venue.displayName || venue.name,
        address: venue.address,
        locality: venue.locality,
        landmark: venue.landmark,
        googleMapsUrl: venue.googleMapsUrl,
        contactPhone: venue.contactPhone,
        contactEmail: venue.contactEmail,
        sport: venue.sport,
        totalPlayAreas: venue.totalPlayAreas,
        playAreas,
        amenities,
        openingTime: venue.openingTime,
        closingTime: venue.closingTime,
        defaultMatchDuration: venue.defaultMatchDuration,
        bufferTimeBetweenMatches: venue.bufferTimeBetweenMatches,
        isVerified: !!venue.verifiedAt,
        status: venue.status,
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        venues: formattedVenues,
        total: formattedVenues.length,
        city: {
          id: city.id,
          cityId: city.cityId,
          name: city.cityName,
          state: city.state,
        }
      }
    });
    
  } catch (error) {
    console.error('[VENUES_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}

// POST - Create a new Venue (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cityId,
      name,
      displayName,
      address,
      locality,
      landmark,
      googleMapsUrl,
      contactPhone,
      contactEmail,
      sport,
      supportedFormats,
      playAreas,
      totalPlayAreas,
      openingTime,
      closingTime,
      defaultMatchDuration,
      bufferTimeBetweenMatches,
      amenities,
      managedById,
    } = body;
    
    // Validate required fields
    if (!cityId || !name || !address || !sport) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: cityId, name, address, sport' },
        { status: 400 }
      );
    }
    
    // Find the city
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
    
    // Create venue
    const venue = await db.venue.create({
      data: {
        cityId: city.id,
        name,
        displayName,
        address,
        locality,
        landmark,
        googleMapsUrl,
        contactPhone,
        contactEmail,
        sport: sport as SportType,
        supportedFormats: supportedFormats ? JSON.stringify(supportedFormats) : null,
        playAreas: playAreas ? JSON.stringify(playAreas) : null,
        totalPlayAreas: totalPlayAreas || (playAreas?.length || 1),
        openingTime: openingTime || 600,  // 10 AM
        closingTime: closingTime || 1380, // 11 PM
        defaultMatchDuration: defaultMatchDuration || 30,
        bufferTimeBetweenMatches: bufferTimeBetweenMatches || 15,
        amenities: amenities ? JSON.stringify(amenities) : null,
        managedById,
        status: VenueStatus.ACTIVE,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: venue,
      message: 'Venue created successfully',
    });
    
  } catch (error) {
    console.error('[VENUES_POST]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create venue' },
      { status: 500 }
    );
  }
}
