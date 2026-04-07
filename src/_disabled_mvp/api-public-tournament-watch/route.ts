import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscribeWatcher, checkExistingSubscription } from '@/lib/tournament-watcher';

/**
 * POST /api/public/tournaments/[id]/watch
 * Subscribe to tournament updates (no auth required)
 * 
 * Body: { email?, phone?, preferences? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();

    const { email, phone, preferences } = body;

    // Validate tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        id: true, 
        name: true, 
        isPublic: true, 
        status: true,
        sport: true,
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Subscribe the watcher
    const result = await subscribeWatcher(tournamentId, {
      email,
      phone,
      ...preferences,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          requiresVerification: result.requiresVerification,
          alreadySubscribed: result.alreadySubscribed,
        },
        { status: 400 }
      );
    }

    // TODO: Send verification email/SMS
    // For development, return the verification token
    const watcher = await db.tournamentWatcher.findUnique({
      where: { id: result.watcherId },
      select: { verifyToken: true, phone: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription created! Check your email/phone for verification.',
      watcherId: result.watcherId,
      requiresVerification: result.requiresVerification,
      // In development, return verification code for testing
      ...(process.env.NODE_ENV === 'development' && watcher?.verifyToken && {
        _dev_verifyToken: watcher.verifyToken,
      }),
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
      },
    });
  } catch (error) {
    console.error('Tournament watch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/public/tournaments/[id]/watch
 * Check if an email/phone is already subscribed
 * 
 * Query params: email? or phone?
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || undefined;
    const phone = searchParams.get('phone') || undefined;

    if (!email && !phone) {
      // Return watcher stats for the tournament
      const tournament = await db.tournament.findUnique({
        where: { id: tournamentId },
        select: { 
          id: true, 
          name: true,
          _count: { select: { watchers: { where: { unsubscribedAt: null } } } },
        },
      });

      if (!tournament) {
        return NextResponse.json(
          { success: false, error: 'Tournament not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          watchersCount: tournament._count.watchers,
        },
      });
    }

    const result = await checkExistingSubscription(tournamentId, email, phone);

    return NextResponse.json({
      success: true,
      exists: result.exists,
      verified: result.verified,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
