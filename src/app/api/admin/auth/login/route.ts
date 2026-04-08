import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { getMfaStatus, isMfaRequiredForRole, verifyMfaLogin } from "@/lib/mfa";
import { withRateLimit } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

async function adminLoginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      mfaCode?: string;
    };

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const mfaCode = typeof body.mfaCode === "string" ? body.mfaCode.trim() : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const adminUser = await db.user.findFirst({
      where: {
        email,
        role: { in: [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR] },
      },
    });

    if (!adminUser) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (!adminUser.isActive) {
      return NextResponse.json({ error: "Account is deactivated. Contact super admin." }, { status: 403 });
    }

    if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
      return NextResponse.json({ error: "Account is temporarily locked. Please try again later." }, { status: 423 });
    }

    if (!adminUser.password) {
      return NextResponse.json({ error: "Password not set. Please reset your password." }, { status: 400 });
    }

    const isValid = await verifyPassword(password, adminUser.password);
    if (!isValid) {
      const attempts = adminUser.failedLoginAttempts + 1;
      await db.user.update({
        where: { id: adminUser.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });

      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const mfaRequired = isMfaRequiredForRole(adminUser.role);
    const mfaStatus = await getMfaStatus(adminUser.id);

    if (mfaRequired && mfaStatus.enabled) {
      if (!mfaCode) {
        return NextResponse.json({
          success: false,
          requireMfa: true,
          message: "MFA verification required",
          email: adminUser.email,
        });
      }

      const mfaResult = await verifyMfaLogin(adminUser.id, mfaCode);
      if (!mfaResult.success) {
        return NextResponse.json(
          { error: mfaResult.error || "Invalid MFA code", requireMfa: true },
          { status: 401 },
        );
      }
    }

    await db.user.update({
      where: { id: adminUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    try {
      await db.session.deleteMany({ where: { userId: adminUser.id } });
    } catch {}

    const session = await createSession(adminUser.id, adminUser.sport);

    const response = NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
        sport: adminUser.sport,
      },
      mfaStatus: {
        required: mfaRequired,
        enabled: mfaStatus.enabled,
        setup: mfaStatus.setup,
      },
    });

    response.cookies.set("admin_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export const POST = withRateLimit(adminLoginHandler, "LOGIN");
