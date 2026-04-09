import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearSessionCookie } from "@/lib/session-helpers";

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    // Delete all sessions for this org
    await db.session.deleteMany({
      where: { orgId: org.id },
    });

    // Delete subscription if exists
    await db.orgSubscription.deleteMany({
      where: { orgId: org.id },
    });

    // Delete the organization
    await db.organization.delete({
      where: { id: org.id },
    });

    // Create response and clear cookies
    const response = NextResponse.json({ success: true, message: "Organization deleted" });
    clearSessionCookie(response);

    return response;
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
