import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    if (!employee.userId) {
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
      },
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: updatedEmployee.id,
        linkStatus: updatedEmployee.userId ? "LINKED" : "UNLINKED",
        userId: updatedEmployee.userId,
        unlinkedBy: unlinkedBy || null,
        reason: reason || null,
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
