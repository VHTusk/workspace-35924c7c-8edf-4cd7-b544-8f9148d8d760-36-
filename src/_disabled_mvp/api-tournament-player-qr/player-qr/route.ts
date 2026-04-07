/**
 * Player QR Code API for Tournament Check-in
 * GET /api/tournaments/[id]/player-qr/[playerId] - Get player's QR code
 * POST /api/tournaments/[id]/player-qr - Generate/refresh QR code
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import {
  generatePlayerCheckInToken,
  getPlayerCheckInStatus,
  getQRCodeImageUrl,
} from '@/lib/tournament-qr';
import { SportType } from '@prisma/client';

// GET - Get player's QR code for check-in
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get check-in status and QR code
    const status = await getPlayerCheckInStatus(tournamentId, playerId);

    if (!status.isRegistered) {
      return NextResponse.json(
        { error: 'Player is not registered for this tournament' },
        { status: 404 }
      );
    }

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, sport: true, endDate: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Generate QR code if not exists or expired
    const registration = await db.tournamentRegistration.findFirst({
      where: { tournamentId, userId: playerId },
      select: { id: true },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Generate or refresh QR code
    const { qrData, qrUrl } = await generatePlayerCheckInToken(
      tournamentId,
      playerId,
      registration.id,
      tournament.sport
    );

    return NextResponse.json({
      success: true,
      data: {
        tournament: {
          id: tournamentId,
          name: tournament.name,
          sport: tournament.sport,
        },
        player: {
          id: playerId,
          isCheckedIn: status.isCheckedIn,
          checkedInAt: status.checkedInAt,
        },
        qrCode: {
          data: qrUrl,
          imageUrl: getQRCodeImageUrl(qrUrl, 300),
          expiresAt: qrData.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error('Error getting player QR code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Generate or refresh QR code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get registration
    const registration = await db.tournamentRegistration.findFirst({
      where: { tournamentId, userId: playerId },
      include: {
        tournament: { select: { sport: true, name: true, endDate: true } },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Player is not registered for this tournament' },
        { status: 404 }
      );
    }

    // Generate new QR code
    const { qrData, qrUrl } = await generatePlayerCheckInToken(
      tournamentId,
      playerId,
      registration.id,
      registration.tournament.sport as SportType
    );

    return NextResponse.json({
      success: true,
      data: {
        tournament: {
          id: tournamentId,
          name: registration.tournament.name,
          sport: registration.tournament.sport,
        },
        qrCode: {
          data: qrUrl,
          imageUrl: getQRCodeImageUrl(qrUrl, 300),
          expiresAt: qrData.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error('Error generating player QR code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
