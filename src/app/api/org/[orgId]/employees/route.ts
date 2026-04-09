import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma, SportType } from "@prisma/client";
import { departmentNameFromId } from "@/lib/corporate-departments";

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
      sport: sport as SportType,
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
      where.department = {
        equals: departmentNameFromId(departmentId),
        mode: "insensitive",
      };
    }

    if (status === "verified") {
      where.isVerified = true;
    } else if (status === "unverified") {
      where.isVerified = false;
    } else if (status === "active") {
      where.sportPlayers = {
        some: {
          orgId,
          sport: sport as SportType,
          matchesPlayed: { gt: 0 },
        },
      };
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
      department,
      designation,
      sport = "CORNHOLE",
    } = body;

    const departmentName =
      typeof department === "string" && department.trim()
        ? department.trim()
        : typeof departmentId === "string" && departmentId.trim()
          ? departmentNameFromId(departmentId)
          : null;

    // Check if employee already exists
    const existing = await db.employee.findUnique({
      where: {
        orgId_email_sport: {
          orgId,
          email: email.toLowerCase(),
          sport: sport as SportType,
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
        sport: sport as SportType,
        employeeId,
        email: email.toLowerCase(),
        firstName,
        lastName,
        phone,
        department: departmentName,
        designation,
        isVerified: false,
        isActive: true,
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
