import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

// POST: Send invites to all PENDING employees
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));
    const { sentBy, employeeIds } = body; // Optional: specific employee IDs to invite

    // Get employees to invite
    const whereClause: Prisma.EmployeeWhereInput = {
      orgId,
      isActive: true,
      linkStatus: "PENDING" as Prisma.EmployeeLinkStatus,
    };

    // If specific employee IDs provided, filter to those
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const employees = await db.employee.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { name: true, sport: true },
        },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({
        success: true,
        invitesSent: 0,
        message: "No pending employees to invite",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let invitesSent = 0;
    let invitesFailed = 0;

    // Process each employee
    for (const employee of employees) {
      try {
        // Generate invite token
        const inviteToken = uuidv4();
        const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Update employee
        await db.employee.update({
          where: { id: employee.id },
          data: {
            inviteToken,
            inviteTokenExpires,
            inviteSentAt: new Date(),
            inviteSentBy: sentBy || null,
            linkStatus: "INVITED" as Prisma.EmployeeLinkStatus,
          },
        });

        // Generate magic link
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
          console.error(`Failed to send invite email to ${employee.email}:`, emailError);
          // Don't count as failed - token is saved, they can manually share
        }

        invitesSent++;
      } catch (error) {
        console.error(`Failed to process employee ${employee.id}:`, error);
        invitesFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      invitesSent,
      invitesFailed,
      totalPending: employees.length,
    });
  } catch (error) {
    console.error("Error bulk sending invites:", error);
    return NextResponse.json(
      { error: "Failed to send bulk invites" },
      { status: 500 }
    );
  }
}
