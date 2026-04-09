import { NextRequest, NextResponse } from "next/server";
import { AdminRole, NotificationType, SportType } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { shouldEnforceIdentityLock } from "@/lib/identity-lock";

const ALLOWED_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "dob",
  "gender",
]);

function parseSport(rawSport: string | undefined): SportType | null {
  if (!rawSport) {
    return null;
  }

  const normalized = rawSport.toUpperCase();
  if (normalized === SportType.CORNHOLE || normalized === SportType.DARTS) {
    return normalized as SportType;
  }

  return null;
}

function getFieldLabel(field: string): string {
  switch (field) {
    case "firstName":
      return "first name";
    case "lastName":
      return "last name";
    case "email":
      return "email";
    case "phone":
      return "phone number";
    case "dob":
      return "date of birth";
    case "gender":
      return "gender";
    default:
      return "profile detail";
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = auth;
    const body = await request.json();
    const field = typeof body.field === "string" ? body.field : "";
    const oldValue = typeof body.oldValue === "string" ? body.oldValue : "";
    const newValue = typeof body.newValue === "string" ? body.newValue.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const sport = parseSport(typeof body.sport === "string" ? body.sport : user.sport);

    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: "Invalid field selection" }, { status: 400 });
    }

    if (!newValue) {
      return NextResponse.json({ error: "Please enter the new value you want to request" }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: "Please provide a reason for the change" }, { status: 400 });
    }

    if (newValue.length > 200) {
      return NextResponse.json({ error: "Requested value is too long" }, { status: 400 });
    }

    if (reason.length > 500) {
      return NextResponse.json({ error: "Reason must be 500 characters or less" }, { status: 400 });
    }

    if (!sport) {
      return NextResponse.json({ error: "Invalid sport context" }, { status: 400 });
    }

    const lockEnforced = user.identityLocked
      ? await shouldEnforceIdentityLock(db, user.id)
      : false;

    if (!lockEnforced) {
      return NextResponse.json(
        { error: "Your profile is still editable directly. Please update it from your profile page." },
        { status: 400 },
      );
    }

    const existingPendingRequest = await db.identityChangeRequest.findFirst({
      where: {
        userId: user.id,
        field,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPendingRequest) {
      return NextResponse.json(
        { error: "You already have a pending edit request for this field." },
        { status: 409 },
      );
    }

    const createdRequest = await db.identityChangeRequest.create({
      data: {
        userId: user.id,
        field,
        oldValue: oldValue || null,
        newValue,
        status: "PENDING",
      },
    });

    const managementRecipients = await db.adminAssignment.findMany({
      where: {
        isActive: true,
        OR: [
          { sport: null },
          { sport },
        ],
        adminRole: {
          in: [
            AdminRole.SUPER_ADMIN,
            AdminRole.SPORT_ADMIN,
            AdminRole.STATE_ADMIN,
            AdminRole.DISTRICT_ADMIN,
          ],
        },
      },
      select: {
        userId: true,
      },
    });

    const managementUserIds = [...new Set(managementRecipients.map((recipient) => recipient.userId))]
      .filter((recipientUserId) => recipientUserId !== user.id);

    if (managementUserIds.length > 0) {
      await db.notification.createMany({
        data: managementUserIds.map((recipientUserId) => ({
          userId: recipientUserId,
          sport,
          type: NotificationType.ESCALATION,
          title: "Profile edit request",
          message: `${user.firstName} ${user.lastName} requested a management edit for ${getFieldLabel(field)}. Reason: ${reason}`,
          link: `/${sport.toLowerCase()}/profile`,
        })),
      });
    }

    await db.notification.create({
      data: {
        userId: user.id,
        sport,
        type: NotificationType.MILESTONE,
        title: "Edit request submitted",
        message: `Your request to update your ${getFieldLabel(field)} has been sent to ValorHive management for review.`,
        link: `/${sport.toLowerCase()}/profile`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Your edit request has been sent to management.",
      request: {
        id: createdRequest.id,
        field: createdRequest.field,
        status: createdRequest.status,
        createdAt: createdRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating identity change request:", error);
    return NextResponse.json({ error: "Failed to submit edit request" }, { status: 500 });
  }
}
