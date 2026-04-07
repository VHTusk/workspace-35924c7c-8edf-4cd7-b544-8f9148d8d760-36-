import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, SportType, TournamentType, TournamentScope } from '@prisma/client';
import { generateDirectorCredentials } from '@/lib/director-credentials';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { safeParseInt } from '@/lib/validation';

// List all tournaments with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user, session } = auth;

    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType | null;
    const status = searchParams.get('status') as TournamentStatus | null;
    const type = searchParams.get('type') as TournamentType | null;
    const scope = searchParams.get('scope') as TournamentScope | null;
    const search = searchParams.get('search');
    const page = safeParseInt(searchParams.get('page'), 1, 1, 1000);
    const limit = safeParseInt(searchParams.get('limit'), 20, 1, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;
    if (status) where.status = status;
    if (type) where.type = type;
    if (scope) where.scope = scope;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const [tournaments, total] = await Promise.all([
      db.tournament.findMany({
        where,
        include: {
          _count: {
            select: { registrations: true, matches: true },
          },
          hostOrg: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.tournament.count({ where }),
    ]);

    return NextResponse.json({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        sport: t.sport,
        type: t.type,
        scope: t.scope,
        status: t.status,
        location: t.location,
        city: t.city,
        state: t.state,
        startDate: t.startDate,
        endDate: t.endDate,
        regDeadline: t.regDeadline,
        prizePool: t.prizePool,
        entryFee: t.entryFee,
        maxPlayers: t.maxPlayers,
        isPublic: t.isPublic,
        bracketFormat: t.bracketFormat,
        scoringMode: t.scoringMode,
        hostOrg: t.hostOrg,
        registrationsCount: t._count.registrations,
        matchesCount: t._count.matches,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin tournaments list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new tournament
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user, session } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      sport,
      type,
      scope,
      location,
      city,
      district,
      state,
      venueGoogleMapsUrl,
      startDate,
      endDate,
      regDeadline,
      prizePool,
      entryFee,
      maxPlayers,
      maxPlayersPerOrg,
      earlyBirdFee,
      earlyBirdDeadline,
      groupDiscountMin,
      groupDiscountPercent,
      bracketFormat,
      ageMin,
      ageMax,
      gender,
      isPublic,
      scoringMode,
      orgId,
      // Manager fields (mandatory)
      managerName,
      managerPhone,
      managerWhatsApp,
      // Contact person fields (optional)
      contactPersonName,
      contactPersonPhone,
      contactPersonWhatsApp,
      // Tournament Director fields (optional - v3.52.0)
      director,
    } = body;

    // Validate required fields
    if (!name || !sport || !type || !location || !startDate || !endDate || !regDeadline || !managerName || !managerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields. Tournament name, sport, type, location, dates, and manager details are required.' },
        { status: 400 }
      );
    }

    // Validate director fields if provided
    if (director && director.name && !director.phone) {
      return NextResponse.json(
        { error: 'Director phone is required when director name is provided' },
        { status: 400 }
      );
    }

    const tournament = await db.tournament.create({
      data: {
        name,
        sport: sport as SportType,
        type: type as TournamentType,
        scope: scope as TournamentScope,
        location,
        city,
        district,
        state,
        venueGoogleMapsUrl,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        regDeadline: new Date(regDeadline),
        prizePool: prizePool || 0,
        entryFee: entryFee || 0,
        maxPlayers: maxPlayers || 32,
        maxPlayersPerOrg,
        earlyBirdFee,
        earlyBirdDeadline: earlyBirdDeadline ? new Date(earlyBirdDeadline) : null,
        groupDiscountMin,
        groupDiscountPercent,
        bracketFormat: bracketFormat as 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN',
        ageMin,
        ageMax,
        gender: gender as 'MALE' | 'FEMALE' | 'MIXED',
        isPublic: isPublic ?? false,
        scoringMode: scoringMode || 'STAFF_ONLY',
        status: TournamentStatus.DRAFT,
        orgId: type === 'INTRA_ORG' ? orgId : null,
        createdById: user.id,
        // Manager fields
        managerName,
        managerPhone,
        managerWhatsApp: managerWhatsApp || null,
        // Contact person fields
        contactPersonName: contactPersonName || null,
        contactPersonPhone: contactPersonPhone || null,
        contactPersonWhatsApp: contactPersonWhatsApp || null,
      },
    });

    // Handle director assignment if provided
    let directorCredentials: { username: string; password: string } | undefined;
    if (director && director.name && director.phone) {
      const credentials = await generateDirectorCredentials(tournament.id);
      await db.tournament.update({
        where: { id: tournament.id },
        data: {
          directorName: director.name,
          directorPhone: director.phone,
          directorEmail: director.email || null,
          directorUsername: credentials.username,
          directorPasswordHash: credentials.passwordHash,
          directorCredentialsSent: false,
          directorAssignedById: user.id,
          directorAssignedAt: new Date(),
        },
      });
      directorCredentials = {
        username: credentials.username,
        password: credentials.password,
      };
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: 'TOURNAMENT_CANCELLED', // Using existing enum - will add TOURNAMENT_CREATED later
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Tournament',
        targetId: tournament.id,
        tournamentId: tournament.id,
        metadata: JSON.stringify({ 
          action: 'CREATED',
          name: tournament.name,
          type: tournament.type,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
      directorCredentials,
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
