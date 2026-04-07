import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";

// GET: Get single department with employees
export async function GET(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
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

    const org = session.org;
    const { departmentId } = await params;

    // Fetch department
    const department = await db.corporateDepartment.findFirst({
      where: {
        id: departmentId,
        orgId: org.id,
        isActive: true,
      },
      include: {
        employees: {
          where: { isActive: true },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            isVerified: true,
            userId: true,
            tournamentsPlayed: true,
            totalPoints: true,
            wins: true,
            losses: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                visiblePoints: true,
                hiddenElo: true,
              },
            },
          },
          orderBy: { firstName: "asc" },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Get manager info if set
    let manager = null;
    if (department.managerId) {
      const managerEmployee = await db.employee.findUnique({
        where: { id: department.managerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          designation: true,
        },
      });
      if (managerEmployee) {
        manager = managerEmployee;
      }
    }

    // Calculate stats
    const activePlayers = department.employees.filter(
      (e) => e.isVerified && e.userId
    ).length;

    const totalPoints = department.employees.reduce(
      (sum, e) => sum + e.totalPoints,
      0
    );

    const totalWins = department.employees.reduce(
      (sum, e) => sum + e.wins,
      0
    );

    const totalLosses = department.employees.reduce(
      (sum, e) => sum + e.losses,
      0
    );

    return NextResponse.json({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        autoLeagueEnabled: department.autoLeagueEnabled,
        leaguePointSystem: department.leaguePointSystem,
        totalEmployees: department.employees.length,
        activePlayers,
        tournamentParticipations: department.tournamentParticipations,
        totalPoints,
        createdAt: department.createdAt.toISOString(),
        manager,
        managerId: department.managerId,
        stats: {
          totalWins,
          totalLosses,
          winRate: totalWins + totalLosses > 0
            ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
            : 0,
        },
      },
      employees: department.employees.map((emp) => ({
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        designation: emp.designation,
        isVerified: emp.isVerified,
        hasAccount: !!emp.userId,
        tournamentsPlayed: emp.tournamentsPlayed,
        totalPoints: emp.totalPoints,
        wins: emp.wins,
        losses: emp.losses,
        joinedAt: emp.joinedAt.toISOString(),
        user: emp.user,
        fullName: `${emp.firstName} ${emp.lastName}`,
      })),
    });
  } catch (error) {
    console.error("Error fetching department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update department
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
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

    const org = session.org;
    const { departmentId } = await params;

    // Verify department belongs to this org
    const department = await db.corporateDepartment.findFirst({
      where: {
        id: departmentId,
        orgId: org.id,
        isActive: true,
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, description, managerId, autoLeagueEnabled, leaguePointSystem } = body;

    // Check for duplicate name if name is being changed
    if (name && name !== department.name) {
      const existing = await db.corporateDepartment.findFirst({
        where: {
          orgId: org.id,
          sport: department.sport,
          name: { equals: name, mode: "insensitive" },
          isActive: true,
          id: { not: departmentId },
        },
      });

      if (existing) {
        return NextResponse.json({ error: "Department with this name already exists" }, { status: 400 });
      }
    }

    // Validate managerId if provided
    if (managerId) {
      const managerEmployee = await db.employee.findFirst({
        where: {
          id: managerId,
          departmentId,
          isActive: true,
        },
      });

      if (!managerEmployee) {
        return NextResponse.json({ error: "Manager must be an employee of this department" }, { status: 400 });
      }
    }

    // Update the department
    const updated = await db.corporateDepartment.update({
      where: { id: departmentId },
      data: {
        name: name || department.name,
        code: code !== undefined ? code?.toUpperCase() : department.code,
        description: description !== undefined ? description : department.description,
        managerId: managerId !== undefined ? managerId : department.managerId,
        autoLeagueEnabled: autoLeagueEnabled !== undefined ? autoLeagueEnabled : department.autoLeagueEnabled,
        leaguePointSystem: leaguePointSystem !== undefined ? leaguePointSystem : department.leaguePointSystem,
      },
    });

    return NextResponse.json({
      success: true,
      department: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        description: updated.description,
        managerId: updated.managerId,
        autoLeagueEnabled: updated.autoLeagueEnabled,
        leaguePointSystem: updated.leaguePointSystem,
      },
    });
  } catch (error) {
    console.error("Error updating department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Soft delete department (set isActive = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
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

    const org = session.org;
    const { departmentId } = await params;

    // Verify department belongs to this org
    const department = await db.corporateDepartment.findFirst({
      where: {
        id: departmentId,
        orgId: org.id,
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
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Check if department has employees
    if (department._count.employees > 0) {
      return NextResponse.json({
        error: "Cannot delete department with employees. Please reassign or remove employees first.",
      }, { status: 400 });
    }

    // Soft delete the department
    await db.corporateDepartment.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
