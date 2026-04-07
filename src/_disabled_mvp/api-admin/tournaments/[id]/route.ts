import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { Role, TournamentStatus, AuditAction, SportType } from '@prisma/client';

// Get tournament details
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

    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        hostOrg: {
          select: { id: true, name: true, type: true },
        },
        bracket: {
          include: {
            _count: { select: { matches: true } },
          },
        },
        _count: {
          select: {
            registrations: true,
            matches: true,
            waitlist: true,
            checkins: true,
          },
        },
        sponsors: {
          select: { id: true, name: true, tier: true },
        },
        staff: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get registrations summary
    const registrations = await db.tournamentRegistration.findMany({
      where: { tournamentId: id },
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
      take: 50,
    });

    // Get recent matches
    const recentMatches = await db.match.findMany({
      where: { tournamentId: id },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        bracketMatch: { select: { roundNumber: true, matchNumber: true } },
      },
      orderBy: { playedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        type: tournament.type,
        scope: tournament.scope,
        status: tournament.status,
        location: tournament.location,
        city: tournament.city,
        district: tournament.district,
        state: tournament.state,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        regDeadline: tournament.regDeadline,
        prizePool: tournament.prizePool,
        entryFee: tournament.entryFee,
        maxPlayers: tournament.maxPlayers,
        maxPlayersPerOrg: tournament.maxPlayersPerOrg,
        earlyBirdFee: tournament.earlyBirdFee,
        earlyBirdDeadline: tournament.earlyBirdDeadline,
        groupDiscountMin: tournament.groupDiscountMin,
        groupDiscountPercent: tournament.groupDiscountPercent,
        bracketFormat: tournament.bracketFormat,
        scoringMode: tournament.scoringMode,
        ageMin: tournament.ageMin,
        ageMax: tournament.ageMax,
        gender: tournament.gender,
        isPublic: tournament.isPublic,
        rosterLockDate: tournament.rosterLockDate,
        createdAt: tournament.createdAt,
        updatedAt: tournament.updatedAt,
        hostOrg: tournament.hostOrg,
        bracket: tournament.bracket ? {
          id: tournament.bracket.id,
          format: tournament.bracket.format,
          totalRounds: tournament.bracket.totalRounds,
          generatedAt: tournament.bracket.generatedAt,
          matchesCount: tournament.bracket._count.matches,
        } : null,
        counts: {
          registrations: tournament._count.registrations,
          matches: tournament._count.matches,
          waitlist: tournament._count.waitlist,
          checkins: tournament._count.checkins,
        },
        sponsors: tournament.sponsors,
        staff: tournament.staff.map((s) => ({
          id: s.id,
          role: s.role,
          user: s.user,
        })),
      },
      registrations: registrations.map((r) => ({
        id: r.id,
        status: r.status,
        registeredAt: r.registeredAt,
        user: r.user,
      })),
      recentMatches: recentMatches.map((m) => ({
        id: m.id,
        playerA: m.playerA,
        playerB: m.playerB,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerId: m.winnerId,
        outcome: m.outcome,
        playedAt: m.playedAt,
        round: m.bracketMatch ? `R${m.bracketMatch.roundNumber}M${m.bracketMatch.matchNumber}` : null,
      })),
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update tournament
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

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingTournament = await db.tournament.findUnique({
      where: { id },
    });

    if (!existingTournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    const allowedFields = [
      'name', 'type', 'scope', 'location', 'city', 'district', 'state',
      'startDate', 'endDate', 'regDeadline', 'prizePool', 'entryFee',
      'maxPlayers', 'maxPlayersPerOrg', 'earlyBirdFee', 'earlyBirdDeadline',
      'groupDiscountMin', 'groupDiscountPercent', 'bracketFormat',
      'ageMin', 'ageMax', 'gender', 'isPublic', 'scoringMode', 'rosterLockDate',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['startDate', 'endDate', 'regDeadline', 'earlyBirdDeadline', 'rosterLockDate'].includes(field)) {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const tournament = await db.tournament.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete tournament
export async function DELETE(
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
      return NextResponse.json({ error: 'Only ADMIN can delete tournaments' }, { status: 403 });
    }

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { matches: true, registrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if tournament has matches
    if (tournament._count.matches > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tournament with matches. Cancel instead.' },
        { status: 400 }
      );
    }

    // Log audit before deletion
    await db.auditLog.create({
      data: {
        sport: tournament.sport as SportType,
        action: AuditAction.TOURNAMENT_CANCELLED,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Tournament',
        targetId: tournament.id,
        metadata: JSON.stringify({
          action: 'DELETED',
          name: tournament.name,
          registrationsCount: tournament._count.registrations,
        }),
      },
    });

    // Delete tournament (cascades will handle related records)
    await db.tournament.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
