// API: School Houses CRUD Operations
// GET/POST /api/orgs/[id]/school-houses

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all houses for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';

    const houses = await db.schoolHouse.findMany({
      where: { orgId, sport },
      orderBy: { points: 'desc' },
      include: {
        _count: {
          select: {
            students: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    const formattedHouses = houses.map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      logoUrl: h.logoUrl,
      motto: h.motto,
      points: h.points,
      tournamentsWon: h.tournamentsWon,
      studentCount: h._count.students,
      isActive: h.isActive,
    }));

    return NextResponse.json({ houses: formattedHouses });
  } catch (error) {
    console.error('Error fetching houses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch houses' },
      { status: 500 }
    );
  }
}

// POST - Create a new house
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const { name, color, motto, sport = 'CORNHOLE' } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'House name is required' },
        { status: 400 }
      );
    }

    // Check if house already exists with this name
    const existing = await db.schoolHouse.findFirst({
      where: { orgId, name, sport }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'House with this name already exists' },
        { status: 400 }
      );
    }

    const house = await db.schoolHouse.create({
      data: {
        orgId,
        name,
        color: color || '#EF4444',
        motto,
        sport,
      },
    });

    return NextResponse.json({ house });
  } catch (error) {
    console.error('Error creating house:', error);
    return NextResponse.json(
      { error: 'Failed to create house' },
      { status: 500 }
    );
  }
}
