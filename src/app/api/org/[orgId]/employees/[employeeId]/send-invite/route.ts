import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// POST: Send invite to employee for account linking
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
    if (employee.userId) {
      return NextResponse.json(
        { error: "Employee is already linked to a player account" },
        { status: 400 }
      );
    }

    // Generate invite token
    const inviteToken = uuidv4();
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate magic link URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const magicLink = `${baseUrl}/${employee.organization.sport.toLowerCase()}/register?employeeInvite=${inviteToken}&employeeId=${employee.id}&orgId=${orgId}&email=${encodeURIComponent(employee.email)}`;

    // Send email notification (using existing email service)
    try {
      const { EmailService } = await import("@/lib/email-service");
      const emailService = new EmailService() as {
        sendEmployeeInviteEmail?: (
          to: { email: string; name: string },
          data: {
            organizationName: string;
            employeeName: string;
            magicLink: string;
            expiresInDays: number;
          },
        ) => Promise<unknown>;
      };

      if (emailService.sendEmployeeInviteEmail) {
        await emailService.sendEmployeeInviteEmail(
          { email: employee.email, name: `${employee.firstName} ${employee.lastName}` },
          {
            organizationName: employee.organization.name,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            magicLink,
            expiresInDays: 7,
          }
        );
      }
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Don't fail the request if email fails - log for manual follow-up
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        linkStatus: "INVITED",
        inviteSentAt: new Date().toISOString(),
        inviteTokenExpires: inviteTokenExpires.toISOString(),
        sentBy: sentBy || null,
      },
      magicLink, // Return for testing/manual sharing
    });
  } catch (error) {
    console.error("Error sending employee invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
