import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, RegistrationStatus, TeamStatus, SportType, TournamentScope, SubscriptionStatus } from '@prisma/client';
import { getAuthenticatedUserId } from '@/lib/session';
import { createRazorpayOrder } from '@/lib/payments/razorpay';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tournaments/[id]/team-register - Get registered teams for a tournament
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: tournamentId } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        format: true,
        teamSize: true,
        maxTeams: true,
        status: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const teamRegistrations = await db.tournamentTeam.findMany({
      where: { tournamentId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    hiddenElo: true,
                    visiblePoints: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });

    return NextResponse.json({
      tournament,
      teams: teamRegistrations,
      registeredCount: teamRegistrations.filter((t) => t.status !== 'CANCELLED').length,
    });
  } catch (error) {
    console.error('Error fetching team registrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/team-register - Register a team for a tournament
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Get current user info
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, sport: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: {
          select: {
            teamRegistrations: {
              where: { status: { notIn: [RegistrationStatus.CANCELLED] } },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Verify tournament format supports team registration
    if (tournament.format === 'INDIVIDUAL') {
      return NextResponse.json(
        { error: 'This tournament is for individual players only. Use individual registration.' },
        { status: 400 }
      );
    }

    // Check tournament status
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return NextResponse.json(
        { error: 'Tournament registration is not open' },
        { status: 400 }
      );
    }

    // SUBSCRIPTION CHECK: STATE and NATIONAL tournaments require active subscription
    // Users can view tournaments but need subscription to participate
    if (tournament.scope === TournamentScope.STATE || tournament.scope === TournamentScope.NATIONAL) {
      const activeSubscription = await db.subscription.findFirst({
        where: {
          userId: userId,
          sport: tournament.sport,
          status: SubscriptionStatus.ACTIVE,
          endDate: { gte: new Date() },
        },
      });

      if (!activeSubscription) {
        return NextResponse.json(
          {
            error: `Subscription required for ${tournament.scope.toLowerCase()} tournaments`,
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'Please purchase an annual subscription to participate in State and National level tournaments. You can still view tournament details and brackets.',
            scope: tournament.scope,
            subscriptionUrl: `/${tournament.sport.toLowerCase()}/subscription`,
          },
          { status: 403 }
        );
      }
    }

    // Check registration deadline
    if (tournament.regDeadline && new Date() > tournament.regDeadline) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    // Get team and verify user is captain
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                hiddenElo: true,
              },
            },
          },
        },
        tournamentTeams: {
          where: {
            tournamentId,
            status: { notIn: [RegistrationStatus.CANCELLED] },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify same sport
    if (team.sport !== tournament.sport) {
      return NextResponse.json({ error: 'Team sport does not match tournament sport' }, { status: 400 });
    }

    // Verify user belongs to this sport
    if (currentUser.sport !== tournament.sport) {
      return NextResponse.json({ error: 'Your account is for a different sport' }, { status: 400 });
    }

    // Verify same format
    if (team.format !== tournament.format) {
      return NextResponse.json(
        { error: `Team format (${team.format}) does not match tournament format (${tournament.format})` },
        { status: 400 }
      );
    }

    // Check if team status is ACTIVE (both members have joined)
    if (team.status !== TeamStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Team is not active. Both players must confirm the team before registration.' },
        { status: 400 }
      );
    }

    // Check if user is captain
    const captainMember = team.members.find((m) => m.userId === userId && m.role === 'CAPTAIN');
    if (!captainMember) {
      return NextResponse.json({ error: 'Only team captain can register the team' }, { status: 403 });
    }

    // Check team size requirements
    const requiredSize = tournament.teamSize || (tournament.format === 'DOUBLES' ? 2 : 3);
    if (team.members.length < requiredSize) {
      return NextResponse.json(
        { error: `Team must have at least ${requiredSize} members for this tournament` },
        { status: 400 }
      );
    }

    // Check max teams limit
    const maxTeams = tournament.maxTeams || tournament.maxPlayers;
    if (maxTeams && tournament._count.teamRegistrations >= maxTeams) {
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
    }

    // Calculate entry fee (considering early bird)
    let entryFee = tournament.entryFee || 0;
    if (tournament.earlyBirdFee && tournament.earlyBirdDeadline && new Date() < tournament.earlyBirdDeadline) {
      entryFee = tournament.earlyBirdFee;
    }

    const amountInPaise = entryFee * 100; // Convert to paise
    const existingRegistration = team.tournamentTeams[0];

    if (existingRegistration?.status === RegistrationStatus.CONFIRMED) {
      return NextResponse.json({ error: 'Team is already registered for this tournament' }, { status: 400 });
    }

    if (existingRegistration?.status === RegistrationStatus.PENDING && entryFee > 0) {
      const receipt = `TEAM_${tournamentId.slice(0, 8)}_${teamId.slice(0, 8)}_${Date.now()}`;

      const order = await createRazorpayOrder({
        amount: amountInPaise,
        receipt,
        notes: {
          paymentType: 'TEAM_TOURNAMENT_ENTRY',
          tournamentId,
          teamId,
          captainId: userId,
          sport: tournament.sport,
        },
      });

      await db.paymentLedger.create({
        data: {
          userId,
          tournamentId,
          sport: tournament.sport,
          amount: amountInPaise,
          type: 'TEAM_TOURNAMENT_ENTRY',
          status: 'INITIATED',
          razorpayId: order.id,
          description: `Team registration retry: ${team.name} for ${tournament.name}`,
        },
      });

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        registration: existingRegistration,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        payer: {
          name: `${currentUser.firstName} ${currentUser.lastName}`,
          email: currentUser.email,
          phone: currentUser.phone,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        tournamentId,
        teamId,
        amountDisplay: `₹${entryFee.toLocaleString('en-IN')}`,
        message: 'Please complete payment to confirm your team registration.',
      });
    }

    // If no entry fee, create registration directly
    if (entryFee === 0) {
      const registration = await db.tournamentTeam.create({
        data: {
          tournamentId,
          teamId,
          status: RegistrationStatus.CONFIRMED,
          amount: 0,
        },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Create notifications for all team members
      for (const member of team.members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            sport: tournament.sport as SportType,
            type: 'TOURNAMENT_REGISTERED',
            title: 'Team Registered!',
            message: `Your team "${team.name}" has been registered for ${tournament.name}`,
            link: `/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        registration,
        message: 'Team registered successfully!',
      });
    }

    // If entry fee > 0, create Razorpay order for payment
    const receipt = `TEAM_${tournamentId.slice(0, 8)}_${teamId.slice(0, 8)}_${Date.now()}`;

    const order = await createRazorpayOrder({
      amount: amountInPaise,
      receipt,
      notes: {
        paymentType: 'TEAM_TOURNAMENT_ENTRY',
        tournamentId,
        teamId,
        captainId: userId,
        sport: tournament.sport,
      },
    });

    // Store payment record with tournament context
    await db.paymentLedger.create({
      data: {
        userId,
        tournamentId,
        sport: tournament.sport,
        amount: amountInPaise,
        type: 'TEAM_TOURNAMENT_ENTRY',
        status: 'INITIATED',
        razorpayId: order.id,
        description: `Team registration: ${team.name} for ${tournament.name}`,
      },
    });

    // Create pending registration
    const registration = await db.tournamentTeam.create({
      data: {
        tournamentId,
        teamId,
        status: RegistrationStatus.PENDING,
        amount: entryFee,
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      registration,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      payer: {
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        email: currentUser.email,
        phone: currentUser.phone,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      tournamentId,
      teamId,
      amountDisplay: `₹${entryFee.toLocaleString('en-IN')}`,
      message: 'Registration created. Please complete payment to confirm.',
    });
  } catch (error) {
    console.error('Error registering team:', error);
    return NextResponse.json({ error: 'Failed to register team' }, { status: 500 });
  }
}

// DELETE /api/tournaments/[id]/team-register - Withdraw team from tournament
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        startDate: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if tournament hasn't started
    if (
      tournament.status === TournamentStatus.IN_PROGRESS ||
      tournament.status === TournamentStatus.COMPLETED
    ) {
      return NextResponse.json({ error: 'Cannot withdraw from an active or completed tournament' }, { status: 400 });
    }

    // Get team registration
    const registration = await db.tournamentTeam.findUnique({
      where: {
        tournamentId_teamId: { tournamentId, teamId },
      },
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Check if user is captain
    const captainMember = registration.team.members.find((m) => m.userId === userId && m.role === 'CAPTAIN');
    if (!captainMember) {
      return NextResponse.json({ error: 'Only team captain can withdraw the team' }, { status: 403 });
    }

    // Cancel registration
    await db.tournamentTeam.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    // Create notifications for all team members
    for (const member of registration.team.members) {
      await db.notification.create({
        data: {
          userId: member.userId,
          sport: tournament.sport as SportType,
          type: 'TOURNAMENT_CANCELLED',
          title: 'Team Withdrawn',
          message: `Your team "${registration.team.name}" has been withdrawn from ${tournament.name}`,
          link: `/${tournament.sport.toLowerCase()}/tournaments`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Team withdrawn from tournament',
      refundInfo:
        registration.amount > 0
          ? 'Refund will be processed within 5-7 business days'
          : null,
    });
  } catch (error) {
    console.error('Error withdrawing team:', error);
    return NextResponse.json({ error: 'Failed to withdraw team' }, { status: 500 });
  }
}
