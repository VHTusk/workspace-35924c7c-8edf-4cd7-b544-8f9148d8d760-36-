import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;
    const { id } = await params;

    // Find the session
    const session = await db.session.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify the session belongs to this org
    if (session.orgId !== org.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the session
    await db.session.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Session revoked" });
  } catch (error) {
    console.error("Error revoking org session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
