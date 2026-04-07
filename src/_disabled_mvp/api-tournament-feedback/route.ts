/**
 * Tournament Feedback API
 * GET /api/tournaments/[id]/feedback - Get feedback summary (admin)
 * POST /api/tournaments/[id]/feedback - Submit feedback (player)
 * 
 * v3.43.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

interface FeedbackSubmission {
  venueRating?: number;
  organizationRating?: number;
  refereeingRating?: number;
  communicationRating?: number;
  wouldReturn?: boolean;
  wouldRecommend?: boolean;
  comments?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get feedback summary
    const feedbacks = await db.tournamentFeedback.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (feedbacks.length === 0) {
      return NextResponse.json({
        totalResponses: 0,
        averages: { venue: '0', organization: '0', refereeing: '0', communication: '0', overall: '0' },
        wouldReturn: { count: 0, percentage: '0' },
        wouldRecommend: { count: 0, percentage: '0' },
        feedbacks: [],
      });
    }

    // Calculate averages
    const avgVenue = feedbacks.reduce((sum, f) => sum + (f.venueRating || 0), 0) / feedbacks.length;
    const avgOrg = feedbacks.reduce((sum, f) => sum + (f.organizationRating || 0), 0) / feedbacks.length;
    const avgRef = feedbacks.reduce((sum, f) => sum + (f.refereeingRating || 0), 0) / feedbacks.length;
    const avgComm = feedbacks.reduce((sum, f) => sum + (f.communicationRating || 0), 0) / feedbacks.length;

    const wouldReturnCount = feedbacks.filter(f => f.wouldReturn).length;
    const wouldRecommendCount = feedbacks.filter(f => f.wouldRecommend).length;

    return NextResponse.json({
      totalResponses: feedbacks.length,
      averages: {
        venue: avgVenue.toFixed(1),
        organization: avgOrg.toFixed(1),
        refereeing: avgRef.toFixed(1),
        communication: avgComm.toFixed(1),
        overall: ((avgVenue + avgOrg + avgRef + avgComm) / 4).toFixed(1),
      },
      wouldReturn: {
        count: wouldReturnCount,
        percentage: ((wouldReturnCount / feedbacks.length) * 100).toFixed(0),
      },
      wouldRecommend: {
        count: wouldRecommendCount,
        percentage: ((wouldRecommendCount / feedbacks.length) * 100).toFixed(0),
      },
      feedbacks: feedbacks.map(f => ({
        id: f.id,
        user: f.user,
        ratings: {
          venue: f.venueRating,
          organization: f.organizationRating,
          refereeing: f.refereeingRating,
          communication: f.communicationRating,
        },
        wouldReturn: f.wouldReturn,
        wouldRecommend: f.wouldRecommend,
        comments: f.comments,
        createdAt: f.createdAt,
      })),
    });

  } catch (error) {
    console.error('[Feedback API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check if tournament is completed
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { 
            userId: session.user.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status !== 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Feedback can only be submitted for completed tournaments' 
      }, { status: 400 });
    }

    // Check if user participated
    if (tournament.registrations.length === 0) {
      return NextResponse.json({ 
        error: 'You must have participated in this tournament to submit feedback' 
      }, { status: 403 });
    }

    // Check for existing feedback
    const existing = await db.tournamentFeedback.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: session.user.id },
      },
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'You have already submitted feedback for this tournament' 
      }, { status: 400 });
    }

    // Parse and validate feedback
    const body = await request.json() as FeedbackSubmission;

    // Validate ratings are 1-5
    const ratings = [body.venueRating, body.organizationRating, body.refereeingRating, body.communicationRating];
    for (const rating of ratings) {
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return NextResponse.json({ error: 'Ratings must be between 1 and 5' }, { status: 400 });
      }
    }

    // Create feedback
    const feedback = await db.tournamentFeedback.create({
      data: {
        tournamentId,
        userId: session.user.id,
        venueRating: body.venueRating,
        organizationRating: body.organizationRating,
        refereeingRating: body.refereeingRating,
        communicationRating: body.communicationRating,
        wouldReturn: body.wouldReturn,
        wouldRecommend: body.wouldRecommend,
        comments: body.comments,
      },
    });

    // Award bonus points for feedback (10 points)
    await db.user.update({
      where: { id: session.user.id },
      data: {
        visiblePoints: { increment: 10 },
      },
    });

    // Create points notification
    await db.notification.create({
      data: {
        userId: session.user.id,
        sport: session.user.sport,
        type: 'POINTS_EARNED',
        title: 'Feedback Bonus!',
        message: 'You earned 10 bonus points for submitting tournament feedback.',
      },
    });

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        createdAt: feedback.createdAt,
      },
      bonusPoints: 10,
      message: 'Thank you for your feedback! You earned 10 bonus points.',
    });

  } catch (error) {
    console.error('[Feedback API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
