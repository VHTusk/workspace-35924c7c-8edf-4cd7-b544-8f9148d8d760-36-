/**
 * Seed script to create Jaipur district for testing
 * Run with: npx tsx scripts/seed-districts.ts
 */

import { db } from '../src/lib/db';
import { SportType } from '@prisma/client';

function generateCityId(cityName: string, state: string, sport: SportType): string {
  const normalizedCity = cityName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedState = state.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `VH-CITY-${normalizedCity}-${normalizedState}-${sport}`;
}

async function main() {
  console.log('Creating Jaipur districts...\n');

  const districts = [
    { cityName: 'Jaipur', state: 'Rajasthan', country: 'India', sport: 'CORNHOLE' as SportType },
    { cityName: 'Jaipur', state: 'Rajasthan', country: 'India', sport: 'DARTS' as SportType },
    // Add more test districts
    { cityName: 'Delhi', state: 'Delhi', country: 'India', sport: 'CORNHOLE' as SportType },
    { cityName: 'Delhi', state: 'Delhi', country: 'India', sport: 'DARTS' as SportType },
    { cityName: 'Mumbai', state: 'Maharashtra', country: 'India', sport: 'CORNHOLE' as SportType },
    { cityName: 'Mumbai', state: 'Maharashtra', country: 'India', sport: 'DARTS' as SportType },
    { cityName: 'Bangalore', state: 'Karnataka', country: 'India', sport: 'CORNHOLE' as SportType },
    { cityName: 'Bangalore', state: 'Karnataka', country: 'India', sport: 'DARTS' as SportType },
  ];

  for (const district of districts) {
    const cityId = generateCityId(district.cityName, district.state, district.sport);
    
    const existing = await db.city.findUnique({
      where: { cityId },
    });

    if (existing) {
      console.log(`✓ ${district.cityName}, ${district.state} (${district.sport}) already exists`);
      console.log(`  ID: ${cityId}`);
      console.log(`  View at: /${district.sport.toLowerCase()}/dashboard/district/${cityId}\n`);
      continue;
    }

    const city = await db.city.create({
      data: {
        cityId,
        cityName: district.cityName,
        state: district.state,
        country: district.country,
        sport: district.sport,
        status: 'ACTIVE',
        isActive: true,
        playerCount: Math.floor(Math.random() * 100) + 10, // Sample data
        activePlayersCount: Math.floor(Math.random() * 50) + 5,
        tournamentCount: Math.floor(Math.random() * 10),
        matchCount: Math.floor(Math.random() * 100),
        duelMatchCount: Math.floor(Math.random() * 50),
      },
    });

    console.log(`✓ Created ${district.cityName}, ${district.state} (${district.sport})`);
    console.log(`  ID: ${city.cityId}`);
    console.log(`  View at: /${district.sport.toLowerCase()}/dashboard/district/${city.cityId}\n`);
  }

  // List all districts
  const allDistricts = await db.city.findMany({
    orderBy: [{ sport: 'asc' }, { cityName: 'asc' }],
  });

  console.log('========================================');
  console.log(`Total districts in database: ${allDistricts.length}`);
  console.log('========================================\n');

  console.log('All District URLs:\n');
  for (const d of allDistricts) {
    console.log(`[${d.sport}] ${d.cityName}, ${d.state}`);
    console.log(`  Browse: /${d.sport.toLowerCase()}/dashboard/districts`);
    console.log(`  View:   /${d.sport.toLowerCase()}/dashboard/district/${d.cityId}\n`);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding districts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
