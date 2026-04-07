// API: School House CRUD Operations (Single House)
// PUT/DELETE /api/orgs/[id]/school-houses/[houseId]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT - Update a house
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; houseId: string }> }
) {
  try {
    const { id: orgId, houseId } = await params;
    const body = await req.json();
    const { name, color, motto } = body;

    // Verify house belongs to this org
    const existingHouse = await db.schoolHouse.findFirst({
      where: { id: houseId, orgId }
    });

    if (!existingHouse) {
      return NextResponse.json(
        { error: 'House not found' },
        { status: 404 }
      );
    }

    const house = await db.schoolHouse.update({
      where: { id: houseId },
      data: { 
        ...(name && { name }),
        ...(color && { color }),
        ...(motto !== undefined && { motto }),
      },
    });

    return NextResponse.json({ house });
  } catch (error) {
    console.error('Error updating house:', error);
    return NextResponse.json(
      { error: 'Failed to update house' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a house
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; houseId: string }> }
) {
  try {
    const { id: orgId, houseId } = await params;

    // Verify house belongs to this org
    const existingHouse = await db.schoolHouse.findFirst({
      where: { id: houseId, orgId },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (!existingHouse) {
      return NextResponse.json(
        { error: 'House not found' },
        { status: 404 }
      );
    }

    // Check if house has students
    if (existingHouse._count.students > 0) {
      return NextResponse.json(
        { error: 'Cannot delete house with students. Please reassign students first.' },
        { status: 400 }
      );
    }

    await db.schoolHouse.delete({
      where: { id: houseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting house:', error);
    return NextResponse.json(
      { error: 'Failed to delete house' },
      { status: 500 }
    );
  }
}
