import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth || !auth.org) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    // Get active sessions for this org
    const sessions = await db.session.findMany({
      where: {
        orgId: org.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: "desc" },
      take: 10,
    });

    // Get current session token from cookie
    const currentToken = request.cookies.get("session_token")?.value;
    const currentTokenHash = currentToken 
      ? await import("@/lib/auth").then(m => m.hashToken(currentToken))
      : null;

    const sessionsWithCurrent = sessions.map(session => ({
      id: session.id,
      deviceName: session.operatorName || `${session.accountType} session`,
      deviceFingerprint: session.deviceFingerprint || "unknown",
      ipAddress: "Unavailable",
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt?.toISOString() || session.createdAt.toISOString(),
      isCurrent: currentTokenHash ? session.token === currentTokenHash : false,
    }));

    return NextResponse.json({
      hasPassword: !!org.password,
      phoneVerified: !!org.phone,
      emailVerified: !!org.email,
      sessions: sessionsWithCurrent,
    });
  } catch (error) {
    console.error("Error fetching org security data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
