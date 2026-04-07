/**
 * Single College Department API
 * GET: Get a single department
 * PUT: Update a department
 * DELETE: Delete/deactivate a department
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - Get a single department
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; departmentId: string }> }
) {
  try {
    const { id: orgId, departmentId } = await params;

    const department = await db.collegeDepartment.findFirst({
      where: {
        id: departmentId,
        orgId,
        isActive: true,
      },
      include: {
        batches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true,
            totalStudents: true,
          },
          orderBy: { startYear: 'desc' },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        totalStudents: department._count.students,
        batches: department.batches,
        createdAt: department.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PUT - Update a department
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; departmentId: string }> }
) {
  try {
    const { id: orgId, departmentId } = await params;
    const body = await req.json();
    const { name, code, description } = body;

    // Validate session
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || session.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if department exists
    const existing = await db.collegeDepartment.findFirst({
      where: { id: departmentId, orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name/code (excluding current department)
    if (name || code) {
      const duplicate = await db.collegeDepartment.findFirst({
        where: {
          orgId,
          id: { not: departmentId },
          OR: [
            ...(name ? [{ name: { equals: name, mode: 'insensitive' as const } }] : []),
            ...(code ? [{ code: { equals: code, mode: 'insensitive' as const } }] : []),
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Department with this name or code already exists' },
          { status: 400 }
        );
      }
    }

    // Update department
    const department = await db.collegeDepartment.update({
      where: { id: departmentId },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
      },
    });

    return NextResponse.json({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        createdAt: department.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a department
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; departmentId: string }> }
) {
  try {
    const { id: orgId, departmentId } = await params;

    // Validate session
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || session.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if department has students
    const studentsCount = await db.student.count({
      where: { departmentId },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with students. Move students first.' },
        { status: 400 }
      );
    }

    // Soft delete (set isActive to false)
    await db.collegeDepartment.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Department deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}
