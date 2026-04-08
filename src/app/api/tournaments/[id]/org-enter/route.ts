import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RegistrationStatus, TournamentType } from '@prisma/client';
import { getAuthenticatedOrg } from '@/lib/auth';
import { createRazorpayOrder, PRICING } from '@/lib/payments/razorpay';

// Organization enters an INTER_ORG tournament with selected roster players
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedOrg(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { org } = auth;

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { playerIds } = body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one player must be selected' },
        { status: 400 }
      );
    }

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { orgRegistrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check tournament type
    if (tournament.type !== TournamentType.INTER_ORG) {
      return NextResponse.json(
        { error: 'This API is only for INTER_ORG tournaments' },
        { status: 400 }
      );
    }

    // Check tournament is open for registration
    if (tournament.status !== 'REGISTRATION_OPEN') {
      return NextResponse.json(
        { error: 'Tournament is not open for registration' },
        { status: 400 }
      );
    }

    // Check if org already registered
    const existingRegistrations = await db.orgTournamentRegistration.findMany({
      where: { tournamentId, orgId: org.id },
    });

    // Check max players per org
    if (tournament.maxPlayersPerOrg && playerIds.length > tournament.maxPlayersPerOrg) {
      return NextResponse.json(
        { error: `Maximum ${tournament.maxPlayersPerOrg} players allowed per organization` },
        { status: 400 }
      );
    }

    // Verify all players are in org's roster
    const rosterPlayers = await db.orgRosterPlayer.findMany({
      where: {
        orgId: org.id,
        userId: { in: playerIds },
        isActive: true,
      },
    });

    if (rosterPlayers.length !== playerIds.length) {
      return NextResponse.json(
        { error: 'Some selected players are not in your roster' },
        { status: 400 }
      );
    }

    // Calculate total amount for payment
    const totalAmount = tournament.entryFee * playerIds.length; // Or use org fee if set
    const amountInPaise = totalAmount * 100;

    const hasConfirmedRegistration = existingRegistrations.some(
      (registration) => registration.status === RegistrationStatus.CONFIRMED,
    );

    if (hasConfirmedRegistration) {
      return NextResponse.json(
        { error: 'Organization already registered for this tournament' },
        { status: 400 }
      );
    }

    const existingPendingPlayerIds = existingRegistrations
      .filter((registration) => registration.status === RegistrationStatus.PENDING)
      .map((registration) => registration.userId)
      .sort();

    const requestedPlayerIds = [...playerIds].sort();

    if (
      existingPendingPlayerIds.length > 0 &&
      JSON.stringify(existingPendingPlayerIds) !== JSON.stringify(requestedPlayerIds)
    ) {
      return NextResponse.json(
        { error: 'A pending payment already exists for a different player selection. Please complete that payment first.' },
        { status: 409 }
      );
    }

    // Create registrations for all players
    if (existingPendingPlayerIds.length === 0) {
      await db.$transaction(
        playerIds.map((playerId: string) =>
          db.orgTournamentRegistration.create({
            data: {
              tournamentId,
              orgId: org.id,
              userId: playerId,
              status: totalAmount > 0 ? RegistrationStatus.PENDING : RegistrationStatus.CONFIRMED,
              amount: 0,
            },
          })
        )
      );
    }

    // Create Razorpay order for payment if there's a fee
    if (totalAmount > 0) {
      const order = await createRazorpayOrder({
        amount: amountInPaise,
        receipt: `org-entry-${tournamentId}-${org.id}`,
        notes: {
          type: 'INTER_ORG_TOURNAMENT_ENTRY',
          tournamentId,
          orgId: org.id,
          playerCount: playerIds.length.toString(),
        },
      });

      // Create payment ledger entry
      await db.paymentLedger.create({
        data: {
          razorpayId: order.id,
          orgId: org.id,
          tournamentId,
          sport: tournament.sport,
          amount: amountInPaise,
          type: 'INTER_ORG_TOURNAMENT_ENTRY',
          status: 'INITIATED',
          description: `Inter-org entry for ${playerIds.length} player(s)`,
        },
      });

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        payer: {
          name: org.name,
          email: org.email,
          phone: org.phone,
        },
        message: 'Please complete payment to register players',
      });
    }

    // Free tournament - registration complete
    return NextResponse.json({
      success: true,
      message: `Successfully registered ${playerIds.length} players for the tournament`,
      registration: {
        tournamentId,
        orgId: org.id,
        playersCount: playerIds.length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('Org tournament entry error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get org's entry status for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedOrg(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { org } = auth;

    const { id: tournamentId } = await params;

    // Get org's registrations for this tournament
    const registrations = await db.orgTournamentRegistration.findMany({
      where: { tournamentId, orgId: org.id },
    });

    const registeredUsers = registrations.length > 0
      ? await db.user.findMany({
          where: {
            id: { in: registrations.map((registration) => registration.userId) },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            city: true,
          },
        })
      : [];
    const registeredUserMap = new Map(
      registeredUsers.map((user) => [user.id, user]),
    );

    // Get roster players
    const roster = await db.orgRosterPlayer.findMany({
      where: { orgId: org.id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json({
      isRegistered: registrations.length > 0,
      registeredPlayers: registrations
        .map((registration) => {
          const user = registeredUserMap.get(registration.userId);
          if (!user) {
            return null;
          }

          return {
            ...user,
            elo: Math.round(user.hiddenElo),
          };
        })
        .filter((player): player is NonNullable<typeof player> => player !== null),
      rosterPlayers: roster.map((r) => ({
        ...r.user,
        elo: Math.round(r.user.hiddenElo),
      })),
    });
  } catch (error) {
    console.error('Get org entry status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
