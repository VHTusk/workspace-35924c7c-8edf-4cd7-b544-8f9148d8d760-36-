import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';
import { TournamentStatus, TournamentType, TournamentScope, BracketFormat, SportType } from '@prisma/client';

// Organization creates an INTRA_ORG tournament
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    if (!auth || !auth.org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { org } = auth;

    const body = await request.json();

    const {
      name,
      startDate,
      endDate,
      regDeadline,
      prizePool,
      entryFee,
      maxPlayers,
      location,
      city,
      district,
      state,
      bracketFormat,
      ageMin,
      ageMax,
      gender,
      description,
      rules,
    } = body;

    // Validate required fields
    if (!name || !startDate || !endDate || !regDeadline || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: name, startDate, endDate, regDeadline, location' },
        { status: 400 }
      );
    }

    // Create tournament (DRAFT status - needs admin approval)
    const tournament = await db.tournament.create({
      data: {
        name,
        sport: org.sport as SportType,
        type: TournamentType.INTRA_ORG,
        scope: TournamentScope.CITY, // Default to city for intra-org
        location,
        city: city || org.city,
        district: district || org.district,
        state: state || org.state,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        regDeadline: new Date(regDeadline),
        managerName: org.name,
        managerPhone: org.phone || 'N/A',
        prizePool: prizePool || 0,
        entryFee: entryFee || 0,
        maxPlayers: maxPlayers || 32,
        bracketFormat: (bracketFormat as BracketFormat) || BracketFormat.SINGLE_ELIMINATION,
        ageMin,
        ageMax,
        gender,
        isPublic: false, // Not public until admin approves
        status: TournamentStatus.DRAFT,
        scoringMode: 'STAFF_ONLY',
        orgId: org.id, // Host organization
        createdById: null, // Org-created, not user-created
      },
    });

    // Create tournament announcement for the approval request
    await db.tournamentAnnouncement.create({
      data: {
        tournamentId: tournament.id,
        title: 'Tournament Created',
        message: `Intra-org tournament "${name}" created by ${org.name}. Awaiting admin approval.`,
      },
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        type: tournament.type,
        message: 'Tournament created successfully. Awaiting admin approval before going live.',
      },
    });
  } catch (error) {
    console.error('Create intra-org tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
