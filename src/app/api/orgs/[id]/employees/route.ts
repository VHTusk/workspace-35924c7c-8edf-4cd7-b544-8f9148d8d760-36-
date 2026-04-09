// API: Employee Management
// GET /api/orgs/[id]/employees - List employees
// POST /api/orgs/[id]/employees - Add employee

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List employees
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const department = searchParams.get('department');

    const where: {
      orgId: string;
      sport: 'CORNHOLE' | 'DARTS';
      isActive: boolean;
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' };
        lastName?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        employeeId?: { contains: string; mode: 'insensitive' };
      }>;
      department?: string;
    } = {
      orgId,
      sport,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (department) {
      where.department = department;
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              hiddenElo: true,
              visiblePoints: true,
            },
          },
          _count: {
            select: {
              tournamentParticipations: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { joinedAt: 'desc' },
      }),
      db.employee.count({ where }),
    ]);

    // Get unique departments
    const departments = await db.employee.findMany({
      where: { orgId, sport, isActive: true, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
    });

    return NextResponse.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        departments: departments.map(d => d.department).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST - Add employee
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const body = await req.json();
    const {
      email,
      firstName,
      lastName,
      sport,
      phone,
      department,
      designation,
      employeeId,
      userId,
    } = body;

    // Check if employee already exists
    const existing = await db.employee.findFirst({
      where: {
        orgId,
        email,
        sport,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Employee with this email already exists for this sport' },
        { status: 400 }
      );
    }

    const employee = await db.employee.create({
      data: {
        orgId,
        email,
        firstName,
        lastName,
        sport,
        phone,
        department,
        designation,
        employeeId,
        userId,
        isActive: true,
        isVerified: false,
      },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
