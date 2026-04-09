// API: Students CRUD Operations
// GET/POST /api/orgs/[id]/students

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all students for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' || 'CORNHOLE';
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const houseId = searchParams.get('houseId') || '';
    const status = searchParams.get('status') || '';

    const where: any = {
      orgId,
      sport,
      studentType: 'SCHOOL_STUDENT',
    };

    if (classId) {
      where.classId = classId;
    }

    if (houseId) {
      where.houseId = houseId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { enrollmentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const students = await db.student.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
      include: {
        schoolClass: {
          select: { id: true, name: true }
        },
        schoolSection: {
          select: { id: true, name: true }
        },
        schoolHouse: {
          select: { id: true, name: true, color: true }
        },
      }
    });

    const formattedStudents = students.map((s) => ({
      id: s.id,
      userId: s.userId,
      enrollmentId: s.enrollmentId,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      dob: s.dob?.toISOString(),
      gender: s.gender,
      classId: s.classId,
      className: s.schoolClass?.name,
      sectionId: s.sectionId,
      sectionName: s.schoolSection?.name,
      houseId: s.houseId,
      houseName: s.schoolHouse?.name,
      houseColor: s.schoolHouse?.color,
      isVerified: s.isVerified,
      status: s.status,
      joinedAt: s.joinedAt.toISOString(),
      tournamentsPlayed: s.tournamentsPlayed,
      matchesWon: s.matchesWon,
      matchesLost: s.matchesLost,
      totalPoints: s.totalPoints,
    }));

    return NextResponse.json({ students: formattedStudents });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

// POST - Create a new student
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
      phone, 
      enrollmentId,
      classId,
      sectionId,
      houseId,
      dob,
      gender,
      studentType = 'SCHOOL_STUDENT',
      sport = 'CORNHOLE'
    } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Check if student already exists with this email
    const existing = await db.student.findFirst({
      where: { orgId, email, sport }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Student with this email already exists' },
        { status: 400 }
      );
    }

    const student = await db.student.create({
      data: {
        orgId,
        email,
        firstName,
        lastName,
        phone,
        enrollmentId,
        classId,
        sectionId,
        houseId,
        dob: dob ? new Date(dob) : undefined,
        gender,
        studentType,
        sport,
      },
    });

    return NextResponse.json({ student });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    );
  }
}
