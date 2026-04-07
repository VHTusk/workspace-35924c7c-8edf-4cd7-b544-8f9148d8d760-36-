/**
 * Seed Script for Venues
 * 
 * Run with: npx tsx prisma/seed-venues.ts
 * 
 * This script adds sample venues for testing the Challenge Match feature
 */

import { PrismaClient, SportType, VenueStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding venues...');

  // Find or create cities
  const cities = await prisma.city.findMany();
  console.log(`Found ${cities.length} cities`);

  if (cities.length === 0) {
    console.log('No cities found. Creating sample cities...');
    
    // Create sample cities
    const sampleCities = [
      { cityId: 'VH-CITY-JAIPUR-RAJASTHAN-CORNHOLE', cityName: 'Jaipur', state: 'Rajasthan', sport: SportType.CORNHOLE },
      { cityId: 'VH-CITY-JAIPUR-RAJASTHAN-DARTS', cityName: 'Jaipur', state: 'Rajasthan', sport: SportType.DARTS },
      { cityId: 'VH-CITY-DELHI-DELHI-CORNHOLE', cityName: 'Delhi', state: 'Delhi', sport: SportType.CORNHOLE },
      { cityId: 'VH-CITY-DELHI-DELHI-DARTS', cityName: 'Delhi', state: 'Delhi', sport: SportType.DARTS },
      { cityId: 'VH-CITY-MUMBAI-MAHARASHTRA-CORNHOLE', cityName: 'Mumbai', state: 'Maharashtra', sport: SportType.CORNHOLE },
      { cityId: 'VH-CITY-MUMBAI-MAHARASHTRA-DARTS', cityName: 'Mumbai', state: 'Maharashtra', sport: SportType.DARTS },
    ];

    for (const cityData of sampleCities) {
      await prisma.city.create({
        data: {
          ...cityData,
          country: 'India',
          status: 'ACTIVE',
          isActive: true,
        }
      });
    }
    console.log('Created sample cities');
  }

  // Get all cities again
  const allCities = await prisma.city.findMany();

  // Sample venues for each city
  const venueData = [
    {
      name: 'City Sports Complex',
      displayName: 'City Sports Complex, Main Area',
      address: 'Sector 5, Main Area, City Center',
      locality: 'Main Area',
      landmark: 'Near Metro Station',
      googleMapsUrl: 'https://maps.google.com/?q=Sports+Complex',
      contactPhone: '+91-141-2356789',
      contactEmail: 'info@sportscomplex.com',
      playAreas: [
        { id: 'court1', name: 'Court 1', type: 'outdoor', capacity: 4 },
        { id: 'court2', name: 'Court 2', type: 'outdoor', capacity: 4 },
        { id: 'court3', name: 'Court 3', type: 'indoor', capacity: 2 },
        { id: 'court4', name: 'Court 4', type: 'indoor', capacity: 2 },
      ],
      amenities: ['parking', 'restrooms', 'cafe', 'lockers', 'wifi'],
      openingTime: 360,   // 6:00 AM
      closingTime: 1320, // 10:00 PM
      defaultMatchDuration: 45,
      bufferTimeBetweenMatches: 15,
    },
    {
      name: 'Central Stadium',
      displayName: 'Central Stadium, Downtown',
      address: 'Downtown Area, City Center',
      locality: 'Downtown',
      landmark: 'Near City Mall',
      googleMapsUrl: 'https://maps.google.com/?q=Central+Stadium',
      contactPhone: '+91-141-2567890',
      playAreas: [
        { id: 'main', name: 'Main Ground', type: 'outdoor', capacity: 16 },
        { id: 'indoor1', name: 'Indoor Hall 1', type: 'indoor', capacity: 8 },
        { id: 'indoor2', name: 'Indoor Hall 2', type: 'indoor', capacity: 8 },
      ],
      amenities: ['parking', 'restrooms', 'cafe', 'first-aid'],
      openingTime: 420,   // 7:00 AM
      closingTime: 1260, // 9:00 PM
      defaultMatchDuration: 60,
      bufferTimeBetweenMatches: 20,
    },
  ];

  // Create venues for each city
  for (const city of allCities) {
    for (let i = 0; i < venueData.length; i++) {
      const venueTemplate = venueData[i];
      const venueName = `${city.cityName} ${venueTemplate.name}`;
      const venueDisplayName = venueTemplate.displayName.replace('City', city.cityName);
      
      // Check if venue already exists
      const existing = await prisma.venue.findFirst({
        where: {
          cityId: city.id,
          name: venueName,
        }
      });

      if (existing) {
        console.log(`Venue "${venueName}" already exists in ${city.cityName}`);
        continue;
      }

      await prisma.venue.create({
        data: {
          cityId: city.id,
          name: venueName,
          displayName: venueDisplayName,
          address: venueTemplate.address,
          locality: venueTemplate.locality,
          landmark: venueTemplate.landmark,
          googleMapsUrl: venueTemplate.googleMapsUrl,
          contactPhone: venueTemplate.contactPhone,
          contactEmail: venueTemplate.contactEmail,
          sport: city.sport,
          supportedFormats: JSON.stringify(['INDIVIDUAL', 'DOUBLES', 'TEAM']),
          playAreas: JSON.stringify(venueTemplate.playAreas),
          totalPlayAreas: venueTemplate.playAreas.length,
          openingTime: venueTemplate.openingTime,
          closingTime: venueTemplate.closingTime,
          defaultMatchDuration: venueTemplate.defaultMatchDuration,
          bufferTimeBetweenMatches: venueTemplate.bufferTimeBetweenMatches,
          amenities: JSON.stringify(venueTemplate.amenities),
          status: VenueStatus.ACTIVE,
          isActive: true,
          verifiedAt: new Date(),
        }
      });
      console.log(`Created venue "${venueName}" in ${city.cityName}`);
    }
  }

  console.log('Seeding completed!');
  
  // Summary
  const venueCount = await prisma.venue.count();
  console.log(`Total venues: ${venueCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
