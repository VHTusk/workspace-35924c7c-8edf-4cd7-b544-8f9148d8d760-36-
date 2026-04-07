/**
 * Demo Data Enhancement Script
 * 
 * Enhances the base seed data with:
 * - Rating history snapshots for ELO charts
 * - Organization-specific data (schools, colleges, corporates)
 * - Inter-institution tournaments
 * - Sample notifications for all categories
 * - Demo leaderboards with history
 * 
 * Run after the main seed: npx prisma db seed
 * Or run separately: npx ts-node prisma/demo-enhancements.ts
 */

import { PrismaClient, SportType, NotificationType, OrgType } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Helper Functions
// ============================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================
// Rating History Generator
// ============================================

async function generateRatingHistorySnapshots() {
  console.log('📈 Generating rating history snapshots...');

  const players = await prisma.user.findMany({
    where: { role: 'PLAYER', isActive: true },
    select: { id: true, hiddenElo: true, sport: true },
  });

  let created = 0;

  for (const player of players) {
    // Generate 30-90 days of rating history
    const numSnapshots = randomInt(20, 50);
    const now = new Date();
    
    // Calculate realistic starting and ending ELO
    const currentElo = Math.round(player.hiddenElo);
    const volatility = randomInt(50, 150);
    const trend = Math.random() > 0.5 ? 1 : -1; // Improving or declining
    
    let rating = currentElo - (trend * randomInt(50, 150));

    for (let i = numSnapshots; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Add realistic daily variation
      const dailyChange = (Math.random() - 0.5) * volatility * 0.3;
      const trendChange = trend * (randomInt(1, 5));
      
      rating = Math.max(800, Math.min(2500, rating + dailyChange + trendChange));

      await prisma.ratingSnapshot.create({
        data: {
          playerId: player.id,
          sport: player.sport,
          rating: Math.round(rating),
          rd: 350 - randomInt(0, 150),
          createdAt: date,
        },
      });
      created++;
    }
  }

  console.log(`✅ Created ${created} rating history snapshots`);
}

// ============================================
// Organization Data Enhancement
// ============================================

async function createDemoOrganizations() {
  console.log('🏢 Creating demo organizations...');

  const hashedPassword = '$2a$10$demo.hash.for.presentations';

  const orgs = [
    // Schools
    { name: 'Delhi Public School, Mumbai', type: OrgType.SCHOOL, city: 'Mumbai', state: 'Maharashtra' },
    { name: 'St. Xavier\'s High School, Pune', type: OrgType.SCHOOL, city: 'Pune', state: 'Maharashtra' },
    { name: 'Kendriya Vidyalaya, Bengaluru', type: OrgType.SCHOOL, city: 'Bengaluru', state: 'Karnataka' },
    
    // Colleges
    { name: 'IIT Bombay Sports Club', type: OrgType.COLLEGE, city: 'Mumbai', state: 'Maharashtra' },
    { name: 'St. Stephen\'s College, Delhi', type: OrgType.COLLEGE, city: 'Delhi', state: 'Delhi' },
    { name: 'Christ University, Bengaluru', type: OrgType.COLLEGE, city: 'Bengaluru', state: 'Karnataka' },
    
    // Corporates
    { name: 'Tata Consultancy Services', type: OrgType.CORPORATE, city: 'Mumbai', state: 'Maharashtra' },
    { name: 'Infosys Sports Club', type: OrgType.CORPORATE, city: 'Bengaluru', state: 'Karnataka' },
    { name: 'Reliance Industries Ltd', type: OrgType.CORPORATE, city: 'Mumbai', state: 'Maharashtra' },
  ];

  let created = 0;

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    for (const orgData of orgs) {
      const org = await prisma.organization.create({
        data: {
          sport,
          name: `${orgData.name} - ${sport}`,
          type: orgData.type,
          email: `sports@${orgData.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          password: hashedPassword,
          phone: `+91${randomInt(7000000000, 9999999999)}`,
          city: orgData.city,
          state: orgData.state,
          district: `${orgData.city} District`,
        },
      });

      // Add some players to roster
      const players = await prisma.user.findMany({
        where: { sport, city: orgData.city, isActive: true },
        take: randomInt(3, 8),
      });

      for (const player of players) {
        await prisma.orgRosterPlayer.create({
          data: {
            orgId: org.id,
            userId: player.id,
            sport,
            isActive: true,
          },
        });
      }

      created++;
    }
  }

  console.log(`✅ Created ${created} demo organizations`);
}

// ============================================
// Inter-Institution Tournaments
// ============================================

async function createInterOrgTournaments() {
  console.log('🏆 Creating inter-institution tournaments...');

  const organizations = await prisma.organization.findMany({
    where: { type: { in: [OrgType.SCHOOL, OrgType.COLLEGE, OrgType.CORPORATE] } },
  });

  const now = new Date();
  let created = 0;

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    const sportOrgs = organizations.filter(o => o.sport === sport);
    
    // Inter-school tournament
    const schoolOrgs = sportOrgs.filter(o => o.type === OrgType.SCHOOL);
    if (schoolOrgs.length >= 2) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + randomInt(7, 14));

      const tournament = await prisma.tournament.create({
        data: {
          name: `Inter-School ${sport} Championship 2025`,
          sport,
          type: 'INTER_ORG',
          scope: 'STATE',
          location: 'Mumbai Sports Complex',
          city: 'Mumbai',
          state: 'Maharashtra',
          startDate,
          endDate: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          regDeadline: new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          prizePool: 50000,
          entryFee: 200,
          maxPlayers: 32,
          maxPlayersPerOrg: 4,
          format: 'INDIVIDUAL',
          isPublic: true,
          status: 'REGISTRATION_OPEN',
          managerName: 'School Sports Coordinator',
          managerPhone: `+91${randomInt(7000000000, 9999999999)}`,
        },
      });

      // Register some school players
      for (const org of schoolOrgs.slice(0, 3)) {
        const roster = await prisma.orgRosterPlayer.findMany({
          where: { orgId: org.id, isActive: true },
          take: 2,
        });

        for (const rp of roster) {
          await prisma.tournamentRegistration.create({
            data: {
              tournamentId: tournament.id,
              userId: rp.userId,
              status: 'CONFIRMED',
              amount: tournament.entryFee,
            },
          });
        }
      }

      created++;
    }

    // Inter-college tournament
    const collegeOrgs = sportOrgs.filter(o => o.type === OrgType.COLLEGE);
    if (collegeOrgs.length >= 2) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + randomInt(14, 21));

      const tournament = await prisma.tournament.create({
        data: {
          name: `Inter-College ${sport} League 2025`,
          sport,
          type: 'INTER_ORG',
          scope: 'STATE',
          location: 'University Sports Ground, Bengaluru',
          city: 'Bengaluru',
          state: 'Karnataka',
          startDate,
          endDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          regDeadline: new Date(startDate.getTime() - 5 * 24 * 60 * 60 * 1000),
          prizePool: 75000,
          entryFee: 300,
          maxPlayers: 48,
          maxPlayersPerOrg: 6,
          format: 'INDIVIDUAL',
          isPublic: true,
          status: 'REGISTRATION_OPEN',
          managerName: 'College Sports Committee',
          managerPhone: `+91${randomInt(7000000000, 9999999999)}`,
        },
      });

      created++;
    }

    // Corporate tournament
    const corporateOrgs = sportOrgs.filter(o => o.type === OrgType.CORPORATE);
    if (corporateOrgs.length >= 2) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + randomInt(21, 30));

      const tournament = await prisma.tournament.create({
        data: {
          name: `Corporate ${sport} Challenge 2025`,
          sport,
          type: 'INTER_ORG',
          scope: 'CITY',
          location: 'Corporate Sports Arena, Mumbai',
          city: 'Mumbai',
          state: 'Maharashtra',
          startDate,
          endDate: new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000),
          regDeadline: new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          prizePool: 100000,
          entryFee: 500,
          maxPlayers: 24,
          maxPlayersPerOrg: 4,
          format: 'INDIVIDUAL',
          isPublic: true,
          status: 'REGISTRATION_OPEN',
          managerName: 'Corporate Events Team',
          managerPhone: `+91${randomInt(7000000000, 9999999990)}`,
        },
      });

      created++;
    }
  }

  console.log(`✅ Created ${created} inter-institution tournaments`);
}

// ============================================
// Sample Notifications
// ============================================

async function createSampleNotifications() {
  console.log('🔔 Creating sample notifications...');

  const players = await prisma.user.findMany({
    where: { role: 'PLAYER', isActive: true },
    take: 20,
  });

  const notificationTemplates = [
    { type: NotificationType.TOURNAMENT_REGISTERED, title: 'Registration Confirmed', message: 'You have been registered for Mumbai Cornhole Championship 2025' },
    { type: NotificationType.MATCH_RESULT, title: 'Match Result Published', message: 'Your match against Rahul Sharma: 21-15 (Won)' },
    { type: NotificationType.POINTS_EARNED, title: 'Points Earned', message: 'You earned 6 points for your State level victory' },
    { type: NotificationType.RANK_CHANGE, title: 'Rank Update', message: 'Your city ranking improved from #12 to #8!' },
    { type: NotificationType.MILESTONE, title: 'Milestone Achieved', message: 'Congratulations! You\'ve played 50 matches' },
    { type: NotificationType.WAITLIST_PROMOTED, title: 'Spot Opened!', message: 'A spot opened up for Pune Darts Open. Complete payment within 24 hours.' },
    { type: NotificationType.TEAM_INVITATION, title: 'Team Invitation', message: 'Vikram Patel invited you to join "Champions Squad"' },
    { type: NotificationType.NEW_FOLLOWER, title: 'New Follower', message: 'Priya Sharma started following you' },
  ];

  let created = 0;

  for (const player of players) {
    // Create 3-5 random notifications for each player
    const numNotifications = randomInt(3, 5);
    const templates = [...notificationTemplates].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numNotifications && i < templates.length; i++) {
      const template = templates[i];
      
      await prisma.notification.create({
        data: {
          userId: player.id,
          sport: player.sport,
          type: template.type,
          title: template.title,
          message: template.message,
          isRead: Math.random() > 0.6, // 40% unread
          readAt: Math.random() > 0.6 ? new Date() : null,
          createdAt: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000),
        },
      });
      created++;
    }
  }

  console.log(`✅ Created ${created} sample notifications`);
}

// ============================================
// Leaderboard History Snapshots
// ============================================

async function createLeaderboardHistory() {
  console.log('📊 Creating leaderboard history...');

  const players = await prisma.user.findMany({
    where: { role: 'PLAYER', isActive: true, showOnLeaderboard: true },
    select: { id: true, sport: true, hiddenElo: true, visiblePoints: true, city: true },
  });

  let created = 0;
  const now = new Date();

  // Create weekly snapshots for the past 4 weeks
  for (let week = 0; week < 4; week++) {
    const snapshotDate = new Date(now);
    snapshotDate.setDate(snapshotDate.getDate() - (week * 7));

    for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
      const sportPlayers = players
        .filter(p => p.sport === sport)
        .sort((a, b) => b.hiddenElo - a.hiddenElo);

      for (let i = 0; i < sportPlayers.length; i++) {
        const player = sportPlayers[i];
        
        await prisma.leaderboardSnapshot.create({
          data: {
            sport,
            type: 'NATIONAL',
            scopeValue: null,
            periodStart: snapshotDate,
            snapshotDate,
            userId: player.id,
            rank: i + 1,
            previousRank: week > 0 ? i + 1 + randomInt(-3, 3) : null,
            visiblePoints: player.visiblePoints + randomInt(-50, 50),
            hiddenElo: player.hiddenElo + randomInt(-20, 20),
            matchesPlayed: randomInt(20, 60),
            wins: randomInt(10, 40),
            winRate: Math.random() * 0.4 + 0.5,
            rankChange: week > 0 ? randomInt(-5, 5) : null,
            isActive: week === 0,
          },
        });
        created++;
      }
    }
  }

  console.log(`✅ Created ${created} leaderboard history snapshots`);
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('🚀 Starting demo data enhancements...\n');

  try {
    await generateRatingHistorySnapshots();
    await createDemoOrganizations();
    await createInterOrgTournaments();
    await createSampleNotifications();
    await createLeaderboardHistory();

    console.log('\n🎉 Demo enhancements completed!');
  } catch (error) {
    console.error('❌ Error during enhancements:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
