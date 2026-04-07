import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// POST - Save step data
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = await validateSession(token);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { step, data } = body;

    if (!step || step < 1 || step > 4) {
      return NextResponse.json(
        { error: 'Invalid step number' },
        { status: 400 }
      );
    }

    // Get or create onboarding progress
    let progress = await db.onboardingProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!progress) {
      progress = await db.onboardingProgress.create({
        data: {
          userId: session.user.id,
          currentStep: 1,
          completedSteps: '',
          sportPreferences: '',
          preferredDays: '',
          preferredTimes: '',
          followedPlayers: '',
        },
      });
    }

    // Parse current completed steps
    const completedStepsSet = new Set(
      progress.completedSteps 
        ? progress.completedSteps.split(',').filter(Boolean).map(Number)
        : []
    );

    // Update data based on step
    const updateData: Record<string, unknown> = {
      currentStep: step + 1 <= 4 ? step + 1 : step,
      updatedAt: new Date(),
    };

    // Mark current step as completed
    completedStepsSet.add(step);
    updateData.completedSteps = Array.from(completedStepsSet).sort().join(',');

    switch (step) {
      case 1: // Profile Basics
        if (data.displayName !== undefined) {
          updateData.displayName = data.displayName;
          // Also update user's name if display name provided
          if (data.displayName) {
            const nameParts = data.displayName.trim().split(' ');
            await db.user.update({
              where: { id: session.user.id },
              data: {
                firstName: nameParts[0] || session.user.firstName,
                lastName: nameParts.slice(1).join(' ') || session.user.lastName,
                city: data.city || session.user.city,
                state: data.state || session.user.state,
              },
            });
          }
        }
        if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
        if (data.sportPreferences !== undefined) {
          updateData.sportPreferences = Array.isArray(data.sportPreferences) 
            ? data.sportPreferences.join(',') 
            : data.sportPreferences;
        }
        if (data.city !== undefined) updateData.city = data.city;
        if (data.state !== undefined) updateData.state = data.state;
        break;

      case 2: // Skill Assessment
        if (data.skillLevel !== undefined) updateData.skillLevel = data.skillLevel;
        if (data.yearsExperience !== undefined) updateData.yearsExperience = parseInt(data.yearsExperience);
        if (data.hasTournamentExp !== undefined) updateData.hasTournamentExp = Boolean(data.hasTournamentExp);
        
        // Seed initial Elo based on skill level (not displayed to user)
        if (data.skillLevel) {
          let baseElo = 1500;
          switch (data.skillLevel) {
            case 'BEGINNER':
              baseElo = 1200;
              break;
            case 'INTERMEDIATE':
              baseElo = 1400;
              break;
            case 'ADVANCED':
              baseElo = 1600;
              break;
            case 'PROFESSIONAL':
              baseElo = 1800;
              break;
          }
          // Only update if no matches played yet
          const rating = await db.playerRating.findUnique({
            where: { userId: session.user.id },
          });
          if (rating && rating.matchesPlayed === 0) {
            await db.user.update({
              where: { id: session.user.id },
              data: { hiddenElo: baseElo },
            });
          }
        }
        break;

      case 3: // Availability
        if (data.preferredDays !== undefined) {
          updateData.preferredDays = Array.isArray(data.preferredDays) 
            ? data.preferredDays.join(',') 
            : data.preferredDays;
        }
        if (data.preferredTimes !== undefined) {
          updateData.preferredTimes = Array.isArray(data.preferredTimes) 
            ? data.preferredTimes.join(',') 
            : data.preferredTimes;
        }

        // Create availability records for calendar
        if (data.preferredDays && data.preferredTimes) {
          const days = Array.isArray(data.preferredDays) ? data.preferredDays : data.preferredDays.split(',');
          const times = Array.isArray(data.preferredTimes) ? data.preferredTimes : data.preferredTimes.split(',');

          // Clear existing availability
          await db.playerAvailability.deleteMany({
            where: { userId: session.user.id },
          });

          // Create new availability entries
          const dayMapping: Record<string, number> = {
            'SUNDAY': 0,
            'MONDAY': 1,
            'TUESDAY': 2,
            'WEDNESDAY': 3,
            'THURSDAY': 4,
            'FRIDAY': 5,
            'SATURDAY': 6,
            'WEEKDAY': -1, // Special handling
            'WEEKEND': -2, // Special handling
          };

          const timeMapping: Record<string, { start: string; end: string }> = {
            'MORNING': { start: '06:00', end: '12:00' },
            'AFTERNOON': { start: '12:00', end: '18:00' },
            'EVENING': { start: '18:00', end: '22:00' },
          };

          // Create availability for each day/time combination
          for (const day of days) {
            for (const time of times) {
              const dayNum = dayMapping[day];
              const timeSlot = timeMapping[time];
              
              if (dayNum !== undefined && dayNum >= 0 && timeSlot) {
                await db.playerAvailability.create({
                  data: {
                    userId: session.user.id,
                    sport: session.user.sport,
                    dayOfWeek: dayNum,
                    startTime: timeSlot.start,
                    endTime: timeSlot.end,
                    isRecurring: true,
                  },
                });
              }
            }
          }
        }
        break;

      case 4: // Discover
        if (data.followedPlayers !== undefined) {
          updateData.followedPlayers = Array.isArray(data.followedPlayers) 
            ? data.followedPlayers.join(',') 
            : data.followedPlayers;

          // Create follow relationships
          const playersToFollow = Array.isArray(data.followedPlayers) 
            ? data.followedPlayers 
            : data.followedPlayers.split(',').filter(Boolean);

          for (const playerId of playersToFollow) {
            if (playerId && playerId !== session.user.id) {
              // Check if already following
              const existing = await db.userFollow.findUnique({
                where: {
                  followerId_followingId_sport: {
                    followerId: session.user.id,
                    followingId: playerId,
                    sport: session.user.sport,
                  },
                },
              });

              if (!existing) {
                await db.userFollow.create({
                  data: {
                    followerId: session.user.id,
                    followingId: playerId,
                    sport: session.user.sport,
                  },
                });
              }
            }
          }
        }
        break;
    }

    // Update progress
    const updatedProgress = await db.onboardingProgress.update({
      where: { userId: session.user.id },
      data: updateData,
    });

    // Parse for response
    const updatedCompletedSteps = updatedProgress.completedSteps 
      ? updatedProgress.completedSteps.split(',').filter(Boolean).map(Number)
      : [];

    return NextResponse.json({
      success: true,
      progress: {
        id: updatedProgress.id,
        currentStep: updatedProgress.currentStep,
        completedSteps: updatedCompletedSteps,
        completedAt: updatedProgress.completedAt,
      },
    });
  } catch (error) {
    console.error('Save onboarding step error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
