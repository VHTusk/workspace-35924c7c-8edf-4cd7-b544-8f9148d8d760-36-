import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, UserStatus, Gender, TournamentStatus, BracketFormat, TournamentScope, Role } from '@prisma/client';
import { hashPassword, getAuthenticatedAdmin } from '@/lib/auth';

// FIX: Mock data generator for demo/development - ADMIN ONLY
// This endpoint creates mock users and tournaments for testing
// CRITICAL: Must require admin authentication to prevent abuse
export async function POST(request: NextRequest) {
  try {
    // FIX: Add authentication check - only admins can seed database
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // FIX: Require ADMIN role (not SUB_ADMIN) for database seeding
    if (auth.user.role !== Role.ADMIN) {
      return NextResponse.json({ 
        error: 'Admin access required for database seeding' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { sport = 'CORNHOLE', count = 20 } = body;
    const sportType = sport.toUpperCase() as SportType;
    
    // Check if already seeded
    const existingUsers = await db.user.count({
      where: { sport: sportType }
    });
    
    if (existingUsers > 50) {
      return NextResponse.json({ 
        message: 'Database already has enough mock data',
        existingUsers 
      });
    }

    const hashedPassword = await hashPassword('demo123456');
    
    // Indian names for realistic mock data
    const firstNames = [
      'Arjun', 'Rohan', 'Vikram', 'Amit', 'Rahul', 'Suresh', 'Anil', 'Deepak',
      'Priya', 'Anita', 'Pooja', 'Neha', 'Sunita', 'Kavita', 'Meera', 'Divya',
      'Rajesh', 'Sanjay', 'Mukesh', 'Arun', 'Vivek', 'Prakash', 'Manoj', 'Sunil',
      'Sneha', 'Aishwarya', 'Ritu', 'Shweta', 'Nisha', 'Rekha', 'Sarita', 'Komal'
    ];
    
    const lastNames = [
      'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Joshi', 'Patel', 'Yadav',
      'Chauhan', 'Agarwal', 'Malhotra', 'Reddy', 'Rao', 'Nair', 'Menon', 'Pillai',
      'Mehta', 'Shah', 'Desai', 'Kulkarni', 'Joshi', 'Bhat', 'Hegde', 'Kamat'
    ];
    
    const cities = [
      { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan' },
      { city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan' },
      { city: 'Udaipur', district: 'Udaipur', state: 'Rajasthan' },
      { city: 'Kota', district: 'Kota', state: 'Rajasthan' },
      { city: 'Ajmer', district: 'Ajmer', state: 'Rajasthan' },
      { city: 'Delhi', district: 'Central Delhi', state: 'Delhi' },
      { city: 'Mumbai', district: 'Mumbai City', state: 'Maharashtra' },
      { city: 'Pune', district: 'Pune', state: 'Maharashtra' },
      { city: 'Bangalore', district: 'Bangalore Urban', state: 'Karnataka' },
      { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
      { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
      { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat' },
    ];

    const users = [];
    const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    
    // Create users
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const location = cities[Math.floor(Math.random() * cities.length)];
      const gender = Math.random() > 0.3 ? Gender.MALE : Gender.FEMALE;
      const tier = tiers[Math.floor(Math.random() * tiers.length)];
      
      // Calculate points based on tier
      const basePoints = tier === 'DIAMOND' ? 2000 : 
                        tier === 'PLATINUM' ? 1500 :
                        tier === 'GOLD' ? 1000 :
                        tier === 'SILVER' ? 600 : 300;
      const points = basePoints + Math.floor(Math.random() * 500);
      const elo = Math.floor(1000 + Math.random() * 800);
      
      const user = await db.user.create({
        data: {
          email: `player${i + existingUsers + 1}@demo.com`,
          phone: `98${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
          password: hashedPassword,
          firstName,
          lastName,
          gender,
          dob: new Date(1990 - Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          city: location.city,
          district: location.district,
          state: location.state,
          sport: sportType,
          status: UserStatus.ACTIVE,
          emailVerified: new Date(),
          phoneVerified: true,
          visiblePoints: points,
          hiddenElo: elo,
          referralCode: `${firstName.substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        }
      });
      
      // Create sport stats for user
      const wins = Math.floor(Math.random() * 50);
      const losses = Math.floor(Math.random() * 30);
      
      await db.sportStats.create({
        data: {
          userId: user.id,
          sport: sportType,
          visiblePoints: points,
          hiddenElo: elo,
          highestElo: elo + Math.floor(Math.random() * 100),
          wins,
          losses,
          winStreak: Math.floor(Math.random() * 10),
          bestWinStreak: Math.floor(Math.random() * 15),
          tier,
          tournamentsPlayed: Math.floor(Math.random() * 20),
          tournamentsWon: Math.floor(Math.random() * 5),
        }
      });
      
      users.push(user);
    }

    // Create tournaments
    const tournamentNames = [
      'City Championship', 'District Open', 'State League', 'Club Tournament',
      'Monsoon Cup', 'Summer Smash', 'Winter Warriors', 'Spring Classic',
      'Community Cup', 'Championship Series', 'Grand Prix', 'Premier League'
    ];

    const tournaments = [];
    
    // Create upcoming tournament
    const upcomingTournament = await db.tournament.create({
      data: {
        name: `${cities[0].city} ${tournamentNames[0]} ${new Date().getFullYear()}`,
        sport: sportType,
        status: TournamentStatus.REGISTRATION_OPEN,
        scope: TournamentScope.CITY,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        venue: `${cities[0].city} Sports Complex`,
        city: cities[0].city,
        district: cities[0].district,
        state: cities[0].state,
        maxPlayers: 64,
        bracketFormat: BracketFormat.SINGLE_ELIMINATION,
        entryFee: 500,
        prizePool: 50000,
        gender: null,
        ageMin: null,
        ageMax: null,
        description: 'Open tournament for all skill levels',
        rules: 'Standard competition rules apply',
      }
    });
    tournaments.push(upcomingTournament);
    
    // Create active tournament
    const activeTournament = await db.tournament.create({
      data: {
        name: `${cities[1].city} ${tournamentNames[1]} ${new Date().getFullYear()}`,
        sport: sportType,
        status: TournamentStatus.IN_PROGRESS,
        scope: TournamentScope.DISTRICT,
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        venue: `${cities[1].city} Indoor Stadium`,
        city: cities[1].city,
        district: cities[1].district,
        state: cities[1].state,
        maxPlayers: 32,
        bracketFormat: BracketFormat.DOUBLE_ELIMINATION,
        entryFee: 800,
        prizePool: 100000,
        gender: null,
        ageMin: null,
        ageMax: null,
        description: 'District level championship',
        rules: 'Double elimination bracket',
      }
    });
    tournaments.push(activeTournament);
    
    // Create completed tournament
    const completedTournament = await db.tournament.create({
      data: {
        name: `${cities[2].city} ${tournamentNames[2]} ${new Date().getFullYear() - 1}`,
        sport: sportType,
        status: TournamentStatus.COMPLETED,
        scope: TournamentScope.STATE,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        venue: `${cities[2].city} Convention Center`,
        city: cities[2].city,
        district: cities[2].district,
        state: cities[2].state,
        maxPlayers: 128,
        bracketFormat: BracketFormat.SINGLE_ELIMINATION,
        entryFee: 1000,
        prizePool: 200000,
        gender: null,
        ageMin: null,
        ageMax: null,
        description: 'State level championship',
        rules: 'Single elimination bracket',
      }
    });
    tournaments.push(completedTournament);

    // Register users for tournaments
    const tournamentEntries = [];
    for (const tournament of tournaments) {
      // Register first 16 users for each tournament
      for (let i = 0; i < Math.min(16, users.length); i++) {
        const entry = await db.tournamentEntry.create({
          data: {
            tournamentId: tournament.id,
            userId: users[i].id,
            seedNumber: i + 1,
            checkedIn: tournament.status !== TournamentStatus.REGISTRATION_OPEN,
          }
        });
        tournamentEntries.push(entry);
      }
    }

    // Create some matches for completed tournament
    if (users.length >= 4) {
      for (let round = 1; round <= 2; round++) {
        for (let i = 0; i < 4; i += 2) {
          if (users[i] && users[i + 1]) {
            await db.match.create({
              data: {
                tournamentId: completedTournament.id,
                playerAId: users[i].id,
                playerBId: users[i + 1].id,
                round,
                matchNumber: (round - 1) * 2 + (i / 2) + 1,
                winnerId: Math.random() > 0.5 ? users[i].id : users[i + 1].id,
                scoreA: Math.floor(Math.random() * 3) + 1,
                scoreB: Math.floor(Math.random() * 3),
                status: 'COMPLETED',
                verificationStatus: 'VERIFIED',
                scheduledAt: completedTournament.startDate,
              }
            });
          }
        }
      }
    }

    // Create some follow relationships
    for (let i = 0; i < Math.min(10, users.length - 1); i++) {
      if (users[i] && users[i + 1]) {
        await db.userFollow.create({
          data: {
            followerId: users[i].id,
            followingId: users[i + 1].id,
            sport: sportType,
          }
        });
      }
    }

    // Create some milestones for top users
    const milestoneTypes = [
      { type: 'FIRST_WIN', title: 'First Victory', description: 'Won their first match' },
      { type: 'TOURNAMENT_WIN', title: 'Tournament Champion', description: 'Won a tournament' },
      { type: 'POINT_MILESTONE', title: 'Point Milestone', description: 'Reached 1000 points' },
      { type: 'WIN_STREAK', title: 'Hot Streak', description: 'Won 5 matches in a row' },
    ];

    for (let i = 0; i < Math.min(5, users.length); i++) {
      const milestone = milestoneTypes[i % milestoneTypes.length];
      await db.milestone.create({
        data: {
          userId: users[i].id,
          sport: sportType,
          type: milestone.type,
          title: milestone.title,
          description: milestone.description,
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${users.length} mock users, ${tournaments.length} tournaments, and related data`,
      data: {
        usersCreated: users.length,
        tournamentsCreated: tournaments.length,
        tournamentEntriesCreated: tournamentEntries.length,
      }
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check seed status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType || 'CORNHOLE';
    
    const userCount = await db.user.count({
      where: { sport: sport as SportType }
    });
    
    const tournamentCount = await db.tournament.count({
      where: { sport: sport as SportType }
    });
    
    const matchCount = await db.match.count({
      where: { tournament: { sport: sport as SportType } }
    });

    return NextResponse.json({
      sport,
      users: userCount,
      tournaments: tournamentCount,
      matches: matchCount,
      needsSeeding: userCount < 20
    });

  } catch (error) {
    console.error('Seed status error:', error);
    return NextResponse.json(
      { error: 'Failed to check seed status' },
      { status: 500 }
    );
  }
}
