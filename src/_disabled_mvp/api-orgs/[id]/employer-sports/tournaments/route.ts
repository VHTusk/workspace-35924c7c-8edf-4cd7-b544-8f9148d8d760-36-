import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiResponse } from '@/lib/api-response';
import { authorizeOrgRoute } from '@/lib/session-helpers';
import { SportType, TournamentType, TournamentStatus } from '@prisma/client';

// GET /api/orgs/[id]/employer-sports/tournaments - List internal tournaments
// POST /api/orgs/[id]/employer-sports/tournaments - Create internal tournament

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authorize: verify authenticated org matches route param
    const auth = await authorizeOrgRoute(request, id);
    if (!auth.success) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';

    const where: Record<string, unknown> = {
      orgId: id,
      type: TournamentType.INTRA_ORG,
    };

    if (sport) {
      where.sport = sport as SportType;
    }
    if (status) {
      where.status = status as TournamentStatus;
    }

    const tournaments = await db.tournament.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    const total = await db.tournament.count({ where });

    return apiResponse({
      tournaments,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching employer sports tournaments:', error);
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authorize: verify authenticated org matches route param
    const auth = await authorizeOrgRoute(request, id);
    if (!auth.success) return auth.error;

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'sport', 'startDate', 'endDate', 'regDeadline', 'location'];
    for (const field of requiredFields) {
      if (!body[field as keyof typeof body]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Validate sport
    if (body.sport && !['CORNHOLE', 'DARTS'].includes(body.sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Create internal tournament
    const tournament = await db.tournament.create({
      data: {
        name: body.name,
        sport: body.sport as SportType,
        type: TournamentType.INTRA_ORG,
        orgId: id,
        location: body.location,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        regDeadline: new Date(body.regDeadline),
        prizePool: body.prizePool || 0,
        maxPlayers: body.maxPlayers || 64,
        entryFee: body.entryFee || 0,
        city: body.city,
        state: body.state,
        managerName: body.managerName || 'HR Department',
        managerPhone: body.managerPhone || '',
        status: TournamentStatus.DRAFT,
        isPublic: false,
        scoringMode: body.scoringMode || 'STAFF_ONLY',
      },
    });

    return apiResponse({ tournament }, 'Internal tournament created successfully', 201);
  } catch (error) {
    console.error('Error creating employer sports tournament:', error);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}
