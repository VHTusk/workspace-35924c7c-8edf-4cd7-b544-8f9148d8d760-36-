import { NextRequest, NextResponse } from "next/server";
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
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; departmentId: string }> }
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

    const { orgId, departmentId } = await params;
    const departmentName = departmentNameFromId(departmentId);

    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const departments = await listCorporateDepartments(orgId, session.org.sport);
    const department = departments.find((entry) => entry.id === departmentId);

    if (!department || !departmentName) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const employees = await getDepartmentEmployees(
      orgId,
      session.org.sport,
      departmentName,
    );

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

// PATCH: Rename department by updating employee department labels
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; departmentId: string }> }
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

    const { orgId, departmentId } = await params;
    const departmentName = departmentNameFromId(departmentId);

    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const employees = await getDepartmentEmployees(
      orgId,
      session.org.sport,
      departmentName,
    );

    if (!departmentName || employees.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await request.json();
    const nextName = typeof body?.name === "string" ? body.name.trim() : "";

    if (!nextName) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    if (nextName.toLowerCase() !== departmentName.toLowerCase()) {
      const existing = await getDepartmentEmployees(orgId, session.org.sport, nextName);
      if (existing.length > 0) {
        return NextResponse.json({ error: "Department with this name already exists" }, { status: 400 });
      }
    }

    await db.employee.updateMany({
      where: {
        orgId,
        sport: session.org.sport,
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

    const departments = await listCorporateDepartments(orgId, session.org.sport);
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

// DELETE: departments are derived from employee department names
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; departmentId: string }> }
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

    const { orgId, departmentId } = await params;
    const departmentName = departmentNameFromId(departmentId);

    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const employees = await getDepartmentEmployees(
      orgId,
      session.org.sport,
      departmentName,
    );

    if (employees.length > 0) {
      return NextResponse.json({
        error:
          "Cannot delete department while employees are assigned to it. Reassign or clear their department first.",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

