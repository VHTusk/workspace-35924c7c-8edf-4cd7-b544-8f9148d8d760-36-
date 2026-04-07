import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg, hashToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    // Get current session token to not revoke it
    const currentToken = request.cookies.get("session_token")?.value;
    const currentTokenHash = currentToken ? await hashToken(currentToken) : null;

    // Delete all sessions except current
    await db.session.deleteMany({
      where: {
        orgId: org.id,
        token: { not: currentTokenHash || "" },
      },
    });

    return NextResponse.json({ success: true, message: "All other sessions revoked" });
  } catch (error) {
    console.error("Error revoking org sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
