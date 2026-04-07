import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

// POST: Resend invite with new token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; employeeId: string }> }
) {
  try {
    const { orgId, employeeId } = await params;
    const body = await request.json().catch(() => ({}));
    const { sentBy } = body; // OrgAdmin userId

    // Get the employee
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        orgId,
      },
      include: {
        organization: {
          select: { name: true, sport: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Check if already linked
    if (employee.linkStatus === "LINKED") {
      return NextResponse.json(
        { error: "Employee is already linked to a player account" },
        { status: 400 }
      );
    }

    // Generate new invite token
    const inviteToken = uuidv4();
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update employee with new invite token
    const updatedEmployee = await db.employee.update({
      where: { id: employeeId },
      data: {
        inviteToken,
        inviteTokenExpires,
        inviteSentAt: new Date(),
        inviteSentBy: sentBy || null,
        linkStatus: "INVITED" as Prisma.EmployeeLinkStatus,
      },
    });

    // Generate magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/employee/link/${inviteToken}`;

    // Send email notification
    try {
      const { EmailService } = await import("@/lib/email-service");
      const emailService = new EmailService();

      await emailService.sendEmployeeInviteEmail(
        { email: employee.email, name: `${employee.firstName} ${employee.lastName}` },
        {
          organizationName: employee.organization.name,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          magicLink,
          expiresInDays: 7,
        }
      );
    } catch (emailError) {
      console.error("Failed to resend invite email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: updatedEmployee.id,
        linkStatus: updatedEmployee.linkStatus,
        inviteSentAt: updatedEmployee.inviteSentAt,
        inviteTokenExpires: updatedEmployee.inviteTokenExpires,
      },
      magicLink,
    });
  } catch (error) {
    console.error("Error resending employee invite:", error);
    return NextResponse.json(
      { error: "Failed to resend invite" },
      { status: 500 }
    );
  }
}
