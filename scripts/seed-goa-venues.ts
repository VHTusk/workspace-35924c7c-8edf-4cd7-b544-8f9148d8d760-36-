import { db } from '@/lib/db';
import { SportType, VenueStatus } from '@prisma/client';

async function main() {
  console.log('🌱 Seeding Goa venues for challenger mode testing...\n');
  
  // Find or create a city for North Goa - Cornhole
  let northGoaCornhole = await db.city.findFirst({
    where: {
      cityName: { contains: 'North Goa' },
      sport: SportType.CORNHOLE
    }
  });
  
  if (!northGoaCornhole) {
    console.log('Creating North Goa city for Cornhole...');
    northGoaCornhole = await db.city.create({
      data: {
        cityId: 'VH-CITY-NORTH-GOA-CORNHOLE',
        cityName: 'North Goa',
        state: 'Goa',
        country: 'India',
        sport: SportType.CORNHOLE,
        playerCount: 50,
        tournamentCount: 5
      }
    });
  }
  console.log('North Goa (Cornhole):', northGoaCornhole.cityId);
  
  // Find or create a city for North Goa - Darts
  let northGoaDarts = await db.city.findFirst({
    where: {
      cityName: { contains: 'North Goa' },
      sport: SportType.DARTS
    }
  });
  
  if (!northGoaDarts) {
    console.log('Creating North Goa city for Darts...');
    northGoaDarts = await db.city.create({
      data: {
        cityId: 'VH-CITY-NORTH-GOA-DARTS',
        cityName: 'North Goa',
        state: 'Goa',
        country: 'India',
        sport: SportType.DARTS,
        playerCount: 35,
        tournamentCount: 3
      }
    });
  }
  console.log('North Goa (Darts):', northGoaDarts.cityId);
  
  // Create demo venues for CORNHOLE
  const cornholeVenues = [
    {
      id: 'venue-cornhole-baga',
      name: 'Baga Beach Cornhole Arena',
      displayName: 'Baga Beach Cornhole Arena, North Goa',
      address: 'Baga Beach Road, Near Titos Lane, Baga, Goa 403516',
      locality: 'Baga Beach',
      landmark: 'Near Titos Lane',
      googleMapsUrl: 'https://maps.google.com/?q=Baga+Beach+Goa',
      contactPhone: '+91 98765 43210',
      contactEmail: 'baga@cornholegoa.com',
      sport: SportType.CORNHOLE,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES']),
      playAreas: JSON.stringify([
        { id: 'court1', name: 'Beach Court 1', type: 'outdoor', capacity: 4 },
        { id: 'court2', name: 'Beach Court 2', type: 'outdoor', capacity: 4 },
        { id: 'court3', name: 'Beach Court 3', type: 'outdoor', capacity: 4 },
      ]),
      totalPlayAreas: 3,
      openingTime: 360,  // 6:00 AM
      closingTime: 1260, // 9:00 PM
      defaultMatchDuration: 30,
      bufferTimeBetweenMatches: 10,
      amenities: JSON.stringify(['parking', 'restrooms', 'food_stalls', 'beach_access']),
      cityId: northGoaCornhole.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    },
    {
      id: 'venue-cornhole-candolim',
      name: 'Candolim Sports Club',
      displayName: 'Candolim Sports Club, North Goa',
      address: 'Candolim Main Road, Near Fort Aguada, Candolim, Goa 403515',
      locality: 'Candolim',
      landmark: 'Near Fort Aguada',
      googleMapsUrl: 'https://maps.google.com/?q=Candolim+Goa',
      contactPhone: '+91 98765 43211',
      contactEmail: 'candolim@cornholegoa.com',
      sport: SportType.CORNHOLE,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES', 'TEAM']),
      playAreas: JSON.stringify([
        { id: 'court1', name: 'Main Court', type: 'indoor', capacity: 4 },
        { id: 'court2', name: 'Practice Court', type: 'indoor', capacity: 2 },
      ]),
      totalPlayAreas: 2,
      openingTime: 480,  // 8:00 AM
      closingTime: 1320, // 10:00 PM
      defaultMatchDuration: 25,
      bufferTimeBetweenMatches: 10,
      amenities: JSON.stringify(['parking', 'restrooms', 'cafe', 'ac', 'lockers']),
      cityId: northGoaCornhole.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    },
    {
      id: 'venue-cornhole-mapusa',
      name: 'Mapusa Cornhole Center',
      displayName: 'Mapusa Cornhole Center, North Goa',
      address: 'Mapusa Market Road, Near Municipal Garden, Mapusa, Goa 403507',
      locality: 'Mapusa',
      landmark: 'Near Municipal Garden',
      googleMapsUrl: 'https://maps.google.com/?q=Mapusa+Goa',
      contactPhone: '+91 98765 43212',
      contactEmail: 'mapusa@cornholegoa.com',
      sport: SportType.CORNHOLE,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES']),
      playAreas: JSON.stringify([
        { id: 'court1', name: 'Court A', type: 'outdoor', capacity: 4 },
        { id: 'court2', name: 'Court B', type: 'outdoor', capacity: 4 },
        { id: 'court3', name: 'Court C', type: 'outdoor', capacity: 4 },
        { id: 'court4', name: 'Court D', type: 'outdoor', capacity: 4 },
      ]),
      totalPlayAreas: 4,
      openingTime: 360,  // 6:00 AM
      closingTime: 1200, // 8:00 PM
      defaultMatchDuration: 30,
      bufferTimeBetweenMatches: 15,
      amenities: JSON.stringify(['parking', 'restrooms', 'food_court']),
      cityId: northGoaCornhole.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    }
  ];
  
  // Create demo venues for DARTS
  const dartsVenues = [
    {
      id: 'venue-darts-panaji',
      name: 'Panaji Darts Lounge',
      displayName: 'Panaji Darts Lounge, Goa',
      address: 'DB Marg, Near MG Road, Panaji, Goa 403001',
      locality: 'Panaji',
      landmark: 'Near MG Road',
      googleMapsUrl: 'https://maps.google.com/?q=Panaji+Goa',
      contactPhone: '+91 98765 43220',
      contactEmail: 'panaji@dartsgoa.com',
      sport: SportType.DARTS,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES']),
      playAreas: JSON.stringify([
        { id: 'lane1', name: 'Lane 1', type: 'indoor', capacity: 2 },
        { id: 'lane2', name: 'Lane 2', type: 'indoor', capacity: 2 },
        { id: 'lane3', name: 'Lane 3', type: 'indoor', capacity: 2 },
        { id: 'lane4', name: 'Lane 4', type: 'indoor', capacity: 2 },
        { id: 'lane5', name: 'Lane 5', type: 'indoor', capacity: 2 },
      ]),
      totalPlayAreas: 5,
      openingTime: 600,  // 10:00 AM
      closingTime: 1380, // 11:00 PM
      defaultMatchDuration: 20,
      bufferTimeBetweenMatches: 5,
      amenities: JSON.stringify(['parking', 'restrooms', 'bar', 'ac', 'snacks']),
      cityId: northGoaDarts.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    },
    {
      id: 'venue-darts-calangute',
      name: 'Calangute Darts Arena',
      displayName: 'Calangute Darts Arena, North Goa',
      address: 'Calangute Beach Road, Near St Alex Church, Calangute, Goa 403516',
      locality: 'Calangute',
      landmark: 'Near St Alex Church',
      googleMapsUrl: 'https://maps.google.com/?q=Calangute+Goa',
      contactPhone: '+91 98765 43221',
      contactEmail: 'calangute@dartsgoa.com',
      sport: SportType.DARTS,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES', 'TEAM']),
      playAreas: JSON.stringify([
        { id: 'lane1', name: 'Pro Lane 1', type: 'indoor', capacity: 2 },
        { id: 'lane2', name: 'Pro Lane 2', type: 'indoor', capacity: 2 },
        { id: 'lane3', name: 'Casual Lane', type: 'indoor', capacity: 2 },
      ]),
      totalPlayAreas: 3,
      openingTime: 540,  // 9:00 AM
      closingTime: 1320, // 10:00 PM
      defaultMatchDuration: 25,
      bufferTimeBetweenMatches: 10,
      amenities: JSON.stringify(['parking', 'restrooms', 'cafe', 'ac', 'wifi']),
      cityId: northGoaDarts.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    },
    {
      id: 'venue-darts-anjuna',
      name: 'Anjuna Darts Club',
      displayName: 'Anjuna Darts Club, North Goa',
      address: 'Anjuna Beach Road, Near Flea Market, Anjuna, Goa 403509',
      locality: 'Anjuna',
      landmark: 'Near Flea Market',
      googleMapsUrl: 'https://maps.google.com/?q=Anjuna+Goa',
      contactPhone: '+91 98765 43222',
      contactEmail: 'anjuna@dartsgoa.com',
      sport: SportType.DARTS,
      supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES']),
      playAreas: JSON.stringify([
        { id: 'lane1', name: 'Beach Lane 1', type: 'outdoor', capacity: 2 },
        { id: 'lane2', name: 'Beach Lane 2', type: 'outdoor', capacity: 2 },
      ]),
      totalPlayAreas: 2,
      openingTime: 480,  // 8:00 AM
      closingTime: 1200, // 8:00 PM
      defaultMatchDuration: 20,
      bufferTimeBetweenMatches: 10,
      amenities: JSON.stringify(['parking', 'restrooms', 'beach_access', 'music']),
      cityId: northGoaDarts.id,
      status: VenueStatus.ACTIVE,
      isActive: true
    }
  ];
  
  // Create all venues
  const allVenues = [...cornholeVenues, ...dartsVenues];
  
  for (const venue of allVenues) {
    try {
      const existing = await db.venue.findUnique({ where: { id: venue.id } });
      if (existing) {
        console.log(`Venue ${venue.id} already exists, updating...`);
        await db.venue.update({
          where: { id: venue.id },
          data: venue
        });
      } else {
        console.log(`Creating venue ${venue.id}...`);
        await db.venue.create({ data: venue });
      }
    } catch (error) {
      console.error(`Error with venue ${venue.id}:`, error);
    }
  }
  
  console.log('\n✅ Venue seeding complete!');
  
  // List all venues
  const venues = await db.venue.findMany({
    where: {
      OR: [
        { cityId: northGoaCornhole.id },
        { cityId: northGoaDarts.id }
      ]
    },
    include: { city: true }
  });
  
  console.log('\n📍 Venues in North Goa:');
  venues.forEach(v => {
    console.log(`  - ${v.name} (${v.sport})`);
    const playAreas = JSON.parse(v.playAreas || '[]');
    playAreas.forEach((area: { id: string; name: string }) => {
      console.log(`    └── ${area.name}`);
    });
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
