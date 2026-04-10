import { NextRequest, NextResponse } from "next/server";
import { AuditAction, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { deleteSession, getAuthenticatedAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth) {
      const { user, session } = auth;
      await db.auditLog.create({
        data: {
          sport: session?.sport || user.sport || "CORNHOLE",
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: "OFFICE_SESSION",
          targetId: user.id,
          metadata: JSON.stringify({ action: "OFFICE_LOGOUT" }),
        },
      }).catch(() => {});

      const cookieStore = await cookies();
      const token = cookieStore.get("admin_session")?.value;
      if (token) {
        await deleteSession(token);
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Office logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
