import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// POST - Mark onboarding as completed
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

    // Get current progress
    const progress = await db.onboardingProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!progress) {
      return NextResponse.json(
        { error: 'No onboarding progress found' },
        { status: 404 }
      );
    }

    // Mark as completed
    const updatedProgress = await db.onboardingProgress.update({
      where: { userId: session.user.id },
      data: {
        completedAt: new Date(),
        currentStep: 4,
        completedSteps: '1,2,3,4',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      progress: {
        id: updatedProgress.id,
        completedAt: updatedProgress.completedAt,
        completedSteps: [1, 2, 3, 4],
      },
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
