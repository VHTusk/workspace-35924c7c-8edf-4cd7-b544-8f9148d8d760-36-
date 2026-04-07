import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTokenFromHeaders, validatePlayerSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tournaments/[id]/registration-status
// Check if the current player is registered for this tournament
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: tournamentId } = await params;
    
    // Get session token
    const token = getTokenFromHeaders(request);
    
    if (!token) {
      return NextResponse.json(
        { isRegistered: false, isAuthenticated: false },
        { status: 200 }
      );
    }

    // Validate session
    const session = await validatePlayerSession(token);
    
    if (!session) {
      return NextResponse.json(
        { isRegistered: false, isAuthenticated: false },
        { status: 200 }
      );
    }

    if (!session.userId) {
      return NextResponse.json(
        { isRegistered: false, isAuthenticated: false },
        { status: 200 }
      );
    }

    // Check if player is registered
    const registration = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId,
        userId: session.userId,
        status: { in: ['CONFIRMED', 'PENDING'] }
      }
    });

    // Also check waitlist
    const waitlistEntry = await db.tournamentWaitlist.findFirst({
      where: {
        tournamentId,
        userId: session.userId,
        status: 'WAITING'
      }
    });

    return NextResponse.json({
      isRegistered: !!registration,
      isWaitlisted: !!waitlistEntry,
      isAuthenticated: true,
      registrationStatus: registration?.status || (waitlistEntry ? 'WAITLISTED' : null)
    });

  } catch (error) {
    console.error('Error checking registration status:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}
