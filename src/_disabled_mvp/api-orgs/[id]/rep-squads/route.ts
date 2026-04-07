// API: Rep Squad Management
// GET /api/orgs/[id]/rep-squads - List squads
// POST /api/orgs/[id]/rep-squads - Create squad

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List squads
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS';

    const where: { orgId: string; status: 'ACTIVE' | 'INACTIVE' | 'DISBANDED'; sport?: 'CORNHOLE' | 'DARTS' } = {
      orgId,
      status: 'ACTIVE',
    };

    if (sport) {
      where.sport = sport;
    }

    const squads = await db.repSquad.findMany({
      where,
      include: {
        _count: {
          select: {
            players: { where: { status: 'ACTIVE' } },
            tournamentRegistrations: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } },
          },
        },
        players: {
          where: { status: 'ACTIVE', role: 'CAPTAIN' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { formedAt: 'desc' },
    });

    return NextResponse.json({ squads });
  } catch (error) {
    console.error('Get squads error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squads' },
      { status: 500 }
    );
  }
}

// POST - Create squad
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const { sport, name, description, managerId, coachId } = body;

    // Check if squad with same name exists
    const existing = await db.repSquad.findFirst({
      where: {
        orgId,
        sport,
        name,
        status: { not: 'DISBANDED' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A squad with this name already exists for this sport' },
        { status: 400 }
      );
    }

    const squad = await db.repSquad.create({
      data: {
        orgId,
        sport,
        name,
        description,
        managerId,
        coachId,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    console.error('Create squad error:', error);
    return NextResponse.json(
      { error: 'Failed to create squad' },
      { status: 500 }
    );
  }
}
