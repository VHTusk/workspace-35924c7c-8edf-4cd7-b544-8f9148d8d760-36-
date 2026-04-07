import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// POST: Unlink employee from player account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; employeeId: string }> }
) {
  try {
    const { orgId, employeeId } = await params;
    const body = await request.json().catch(() => ({}));
    const { unlinkedBy, reason } = body; // OrgAdmin userId and optional reason

    // Get the employee
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        orgId,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Check if actually linked
    if (employee.linkStatus !== "LINKED" || !employee.userId) {
      return NextResponse.json(
        { error: "Employee is not currently linked to a player account" },
        { status: 400 }
      );
    }

    // Update employee - unlink from player account
    const updatedEmployee = await db.employee.update({
      where: { id: employeeId },
      data: {
        userId: null,
        linkStatus: "UNLINKED" as Prisma.EmployeeLinkStatus,
        linkedAt: null,
        linkedById: null,
      },
    });

    // Update department stats if applicable
    if (employee.departmentId) {
      await db.corporateDepartment.update({
        where: { id: employee.departmentId },
        data: { activePlayers: { decrement: 1 } },
      });
    }

    // Create audit log
    try {
      const actorId = unlinkedBy || "system";
      await db.auditLog.create({
        data: {
          sport: employee.sport,
          action: "ADMIN_OVERRIDE" as Prisma.AuditAction,
          actorId,
          actorRole: "ORG_ADMIN" as Prisma.Role,
          targetType: "Employee",
          targetId: employeeId,
          reason: reason || "Employee unlinked from player account",
          metadata: JSON.stringify({
            previousUserId: employee.userId,
            organizationId: orgId,
          }),
        },
      });
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: updatedEmployee.id,
        linkStatus: updatedEmployee.linkStatus,
        userId: updatedEmployee.userId,
      },
    });
  } catch (error) {
    console.error("Error unlinking employee:", error);
    return NextResponse.json(
      { error: "Failed to unlink employee" },
      { status: 500 }
    );
  }
}
