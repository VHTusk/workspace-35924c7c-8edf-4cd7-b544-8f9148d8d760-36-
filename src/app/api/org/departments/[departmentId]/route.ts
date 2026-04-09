import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";
import {
  departmentNameFromId,
  formatDepartmentEmployees,
  getDepartmentEmployees,
  listCorporateDepartments,
} from "@/lib/corporate-departments";

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
    const departmentName = departmentNameFromId(departmentId);

    const departments = await listCorporateDepartments(org.id, org.sport);
    const department = departments.find((entry) => entry.id === departmentId);

    if (!department || !departmentName) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const employees = await getDepartmentEmployees(org.id, org.sport, departmentName);

    return NextResponse.json({
      success: true,
      department: {
        ...department,
        manager: null,
      },
      employees: formatDepartmentEmployees(employees),
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
    const departmentName = departmentNameFromId(departmentId);

    const employees = await getDepartmentEmployees(org.id, org.sport, departmentName);
    if (!departmentName || employees.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await request.json();
    const nextName = typeof body?.name === "string" ? body.name.trim() : "";

    if (!nextName) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    if (nextName.toLowerCase() !== departmentName.toLowerCase()) {
      const existing = await getDepartmentEmployees(org.id, org.sport, nextName);
      if (existing.length > 0) {
        return NextResponse.json({ error: "Department with this name already exists" }, { status: 400 });
      }
    }

    await db.employee.updateMany({
      where: {
        orgId: org.id,
        sport: org.sport,
        isActive: true,
        department: {
          equals: departmentName,
          mode: "insensitive",
        },
      },
      data: {
        department: nextName,
      },
    });

    const departments = await listCorporateDepartments(org.id, org.sport);
    const updated = departments.find(
      (entry) => entry.name.toLowerCase() === nextName.toLowerCase(),
    );

    return NextResponse.json({
      success: true,
      department: updated ?? null,
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
    const departmentName = departmentNameFromId(departmentId);

    const employees = await getDepartmentEmployees(org.id, org.sport, departmentName);
    if (!departmentName || employees.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({
      error:
        "Cannot delete department while employees are assigned to it. Reassign or clear their department first.",
    }, { status: 400 });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
