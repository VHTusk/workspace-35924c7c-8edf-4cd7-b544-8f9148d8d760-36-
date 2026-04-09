// API: School Classes CRUD Operations
// GET/POST /api/orgs/[id]/school-classes

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all classes for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';

    const classes = await db.schoolClass.findMany({
      where: { orgId, sport },
      orderBy: { gradeLevel: 'asc' },
      include: {
        _count: {
          select: {
            students: {
              where: { status: 'ACTIVE' }
            }
          }
        },
        sections: {
          where: { isActive: true },
          select: { id: true, name: true, capacity: true }
        }
      }
    });

    const formattedClasses = classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      isActive: c.isActive,
      studentCount: c._count.students,
      sections: c.sections,
    }));

    return NextResponse.json({ classes: formattedClasses });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}

// POST - Create a new class
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const { name, gradeLevel, sport = 'CORNHOLE' } = body;

    if (!name || !gradeLevel) {
      return NextResponse.json(
        { error: 'Name and grade level are required' },
        { status: 400 }
      );
    }

    // Check if class already exists for this grade
    const existing = await db.schoolClass.findFirst({
      where: { orgId, gradeLevel: parseInt(gradeLevel), sport }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Class already exists for this grade level' },
        { status: 400 }
      );
    }

    const schoolClass = await db.schoolClass.create({
      data: {
        orgId,
        name,
        gradeLevel: parseInt(gradeLevel),
        sport,
      },
    });

    return NextResponse.json({ class: schoolClass });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json(
      { error: 'Failed to create class' },
      { status: 500 }
    );
  }
}
