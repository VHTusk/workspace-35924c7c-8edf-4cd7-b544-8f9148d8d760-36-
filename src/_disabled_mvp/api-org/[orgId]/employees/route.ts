import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get("sport") || "CORNHOLE";
    const search = searchParams.get("search");
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");

    const where: Prisma.EmployeeWhereInput = {
      orgId,
      sport: sport as Prisma.SportType,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (departmentId && departmentId !== "all") {
      where.departmentId = departmentId;
    }

    if (status === "verified") {
      where.isVerified = true;
    } else if (status === "unverified") {
      where.isVerified = false;
    } else if (status === "active") {
      where.tournamentsPlayed = { gt: 0 };
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        user: {
          select: { id: true },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const {
      employeeId,
      email,
      firstName,
      lastName,
      phone,
      departmentId,
      designation,
      sport = "CORNHOLE",
    } = body;

    // Check if employee already exists
    const existing = await db.employee.findUnique({
      where: {
        orgId_email_sport: {
          orgId,
          email: email.toLowerCase(),
          sport: sport as Prisma.SportType,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Employee with this email already exists" },
        { status: 400 }
      );
    }

    const employee = await db.employee.create({
      data: {
        orgId,
        sport: sport as Prisma.SportType,
        employeeId,
        email: email.toLowerCase(),
        firstName,
        lastName,
        phone,
        departmentId,
        designation,
        isVerified: false,
        isActive: true,
      },
    });

    // Update department stats if assigned
    if (departmentId) {
      await db.corporateDepartment.update({
        where: { id: departmentId },
        data: { totalEmployees: { increment: 1 } },
      });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
