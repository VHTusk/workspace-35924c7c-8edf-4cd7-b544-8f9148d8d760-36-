import { PrismaClient, SportType, TournamentType, TournamentScope, TournamentStatus, BracketFormat } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏆 Creating test tournaments for March 2025...');

  // Get admin user for createdById
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!admin) {
    console.error('❌ No admin user found. Run the main seed first.');
    return;
  }

  // Create demo players for testing
  const demoPlayers = [];
  for (let i = 1; i <= 16; i++) {
    const player = await prisma.user.upsert({
      where: {
        email_sport: {
          email: `player${i}@test.com`,
          sport: SportType.CORNHOLE,
        },
      },
      update: {},
      create: {
        email: `player${i}@test.com`,
        password: 'hashed_password', // Will be hashed on actual login
        firstName: `Player`,
        lastName: `${i}`,
        sport: SportType.CORNHOLE,
        role: 'PLAYER',
        city: ['Jaipur', 'Delhi', 'Mumbai', 'Ahmedabad', 'Pune', 'Hyderabad'][i % 6],
        state: ['Rajasthan', 'Delhi', 'Maharashtra', 'Gujarat', 'Maharashtra', 'Telangana'][i % 6],
        hiddenElo: 1400 + (i * 30),
        visiblePoints: 100 + (i * 50),
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // Create rating for player
    await prisma.playerRating.upsert({
      where: { userId: player.id },
      update: {},
      create: {
        userId: player.id,
        sport: SportType.CORNHOLE,
        matchesPlayed: 10 + i,
        wins: 5 + Math.floor(i / 2),
        losses: 5 - Math.floor(i / 2),
        highestElo: 1400 + (i * 35),
      },
    });

    demoPlayers.push(player);
  }

  console.log(`✅ Created ${demoPlayers.length} demo players`);

  // March 2025 tournaments
  const tournaments = [
    {
      name: "Jaipur Cornhole Championship 2025",
      sport: SportType.CORNHOLE,
      type: TournamentType.INDIVIDUAL,
      scope: TournamentScope.CITY,
      location: "Jaipur Sports Complex, Mansarovar, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      startDate: new Date("2025-03-15T09:00:00"),
      endDate: new Date("2025-03-15T18:00:00"),
      regDeadline: new Date("2025-03-14T23:59:59"),
      prizePool: 50000, // ₹50,000
      entryFee: 500, // ₹500
      maxPlayers: 32,
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
    {
      name: "Rajasthan State Cornhole League",
      sport: SportType.CORNHOLE,
      type: TournamentType.INDIVIDUAL,
      scope: TournamentScope.STATE,
      location: "SMS Stadium, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      startDate: new Date("2025-03-22T09:00:00"),
      endDate: new Date("2025-03-23T18:00:00"),
      regDeadline: new Date("2025-03-20T23:59:59"),
      prizePool: 200000, // ₹2,00,000
      entryFee: 1000, // ₹1,000
      maxPlayers: 64,
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
    {
      name: "Darts Premier League - Delhi Edition",
      sport: SportType.DARTS,
      type: TournamentType.INDIVIDUAL,
      scope: TournamentScope.CITY,
      location: "Delhi Sports Arena, Connaught Place, New Delhi",
      city: "New Delhi",
      state: "Delhi",
      startDate: new Date("2025-03-08T10:00:00"),
      endDate: new Date("2025-03-08T20:00:00"),
      regDeadline: new Date("2025-03-07T23:59:59"),
      prizePool: 30000, // ₹30,000
      entryFee: 500, // ₹500
      maxPlayers: 24,
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
    {
      name: "Holi Cornhole Festival",
      sport: SportType.CORNHOLE,
      type: TournamentType.INDIVIDUAL,
      scope: TournamentScope.DISTRICT,
      location: "Central Park, Jaipur",
      city: "Jaipur",
      district: "Jaipur",
      state: "Rajasthan",
      startDate: new Date("2025-03-14T08:00:00"),
      endDate: new Date("2025-03-14T17:00:00"),
      regDeadline: new Date("2025-03-13T23:59:59"),
      prizePool: 25000, // ₹25,000
      entryFee: 500, // ₹500
      maxPlayers: 32,
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
    {
      name: "Corporate Darts Championship",
      sport: SportType.DARTS,
      type: TournamentType.INTER_ORG,
      scope: TournamentScope.CITY,
      location: "Crystal Palm Mall, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      startDate: new Date("2025-03-29T10:00:00"),
      endDate: new Date("2025-03-29T18:00:00"),
      regDeadline: new Date("2025-03-27T23:59:59"),
      prizePool: 100000, // ₹1,00,000
      entryFee: 5000, // ₹5,000 per team
      maxPlayers: 16, // 16 teams
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
    {
      name: "Weekend Darts League",
      sport: SportType.DARTS,
      type: TournamentType.INDIVIDUAL,
      scope: TournamentScope.CITY,
      location: "Sports Bar, C-Scheme, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      startDate: new Date("2025-03-01T16:00:00"),
      endDate: new Date("2025-03-01T22:00:00"),
      regDeadline: new Date("2025-02-28T23:59:59"),
      prizePool: 15000, // ₹15,000
      entryFee: 500, // ₹500
      maxPlayers: 16,
      bracketFormat: BracketFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      isPublic: true,
      createdById: admin.id,
    },
  ];

  for (const tournamentData of tournaments) {
    const existing = await prisma.tournament.findFirst({
      where: { name: tournamentData.name },
    });

    if (!existing) {
      const tournament = await prisma.tournament.create({
        data: tournamentData,
      });
      console.log(`✅ Created: ${tournament.name} (Entry: ₹${tournament.entryFee})`);
    } else {
      console.log(`⏭️  Already exists: ${tournamentData.name}`);
    }
  }

  // Create SportRules if not exist
  await prisma.sportRules.upsert({
    where: { sport: SportType.CORNHOLE },
    update: {},
    create: {
      sport: SportType.CORNHOLE,
      cityParticipation: 1,
      cityWin: 2,
      districtParticipation: 1,
      districtWin: 3,
      stateParticipation: 2,
      stateWin: 4,
      nationalParticipation: 3,
      nationalWin: 6,
    },
  });

  await prisma.sportRules.upsert({
    where: { sport: SportType.DARTS },
    update: {},
    create: {
      sport: SportType.DARTS,
      cityParticipation: 1,
      cityWin: 2,
      districtParticipation: 1,
      districtWin: 3,
      stateParticipation: 2,
      stateWin: 4,
      nationalParticipation: 3,
      nationalWin: 6,
    },
  });

  console.log('🎉 Tournament seeding complete!');
  console.log('\n📋 Test Tournaments Created:');
  console.log('   - Jaipur Cornhole Championship 2025 (₹500 entry)');
  console.log('   - Rajasthan State Cornhole League (₹1,000 entry)');
  console.log('   - Darts Premier League - Delhi Edition (₹500 entry)');
  console.log('   - Holi Cornhole Festival (₹500 entry)');
  console.log('   - Corporate Darts Championship (₹5,000 team entry)');
  console.log('   - Weekend Darts League (₹500 entry)');
  console.log('\n🧪 Test Players Created:');
  console.log('   - player1@test.com to player16@test.com');
  console.log('   - Password: test123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
