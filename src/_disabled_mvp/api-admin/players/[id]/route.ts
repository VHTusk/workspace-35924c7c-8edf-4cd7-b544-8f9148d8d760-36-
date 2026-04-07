import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// Get player details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const player = await db.user.findUnique({
      where: { id },
      include: {
        rating: true,
        affiliatedOrg: {
          select: { id: true, name: true, type: true, city: true },
        },
        tournamentRegs: {
          include: {
            tournament: {
              select: { id: true, name: true, status: true, startDate: true },
            },
          },
          orderBy: { registeredAt: 'desc' },
          take: 10,
        },
        matchesAsA: {
          where: { tournamentId: { not: null } },
          include: {
            tournament: { select: { id: true, name: true } },
            playerB: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { playedAt: 'desc' },
          take: 10,
        },
        matchesAsB: {
          where: { tournamentId: { not: null } },
          include: {
            tournament: { select: { id: true, name: true } },
            playerA: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { playedAt: 'desc' },
          take: 10,
        },
        achievements: {
          orderBy: { earnedAt: 'desc' },
          take: 10,
        },
        tournamentResults: {
          include: {
            tournament: { select: { id: true, name: true, scope: true } },
          },
          orderBy: { awardedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Combine matches
    const allMatches = [
      ...player.matchesAsA.map((m) => ({
        id: m.id,
        tournament: m.tournament,
        opponent: m.playerB,
        score: `${m.scoreA}-${m.scoreB}`,
        won: m.winnerId === player.id,
        playedAt: m.playedAt,
        eloChange: m.eloChangeA,
      })),
      ...player.matchesAsB.map((m) => ({
        id: m.id,
        tournament: m.tournament,
        opponent: m.playerA,
        score: `${m.scoreB}-${m.scoreA}`,
        won: m.winnerId === player.id,
        playedAt: m.playedAt,
        eloChange: m.eloChangeB,
      })),
    ].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()).slice(0, 10);

    return NextResponse.json({
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        email: player.email,
        phone: player.phone,
        sport: player.sport,
        dob: player.dob,
        gender: player.gender,
        city: player.city,
        district: player.district,
        state: player.state,
        pinCode: player.pinCode,
        elo: Math.round(player.hiddenElo),
        points: player.visiblePoints,
        isActive: player.isActive,
        verified: player.verified,
        verifiedAt: player.verifiedAt,
        hideElo: player.hideElo,
        showOnLeaderboard: player.showOnLeaderboard,
        tosAcceptedAt: player.tosAcceptedAt,
        privacyAcceptedAt: player.privacyAcceptedAt,
        createdAt: player.createdAt,
        deactivatedAt: player.deactivatedAt,
        deactivationReason: player.deactivationReason,
        affiliatedOrg: player.affiliatedOrg,
        rating: player.rating,
      },
      recentTournaments: player.tournamentRegs.map((r) => ({
        id: r.id,
        tournament: r.tournament,
        status: r.status,
        registeredAt: r.registeredAt,
      })),
      recentMatches: allMatches,
      achievements: player.achievements,
      tournamentResults: player.tournamentResults.map((r) => ({
        id: r.id,
        tournament: r.tournament,
        rank: r.rank,
        bonusPoints: r.bonusPoints,
        awardedAt: r.awardedAt,
      })),
    });
  } catch (error) {
    console.error('Get player error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update player
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Only ADMIN can update players' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const player = await db.user.findUnique({ where: { id } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone', 'city', 'district', 'state', 'pinCode',
      'hideElo', 'showOnLeaderboard', 'verified',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      player: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
      },
    });
  } catch (error) {
    console.error('Update player error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
