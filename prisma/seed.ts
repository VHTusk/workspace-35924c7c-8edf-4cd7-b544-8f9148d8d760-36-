import { PrismaClient, SportType, Role, TournamentStatus, TournamentFormat, TournamentScope, TournamentType, GenderCategory, AccountTier, DuelStatus, DuelFormat, DuelApprovalStatus, CityStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Indian names for mock data
const firstNames = [
  'Arjun', 'Rohan', 'Vikram', 'Aditya', 'Karan', 'Rahul', 'Amit', 'Suresh',
  'Priya', 'Anjali', 'Neha', 'Pooja', 'Deepika', 'Kavita', 'Sneha', 'Meera',
  'Raj', 'Aakash', 'Vivek', 'Sanjay', 'Nikhil', 'Prashant', 'Anil', 'Sunil',
  'Divya', 'Shweta', 'Ritu', 'Aarti', 'Nisha', 'Sunita'
];

const lastNames = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Shah',
  'Mehta', 'Reddy', 'Rao', 'Iyer', 'Nair', 'Menon', 'Pillai', 'Chopra',
  'Kapoor', 'Malhotra', 'Bhatia', 'Chadha', 'Agarwal', 'Mittal', 'Bansal', 'Yadav'
];

const cityData = [
  { name: 'Mumbai', state: 'Maharashtra' },
  { name: 'Pune', state: 'Maharashtra' },
  { name: 'Nagpur', state: 'Maharashtra' },
  { name: 'Nashik', state: 'Maharashtra' },
  { name: 'Thane', state: 'Maharashtra' },
  { name: 'Bengaluru', state: 'Karnataka' },
  { name: 'Mysore', state: 'Karnataka' },
  { name: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Coimbatore', state: 'Tamil Nadu' },
  { name: 'Hyderabad', state: 'Telangana' },
  { name: 'Delhi', state: 'Delhi' },
  { name: 'Jaipur', state: 'Rajasthan' },
  { name: 'Ahmedabad', state: 'Gujarat' },
  { name: 'Surat', state: 'Gujarat' },
  { name: 'Kolkata', state: 'West Bengal' },
];

const venues = [
  'Sports Complex', 'Community Center', 'City Stadium', 'Club House',
  'Recreation Center', 'Town Hall Grounds', 'Sports Arena', 'Park Ground',
  'Indoor Stadium', 'Youth Center'
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  return `+91${randomInt(7000000000, 9999999999)}`;
}

function generateEmail(firstName: string, lastName: string, num: number): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@example.com`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  
  // PostgreSQL-compatible data cleanup
  // Delete in order to respect foreign key constraints (child records first)
  // This order is based on the dependency graph of the schema
  const deleteOrder = [
    // Most dependent tables first (children)
    'MatchResultHistory',
    'TournamentRegistration',
    'TournamentWaitlist',
    'MatchCheckIn',
    'CourtAssignment',
    'MatchQueue',
    'VenueFlowLog',
    'VenueHealthAlert',
    'Court',
    'VenueFlowConfig',
    'Match',
    'BracketMatch',
    'Bracket',
    'TournamentMedia',
    'TournamentMediaItem',
    'TournamentSponsor',
    'TournamentCheckin',
    'TournamentAnnouncement',
    'TournamentResult',
    'PrizePayoutRecord',
    'PrizeDistribution',
    'PrizePayout',
    'TournamentReminder',
    'MatchReminder',
    'AutopilotLog',
    'TournamentStaff',
    'ScheduleSlot',
    'Dispute',
    'Notification',
    'PlayerRating',
    'RatingSnapshot',
    'PlayerAchievement',
    'PlayerSkillMetrics',
    'PlayerStreak',
    'PlayerActivityFeedItem',
    'FriendActivity',
    'PlayerTrophy',
    'QuickTeamRequest',
    'PlayerTournamentRecommendation',
    'PlayerSpotlightImage',
    'TournamentGalleryImage',
    'VideoHighlight',
    'TournamentRecap',
    'ShareableResultCard',
    'Milestone',
    'LeaderboardSnapshot',
    'Referral',
    'UserFollow',
    'UserFollowsOrg',
    'OrgFollowsUser',
    'ConversationParticipant',
    'Message',
    'Conversation',
    'ActivityFeed',
    'BlockedPlayer',
    'PlayerAvailability',
    'EmailNotificationSetting',
    'WhatsAppNotificationSetting',
    'PushNotificationSetting',
    'DeviceToken',
    'PushNotificationLog',
    'Wallet',
    'OrgAdmin',
    'OrgRosterPlayer',
    'OrgRosterRequest',
    'PlayerContract',
    'InterOrgTeamPlayer',
    'InterOrgTeamSelection',
    'PlayerIdVerification',
    'GdprConsent',
    'Subscription',
    'OrgSubscription',
    'OrgTournamentRegistration',
    'TournamentTeam',
    'TeamMember',
    'TeamInvitation',
    'Team',
    'WebhookEvent',
    'ContentReport',
    'ArchivedMatch',
    'ArchivedTournament',
    'PlayerSearchIndex',
    'PlayerPerformanceTrend',
    'DartsScoringHeatmap',
    'CornholeScoringHeatmap',
    'PlayerFormIndicator',
    'HeadToHeadRecord',
    'TournamentSnapshot',
    'FinalizationWindow',
    'TournamentDispute',
    'TournamentCompletionLog',
    'TournamentStateLog',
    'RecognitionAward',
    'PlayerCompletionStats',
    'RefundPolicy',
    'RefundJob',
    'PaymentRecovery',
    'TournamentFinanceSnapshot',
    'CancellationLog',
    'DirectorAssignmentRule',
    'AdminInactivityFlag',
    'RegionLoadMetric',
    'EmergencyControlLog',
    'AutoDirectorAssignmentLog',
    'EmployeeInvitation',
    'EmployeeTournamentParticipation',
    'RepPlayer',
    'RepSquadTournamentRegistration',
    'RepSquad',
    'Employee',
    'AcademicTeamMember',
    'AcademicTeamRegistration',
    'SchoolTeam',
    'CollegeTeam',
    'Student',
    'SchoolSection',
    'SchoolHouse',
    'SchoolClass',
    'CollegeBatch',
    'CollegeDepartment',
    'MediaCollectionItem',
    'MediaCollection',
    'HeroSlide',
    'DuelRegistration',
    'CityDuelEntry',
    'CityDuelLeaderboard',
    'DuelMatch',
    'DuelVenueSlot',
    'DuelVenue',
    'TournamentInterestPoll',
    'InterestPollVote',
    'ChallengeMatch',
    'CityActivityFeedItem',
    'CityStatsSnapshot',
    'VenueSlot',
    'Venue',
    'Tournament',
    'Session',
    'RefreshToken',
    'Organization',
    'AdminAssignment',
    'AdminPermissions',
    'AdminEscalation',
    'AdminAuditLog',
    'AdminAvailability',
    'AdminMetrics',
    'MfaSecret',
    'MfaRecoveryCode',
    'NotificationPreference',
    'TransferCooldown',
    'IdentityChangeRequest',
    'OrganizationMembership',
    'OrganizationSport',
    'SportPlayer',
    'OrgAuditLog',
    'OrgStatistics',
    'TournamentTemplate',
    'RecurringTournament',
    'SeriesStanding',
    'TournamentSeries',
    'PaymentLedger',
    'AuditLog',
    'ReengagementLog',
    'PlayerIncentive',
    'FeedbackRequest',
    'Feedback',
    'ScheduledNotification',
    'BatchedNotification',
    'EloJob',
    'IdempotencyKey',
    'MatchEvent',
    'ShortUrlRedirect',
    'SuspendedIdentity',
    'Sponsorship',
    'FeatureFlag',
    'SystemConfig',
    'DocumentVerification',
    'PromoCodeUsage',
    'PromoCode',
    'CouponUsage',
    'Coupon',
    'TournamentPause',
    'DirectorMagicLink',
    'DirectorSession',
    'PushDevice',
    'RefereeProfile',
    'AbuseEvent',
    'Appeal',
    'UploadedFile',
    'User',
    'City',
    'SportRules',
    'BadgeDefinition',
  ];
  
  // Delete from each table (PostgreSQL compatible with quoted table names)
  for (const table of deleteOrder) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch (e) {
      // Table might not exist yet, ignore
    }
  }
  
  // Reset sequences for PostgreSQL (auto-increment counters)
  // This is handled automatically by PostgreSQL, but we can reset if needed
  // The sequences will be reset when we use TRUNCATE, but DELETE doesn't reset them
  // For seed purposes, this is usually fine as we use cuid() for IDs
  
  console.log('✅ Data cleaned');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // ============================================
  // CREATE CITIES
  // ============================================

  console.log('🏙️ Creating cities...');

  const createdCities: { [key: string]: any } = {};

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    for (const cityInfo of cityData) {
      const cityId = `VH-CITY-${cityInfo.name.toUpperCase().replace(/\s+/g, '-')}-${sport}`;
      const city = await prisma.city.create({
        data: {
          cityId,
          sport,
          cityName: cityInfo.name,
          state: cityInfo.state,
          playerCount: randomInt(50, 200),
          activePlayersCount: randomInt(30, 100),
          tournamentCount: randomInt(5, 20),
          matchCount: randomInt(50, 200),
          duelMatchCount: randomInt(10, 50),
          status: CityStatus.ACTIVE,
          isActive: true,
        }
      });
      const key = `${cityInfo.name}-${sport}`;
      createdCities[key] = city;
    }
  }

  console.log(`✅ Created ${Object.keys(createdCities).length} cities`);

  // ============================================
  // CREATE PLAYERS FOR EACH SPORT
  // ============================================
  
  const cornholePlayers: any[] = [];
  const dartsPlayers: any[] = [];

  console.log('👥 Creating players...');

  // Create 25 Cornhole players
  for (let i = 0; i < 25; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const city = randomElement(cityData);
    
    const player = await prisma.user.create({
      data: {
        email: generateEmail(firstName, lastName, i),
        password: hashedPassword,
        phone: generatePhone(),
        firstName,
        lastName,
        sport: SportType.CORNHOLE,
        role: Role.PLAYER,
        accountTier: AccountTier.PLAYER,
        city: city.name,
        district: `${city.name} District`,
        state: city.state,
        hiddenElo: 1200 + randomInt(-200, 400),
        visiblePoints: randomInt(0, 500),
        verified: true,
        emailVerified: true,
        isActive: true,
        gender: i % 3 === 0 ? GenderCategory.FEMALE : GenderCategory.MALE,
      }
    });
    cornholePlayers.push(player);
  }

  // Create 25 Darts players
  for (let i = 0; i < 25; i++) {
    const firstName = firstNames[(i + 15) % firstNames.length];
    const lastName = lastNames[(i + 10) % lastNames.length];
    const city = randomElement(cityData);
    
    const player = await prisma.user.create({
      data: {
        email: generateEmail(firstName, lastName, i + 100),
        password: hashedPassword,
        phone: generatePhone(),
        firstName,
        lastName,
        sport: SportType.DARTS,
        role: Role.PLAYER,
        accountTier: AccountTier.PLAYER,
        city: city.name,
        district: `${city.name} District`,
        state: city.state,
        hiddenElo: 1200 + randomInt(-200, 400),
        visiblePoints: randomInt(0, 500),
        verified: true,
        emailVerified: true,
        isActive: true,
        gender: i % 3 === 0 ? GenderCategory.FEMALE : GenderCategory.MALE,
      }
    });
    dartsPlayers.push(player);
  }

  console.log(`✅ Created ${cornholePlayers.length} Cornhole players`);
  console.log(`✅ Created ${dartsPlayers.length} Darts players`);

  // ============================================
  // CREATE TOURNAMENTS
  // ============================================

  console.log('🏆 Creating tournaments...');

  const now = new Date();
  const tournaments: any[] = [];

  // Create tournaments for both sports
  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    const players = sport === SportType.CORNHOLE ? cornholePlayers : dartsPlayers;
    
    // Upcoming tournaments (Registration Open)
    for (let i = 0; i < 3; i++) {
      const city = randomElement(cityData);
      const venue = randomElement(venues);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + randomInt(7, 30));
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + randomInt(1, 2));

      const regDeadline = new Date(startDate);
      regDeadline.setDate(regDeadline.getDate() - 2);

      const tournament = await prisma.tournament.create({
        data: {
          name: `${city.name} ${sport === SportType.CORNHOLE ? 'Cornhole' : 'Darts'} Championship ${i + 1}`,
          sport,
          type: TournamentType.INDIVIDUAL,
          scope: [TournamentScope.CITY, TournamentScope.DISTRICT, TournamentScope.STATE][i % 3],
          location: `${venue}, ${city.name}`,
          city: city.name,
          district: `${city.name} District`,
          state: city.state,
          startDate,
          endDate,
          regDeadline,
          prizePool: randomInt(10000, 100000),
          entryFee: randomInt(100, 500),
          maxPlayers: 16 + (i * 8),
          format: TournamentFormat.INDIVIDUAL,
          isPublic: true,
          status: TournamentStatus.REGISTRATION_OPEN,
          managerName: 'Tournament Manager',
          managerPhone: generatePhone(),
        }
      });
      tournaments.push({ tournament, sport });
    }

    // In Progress tournaments
    for (let i = 0; i < 2; i++) {
      const city = randomElement(cityData);
      const venue = randomElement(venues);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - randomInt(1, 2));
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + randomInt(1, 3));

      const tournament = await prisma.tournament.create({
        data: {
          name: `${city.name} ${sport === SportType.CORNHOLE ? 'Cornhole' : 'Darts'} Open ${i + 1}`,
          sport,
          type: TournamentType.INDIVIDUAL,
          scope: TournamentScope.DISTRICT,
          location: `${venue}, ${city.name}`,
          city: city.name,
          district: `${city.name} District`,
          state: city.state,
          startDate,
          endDate,
          regDeadline: new Date(startDate.getTime() - 2 * 24 * 60 * 60 * 1000),
          prizePool: randomInt(15000, 75000),
          entryFee: randomInt(200, 600),
          maxPlayers: 24,
          format: TournamentFormat.INDIVIDUAL,
          isPublic: true,
          status: TournamentStatus.IN_PROGRESS,
          managerName: 'Tournament Manager',
          managerPhone: generatePhone(),
        }
      });
      tournaments.push({ tournament, sport });
    }

    // Completed tournaments
    for (let i = 0; i < 4; i++) {
      const city = randomElement(cityData);
      const venue = randomElement(venues);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - randomInt(7, 30));
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + randomInt(1, 2));

      const tournament = await prisma.tournament.create({
        data: {
          name: `${city.name} ${sport === SportType.CORNHOLE ? 'Cornhole' : 'Darts'} League ${i + 1}`,
          sport,
          type: TournamentType.INDIVIDUAL,
          scope: [TournamentScope.CITY, TournamentScope.DISTRICT][i % 2],
          location: `${venue}, ${city.name}`,
          city: city.name,
          district: `${city.name} District`,
          state: city.state,
          startDate,
          endDate,
          regDeadline: new Date(startDate.getTime() - 2 * 24 * 60 * 60 * 1000),
          prizePool: randomInt(20000, 150000),
          entryFee: randomInt(150, 800),
          maxPlayers: 32,
          format: TournamentFormat.INDIVIDUAL,
          isPublic: true,
          status: TournamentStatus.COMPLETED,
          managerName: 'Tournament Manager',
          managerPhone: generatePhone(),
        }
      });
      tournaments.push({ tournament, sport });

      // Register some players to completed tournaments
      const numRegistrations = randomInt(8, 16);
      const registeredPlayers = players.slice(0, numRegistrations);

      for (let j = 0; j < registeredPlayers.length; j++) {
        await prisma.tournamentRegistration.create({
          data: {
            tournamentId: tournament.id,
            userId: registeredPlayers[j].id,
            status: 'CONFIRMED',
            amount: tournament.entryFee,
          }
        });
      }

      // Create matches for completed tournaments
      const matchWinners: { [key: string]: number } = {};
      for (let j = 0; j < numRegistrations - 1; j += 2) {
        const playerA = registeredPlayers[j];
        const playerB = registeredPlayers[j + 1] || registeredPlayers[0];
        const scoreA = randomInt(0, 21);
        const scoreB = randomInt(0, 21);
        const winnerId = scoreA >= scoreB ? playerA.id : playerB.id;
        
        // Track wins for each player
        matchWinners[winnerId] = (matchWinners[winnerId] || 0) + 1;
        
        await prisma.match.create({
          data: {
            sport,
            tournamentId: tournament.id,
            playerAId: playerA.id,
            playerBId: playerB.id,
            scoreA,
            scoreB,
            winnerId,
            playedAt: startDate,
          }
        });
      }

      // Create TournamentResult records for completed tournaments
      // Sort by wins and create rankings
      const sortedPlayers = registeredPlayers
        .map(p => ({
          userId: p.id,
          wins: matchWinners[p.id] || 0,
        }))
        .sort((a, b) => b.wins - a.wins);

      for (let j = 0; j < sortedPlayers.length; j++) {
        const player = sortedPlayers[j];
        const bonusPoints = j === 0 ? 100 : j === 1 ? 60 : j === 2 ? 40 : 10;
        
        await prisma.tournamentResult.create({
          data: {
            tournamentId: tournament.id,
            userId: player.userId,
            sport,
            rank: j + 1,
            bonusPoints,
          }
        });
      }
    }
  }

  console.log(`✅ Created ${tournaments.length} tournaments`);

  // ============================================
  // CREATE REGISTRATIONS FOR UPCOMING/ONGOING TOURNAMENTS
  // ============================================

  console.log('📝 Creating tournament registrations...');

  let registrationCount = 0;
  for (const { tournament, sport } of tournaments) {
    if (tournament.status === TournamentStatus.REGISTRATION_OPEN || 
        tournament.status === TournamentStatus.IN_PROGRESS) {
      const players = sport === SportType.CORNHOLE ? cornholePlayers : dartsPlayers;
      const numRegistrations = randomInt(5, Math.min(15, players.length));
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numRegistrations; i++) {
        await prisma.tournamentRegistration.create({
          data: {
            tournamentId: tournament.id,
            userId: shuffled[i].id,
            status: 'CONFIRMED',
            amount: tournament.entryFee,
          }
        });
        registrationCount++;
      }
    }
  }

  console.log(`✅ Created ${registrationCount} tournament registrations`);

  // ============================================
  // CREATE PLAYER RATINGS FOR LEADERBOARD
  // ============================================

  console.log('📊 Creating player ratings...');

  for (const player of [...cornholePlayers, ...dartsPlayers]) {
    await prisma.playerRating.create({
      data: {
        userId: player.id,
        sport: player.sport,
        matchesPlayed: randomInt(5, 50),
        wins: randomInt(0, 30),
        losses: randomInt(0, 20),
        highestElo: player.hiddenElo + randomInt(0, 100),
        currentStreak: randomInt(-5, 5),
        bestStreak: randomInt(3, 10),
        tournamentsPlayed: randomInt(1, 10),
        tournamentsWon: randomInt(0, 3),
        rd: 350 - randomInt(0, 150),
      }
    });
  }

  console.log('✅ Created player ratings');

  // ============================================
  // CREATE ACHIEVEMENTS
  // ============================================

  console.log('🏆 Creating achievements...');

  const achievementTypes = [
    { type: 'FIRST_WIN', name: 'First Win', description: 'Won your first match' },
    { type: 'TOURNAMENT_CHAMPION', name: 'Tournament Champion', description: 'Won a tournament' },
    { type: 'RISING_STAR', name: 'Rising Star', description: 'Reached 1500 Elo' },
    { type: 'VETERAN', name: 'Veteran', description: 'Played 50 matches' },
    { type: 'PERFECT_SCORE', name: 'Perfect Score', description: 'Won a match 21-0' },
  ];

  for (const player of [...cornholePlayers.slice(0, 10), ...dartsPlayers.slice(0, 10)]) {
    const numAchievements = randomInt(1, 3);
    for (let i = 0; i < numAchievements; i++) {
      const achievement = randomElement(achievementTypes);
      await prisma.playerAchievement.create({
        data: {
          userId: player.id,
          sport: player.sport,
          type: achievement.type,
          title: achievement.name,
          description: achievement.description,
        }
      });
    }
  }

  console.log('✅ Created achievements');

  // ============================================
  // CREATE FOLLOWER RELATIONSHIPS
  // ============================================

  console.log('👥 Creating follower relationships...');

  for (const players of [cornholePlayers, dartsPlayers]) {
    const sport = players[0].sport;
    for (let i = 0; i < players.length; i++) {
      const numFollowers = randomInt(2, 8);
      const potentialFollowers = players.filter((_, idx) => idx !== i);
      const shuffled = potentialFollowers.sort(() => Math.random() - 0.5);
      
      for (let j = 0; j < numFollowers && j < shuffled.length; j++) {
        try {
          await prisma.userFollow.create({
            data: {
              followerId: shuffled[j].id,
              followingId: players[i].id,
              sport,
            }
          });
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    }
  }

  console.log('✅ Created follower relationships');

  // ============================================
  // CREATE NOTIFICATIONS
  // ============================================

  console.log('🔔 Creating notifications...');

  for (const player of [...cornholePlayers.slice(0, 10), ...dartsPlayers.slice(0, 10)]) {
    await prisma.notification.create({
      data: {
        userId: player.id,
        sport: player.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Welcome to VALORHIVE!',
        message: `You have successfully registered. Start competing in tournaments!`,
      }
    });
  }

  console.log('✅ Created notifications');

  // ============================================
  // CREATE DUEL MATCHES (for Duel feature)
  // ============================================

  console.log('⚔️ Creating duel matches...');

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    const players = sport === SportType.CORNHOLE ? cornholePlayers : dartsPlayers;
    const city = randomElement(cityData);
    
    await prisma.duelMatch.create({
      data: {
        sport,
        city: city.name,
        hostId: players[0].id,
        format: DuelFormat.INDIVIDUAL,
        venueName: randomElement(venues),
        venueAddress: `${city.name}, ${city.state}`,
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
        entryFee: 10000, // 100 rupees in paise
        prizePool: 18000, // 180 rupees total
        isPublic: true,
        approvalStatus: DuelApprovalStatus.APPROVED,
        status: DuelStatus.OPEN,
      }
    });
  }

  console.log('✅ Created duel matches');

  // ============================================
  // CREATE CHALLENGE MATCHES
  // ============================================

  console.log('🎯 Creating challenge matches...');

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    const players = sport === SportType.CORNHOLE ? cornholePlayers : dartsPlayers;
    const city = randomElement(cityData);
    const cityKey = `${city.name}-${sport}`;
    const cityRecord = createdCities[cityKey];
    
    if (cityRecord) {
      // Open challenge match
      await prisma.challengeMatch.create({
        data: {
          cityId: cityRecord.id,
          sport,
          title: `${city.name} ${sport === SportType.CORNHOLE ? 'Cornhole' : 'Darts'} Challenge`,
          description: 'Join this exciting challenge match! Minimum 8 players needed.',
          matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          venueName: randomElement(venues),
          venueAddress: `${city.name}, ${city.state}`,
          format: TournamentFormat.INDIVIDUAL,
          startTime: 600, // 10:00 AM (600 minutes from midnight)
          estimatedDuration: 180, // 3 hours
          matchType: '1v1',
          playerSlots: 16,
          minPlayers: 8,
          maxPlayers: 16,
          entryFee: 20000, // 200 rupees
          basePrizePool: 200000, // 2000 rupees
          prizePoolPercentage: 70,
          joinedCount: 5,
          joinedUserIds: JSON.stringify(players.slice(0, 5).map(p => ({ userId: p.id, joinedAt: new Date().toISOString() }))),
          status: 'OPEN',
          createdById: players[0].id,
        }
      });

      // Threshold reached challenge match
      const city2 = cityData[1];
      const cityKey2 = `${city2.name}-${sport}`;
      const cityRecord2 = createdCities[cityKey2];
      
      if (cityRecord2) {
        await prisma.challengeMatch.create({
          data: {
            cityId: cityRecord2.id,
            sport,
            title: `${city2.name} Weekend ${sport === SportType.CORNHOLE ? 'Cornhole' : 'Darts'} Showdown`,
            description: 'Threshold reached! Ready for payment.',
            matchDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            registrationDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            venueName: randomElement(venues),
            venueAddress: `${city2.name}, ${city2.state}`,
            format: TournamentFormat.INDIVIDUAL,
            startTime: 660, // 11:00 AM (660 minutes from midnight)
            estimatedDuration: 240, // 4 hours
            matchType: '1v1',
            playerSlots: 16,
            minPlayers: 8,
            maxPlayers: 16,
            entryFee: 30000, // 300 rupees
            basePrizePool: 300000, // 3000 rupees
            prizePoolPercentage: 70,
            joinedCount: 10,
            joinedUserIds: JSON.stringify(players.slice(0, 10).map(p => ({ userId: p.id, joinedAt: new Date().toISOString() }))),
            status: 'THRESHOLD_REACHED',
            thresholdReachedAt: new Date(),
            sponsorName: 'SportsPro India',
            sponsorLogo: '/sponsors/sportspro.png',
            sponsorAmount: 200000, // 2000 rupees
            sponsorMessage: 'Proud to support local sports!',
            createdById: players[1].id,
          }
        });
      }
    }
  }

  console.log('✅ Created challenge matches');

  // ============================================
  // CREATE LEADERBOARD SNAPSHOTS
  // ============================================

  console.log('📈 Creating leaderboard snapshots...');

  // Sort players by Elo for each sport
  const sortedCornhole = [...cornholePlayers].sort((a, b) => b.hiddenElo - a.hiddenElo);
  const sortedDarts = [...dartsPlayers].sort((a, b) => b.hiddenElo - a.hiddenElo);

  for (let i = 0; i < Math.min(10, sortedCornhole.length); i++) {
    const player = sortedCornhole[i];
    
    await prisma.leaderboardSnapshot.create({
      data: {
        sport: SportType.CORNHOLE,
        type: 'CITY',
        scopeValue: player.city,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        snapshotDate: now,
        userId: player.id,
        rank: i + 1,
        visiblePoints: player.visiblePoints,
        hiddenElo: player.hiddenElo,
        matchesPlayed: randomInt(20, 50),
        wins: randomInt(10, 30),
        winRate: Math.random() * 0.4 + 0.5, // 50-90%
        isActive: true,
      }
    });
  }

  for (let i = 0; i < Math.min(10, sortedDarts.length); i++) {
    const player = sortedDarts[i];
    
    await prisma.leaderboardSnapshot.create({
      data: {
        sport: SportType.DARTS,
        type: 'CITY',
        scopeValue: player.city,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        snapshotDate: now,
        userId: player.id,
        rank: i + 1,
        visiblePoints: player.visiblePoints,
        hiddenElo: player.hiddenElo,
        matchesPlayed: randomInt(20, 50),
        wins: randomInt(10, 30),
        winRate: Math.random() * 0.4 + 0.5, // 50-90%
        isActive: true,
      }
    });
  }

  console.log('✅ Created leaderboard snapshots');

  // ============================================
  // CREATE ORGANIZATIONS
  // ============================================

  console.log('🏢 Creating organizations...');

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    for (let i = 0; i < 3; i++) {
      const city = randomElement(cityData);
      
      await prisma.organization.create({
        data: {
          sport,
          name: `${city.name} Sports Club ${i + 1}`,
          type: 'CLUB',
          email: `org${i}_${sport.toLowerCase()}@example.com`,
          password: hashedPassword,
          phone: generatePhone(),
          city: city.name,
          district: `${city.name} District`,
          state: city.state,
        }
      });
    }
  }

  console.log('✅ Created organizations');

  // ============================================
  // CREATE WALLET ENTRIES FOR PLAYERS
  // ============================================

  console.log('💰 Creating wallet entries...');

  for (const player of [...cornholePlayers, ...dartsPlayers]) {
    await prisma.wallet.create({
      data: {
        userId: player.id,
        sport: player.sport,
        balance: randomInt(0, 100000), // 0-1000 rupees in paise
      }
    });
  }

  console.log('✅ Created wallet entries');

  // ============================================
  // CREATE MILESTONES
  // ============================================

  console.log('🎯 Creating milestones...');

  for (const player of [...cornholePlayers.slice(0, 15), ...dartsPlayers.slice(0, 15)]) {
    const milestoneTypes = [
      { type: 'FIRST_TOURNAMENT', title: 'First Tournament', description: 'Participated in your first tournament' },
      { type: 'FIRST_WIN', title: 'First Victory', description: 'Won your first match' },
      { type: 'WIN_STREAK_3', title: 'On Fire!', description: 'Won 3 matches in a row' },
      { type: 'TOP_10', title: 'Top 10 Player', description: 'Reached top 10 in your city' },
    ];
    
    const numMilestones = randomInt(1, 3);
    for (let i = 0; i < numMilestones; i++) {
      const milestone = milestoneTypes[i % milestoneTypes.length];
      await prisma.milestone.create({
        data: {
          userId: player.id,
          sport: player.sport,
          type: milestone.type,
          title: milestone.title,
          description: milestone.description,
        }
      });
    }
  }

  console.log('✅ Created milestones');

  // ============================================
  // CREATE SOME ADDITIONAL MATCHES FOR HISTORY
  // ============================================

  console.log('🎮 Creating match history...');

  for (const sport of [SportType.CORNHOLE, SportType.DARTS]) {
    const players = sport === SportType.CORNHOLE ? cornholePlayers : dartsPlayers;
    
    for (let i = 0; i < 15; i++) {
      const playerA = players[randomInt(0, players.length - 1)];
      let playerB = players[randomInt(0, players.length - 1)];
      while (playerB.id === playerA.id) {
        playerB = players[randomInt(0, players.length - 1)];
      }

      const scoreA = randomInt(10, 21);
      const scoreB = randomInt(5, 21);
      
      await prisma.match.create({
        data: {
          sport,
          playerAId: playerA.id,
          playerBId: playerB.id,
          scoreA,
          scoreB,
          winnerId: scoreA >= scoreB ? playerA.id : playerB.id,
          playedAt: new Date(Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000),
        }
      });
    }
  }

  console.log('✅ Created match history');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${cornholePlayers.length} Cornhole players`);
  console.log(`   - ${dartsPlayers.length} Darts players`);
  console.log(`   - ${Object.keys(createdCities).length} Cities`);
  console.log(`   - ${tournaments.length} Tournaments`);
  console.log(`   - ${registrationCount} Tournament registrations`);
  console.log(`   - Multiple achievements, milestones, and matches`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
