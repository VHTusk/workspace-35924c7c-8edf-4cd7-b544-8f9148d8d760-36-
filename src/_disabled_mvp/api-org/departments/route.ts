import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import { SportType } from "@prisma/client";

// GET: List all departments for an organization
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const org = session.org;

    // Only CORPORATE organizations have departments
    if (org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Only corporate organizations have departments" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") as SportType | null;

    if (!sport || !["CORNHOLE", "DARTS"].includes(sport)) {
      return NextResponse.json({ error: "Valid sport parameter required" }, { status: 400 });
    }

    // Fetch departments with employee counts
    const departments = await db.corporateDepartment.findMany({
      where: {
        orgId: org.id,
        sport,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            employees: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Get employee counts per department with active player status
    const departmentsWithStats = await Promise.all(
      departments.map(async (dept) => {
        // Count active players (employees with User accounts who have played tournaments)
        const activePlayers = await db.employee.count({
          where: {
            departmentId: dept.id,
            isActive: true,
            isVerified: true,
            userId: { not: null },
          },
        });

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          managerId: dept.managerId,
          totalEmployees: dept._count.employees,
          activePlayers,
          tournamentParticipations: dept.tournamentParticipations,
          totalPoints: dept.totalPoints,
          autoLeagueEnabled: dept.autoLeagueEnabled,
          leaguePointSystem: dept.leaguePointSystem,
          createdAt: dept.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      departments: departmentsWithStats,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new department
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const org = session.org;

    // Only CORPORATE organizations have departments
    if (org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Only corporate organizations have departments" }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, sport } = body;

    if (!name || !sport) {
      return NextResponse.json({ error: "Department name and sport are required" }, { status: 400 });
    }

    if (!["CORNHOLE", "DARTS"].includes(sport)) {
      return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
    }

    // Check if department with same name already exists for this org and sport
    const existing = await db.corporateDepartment.findFirst({
      where: {
        orgId: org.id,
        sport: sport as SportType,
        name: { equals: name, mode: "insensitive" },
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Department with this name already exists" }, { status: 400 });
    }

    // Create the department
    const department = await db.corporateDepartment.create({
      data: {
        orgId: org.id,
        sport: sport as SportType,
        name,
        code: code?.toUpperCase() || null,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        totalEmployees: 0,
        activePlayers: 0,
        tournamentParticipations: 0,
        totalPoints: 0,
        autoLeagueEnabled: department.autoLeagueEnabled,
        leaguePointSystem: department.leaguePointSystem,
        createdAt: department.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
