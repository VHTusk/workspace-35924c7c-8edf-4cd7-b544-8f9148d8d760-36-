// API: School Class CRUD Operations (Single Class)
// PUT/DELETE /api/orgs/[id]/school-classes/[classId]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT - Update a class
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; classId: string }> }
) {
  try {
    const { id: orgId, classId } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Verify class belongs to this org
    const existingClass = await db.schoolClass.findFirst({
      where: { id: classId, orgId }
    });

    if (!existingClass) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    const schoolClass = await db.schoolClass.update({
      where: { id: classId },
      data: { name },
    });

    return NextResponse.json({ class: schoolClass });
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json(
      { error: 'Failed to update class' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a class
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; classId: string }> }
) {
  try {
    const { id: orgId, classId } = await params;
    const { searchParams } = new URL(req.url);

    // Verify class belongs to this org
    const existingClass = await db.schoolClass.findFirst({
      where: { id: classId, orgId },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (!existingClass) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if class has students
    if (existingClass._count.students > 0) {
      return NextResponse.json(
        { error: 'Cannot delete class with students. Please reassign students first.' },
        { status: 400 }
      );
    }

    await db.schoolClass.delete({
      where: { id: classId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json(
      { error: 'Failed to delete class' },
      { status: 500 }
    );
  }
}
