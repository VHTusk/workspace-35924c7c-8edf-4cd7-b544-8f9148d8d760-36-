/**
 * Kiosk Check-in API
 *
 * GET: Get tournaments and check-in status for kiosk display
 * POST: Process player check-in from kiosk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RegistrationStatus, TournamentStatus, CourtStatus, MatchReadiness } from '@prisma/client';

/**
 * GET /api/kiosk/check-in
 * Get tournaments and check-in status for kiosk display
 *
 * Query params:
 * - sport: Sport type (CORNHOLE, DARTS)
 * - tournamentId: Specific tournament to get check-in data for
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const tournamentId = searchParams.get('tournamentId');

    // If tournamentId is provided, get check-in data for that tournament
    if (tournamentId) {
      return await getTournamentCheckInData(tournamentId);
    }

    // Otherwise, get list of active tournaments for the sport
    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter required when tournamentId is not provided' },
        { status: 400 }
      );
    }

    const tournaments = await db.tournament.findMany({
      where: {
        sport: sport as 'CORNHOLE' | 'DARTS',
        status: {
          in: [
            TournamentStatus.REGISTRATION_OPEN,
            TournamentStatus.REGISTRATION_CLOSED,
            TournamentStatus.IN_PROGRESS
          ]
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        _count: {
          select: {
            registrations: {
              where: { status: RegistrationStatus.CONFIRMED }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    return NextResponse.json({
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        startDate: t.startDate,
        playerCount: t._count.registrations
      }))
    });
  } catch (error) {
    console.error('Kiosk check-in GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get check-in data for a specific tournament
 */
async function getTournamentCheckInData(tournamentId: string) {
  // Get tournament
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  if (!tournament) {
    return NextResponse.json(
      { error: 'Tournament not found' },
      { status: 404 }
    );
  }

  // Get all confirmed registrations
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: RegistrationStatus.CONFIRMED
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          visiblePoints: true
        }
      }
    },
    orderBy: { registeredAt: 'asc' }
  });

  // Get existing check-ins
  const checkIns = await db.tournamentCheckin.findMany({
    where: { tournamentId }
  });

  const checkInMap = new Map(checkIns.map(c => [c.userId, c]));

  // Get upcoming matches for players
  const upcomingMatches = await db.match.findMany({
    where: {
      tournamentId,
      status: 'PENDING'
    },
    include: {
      playerA: { select: { id: true, firstName: true, lastName: true } },
      playerB: { select: { id: true, firstName: true, lastName: true } },
      courtAssignments: {
        where: { releasedAt: null },
        include: { court: { select: { id: true, name: true } } }
      }
    }
  });

  // Create a map of player to upcoming match
  const playerMatchMap = new Map<string, typeof upcomingMatches[0]>();
  for (const match of upcomingMatches) {
    if (match.playerAId) {
      playerMatchMap.set(match.playerAId, match);
    }
    if (match.playerBId) {
      playerMatchMap.set(match.playerBId, match);
    }
  }

  // Build players list
  const players = registrations.map(r => {
    const checkIn = checkInMap.get(r.userId);
    const upcomingMatch = playerMatchMap.get(r.userId);
    const assignment = upcomingMatch?.courtAssignments[0];

    return {
      id: r.userId,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      email: r.user.email,
      phone: r.user.phone,
      visiblePoints: r.user.visiblePoints,
      checkedIn: !!checkIn,
      checkedInAt: checkIn?.checkedInAt?.toISOString() || null,
      upcomingMatch: upcomingMatch ? {
        id: upcomingMatch.id,
        round: upcomingMatch.round || 1,
        court: assignment?.court ? {
          id: assignment.court.id,
          name: assignment.court.name
        } : undefined,
        opponent: upcomingMatch.playerAId === r.userId
          ? upcomingMatch.playerB
            ? { id: upcomingMatch.playerB.id, firstName: upcomingMatch.playerB.firstName, lastName: upcomingMatch.playerB.lastName }
            : undefined
          : upcomingMatch.playerA
            ? { id: upcomingMatch.playerA.id, firstName: upcomingMatch.playerA.firstName, lastName: upcomingMatch.playerA.lastName }
            : undefined
      } : undefined
    };
  });

  // Calculate stats
  const totalPlayers = players.length;
  const checkedInCount = players.filter(p => p.checkedIn).length;

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status
    },
    players,
    stats: {
      total: totalPlayers,
      checkedIn: checkedInCount,
      notCheckedIn: totalPlayers - checkedInCount
    }
  });
}

/**
 * POST /api/kiosk/check-in
 * Process player check-in from kiosk
 *
 * Body:
 * - tournamentId: Tournament ID
 * - userId: Player user ID
 * - method: Check-in method (KIOSK, QR, MANUAL)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentId, userId, method = 'KIOSK' } = body;

    if (!tournamentId || !userId) {
      return NextResponse.json(
        { error: 'Tournament ID and User ID are required' },
        { status: 400 }
      );
    }

    // Check if tournament exists and is active
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (![
      TournamentStatus.REGISTRATION_OPEN,
      TournamentStatus.REGISTRATION_CLOSED,
      TournamentStatus.IN_PROGRESS
    ].includes(tournament.status)) {
      return NextResponse.json(
        { error: 'Tournament is not active for check-in' },
        { status: 400 }
      );
    }

    // Check if player is registered
    const registration = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId,
        userId,
        status: RegistrationStatus.CONFIRMED
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Player is not registered for this tournament' },
        { status: 400 }
      );
    }

    // Check if already checked in
    const existingCheckIn = await db.tournamentCheckin.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId }
      }
    });

    if (existingCheckIn) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        message: 'Player is already checked in',
        checkin: {
          id: existingCheckIn.id,
          userId: existingCheckIn.userId,
          name: `${registration.user.firstName} ${registration.user.lastName}`,
          checkedInAt: existingCheckIn.checkedInAt
        }
      });
    }

    // Create check-in
    const checkIn = await db.tournamentCheckin.create({
      data: {
        tournamentId,
        userId,
        method
      }
    });

    // Try to assign court if player has upcoming match
    let courtAssignment: { id: string; name: string } | undefined;

    // Find player's upcoming match
    const upcomingMatch = await db.match.findFirst({
      where: {
        tournamentId,
        OR: [{ playerAId: userId }, { playerBId: userId }],
        status: 'PENDING'
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (upcomingMatch) {
      // Check if both players are now checked in
      const opponentId = upcomingMatch.playerAId === userId
        ? upcomingMatch.playerBId
        : upcomingMatch.playerAId;

      if (opponentId) {
        const opponentCheckIn = await db.tournamentCheckin.findUnique({
          where: {
            tournamentId_userId: { tournamentId, userId: opponentId }
          }
        });

        // If both players checked in, try to assign a court
        if (opponentCheckIn) {
          // Check for available court
          const availableCourt = await db.court.findFirst({
            where: {
              tournamentId,
              status: CourtStatus.AVAILABLE
            },
            orderBy: [
              { isPriority: 'desc' },
              { matchesHosted: 'asc' }
            ]
          });

          if (availableCourt) {
            // Assign court to match
            await db.courtAssignment.create({
              data: {
                courtId: availableCourt.id,
                matchId: upcomingMatch.id,
                isAutoAssigned: true
              }
            });

            // Update court status
            await db.court.update({
              where: { id: availableCourt.id },
              data: {
                status: CourtStatus.OCCUPIED,
                currentMatchId: upcomingMatch.id
              }
            });

            courtAssignment = {
              id: availableCourt.id,
              name: availableCourt.name
            };
          }
        }
      }
    }

    // Log check-in to venue flow
    try {
      await db.venueFlowLog.create({
        data: {
          tournamentId,
          action: 'PLAYER_CHECKIN',
          entityType: 'PLAYER',
          entityId: userId,
          metadata: JSON.stringify({
            checkedInAt: checkIn.checkedInAt,
            method,
            kioskMode: true
          })
        }
      });
    } catch {
      // Venue flow log is optional
    }

    return NextResponse.json({
      success: true,
      message: 'Check-in successful',
      checkin: {
        id: checkIn.id,
        userId: checkIn.userId,
        name: `${registration.user.firstName} ${registration.user.lastName}`,
        checkedInAt: checkIn.checkedInAt
      },
      courtAssignment
    });
  } catch (error) {
    console.error('Kiosk check-in POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
