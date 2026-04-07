import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// GET - Get current onboarding progress
export async function GET(request: NextRequest) {
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

    // Get or create onboarding progress
    let progress = await db.onboardingProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!progress) {
      // Create new progress record
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

    // Parse comma-separated fields
    const completedSteps = progress.completedSteps 
      ? progress.completedSteps.split(',').filter(Boolean).map(Number)
      : [];
    const sportPreferences = progress.sportPreferences 
      ? progress.sportPreferences.split(',').filter(Boolean)
      : [];
    const preferredDays = progress.preferredDays 
      ? progress.preferredDays.split(',').filter(Boolean)
      : [];
    const preferredTimes = progress.preferredTimes 
      ? progress.preferredTimes.split(',').filter(Boolean)
      : [];
    const followedPlayers = progress.followedPlayers 
      ? progress.followedPlayers.split(',').filter(Boolean)
      : [];

    return NextResponse.json({
      success: true,
      progress: {
        id: progress.id,
        currentStep: progress.currentStep,
        completedSteps,
        displayName: progress.displayName,
        avatarUrl: progress.avatarUrl,
        sportPreferences,
        city: progress.city,
        state: progress.state,
        skillLevel: progress.skillLevel,
        yearsExperience: progress.yearsExperience,
        hasTournamentExp: progress.hasTournamentExp,
        preferredDays,
        preferredTimes,
        followedPlayers,
        completedAt: progress.completedAt,
      },
      user: {
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        sport: session.user.sport,
      },
    });
  } catch (error) {
    console.error('Get onboarding progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
