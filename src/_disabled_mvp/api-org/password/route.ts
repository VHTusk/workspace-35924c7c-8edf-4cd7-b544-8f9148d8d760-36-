import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg, validatePassword, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
    }

    // If org has a password, verify current password
    if (org.password) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }

      const isValid = await verifyPassword(currentPassword, org.password);
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);

    await db.organization.update({
      where: { id: org.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating org password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
