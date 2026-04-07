import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

// GET: Validate token and show linking page data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find employee by invite token
    const employee = await db.employee.findFirst({
      where: {
        inviteToken: token,
        linkStatus: "INVITED" as Prisma.EmployeeLinkStatus,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            sport: true,
          },
        },
        departmentRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check if token expired
    if (employee.inviteTokenExpires && new Date() > employee.inviteTokenExpires) {
      // Update status to expired
      await db.employee.update({
        where: { id: employee.id },
        data: { linkStatus: "EXPIRED" as Prisma.EmployeeLinkStatus },
      });

      return NextResponse.json(
        { error: "Invite link has expired. Please request a new invite from your organization." },
        { status: 410 }
      );
    }

    // Check if already linked
    if (employee.linkStatus === "LINKED") {
      return NextResponse.json(
        { error: "This invite has already been used." },
        { status: 400 }
      );
    }

    // Check if user exists with matching email
    const existingUser = await db.user.findFirst({
      where: {
        email: employee.email.toLowerCase(),
        sport: employee.sport,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        hiddenElo: true,
        visiblePoints: true,
      },
    });

    return NextResponse.json({
      valid: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        designation: employee.designation,
        department: employee.departmentRef?.name || employee.department,
      },
      organization: {
        id: employee.organization.id,
        name: employee.organization.name,
        type: employee.organization.type,
      },
      sport: employee.sport,
      existingUser: existingUser ? {
        id: existingUser.id,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        hasStats: (existingUser.visiblePoints || 0) > 0,
      } : null,
    });
  } catch (error) {
    console.error("Error validating invite token:", error);
    return NextResponse.json(
      { error: "Failed to validate invite" },
      { status: 500 }
    );
  }
}

// POST: Process the linking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { action, userId, userData } = body;
    // action: "link_existing" | "create_new"
    // userId: existing user ID (for link_existing)
    // userData: { firstName, lastName, password, phone } (for create_new)

    // Find employee by invite token
    const employee = await db.employee.findFirst({
      where: {
        inviteToken: token,
        linkStatus: "INVITED" as Prisma.EmployeeLinkStatus,
      },
      include: {
        organization: {
          select: { id: true, name: true, sport: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check if token expired
    if (employee.inviteTokenExpires && new Date() > employee.inviteTokenExpires) {
      await db.employee.update({
        where: { id: employee.id },
        data: { linkStatus: "EXPIRED" as Prisma.EmployeeLinkStatus },
      });

      return NextResponse.json(
        { error: "Invite link has expired" },
        { status: 410 }
      );
    }

    let linkedUserId: string;

    if (action === "link_existing" && userId) {
      // Link existing user
      const existingUser = await db.user.findFirst({
        where: {
          id: userId,
          email: employee.email.toLowerCase(),
          sport: employee.sport,
        },
      });

      if (!existingUser) {
        return NextResponse.json(
          { error: "User not found or email mismatch" },
          { status: 404 }
        );
      }

      linkedUserId = existingUser.id;
    } else if (action === "create_new" && userData) {
      // Create new user account
      const hashedPassword = await hash(userData.password, 10);

      const newUser = await db.user.create({
        data: {
          sport: employee.sport,
          role: "PLAYER" as Prisma.Role,
          accountTier: "FAN" as Prisma.AccountTier,
          email: employee.email.toLowerCase(),
          password: hashedPassword,
          phone: userData.phone || employee.phone,
          firstName: userData.firstName || employee.firstName,
          lastName: userData.lastName || employee.lastName,
          verified: true,
          verifiedAt: new Date(),
        },
      });

      linkedUserId = newUser.id;
    } else {
      return NextResponse.json(
        { error: "Invalid action or missing data" },
        { status: 400 }
      );
    }

    // Update employee with link
    const updatedEmployee = await db.employee.update({
      where: { id: employee.id },
      data: {
        userId: linkedUserId,
        linkStatus: "LINKED" as Prisma.EmployeeLinkStatus,
        linkedAt: new Date(),
        linkedById: linkedUserId,
        inviteToken: null,
        inviteTokenExpires: null,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Update department stats if applicable
    if (employee.departmentId) {
      await db.corporateDepartment.update({
        where: { id: employee.departmentId },
        data: { activePlayers: { increment: 1 } },
      });
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: updatedEmployee.id,
        linkStatus: updatedEmployee.linkStatus,
        linkedAt: updatedEmployee.linkedAt,
      },
      userId: linkedUserId,
      redirectUrl: `/${employee.sport.toLowerCase()}/dashboard`,
    });
  } catch (error) {
    console.error("Error processing link:", error);
    return NextResponse.json(
      { error: "Failed to process linking" },
      { status: 500 }
    );
  }
}
