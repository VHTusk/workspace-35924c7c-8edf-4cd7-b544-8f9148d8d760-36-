import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import { SportType } from "@prisma/client";

// GET: List all departments for an organization with employee counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
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

    const { orgId } = await params;

    // Validate user has access to this org
    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only CORPORATE organizations have departments
    if (session.org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Only corporate organizations have departments" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get("sport") as SportType | null;

    if (!sport || !["CORNHOLE", "DARTS"].includes(sport)) {
      return NextResponse.json({ error: "Valid sport parameter required" }, { status: 400 });
    }

    // Fetch departments with employee counts
    const departments = await db.corporateDepartment.findMany({
      where: {
        orgId,
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

    // Get active player counts per department
    const departmentsWithStats = await Promise.all(
      departments.map(async (dept) => {
        // Count active players (employees with User accounts who are verified)
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

    // Calculate summary stats
    const summary = {
      totalDepartments: departmentsWithStats.length,
      totalEmployees: departmentsWithStats.reduce((sum, d) => sum + d.totalEmployees, 0),
      totalActivePlayers: departmentsWithStats.reduce((sum, d) => sum + d.activePlayers, 0),
      totalPoints: departmentsWithStats.reduce((sum, d) => sum + d.totalPoints, 0),
    };

    return NextResponse.json({
      success: true,
      departments: departmentsWithStats,
      summary,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new department
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
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

    const { orgId } = await params;

    // Validate user has access to this org
    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only CORPORATE organizations have departments
    if (session.org.type !== "CORPORATE") {
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
        orgId,
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
        orgId,
        sport: sport as SportType,
        name,
        code: code?.toUpperCase() || null,
        description: description || null,
      },
    });

    // Update organization's hasDepartments flag
    await db.organization.update({
      where: { id: orgId },
      data: { hasDepartments: true },
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
