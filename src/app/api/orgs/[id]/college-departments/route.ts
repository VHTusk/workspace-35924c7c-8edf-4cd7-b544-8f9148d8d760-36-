/**
 * College Departments API
 * GET: List all departments for a college
 * POST: Create a new department
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - List all departments for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true, name: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json(
        { error: 'Not a college organization' },
        { status: 400 }
      );
    }

    // Get all departments with their batches and student counts
    const departments = await db.collegeDepartment.findMany({
      where: {
        orgId,
        sport,
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
      orderBy: { name: 'asc' },
    });

    const formattedDepartments = departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      totalStudents: dept._count.students,
      batches: dept.batches.map((b) => ({
        id: b.id,
        name: b.name,
        startYear: b.startYear,
        endYear: b.endYear,
        totalStudents: b.totalStudents,
      })),
      createdAt: dept.createdAt.toISOString(),
    }));

    // Get stats
    const stats = {
      totalDepartments: departments.length,
      totalBatches: departments.reduce((sum, d) => sum + d.batches.length, 0),
      totalStudents: departments.reduce((sum, d) => sum + d._count.students, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        departments: formattedDepartments,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST - Create a new department
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const { name, code, description, sport = 'CORNHOLE' } = body;

    // Validate session
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || session.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Department name and code are required' },
        { status: 400 }
      );
    }

    // Verify this is a college
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { type: true },
    });

    if (!org || org.type !== 'COLLEGE') {
      return NextResponse.json(
        { error: 'Not a college organization' },
        { status: 400 }
      );
    }

    // Check if department with same name or code already exists
    const existing = await db.collegeDepartment.findFirst({
      where: {
        orgId,
        sport: sport as 'CORNHOLE' | 'DARTS',
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { code: { equals: code, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Department with this name or code already exists' },
        { status: 400 }
      );
    }

    // Create department
    const department = await db.collegeDepartment.create({
      data: {
        orgId,
        sport: sport as 'CORNHOLE' | 'DARTS',
        name,
        code: code.toUpperCase(),
      },
    });

    return NextResponse.json({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        totalStudents: 0,
        batches: [],
        createdAt: department.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
