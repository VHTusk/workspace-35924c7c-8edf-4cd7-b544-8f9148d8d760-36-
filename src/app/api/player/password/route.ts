import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, getAuthenticatedUser } from "@/lib/auth";
import { logPasswordChangeEvent } from "@/lib/audit-logger";
import { log } from "@/lib/logger";

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    // Get full user with password
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Verify current password
    if (!fullUser.password) {
      return NextResponse.json({ error: "Account uses Google OAuth. Password cannot be changed." }, { status: 400 });
    }

    const isValid = await verifyPassword(currentPassword, fullUser.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Log password change event
    logPasswordChangeEvent(user.id, user.sport, request, {
      role: fullUser.role,
    }).catch(err => log.error('Failed to log password change event', { error: err }));

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
