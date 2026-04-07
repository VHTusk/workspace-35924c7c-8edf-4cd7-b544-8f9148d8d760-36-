import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

interface EmployeeRow {
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  designation?: string;
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; email: string; error: string }>;
  warnings: Array<{ row: number; email: string; warning: string }>;
  createdEmployees: Array<{ id: string; email: string; firstName: string; lastName: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { employees, sport = "CORNHOLE", sendInvites = false } = body as {
      employees: EmployeeRow[];
      sport?: "CORNHOLE" | "DARTS";
      sendInvites?: boolean;
    };

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: "No employees provided" },
        { status: 400 }
      );
    }

    // Get organization
    const org = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get all departments for mapping
    const departments = await db.corporateDepartment.findMany({
      where: { orgId, sport: sport as Prisma.SportType, isActive: true },
    });

    const departmentMap = new Map<string, string>();
    departments.forEach((dept) => {
      departmentMap.set(dept.name.toLowerCase(), dept.id);
      if (dept.code) {
        departmentMap.set(dept.code.toLowerCase(), dept.id);
      }
    });

    const result: ImportResult = {
      total: employees.length,
      created: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      createdEmployees: [],
    };

    // Get existing employees to check for duplicates
    const existingEmails = await db.employee.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
        email: { in: employees.map((e) => e.email.toLowerCase()) },
      },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingEmails.map((e) => e.email.toLowerCase()));

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const rowNum = i + 2; // +2 because row 1 is header

      // Validate required fields
      if (!emp.email) {
        result.errors.push({ row: rowNum, email: "", error: "Email is required" });
        continue;
      }

      if (!emp.firstName) {
        result.errors.push({ row: rowNum, email: emp.email, error: "First name is required" });
        continue;
      }

      if (!emp.lastName) {
        result.errors.push({ row: rowNum, email: emp.email, error: "Last name is required" });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emp.email)) {
        result.errors.push({ row: rowNum, email: emp.email, error: "Invalid email format" });
        continue;
      }

      // Check for duplicate in import batch
      const duplicateInBatch = employees.slice(0, i).find(
        (e) => e.email.toLowerCase() === emp.email.toLowerCase()
      );
      if (duplicateInBatch) {
        result.warnings.push({
          row: rowNum,
          email: emp.email,
          warning: "Duplicate email in import batch (skipped)",
        });
        result.skipped++;
        continue;
      }

      // Check for existing employee
      if (existingEmailSet.has(emp.email.toLowerCase())) {
        result.warnings.push({
          row: rowNum,
          email: emp.email,
          warning: "Employee already exists",
        });
        result.skipped++;
        continue;
      }

      // Map department
      let departmentId: string | null = null;
      if (emp.department) {
        departmentId = departmentMap.get(emp.department.toLowerCase()) || null;
        if (!departmentId) {
          result.warnings.push({
            row: rowNum,
            email: emp.email,
            warning: `Department "${emp.department}" not found`,
          });
        }
      }

      try {
        // Create employee
        const newEmployee = await db.employee.create({
          data: {
            orgId,
            sport: sport as Prisma.SportType,
            employeeId: emp.employeeId || null,
            email: emp.email.toLowerCase(),
            firstName: emp.firstName,
            lastName: emp.lastName,
            phone: emp.phone || null,
            departmentId,
            department: emp.department || null,
            designation: emp.designation || null,
            isVerified: false,
            isActive: true,
          },
        });

        result.created++;
        result.createdEmployees.push({
          id: newEmployee.id,
          email: newEmployee.email,
          firstName: newEmployee.firstName,
          lastName: newEmployee.lastName,
        });

        // Update department stats
        if (departmentId) {
          await db.corporateDepartment.update({
            where: { id: departmentId },
            data: { totalEmployees: { increment: 1 } },
          });
        }
      } catch (err) {
        result.errors.push({
          row: rowNum,
          email: emp.email,
          error: err instanceof Error ? err.message : "Failed to create employee",
        });
      }
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
